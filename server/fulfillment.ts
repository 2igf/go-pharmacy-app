import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import type { z } from "zod";
import { getDb } from "./db";
import { authorizePharmacy } from "./pharmacy";
import {
  fulfillmentTransition,
  deliveryHandoff,
  fulfillmentRequest,
  fulfillmentAssignSchema,
  fulfillmentMutationSchema,
} from "../shared/fulfillment";
import {
  orders,
  orderItems,
  users,
  products,
  organizations,
  organizationMemberships,
  pharmacyOrderAssignments,
  pharmacyInventory,
  fulfillmentOrders,
  fulfillmentEvents,
  fulfillmentStockLines,
  notifications,
} from "../drizzle/schema";
type DB = Awaited<ReturnType<typeof getDb>>;
type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
type Order = typeof orders.$inferSelect;
type Aggregate = typeof fulfillmentOrders.$inferSelect;
type Request = z.infer<typeof fulfillmentRequest>;
type Assignment = z.infer<typeof fulfillmentAssignSchema>;
type Mutation = z.infer<typeof fulfillmentMutationSchema>;
type Result = { orderId: number; state: Aggregate["state"]; version: number };
const conflict = (message: string): never => {
  throw new TRPCError({ code: "CONFLICT", message });
};
const missing = (): never => {
  throw new TRPCError({
    code: "NOT_FOUND",
    message: "Assigned order not found",
  });
};
const forbidden = (): never => {
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Pharmacy access unavailable",
  });
};
export const fulfillmentEnabled = () =>
  process.env.SIMULATED_FULFILLMENT_ENABLED === "true";
function enabled() {
  if (!fulfillmentEnabled())
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Simulated fulfillment is disabled",
    });
}
async function transaction<T>(run: (tx: Tx) => Promise<T>) {
  try {
    return await (await getDb()).transaction(run);
  } catch (error) {
    const e = error as { code?: string; cause?: { code?: string } };
    if (e.code === "ER_DUP_ENTRY" || e.cause?.code === "ER_DUP_ENTRY")
      conflict("Request ID or order already used; refresh before retrying");
    throw error;
  }
}
/** Same lock order as legacy commerce; organization revocations/stock writes lock its parent. */
async function lockOrder(tx: Tx, orderId: number) {
  const [identity] = await tx
    .select({ userId: orders.userId })
    .from(orders)
    .where(eq(orders.id, orderId));
  if (!identity) missing();
  await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, identity.userId))
    .for("update");
  const [order] = await tx
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .for("update");
  if (!order) missing();
  return order;
}
function simulation(order: Order) {
  if (
    !order.isSimulated ||
    !order.orderNumber.startsWith("SIM-") ||
    order.paymentMethod !== "cash" ||
    order.paymentStatus !== "pending"
  )
    conflict("Only unpaid cash simulation orders are eligible");
}
async function aggregate(tx: Tx, orderId: number) {
  const [row] = await tx
    .select()
    .from(fulfillmentOrders)
    .where(eq(fulfillmentOrders.orderId, orderId))
    .for("update");
  if (!row) missing();
  return row;
}
async function assigned(tx: Tx, orderId: number) {
  const [row] = await tx
    .select()
    .from(pharmacyOrderAssignments)
    .where(eq(pharmacyOrderAssignments.orderId, orderId))
    .for("update");
  return row;
}
async function pharmacy(tx: Tx, organizationId: number) {
  const [org] = await tx
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .for("update");
  if (!org || org.type !== "pharmacy" || org.status !== "approved") forbidden();
  const members = await tx
    .select({ role: organizationMemberships.role })
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.organizationId, organizationId),
        eq(organizationMemberships.status, "active")
      )
    )
    .for("update");
  if (!members.some(m => m.role === "owner" || m.role === "manager"))
    conflict("Pharmacy needs active management");
  return org;
}
async function lines(tx: Tx, orderId: number) {
  const items = await tx
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .orderBy(asc(orderItems.productId));
  if (!items.length) conflict("Order has no items");
  const result: { productId: number; quantity: number }[] = [];
  for (const item of items) {
    const [p] = await tx
      .select()
      .from(products)
      .where(eq(products.id, item.productId))
      .for("update");
    if (
      !p ||
      !p.isActive ||
      p.requiresPrescription ||
      p.category === "medications" ||
      !/^DEMO\b/i.test(p.name) ||
      (p.expiryDate && p.expiryDate <= new Date()) ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 99
    )
      conflict("Only active fictional non-medication items are supported");
    if (result.some(x => x.productId === item.productId))
      conflict("Duplicate product lines require review");
    result.push({ productId: item.productId, quantity: item.quantity });
  }
  return result;
}
const hash = (
  actor: number,
  action: string,
  input: Request | Assignment | Mutation
) =>
  createHash("sha256")
    .update(
      JSON.stringify([
        actor,
        action,
        input.orderId,
        "organizationId" in input ? input.organizationId : null,
        "expectedVersion" in input ? input.expectedVersion : null,
        input.reason,
      ])
    )
    .digest("hex");
