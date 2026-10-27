import { createHash } from "node:crypto";
import { and, asc, desc, eq, gt, lt } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import {
  organizations,
  organizationMemberships,
  organizationAuditEvents,
  pharmacyInventory,
  users,
  products,
} from "../drizzle/schema";

type DB = Awaited<ReturnType<typeof getDb>>;
type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
type Organization = typeof organizations.$inferSelect;
type Membership = typeof organizationMemberships.$inferSelect;
type ReviewStatus = Organization["status"];
type Permission =
  | "inventory_read"
  | "inventory_write"
  | "membership_read"
  | "audit_read";
const forbidden = (): never => {
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Pharmacy access unavailable",
  });
};
const conflict = (message: string): never => {
  throw new TRPCError({ code: "CONFLICT", message });
};
const invalid = (message: string): never => {
  throw new TRPCError({ code: "BAD_REQUEST", message });
};

async function lockOrganization(tx: Tx, id: number): Promise<Organization> {
  const [org] = await tx
    .select()
    .from(organizations)
    .where(eq(organizations.id, id))
    .for("update");
  if (!org || org.type !== "pharmacy") forbidden();
  return org;
}

/** All private operations, approval and revocation acquire this same parent lock.
 * Role/organization inputs and platform roles never substitute for membership.
 */
async function authorize(
  tx: Tx,
  organizationId: number,
  userId: number,
  permission: Permission
) {
  const org = await lockOrganization(tx, organizationId);
  if (org.status !== "approved") forbidden();
  const [member] = await tx
    .select()
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.organizationId, organizationId),
        eq(organizationMemberships.userId, userId)
      )
    )
    .for("update");
  if (!member || member.status !== "active") forbidden();
  if (permission === "inventory_write" && member.role === "viewer") forbidden();
  if (
    (permission === "membership_read" || permission === "audit_read") &&
    !["owner", "manager"].includes(member.role)
  )
    forbidden();
  return org;
}

async function audit(
  tx: Tx,
  event: typeof organizationAuditEvents.$inferInsert
) {
  await tx.insert(organizationAuditEvents).values(event);
}

export async function applyPharmacy(
  userId: number,
  input: { name: string; registrationNumber: string; countryCode: "JO" }
) {
  const db = await getDb();
  try {
    return await db.transaction(async tx => {
      const [created] = await tx.insert(organizations).values({
        ...input,
        type: "pharmacy",
        status: "pending",
        createdBy: userId,
      });
      await tx.insert(organizationMemberships).values({
        organizationId: created.insertId,
        userId,
        role: "owner",
        status: "pending",
      });
      await audit(tx, {
        organizationId: created.insertId,
        actorUserId: userId,
        action: "organization_applied",
        reason: "Pharmacy onboarding application",
        details: { status: "pending" },
      });
      return { id: created.insertId, status: "pending" as const };
    });
  } catch (error) {
    const code = error as { cause?: { code?: string }; code?: string };
    if (code.code === "ER_DUP_ENTRY" || code.cause?.code === "ER_DUP_ENTRY")
      conflict("Registration already submitted");
    throw error;
  }
}

export async function myPharmacies(
  userId: number,
  input: { afterId: number; limit: number }
) {
  return (await getDb())
    .select({
      organizationId: organizations.id,
      name: organizations.name,
      organizationStatus: organizations.status,
      countryCode: organizations.countryCode,
      role: organizationMemberships.role,
      membershipStatus: organizationMemberships.status,
    })
    .from(organizationMemberships)
    .innerJoin(
      organizations,
      eq(organizations.id, organizationMemberships.organizationId)
    )
    .where(
      and(
        eq(organizationMemberships.userId, userId),
        eq(organizations.type, "pharmacy"),
        gt(organizations.id, input.afterId)
      )
    )
    .orderBy(asc(organizations.id))
    .limit(input.limit);
}

