import { randomUUID, createHash } from "node:crypto";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  cartItems,
  products,
  orders,
  orderItems,
  users,
  userAddresses,
  notifications,
} from "../drizzle/schema";
import { getDb } from "./db";
import { guardLegacyFulfillment, withCustomerFulfillment } from "./fulfillment";
import {
  quoteLines,
  assertTransition,
  type OrderStatus,
} from "./commerce-rules";

function unavailable(message: string): never {
  throw new TRPCError({ code: "CONFLICT", message });
}
function notFound(): never {
  throw new TRPCError({ code: "NOT_FOUND", message: "Record not found" });
}
export function cartFingerprint(
  lines: { productId: number; quantity: number; price: string }[]
) {
  return createHash("sha256")
    .update(
      JSON.stringify(
        [...lines]
          .sort((a, b) => a.productId - b.productId)
          .map(item => [item.productId, item.quantity, item.price])
      )
    )
    .digest("hex");
}
type DB = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
// Every cart write and checkout locks the user first. Product locks are acquired in ID order.
async function lockUser(tx: Tx, userId: number) {
  const [user] = await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .for("update");
  if (!user) notFound();
}
function assertAvailable(
  product: typeof products.$inferSelect | undefined,
  quantity: number
) {
  if (!product || !product.isActive) unavailable("Product is unavailable");
  if (product.requiresPrescription)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Prescription products are disabled in Beta",
    });
  if (product.expiryDate && product.expiryDate <= new Date())
    unavailable("Product has expired");
  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 99 ||
    product.stock < quantity
  )
    unavailable("Insufficient stock or invalid quantity");
}
export async function changeCart(
  userId: number,
  input:
    | { productId: number; quantity: number }
    | { id: number; quantity?: number }
    | { clear: true }
) {
  const db = await getDb();
  return db.transaction(async tx => {
    await lockUser(tx, userId);
    if ("clear" in input) {
      await tx.delete(cartItems).where(eq(cartItems.userId, userId));
      return { success: true };
    }
    if ("productId" in input) {
      const [product] = await tx
        .select()
        .from(products)
        .where(eq(products.id, input.productId))
        .for("update");
      const [item] = await tx
        .select()
        .from(cartItems)
        .where(
          and(
            eq(cartItems.userId, userId),
            eq(cartItems.productId, input.productId)
          )
        );
      const quantity = (item?.quantity ?? 0) + input.quantity;
      assertAvailable(product, quantity);
      if (item)
        await tx
          .update(cartItems)
          .set({ quantity })
          .where(and(eq(cartItems.id, item.id), eq(cartItems.userId, userId)));
      else
        await tx
          .insert(cartItems)
          .values({ userId, productId: input.productId, quantity });
    } else {
      const [item] = await tx
        .select()
        .from(cartItems)
        .where(and(eq(cartItems.id, input.id), eq(cartItems.userId, userId)));
      if (!item) notFound();
      if (input.quantity === undefined)
        await tx
          .delete(cartItems)
          .where(and(eq(cartItems.id, input.id), eq(cartItems.userId, userId)));
      else {
        const [product] = await tx
          .select()
          .from(products)
          .where(eq(products.id, item.productId))
          .for("update");
        assertAvailable(product, input.quantity);
        await tx
          .update(cartItems)
          .set({ quantity: input.quantity })
          .where(and(eq(cartItems.id, item.id), eq(cartItems.userId, userId)));
      }
    }
    return { success: true };
  });
}
export async function cartQuote(userId: number) {
  const db = await getDb();
  const rows = await db
    .select({ item: cartItems, product: products })
    .from(cartItems)
    .innerJoin(products, eq(products.id, cartItems.productId))
    .where(eq(cartItems.userId, userId))
    .orderBy(asc(products.id));
  const items = rows.map(({ item, product }) => ({
    ...item,
    name: product.name,
    price: product.price,
    stock: product.stock,
    available:
      product.isActive &&
      !product.requiresPrescription &&
      (!product.expiryDate || product.expiryDate > new Date()) &&
      product.stock >= item.quantity,
    lineTotal: quoteLines([{ price: product.price, quantity: item.quantity }])
      .total,
  }));
  return {
    items,
    ...quoteLines(items),
    fingerprint: cartFingerprint(items),
    simulated: true as const,
  };
}
export type CheckoutInput = {
  addressId: number;
  idempotencyKey: string;
  contactName: string;
  contactPhone: string;
  expectedTotal: string;
  expectedCartHash: string;
  paymentMethod: "cash";
  simulationAcknowledged: true;
};
export async function checkout(userId: number, input: CheckoutInput) {
  const db = await getDb();
  const requestHash = createHash("sha256")
    .update(
      JSON.stringify([
        input.addressId,
        input.contactName,
        input.contactPhone,
        input.expectedTotal,
        input.expectedCartHash,
        input.paymentMethod,
      ])
    )
    .digest("hex");
  return db.transaction(async tx => {
    await lockUser(tx, userId);
    const [existing] = await tx
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.userId, userId),
          eq(orders.idempotencyKey, input.idempotencyKey)
        )
      );
    if (existing) {
      if (existing.requestHash !== requestHash)
        unavailable("Idempotency key was used for different checkout details");
      return { orderId: existing.id, orderNumber: existing.orderNumber };
    }
    const [address] = await tx
      .select()
      .from(userAddresses)
      .where(
        and(
          eq(userAddresses.id, input.addressId),
          eq(userAddresses.userId, userId)
        )
      )
      .for("update");
    if (!address) notFound();
    const cart = await tx
      .select()
      .from(cartItems)
      .where(eq(cartItems.userId, userId))
      .orderBy(asc(cartItems.productId))
      .for("update");
    if (!cart.length) unavailable("Cart is empty");
    const lines: {
      productId: number;
      productName: string;
      quantity: number;
      price: string;
    }[] = [];
    for (const item of cart) {
      const [product] = await tx
        .select()
        .from(products)
        .where(eq(products.id, item.productId))
        .for("update");
      assertAvailable(product, item.quantity);
      lines.push({
        productId: product.id,
        productName: product.name,
        price: product.price,
        quantity: item.quantity,
      });
      const [result] = await tx
        .update(products)
        .set({ stock: sql`${products.stock} - ${item.quantity}` })
        .where(
          and(eq(products.id, product.id), gte(products.stock, item.quantity))
        );
      if (result.affectedRows !== 1)
        unavailable("Stock changed; review your cart");
    }
    const quote = quoteLines(lines);
    if (cartFingerprint(lines) !== input.expectedCartHash)
      unavailable("Cart changed; review the contents before submitting again");
    if (quote.total !== input.expectedTotal)
      unavailable("Prices changed; review your cart before submitting again");
    const orderNumber = `SIM-${randomUUID()}`;
    const [result] = await tx
      .insert(orders)
      .values({
        userId,
        orderNumber,
        idempotencyKey: input.idempotencyKey,
        requestHash,
        totalAmount: quote.total,
        status: "pending",
        deliveryAddress: address.address,
        paymentMethod: "cash",
        paymentStatus: "pending",
        isSimulated: true,
        contactName: input.contactName,
        contactPhone: input.contactPhone,
        notes: "BETA SIMULATION — NO PAYMENT OR DISPENSING",
      });
    await tx
      .insert(orderItems)
      .values(lines.map(line => ({ ...line, orderId: result.insertId })));
    await tx.delete(cartItems).where(eq(cartItems.userId, userId));
    await tx
      .insert(notifications)
      .values({
        userId,
        type: "order_status",
        title: "طلب تجريبي جديد",
        message: `${orderNumber}: pending`,
        relatedId: result.insertId,
      });
    return { orderId: result.insertId, orderNumber };
  });
}
export async function orderDetail(id: number, userId: number, admin = false) {
  const db = await getDb();
  const [order] = await db
    .select()
    .from(orders)
    .where(
      admin
        ? eq(orders.id, id)
        : and(eq(orders.id, id), eq(orders.userId, userId))
    );
  if (!order) notFound();
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, id));
  const [result] = await withCustomerFulfillment([{ ...order, items }]);
  return result;
}
export async function updateOrderStatus(id: number, status: OrderStatus, actorUserId?: number) {
  const db = await getDb();
  const [summary] = await db
    .select({ userId: orders.userId })
    .from(orders)
    .where(eq(orders.id, id));
  if (!summary) notFound();
  return db.transaction(async tx => {
    await lockUser(tx, summary.userId);
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, id))
      .for("update");
    if (!order || !order.isSimulated)
      unavailable("Only Beta simulation orders can be managed");
    assertTransition(order.status, status);
    if (order.status === status) return { success: true };
    await guardLegacyFulfillment(tx, order, status, actorUserId);
    if (status === "cancelled") {
      const lines = await tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, id))
        .orderBy(asc(orderItems.productId));
      for (const line of lines)
        await tx
          .update(products)
          .set({ stock: sql`${products.stock} + ${line.quantity}` })
          .where(eq(products.id, line.productId));
    }
    await tx
      .update(orders)
      .set({
        status,
        actualDelivery: status === "delivered" ? new Date() : null,
      })
      .where(eq(orders.id, id));
    await tx
      .insert(notifications)
      .values({
        userId: order.userId,
        type: "order_status",
        title: "تحديث طلب تجريبي",
        message: `${order.orderNumber}: ${status}`,
        relatedId: id,
      });
    return { success: true };
  });
}