async function replay(tx: Tx, requestId: string, requestHash: string) {
  const [event] = await tx
    .select()
    .from(fulfillmentEvents)
    .where(eq(fulfillmentEvents.requestId, requestId))
    .for("update");
  if (event) {
    if (event.requestHash !== requestHash)
      conflict("Request ID already used with different input or actor");
    return (event.details as { result: Result }).result;
  }
}
async function record(
  tx: Tx,
  actorUserId: number,
  action: typeof fulfillmentEvents.$inferInsert.action,
  organizationId: number | null,
  reason: string,
  result: Result,
  extra: Record<string, unknown> = {},
  requestId?: string,
  requestHash?: string
) {
  await tx
    .insert(fulfillmentEvents)
    .values({
      actorUserId,
      action,
      organizationId,
      orderId: result.orderId,
      reason,
      requestId,
      requestHash,
      details: { result, ...extra },
    });
}
function version(current: Aggregate, expected: number) {
  if (current.version !== expected || current.version >= 2147483647)
    conflict("Fulfillment version changed; refresh and review");
}
async function notify(tx: Tx, order: Order, state: string) {
  await tx
    .insert(notifications)
    .values({
      userId: order.userId,
      type: "order_status",
      title: "تحديث تنفيذ طلب تجريبي",
      message: `${order.orderNumber}: ${state}`,
      relatedId: order.id,
    });
}