// Governance functions are called only behind adminProcedure, not tenant routers.
export async function listPharmacies(input: {
  afterId: number;
  limit: number;
  status?: ReviewStatus;
}) {
  return (await getDb())
    .select()
    .from(organizations)
    .where(
      and(
        eq(organizations.type, "pharmacy"),
        gt(organizations.id, input.afterId),
        input.status ? eq(organizations.status, input.status) : undefined
      )
    )
    .orderBy(asc(organizations.id))
    .limit(input.limit);
}

export async function reviewPharmacy(
  actorUserId: number,
  input: { organizationId: number; status: ReviewStatus; reason: string }
) {
  return (await getDb()).transaction(async tx => {
    const org = await lockOrganization(tx, input.organizationId);
    if (org.createdBy === actorUserId && input.status === "approved")
      forbidden();
    const transitions: Record<ReviewStatus, readonly ReviewStatus[]> = {
      pending: ["approved", "rejected"],
      approved: ["suspended"],
      rejected: ["pending"],
      suspended: ["approved", "rejected"],
    };
    if (!transitions[org.status].includes(input.status))
      conflict("Invalid organization status transition");
    await tx
      .update(organizations)
      .set({ status: input.status })
      .where(eq(organizations.id, org.id));
    await audit(tx, {
      organizationId: org.id,
      actorUserId,
      action: "organization_reviewed",
      reason: input.reason,
      details: { before: org.status, after: input.status },
    });
    // Review never activates or reinstates any membership.
    return { status: input.status };
  });
}

export async function setPharmacyMembership(
  actorUserId: number,
  input: {
    organizationId: number;
    userId: number;
    role: Membership["role"];
    status: Membership["status"];
    reason: string;
  }
) {
  return (await getDb()).transaction(async tx => {
    const org = await lockOrganization(tx, input.organizationId);
    if ((input.role === "owner") !== (input.userId === org.createdBy))
      invalid("Owner transfer is unavailable");
    if (input.status === "active" && org.status !== "approved")
      conflict("Approve organization before activating membership");
    const [user] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, input.userId));
    if (!user)
      throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
    const predicate = and(
      eq(organizationMemberships.organizationId, org.id),
      eq(organizationMemberships.userId, input.userId)
    );
    const [before] = await tx
      .select()
      .from(organizationMemberships)
      .where(predicate)
      .for("update");
    if (before)
      await tx
        .update(organizationMemberships)
        .set({ role: input.role, status: input.status })
        .where(predicate);
    else
      await tx.insert(organizationMemberships).values({
        organizationId: org.id,
        userId: input.userId,
        role: input.role,
        status: input.status,
      });
    await audit(tx, {
      organizationId: org.id,
      actorUserId,
      action: "membership_updated",
      reason: input.reason,
      details: {
        userId: input.userId,
        before: before ? { role: before.role, status: before.status } : null,
        after: { role: input.role, status: input.status },
      },
    });
    return { success: true as const };
  });
}

export async function listPharmacyInventory(
  userId: number,
  input: { organizationId: number; afterProductId: number; limit: number }
) {
  return (await getDb()).transaction(async tx => {
    await authorize(tx, input.organizationId, userId, "inventory_read");
    return tx
      .select({
        productId: pharmacyInventory.productId,
        quantity: pharmacyInventory.quantity,
        version: pharmacyInventory.version,
        updatedAt: pharmacyInventory.updatedAt,
        productName: products.name,
        requiresPrescription: products.requiresPrescription,
      })
      .from(pharmacyInventory)
      .innerJoin(products, eq(products.id, pharmacyInventory.productId))
      .where(
        and(
          eq(pharmacyInventory.organizationId, input.organizationId),
          gt(pharmacyInventory.productId, input.afterProductId)
        )
      )
      .orderBy(asc(pharmacyInventory.productId))
      .limit(input.limit);
  });
}

