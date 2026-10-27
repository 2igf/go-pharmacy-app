import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { appRouter } from "./routers";
import { getDb } from "./db";
import {
  users,
  products,
  pharmacyInventory,
  organizationAuditEvents,
  organizationMemberships,
  organizations,
  officialMedicinePrices,
} from "../drizzle/schema";
import { resetFixtures, testContext, closeDb } from "./test-support";

beforeEach(async () => {
  if (process.env.TEST_DATABASE_URL) await resetFixtures();
});
afterAll(closeDb);
const application = (suffix: string) => ({
  name: `Fictional Pharmacy ${suffix}`,
  registrationNumber: `TEST-${suffix}`,
  countryCode: "JO" as const,
});
const adjustment = (
  organizationId: number,
  delta = 5,
  expectedVersion = 0
) => ({
  organizationId,
  productId: 1,
  delta,
  expectedVersion,
  requestId: randomUUID(),
  reason: "Fictional physical stock count",
});
async function fixtures() {
  const db = await getDb();
  await db.insert(users).values([
    { id: 4, openId: "staff-a", role: "pharmacist" },
    { id: 5, openId: "staff-b", role: "pharmacist" },
  ]);
  const ownerA = appRouter.createCaller(await testContext(1));
  const ownerB = appRouter.createCaller(await testContext(2));
  const admin = appRouter.createCaller(await testContext(3));
  const a = await ownerA.pharmacies.submitApplication(application("A"));
  const b = await ownerB.pharmacies.submitApplication(application("B"));
  for (const id of [a.id, b.id])
    await admin.pharmacies.administration.review({
      organizationId: id,
      status: "approved",
      reason: "Fictional review approved",
    });
  for (const [organizationId, userId, role] of [
    [a.id, 1, "owner"],
    [b.id, 2, "owner"],
    [a.id, 4, "inventory_staff"],
    [b.id, 5, "inventory_staff"],
  ] as const)
    await admin.pharmacies.administration.setMembership({
      organizationId,
      userId,
      role,
      status: "active",
      reason: "Fictional staff approved",
    });
  return {
    db,
    a: a.id,
    b: b.id,
    ownerA,
    ownerB,
    admin,
    staffA: appRouter.createCaller(await testContext(4)),
    staffB: appRouter.createCaller(await testContext(5)),
  };
}

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "real MySQL pharmacy tenancy",
  () => {
    it("rejects anonymous private operations before accessing tenant data", async () => {
      const context = await testContext(1);
      const anonymous = appRouter.createCaller({ ...context, user: null });
      await expect(anonymous.pharmacies.mine({})).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
      await expect(
        anonymous.pharmacies.inventory.list({ organizationId: 1 })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await expect(
        anonymous.pharmacies.inventory.adjust(adjustment(1))
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("denies a waiting stock write after a concurrent organization suspension commits", async () => {
      const f = await fixtures();
      let outcome: Promise<{ error?: { code?: string } }> = Promise.resolve({});
      await f.db.transaction(async tx => {
        await tx
          .select()
          .from(organizations)
          .where(eq(organizations.id, f.a))
          .for("update");
        await tx
          .update(organizations)
          .set({ status: "suspended" })
          .where(eq(organizations.id, f.a));
        outcome = f.staffA.pharmacies.inventory.adjust(adjustment(f.a)).then(
          () => ({}),
          error => ({ error })
        );
        await new Promise(resolve => setTimeout(resolve, 25));
      });
      expect((await outcome).error?.code).toBe("FORBIDDEN");
      expect(await f.db.select().from(pharmacyInventory)).toEqual([]);
    });
    it("requires separate organization approval and membership activation", async () => {
      const owner = appRouter.createCaller(await testContext(1));
      const admin = appRouter.createCaller(await testContext(3));
      const org = await owner.pharmacies.submitApplication(
        application("pending")
      );
      expect((await owner.pharmacies.mine({}))[0]).toMatchObject({
        organizationId: org.id,
        organizationStatus: "pending",
        membershipStatus: "pending",
        role: "owner",
      });
      await expect(
        owner.pharmacies.inventory.list({ organizationId: org.id })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        admin.pharmacies.administration.setMembership({
          organizationId: org.id,
          userId: 1,
          role: "owner",
          status: "active",
          reason: "Too early activation",
        })
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await admin.pharmacies.administration.review({
        organizationId: org.id,
        status: "approved",
        reason: "Fictional verified review",
      });
      await expect(
        owner.pharmacies.inventory.adjust(adjustment(org.id))
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await admin.pharmacies.administration.setMembership({
        organizationId: org.id,
        userId: 1,
        role: "owner",
        status: "active",
        reason: "Explicit membership activation",
      });
      expect(
        await owner.pharmacies.inventory.list({ organizationId: org.id })
      ).toEqual([]);
    });

    it("isolates two pharmacies, never changes central stock/price, and denies cross-tenant/private reads and writes", async () => {
      const f = await fixtures();
      await f.staffA.pharmacies.inventory.adjust(adjustment(f.a, 7));
      await f.staffB.pharmacies.inventory.adjust(adjustment(f.b, 2));
      expect(
        (await f.staffA.pharmacies.inventory.list({ organizationId: f.a }))[0]
      ).toMatchObject({ quantity: 7, version: 1, productId: 1 });
      expect(
        (await f.staffB.pharmacies.inventory.list({ organizationId: f.b }))[0]
      ).toMatchObject({ quantity: 2 });
      const auditA = (
        await f.ownerA.pharmacies.audit.list({ organizationId: f.a })
      ).filter(event => event.action === "stock_adjusted");
      const auditB = (
        await f.ownerB.pharmacies.audit.list({ organizationId: f.b })
      ).filter(event => event.action === "stock_adjusted");
      expect(auditA).toHaveLength(1);
      expect(auditB).toHaveLength(1);
      expect(auditA[0].details).toMatchObject({ quantity: 7 });
      expect(auditB[0].details).toMatchObject({ quantity: 2 });
      expect(auditA[0]).not.toHaveProperty("requestHash");
      for (const id of [f.b, 999999]) {
        await expect(
          f.staffA.pharmacies.inventory.list({ organizationId: id })
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
        await expect(
          f.staffA.pharmacies.inventory.adjust(adjustment(id))
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
        await expect(
          f.ownerA.pharmacies.members.list({ organizationId: id })
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
        await expect(
          f.ownerA.pharmacies.audit.list({ organizationId: id })
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
      }
      expect(
        (await f.db.select().from(products).where(eq(products.id, 1)))[0]
      ).toMatchObject({ stock: 3, price: "0.10" });
      expect(await f.db.select().from(officialMedicinePrices)).toEqual([]);
      expect(
        (await f.ownerA.pharmacies.members.list({ organizationId: f.a }))
          .map(m => m.userId)
          .sort()
      ).toEqual([1, 4]);
    });

    it("denies admin operational access without membership and ignores spoofed role/organization headers", async () => {
      const f = await fixtures();
      await expect(
        f.admin.pharmacies.inventory.adjust(adjustment(f.a))
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        f.admin.pharmacies.members.list({ organizationId: f.a })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        f.admin.pharmacies.audit.list({ organizationId: f.a })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        f.admin.pharmacies.inventory.list({ organizationId: f.a })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      const ctx = await testContext(4);
      ctx.req.headers = {
        "x-go-pharmacy-role": "admin",
        "x-organization-id": String(f.b),
      };
      const spoof = appRouter.createCaller(ctx);
      await expect(
        spoof.pharmacies.inventory.adjust(adjustment(f.b))
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        spoof.pharmacies.administration.list({})
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        spoof.pharmacies.administration.setMembership({
          organizationId: f.b,
          userId: 4,
          role: "owner",
          status: "active",
          reason: "Attempted privilege escalation",
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        spoof.pharmacies.inventory.adjust({
          ...adjustment(f.a),
          role: "owner",
        } as never)
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("enforces viewer/staff/manager permissions without changing platform roles", async () => {
      const f = await fixtures();
      await f.admin.pharmacies.administration.setMembership({
        organizationId: f.a,
        userId: 4,
        role: "viewer",
        status: "active",
        reason: "Fictional read-only role",
      });
      expect(
        await f.staffA.pharmacies.inventory.list({ organizationId: f.a })
      ).toEqual([]);
      await expect(
        f.staffA.pharmacies.inventory.adjust(adjustment(f.a))
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        f.staffA.pharmacies.members.list({ organizationId: f.a })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await f.admin.pharmacies.administration.setMembership({
        organizationId: f.a,
        userId: 4,
        role: "manager",
        status: "active",
        reason: "Fictional manager appointment",
      });
      expect(
        await f.staffA.pharmacies.members.list({ organizationId: f.a })
      ).toHaveLength(2);
      await f.staffA.pharmacies.inventory.adjust(adjustment(f.a));
      expect(
        (await f.db.select().from(users).where(eq(users.id, 4)))[0].role
      ).toBe("pharmacist");
    });

    it("revokes access on membership/org suspension and does not silently reactivate suspended members", async () => {
      const f = await fixtures();
      const request = adjustment(f.a);
      await f.staffA.pharmacies.inventory.adjust(request);
      await f.admin.pharmacies.administration.setMembership({
        organizationId: f.a,
        userId: 4,
        role: "inventory_staff",
        status: "suspended",
        reason: "Fictional staff suspension",
      });
      await expect(
        f.staffA.pharmacies.inventory.adjust(request)
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await f.admin.pharmacies.administration.review({
        organizationId: f.a,
        status: "suspended",
        reason: "Fictional organization suspension",
      });
      await expect(
        f.ownerA.pharmacies.inventory.list({ organizationId: f.a })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await f.admin.pharmacies.administration.review({
        organizationId: f.a,
        status: "approved",
        reason: "Fictional reinstatement",
      });
      await expect(
        f.staffA.pharmacies.inventory.list({ organizationId: f.a })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(
        (await f.ownerA.pharmacies.inventory.list({ organizationId: f.a }))[0]
          .quantity
      ).toBe(5);
    });

    it("handles rejection/reopening and blocks invalid transitions, owner reassignment and self approval", async () => {
      const admin = appRouter.createCaller(await testContext(3));
      const owner = appRouter.createCaller(await testContext(1));
      const org = await owner.pharmacies.submitApplication(
        application("reject")
      );
      await admin.pharmacies.administration.review({
        organizationId: org.id,
        status: "rejected",
        reason: "Fictional rejection reason",
      });
      await expect(
        admin.pharmacies.administration.review({
          organizationId: org.id,
          status: "approved",
          reason: "Invalid direct approval",
        })
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await admin.pharmacies.administration.review({
        organizationId: org.id,
        status: "pending",
        reason: "Reopened for review",
      });
      await expect(
        admin.pharmacies.administration.setMembership({
          organizationId: org.id,
          userId: 2,
          role: "owner",
          status: "pending",
          reason: "Invalid owner transfer",
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      const own = await admin.pharmacies.submitApplication(
        application("admin-own")
      );
      await expect(
        admin.pharmacies.administration.review({
          organizationId: own.id,
          status: "approved",
          reason: "Attempt self approval",
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        owner.pharmacies.submitApplication(application("reject"))
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });

    it("validates deltas, prevents negative/overflow stock and leaves no successful audit on rejected updates", async () => {
      const f = await fixtures();
      for (const delta of [0, 1.5, 100001])
        await expect(
          f.staffA.pharmacies.inventory.adjust(adjustment(f.a, delta))
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(
        f.staffA.pharmacies.inventory.adjust(adjustment(f.a, -1))
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(
        f.staffA.pharmacies.inventory.adjust({
          ...adjustment(f.a),
          productId: 99999,
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await f.db.insert(pharmacyInventory).values({
        organizationId: f.a,
        productId: 1,
        quantity: 1000000,
        version: 1,
      });
      await expect(
        f.staffA.pharmacies.inventory.adjust(adjustment(f.a, 1, 1))
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(
        (await f.ownerA.pharmacies.audit.list({ organizationId: f.a })).filter(
          a => a.action === "stock_adjusted"
        )
      ).toHaveLength(0);
    });

    it("serializes concurrent updates with optimistic versions and atomically audits only one winner", async () => {
      const f = await fixtures();
      await f.staffA.pharmacies.inventory.adjust(adjustment(f.a, 5));
      const results = await Promise.allSettled([
        f.staffA.pharmacies.inventory.adjust(adjustment(f.a, -4, 1)),
        f.staffA.pharmacies.inventory.adjust(adjustment(f.a, -4, 1)),
      ]);
      expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter(r => r.status === "rejected")).toHaveLength(1);
      expect(
        (await f.staffA.pharmacies.inventory.list({ organizationId: f.a }))[0]
      ).toMatchObject({ quantity: 1, version: 2 });
      expect(
        (await f.ownerA.pharmacies.audit.list({ organizationId: f.a })).filter(
          a => a.action === "stock_adjusted"
        )
      ).toHaveLength(2);
    });

    it("replays duplicate requests once and rejects changed request payloads", async () => {
      const f = await fixtures();
      const request = adjustment(f.a);
      const [a, b] = await Promise.all([
        f.staffA.pharmacies.inventory.adjust(request),
        f.staffA.pharmacies.inventory.adjust(request),
      ]);
      expect(a).toEqual(b);
      await expect(
        f.ownerA.pharmacies.inventory.adjust(request)
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(
        f.staffA.pharmacies.inventory.adjust({ ...request, delta: 6 })
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(
        (await f.ownerA.pharmacies.audit.list({ organizationId: f.a })).filter(
          a => a.action === "stock_adjusted"
        )
      ).toHaveLength(1);
    });

    it("rolls back inventory when audit insertion fails", async () => {
      const f = await fixtures();
      // Test-only CHECK forces a real audit failure without SUPER privileges or
      // weakening MySQL binary-log protections; confined to the guarded test DB.
      await f.db.execute(
        sql`ALTER TABLE organizationAuditEvents ADD CONSTRAINT test_reject_stock_audit CHECK (action <> 'stock_adjusted')`
      );
      try {
        await expect(
          f.staffA.pharmacies.inventory.adjust(adjustment(f.a))
        ).rejects.toThrow();
        expect(
          await f.staffA.pharmacies.inventory.list({ organizationId: f.a })
        ).toEqual([]);
      } finally {
        await f.db.execute(
          sql`ALTER TABLE organizationAuditEvents DROP CHECK test_reject_stock_audit`
        );
      }
    });

    it("database constraints reject orphan/duplicate membership and invalid quantities", async () => {
      const f = await fixtures();
      await expect(
        f.db.insert(organizationMemberships).values({
          organizationId: f.a,
          userId: 4,
          role: "viewer",
          status: "active",
        })
      ).rejects.toThrow();
      await expect(
        f.db
          .insert(pharmacyInventory)
          .values({ organizationId: f.a, productId: 99999, quantity: 1 })
      ).rejects.toThrow();
      await expect(
        f.db
          .insert(pharmacyInventory)
          .values({ organizationId: f.a, productId: 1, quantity: -1 })
      ).rejects.toThrow();
      expect(await f.db.select().from(organizations)).toHaveLength(2);
    });
  }
);