export async function enrollOrder(actor: number, input: Request) {
  enabled();
  return transaction(async tx => {
    const order = await lockOrder(tx, input.orderId);
    simulation(order);
    const requestHash = hash(actor, "enrolled", input);
    const previous = await replay(tx, input.requestId, requestHash);
    if (previous) return previous;
    if (order.status !== "pending")
      conflict("Enrollment requires a pending order");
    await lines(tx, order.id);
    if (await assigned(tx, order.id))
      conflict("An existing pharmacy relationship requires manual review");
    const [existing] = await tx
      .select()
      .from(fulfillmentOrders)
      .where(eq(fulfillmentOrders.orderId, order.id));
    if (existing) conflict("Order already enrolled");
    await tx.insert(fulfillmentOrders).values({ orderId: order.id });
    const result: Result = {
      orderId: order.id,
      state: "assignment_pending",
      version: 0,
    };
    await record(
      tx,
      actor,
      "enrolled",
      null,
      input.reason,
      result,
      {},
      input.requestId,
      requestHash
    );
    return result;
  });
}
export async function assignOrder(actor: number, input: Assignment) {
  enabled();
  return transaction(async tx => {
    const order = await lockOrder(tx, input.orderId);
    simulation(order);
    await pharmacy(tx, input.organizationId);
    const current = await aggregate(tx, order.id);
    const requestHash = hash(actor, "assigned", input);
    const previous = await replay(tx, input.requestId, requestHash);
    if (previous) return previous;
    version(current, input.expectedVersion);
    if (
      current.state !== "assignment_pending" ||
      order.status !== "pending" ||
      (await assigned(tx, order.id))
    )
      conflict("Order cannot be assigned again");
    const items = await lines(tx, order.id);
    const stock = [];
    for (const item of items) {
      const predicate = and(
        eq(pharmacyInventory.organizationId, input.organizationId),
        eq(pharmacyInventory.productId, item.productId)
      );
      const [inventory] = await tx
        .select()
        .from(pharmacyInventory)
        .where(predicate)
        .for("update");
      if (
        !inventory ||
        inventory.quantity < item.quantity ||
        inventory.version >= 2147483647
      )
        conflict("Pharmacy stock is unavailable");
      const quantity = inventory.quantity - item.quantity,
        newVersion = inventory.version + 1;
      await tx
        .update(pharmacyInventory)
        .set({ quantity, version: newVersion })
        .where(predicate);
      stock.push({
        productId: item.productId,
        delta: -item.quantity,
        quantity,
        version: newVersion,
      });
    }
    await tx
      .insert(pharmacyOrderAssignments)
      .values({
        orderId: order.id,
        organizationId: input.organizationId,
        assignedBy: actor,
      });
    await tx
      .insert(fulfillmentStockLines)
      .values(
        items.map(item => ({
          ...item,
          orderId: order.id,
          state: "held" as const,
        }))
      );
    const result: Result = {
      orderId: order.id,
      state: "assigned",
      version: current.version + 1,
    };
    await tx
      .update(fulfillmentOrders)
      .set({ state: result.state, version: result.version })
      .where(eq(fulfillmentOrders.orderId, order.id));
    await record(
      tx,
      actor,
      "assigned",
      input.organizationId,
      input.reason,
      result,
      { stock },
      input.requestId,
      requestHash
    );
    await notify(tx, order, result.state);
    return result;
  });
}
async function releaseStock(tx: Tx, orderId: number, organizationId: number) {
  const items = await tx
    .select()
    .from(fulfillmentStockLines)
    .where(eq(fulfillmentStockLines.orderId, orderId))
    .orderBy(asc(fulfillmentStockLines.productId))
    .for("update");
  const changes = [];
  for (const item of items) {
    if (item.state === "released") continue;
    const predicate = and(
      eq(pharmacyInventory.organizationId, organizationId),
      eq(pharmacyInventory.productId, item.productId)
    );
    const [stock] = await tx
      .select()
      .from(pharmacyInventory)
      .where(predicate)
      .for("update");
    if (
      !stock ||
      stock.quantity + item.quantity > 1000000 ||
      stock.version >= 2147483647
    )
      conflict("Stock return needs manual reconciliation; no changes applied");
    const quantity = stock.quantity + item.quantity,
      version = stock.version + 1;
    await tx
      .update(pharmacyInventory)
      .set({ quantity, version })
      .where(predicate);
    await tx
      .update(fulfillmentStockLines)
      .set({ state: "released" })
      .where(
        and(
          eq(fulfillmentStockLines.orderId, orderId),
          eq(fulfillmentStockLines.productId, item.productId)
        )
      );
    changes.push({
      productId: item.productId,
      delta: item.quantity,
      quantity,
      version,
    });
  }
  return changes;
}
export async function transitionOrder(actor: number, input: Mutation) {
  enabled();
  return transaction(async tx => {
    const order = await lockOrder(tx, input.orderId);
    await authorizePharmacy(tx, input.organizationId, actor, "order_write");
    const assignment = await assigned(tx, order.id);
    if (!assignment || assignment.organizationId !== input.organizationId)
      missing();
    simulation(order);
    const current = await aggregate(tx, order.id);
    const requestHash = hash(actor, input.action, input);
    const previous = await replay(tx, input.requestId, requestHash);
    if (previous) return previous;
    version(current, input.expectedVersion);
    const next = (() => {
      try {
        return fulfillmentTransition(current.state, input.action);
      } catch {
        return conflict("Invalid fulfillment transition");
      }
    })();
    const expectedOrderStatus =
      current.state === "assigned"
        ? "pending"
        : current.state === "accepted"
          ? "confirmed"
          : "processing";
    if (order.status !== expectedOrderStatus)
      conflict("Order status changed; refresh and review");
    // Revalidate fictional product safety before accepting/preparing/marking ready.
    if (input.action !== "reject") await lines(tx, order.id);
    const stock =
      input.action === "reject"
        ? await releaseStock(tx, order.id, input.organizationId)
        : [];
    if (input.action === "ready")
      await tx
        .update(fulfillmentStockLines)
        .set({ state: "consumed" })
        .where(
          and(
            eq(fulfillmentStockLines.orderId, order.id),
            eq(fulfillmentStockLines.state, "held")
          )
        );
    const result: Result = {
      orderId: order.id,
      state: next.state,
      version: current.version + 1,
    };
    await tx
      .update(fulfillmentOrders)
      .set({ state: result.state, version: result.version })
      .where(eq(fulfillmentOrders.orderId, order.id));
    await tx
      .update(orders)
      .set({ status: next.orderStatus })
      .where(eq(orders.id, order.id));
    await record(
      tx,
      actor,
      next.state,
      input.organizationId,
      input.reason,
      result,
      { previousState: current.state, stock },
      input.requestId,
      requestHash
    );
    await notify(tx, order, result.state);
    return result;
  });
}