export async function adjustPharmacyInventory(
  userId: number,
  input: {
    organizationId: number;
    productId: number;
    delta: number;
    expectedVersion: number;
    requestId: string;
    reason: string;
  }
) {
  return (await getDb()).transaction(async tx => {
    await authorize(tx, input.organizationId, userId, "inventory_write");
    const requestHash = createHash("sha256")
      .update(
        JSON.stringify([
          userId,
          input.productId,
          input.delta,
          input.expectedVersion,
          input.reason,
        ])
      )
      .digest("hex");
    const [previous] = await tx
      .select()
      .from(organizationAuditEvents)
      .where(
        and(
          eq(organizationAuditEvents.organizationId, input.organizationId),
          eq(organizationAuditEvents.requestId, input.requestId)
        )
      );
    if (previous) {
      if (
        previous.requestHash !== requestHash ||
        previous.action !== "stock_adjusted"
      )
        conflict("Request ID already used with different input");
      return previous.details as {
        productId: number;
        quantity: number;
        version: number;
        previousQuantity: number;
        delta: number;
      };
    }
    const predicate = and(
      eq(pharmacyInventory.organizationId, input.organizationId),
      eq(pharmacyInventory.productId, input.productId)
    );
    const [current] = await tx
      .select()
      .from(pharmacyInventory)
      .where(predicate)
      .for("update");
    if ((current?.version ?? 0) !== input.expectedVersion)
      conflict("Inventory version changed; refresh before retrying");
    const quantity = (current?.quantity ?? 0) + input.delta;
    if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > 1000000)
      invalid("Stock must remain between zero and 1000000");
    const [product] = await tx
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, input.productId));
    if (!product)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Catalog product not found",
      });
    const version = (current?.version ?? 0) + 1;
    const result = { productId: input.productId, quantity, version };
    if (current)
      await tx
        .update(pharmacyInventory)
        .set({ quantity, version })
        .where(predicate);
    else
      await tx.insert(pharmacyInventory).values({
        organizationId: input.organizationId,
        productId: input.productId,
        quantity,
        version,
      });
    await audit(tx, {
      organizationId: input.organizationId,
      actorUserId: userId,
      action: "stock_adjusted",
      reason: input.reason,
      requestId: input.requestId,
      requestHash,
      details: {
        ...result,
        previousQuantity: current?.quantity ?? 0,
        delta: input.delta,
      },
    });
    // Replay response must have the same shape, including audit context.
    return {
      ...result,
      previousQuantity: current?.quantity ?? 0,
      delta: input.delta,
    };
  });
}

export async function listPharmacyMembers(
  userId: number,
  input: { organizationId: number; afterUserId: number; limit: number }
) {
  return (await getDb()).transaction(async tx => {
    await authorize(tx, input.organizationId, userId, "membership_read");
    return tx
      .select({
        userId: organizationMemberships.userId,
        role: organizationMemberships.role,
        status: organizationMemberships.status,
      })
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.organizationId, input.organizationId),
          gt(organizationMemberships.userId, input.afterUserId)
        )
      )
      .orderBy(asc(organizationMemberships.userId))
      .limit(input.limit);
  });
}

export async function listPharmacyAudit(
  userId: number,
  input: { organizationId: number; beforeId?: number; limit: number }
) {
  return (await getDb()).transaction(async tx => {
    await authorize(tx, input.organizationId, userId, "audit_read");
    // requestHash is internal idempotency metadata, not part of the audit DTO.
    return tx
      .select({
        id: organizationAuditEvents.id,
        actorUserId: organizationAuditEvents.actorUserId,
        action: organizationAuditEvents.action,
        reason: organizationAuditEvents.reason,
        details: organizationAuditEvents.details,
        createdAt: organizationAuditEvents.createdAt,
      })
      .from(organizationAuditEvents)
      .where(
        and(
          eq(organizationAuditEvents.organizationId, input.organizationId),
          input.beforeId
            ? lt(organizationAuditEvents.id, input.beforeId)
            : undefined
        )
      )
      .orderBy(desc(organizationAuditEvents.id))
      .limit(input.limit);
  });
}