const privateColumns = {
  orderId: orders.id,
  orderNumber: orders.orderNumber,
  orderStatus: orders.status,
  state: fulfillmentOrders.state,
  version: fulfillmentOrders.version,
  updatedAt: fulfillmentOrders.updatedAt,
};
export async function listAssignedOrders(
  actor: number,
  input: { organizationId: number; afterOrderId: number; limit: number }
) {
  enabled();
  return transaction(async tx => {
    await authorizePharmacy(tx, input.organizationId, actor, "order_read");
    return tx
      .select(privateColumns)
      .from(pharmacyOrderAssignments)
      .innerJoin(orders, eq(orders.id, pharmacyOrderAssignments.orderId))
      .innerJoin(fulfillmentOrders, eq(fulfillmentOrders.orderId, orders.id))
      .where(
        and(
          eq(pharmacyOrderAssignments.organizationId, input.organizationId),
          gt(orders.id, input.afterOrderId)
        )
      )
      .orderBy(asc(orders.id))
      .limit(input.limit);
  });
}
export async function assignedOrderDetail(
  actor: number,
  input: { organizationId: number; orderId: number }
) {
  enabled();
  return transaction(async tx => {
    await authorizePharmacy(tx, input.organizationId, actor, "order_read");
    const [order] = await tx
      .select(privateColumns)
      .from(pharmacyOrderAssignments)
      .innerJoin(orders, eq(orders.id, pharmacyOrderAssignments.orderId))
      .innerJoin(fulfillmentOrders, eq(fulfillmentOrders.orderId, orders.id))
      .where(
        and(
          eq(pharmacyOrderAssignments.organizationId, input.organizationId),
          eq(orders.id, input.orderId)
        )
      );
    if (!order) missing();
    const items = await tx
      .select({
        productId: fulfillmentStockLines.productId,
        quantity: fulfillmentStockLines.quantity,
        reservationState: fulfillmentStockLines.state,
        productName: products.name,
      })
      .from(fulfillmentStockLines)
      .innerJoin(products, eq(products.id, fulfillmentStockLines.productId))
      .where(eq(fulfillmentStockLines.orderId, order.orderId))
      .orderBy(asc(fulfillmentStockLines.productId));
    const events = await tx
      .select({
        id: fulfillmentEvents.id,
        action: fulfillmentEvents.action,
        actorUserId: fulfillmentEvents.actorUserId,
        reason: fulfillmentEvents.reason,
        createdAt: fulfillmentEvents.createdAt,
      })
      .from(fulfillmentEvents)
      .where(
        and(
          eq(fulfillmentEvents.orderId, order.orderId),
          eq(fulfillmentEvents.organizationId, input.organizationId)
        )
      )
      .orderBy(desc(fulfillmentEvents.id))
      .limit(50);
    return {
      ...order,
      items,
      events,
      simulated: true as const,
      handoff:
        order.orderStatus === "processing"
          ? deliveryHandoff({ ...order, organizationId: input.organizationId })
          : null,
    };
  });
}
export async function eligiblePharmacies(input: {
  orderId: number;
  afterId: number;
  limit: number;
}) {
  enabled();
  return transaction(async tx => {
    const order = await lockOrder(tx, input.orderId);
    simulation(order);
    const current = await aggregate(tx, order.id);
    if (current.state !== "assignment_pending" || order.status !== "pending")
      return [];
    const items = await lines(tx, order.id);
    const candidates = await tx
      .select({ organizationId: organizations.id, name: organizations.name })
      .from(organizations)
      .where(
        and(
          eq(organizations.type, "pharmacy"),
          eq(organizations.status, "approved"),
          gt(organizations.id, input.afterId)
        )
      )
      .orderBy(asc(organizations.id))
      .limit(input.limit);
    const eligible = [];
    for (const candidate of candidates) {
      const members = await tx
        .select({ role: organizationMemberships.role })
        .from(organizationMemberships)
        .where(
          and(
            eq(
              organizationMemberships.organizationId,
              candidate.organizationId
            ),
            eq(organizationMemberships.status, "active")
          )
        );
      if (!members.some(m => m.role === "owner" || m.role === "manager"))
        continue;
      const stock = await tx
        .select()
        .from(pharmacyInventory)
        .where(eq(pharmacyInventory.organizationId, candidate.organizationId));
      if (
        items.every(item =>
          stock.some(
            s =>
              s.productId === item.productId &&
              s.quantity >= item.quantity &&
              s.version < 2147483647
          )
        )
      )
        eligible.push(candidate);
    }
    return eligible;
  });
}
export async function adminFulfillmentOrders(input: {
  afterOrderId: number;
  limit: number;
}) {
  enabled();
  return (await getDb())
    .select({
      ...privateColumns,
      organizationId: pharmacyOrderAssignments.organizationId,
      pharmacyName: organizations.name,
    })
    .from(fulfillmentOrders)
    .innerJoin(orders, eq(orders.id, fulfillmentOrders.orderId))
    .leftJoin(
      pharmacyOrderAssignments,
      eq(pharmacyOrderAssignments.orderId, orders.id)
    )
    .leftJoin(
      organizations,
      eq(organizations.id, pharmacyOrderAssignments.organizationId)
    )
    .where(gt(orders.id, input.afterOrderId))
    .orderBy(asc(orders.id))
    .limit(input.limit);
}

/** Called inside legacy commerce's user/order lock. Never skip managed-order guards
 * simply because the feature was disabled; older Demo schemas remain supported. */
export async function guardLegacyFulfillment(
  tx: Tx,
  order: Order,
  status: Order["status"],
  actor?: number
) {
  const [schema] = await tx.execute(
    sql`SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='fulfillmentOrders'`
  );
  if (!(schema as unknown as { n: number }[])[0]?.n) return;
  const [current] = await tx
    .select()
    .from(fulfillmentOrders)
    .where(eq(fulfillmentOrders.orderId, order.id))
    .for("update");
  if (!current || order.status === status) return;
  if (!fulfillmentEnabled() || !actor)
    conflict("Managed order changes require enabled simulated fulfillment");
  if (
    status !== "cancelled" &&
    !(
      current.state === "ready" &&
      (status === "shipped" || status === "delivered")
    )
  )
    conflict("Use pharmacy fulfillment transitions for this order");
  const assignment = await assigned(tx, order.id);
  let stock: unknown[] = [];
  if (assignment) {
    await tx
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, assignment.organizationId))
      .for("update");
    if (status === "cancelled")
      stock = await releaseStock(tx, order.id, assignment.organizationId);
  }
  if (current.version >= 2147483647)
    conflict("Fulfillment version requires reconciliation");
  const result: Result = {
    orderId: order.id,
    state: status === "cancelled" ? "cancelled" : current.state,
    version: current.version + 1,
  };
  await tx
    .update(fulfillmentOrders)
    .set({ state: result.state, version: result.version })
    .where(eq(fulfillmentOrders.orderId, order.id));
  await record(
    tx,
    actor!,
    status as "cancelled" | "shipped" | "delivered",
    assignment?.organizationId ?? null,
    "Existing protected administrative simulation status transition",
    result,
    { stock, previousOrderStatus: order.status, orderStatus: status }
  );
}
/** Caller has already constrained orders by customer ownership/admin permission. */
export async function withCustomerFulfillment<T extends { id: number }>(
  rows: T[]
) {
  const summaries =
    fulfillmentEnabled() && rows.length
      ? await (
          await getDb()
        )
          .select({
            orderId: fulfillmentOrders.orderId,
            state: fulfillmentOrders.state,
            updatedAt: fulfillmentOrders.updatedAt,
            pharmacyName: organizations.name,
          })
          .from(fulfillmentOrders)
          .leftJoin(
            pharmacyOrderAssignments,
            eq(pharmacyOrderAssignments.orderId, fulfillmentOrders.orderId)
          )
          .leftJoin(
            organizations,
            eq(organizations.id, pharmacyOrderAssignments.organizationId)
          )
          .where(
            inArray(
              fulfillmentOrders.orderId,
              rows.map(r => r.id)
            )
          )
      : [];
  return rows.map(row => {
    const summary = summaries.find(s => s.orderId === row.id);
    return {
      ...row,
      fulfillment: summary
        ? {
            state: summary.state,
            pharmacyName: summary.pharmacyName,
            updatedAt: summary.updatedAt,
            simulated: true as const,
          }
        : null,
    };
  });
}
