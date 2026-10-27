import {
  beforeEach,
  afterEach,
  afterAll,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { resetFixtures, testContext, closeDb } from "./test-support";
import {
  users,
  products,
  orders,
  orderItems,
  organizations,
  organizationMemberships,
  pharmacyInventory,
  pharmacyOrderAssignments,
  fulfillmentOrders,
  fulfillmentEvents,
} from "../drizzle/schema";
beforeEach(async () => {
  if (process.env.TEST_DATABASE_URL) await resetFixtures();
  vi.stubEnv("SIMULATED_FULFILLMENT_ENABLED", "true");
});
afterEach(() => vi.unstubAllEnvs());
afterAll(closeDb);
const request = () => ({
  requestId: randomUUID(),
  reason: "Fictional fulfillment test",
});
async function fixtures() {
  const db = await getDb();
  await db.insert(users).values([
    { id: 4, openId: "fulfill:staff", role: "pharmacist" },
    { id: 5, openId: "fulfill:viewer" },
    { id: 6, openId: "fulfill:driver", role: "user" },
  ]);
  const customer = appRouter.createCaller(await testContext(1)),
    other = appRouter.createCaller(await testContext(2)),
    admin = appRouter.createCaller(await testContext(3)),
    staff = appRouter.createCaller(await testContext(4)),
    viewer = appRouter.createCaller(await testContext(5)),
    driver = appRouter.createCaller(await testContext(6));
  const a = await customer.pharmacies.submitApplication({
      name: "DEMO Fulfillment A",
      registrationNumber: "FULFILL-A",
      countryCode: "JO",
    }),
    b = await other.pharmacies.submitApplication({
      name: "DEMO Fulfillment B",
      registrationNumber: "FULFILL-B",
      countryCode: "JO",
    });
  for (const org of [a, b]) {
    await admin.pharmacies.administration.review({
      organizationId: org.id,
      status: "approved",
      reason: "Fictional review",
    });
    await admin.pharmacies.administration.setMembership({
      organizationId: org.id,
      userId: org === a ? 1 : 2,
      role: "owner",
      status: "active",
      reason: "Fictional approval",
    });
    await (org === a ? customer : other).pharmacies.inventory.adjust({
      organizationId: org.id,
      productId: 1,
      delta: 10,
      expectedVersion: 0,
      ...request(),
    });
  }
  for (const [userId, role] of [
    [4, "inventory_staff"],
    [5, "viewer"],
  ] as const)
    await admin.pharmacies.administration.setMembership({
      organizationId: a.id,
      userId,
      role,
      status: "active",
      reason: "Fictional membership",
    });
  const create = async () => {
    await customer.cart.add({ productId: 1, quantity: 1 });
    const q = await customer.cart.quote();
    return customer.orders.create({
      addressId: 1,
      idempotencyKey: randomUUID(),
      contactName: "Fictional Customer",
      contactPhone: "00000000",
      expectedTotal: q.total,
      expectedCartHash: q.fingerprint,
      paymentMethod: "cash",
      simulationAcknowledged: true,
    });
  };
  const order = await create();
  const enroll = () =>
    admin.fulfillment.enroll({ orderId: order.orderId, ...request() });
  const assign = (org = a.id, expectedVersion = 0) =>
    admin.fulfillment.assign({
      orderId: order.orderId,
      organizationId: org,
      expectedVersion,
      ...request(),
    });
  const move = (
    action: "accept" | "reject" | "prepare" | "ready",
    expectedVersion: number
  ) =>
    staff.fulfillment.transition({
      orderId: order.orderId,
      organizationId: a.id,
      expectedVersion,
      action,
      ...request(),
    });
  return {
    db,
    customer,
    other,
    admin,
    staff,
    viewer,
    driver,
    a: a.id,
    b: b.id,
    orderId: order.orderId,
    create,
    enroll,
    assign,
    move,
  };
}
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "real MySQL simulated pharmacy fulfillment",
  () => {
    it("rechecks active management after waiting for concurrent membership suspension", async () => {
      const f = await fixtures();
      await f.enroll();
      let outcome: Promise<{ error?: { code?: string } }> = Promise.resolve({});
      await f.db.transaction(async tx => {
        await tx
          .select()
          .from(organizations)
          .where(eq(organizations.id, f.a))
          .for("update");
        await tx
          .update(organizationMemberships)
          .set({ status: "suspended" })
          .where(
            and(
              eq(organizationMemberships.organizationId, f.a),
              eq(organizationMemberships.userId, 1)
            )
          );
        outcome = f.assign().then(
          () => ({}),
          error => ({ error })
        );
        await new Promise(resolve => setTimeout(resolve, 40));
      });
      expect((await outcome).error?.code).toBe("CONFLICT");
      expect(await f.db.select().from(pharmacyOrderAssignments)).toHaveLength(
        0
      );
    });
    it("rolls back cancellation if stock return would overflow, then recovers without losing units", async () => {
      const f = await fixtures();
      await f.enroll();
      await f.assign();
      let remaining = 999991,
        stockVersion = 2;
      while (remaining > 0) {
        const delta = Math.min(100000, remaining);
        await f.customer.pharmacies.inventory.adjust({
          organizationId: f.a,
          productId: 1,
          delta,
          expectedVersion: stockVersion++,
          ...request(),
        });
        remaining -= delta;
      }
      await expect(
        f.admin.admin.updateStatus({ id: f.orderId, status: "cancelled" })
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect((await f.customer.orders.byId({ id: f.orderId })).status).toBe(
        "pending"
      );
      expect(
        (await f.db.select().from(products).where(eq(products.id, 1)))[0].stock
      ).toBe(2);
      await f.customer.pharmacies.inventory.adjust({
        organizationId: f.a,
        productId: 1,
        delta: -1,
        expectedVersion: stockVersion,
        ...request(),
      });
      await f.admin.admin.updateStatus({ id: f.orderId, status: "cancelled" });
      expect(
        (await f.staff.pharmacies.inventory.list({ organizationId: f.a }))[0]
          .quantity
      ).toBe(1000000);
    });
    it("explicitly enrolls and assigns an eligible pharmacy without auto-enrolling historical orders", async () => {
      const f = await fixtures();
      expect(
        (await f.customer.orders.byId({ id: f.orderId })).fulfillment
      ).toBeNull();
      expect(await f.db.select().from(pharmacyOrderAssignments)).toHaveLength(
        0
      );
      expect(await f.enroll()).toMatchObject({
        state: "assignment_pending",
        version: 0,
      });
      const candidates = await f.admin.fulfillment.eligible({
        orderId: f.orderId,
      });
      expect(candidates.map(x => x.organizationId)).toEqual(
        expect.arrayContaining([f.a, f.b])
      );
      expect(await f.assign()).toMatchObject({ state: "assigned", version: 1 });
      expect(
        (await f.staff.pharmacies.inventory.list({ organizationId: f.a }))[0]
      ).toMatchObject({ quantity: 9, version: 2 });
      expect((await f.customer.orders.byId({ id: f.orderId })).status).toBe(
        "pending"
      );
    });
    it("runs accept/prepare/ready and exposes only a safe customer summary", async () => {
      const f = await fixtures();
      await f.enroll();
      await f.assign();
      await f.move("accept", 1);
      await f.move("prepare", 2);
      await f.move("ready", 3);
      const detail = await f.customer.orders.byId({ id: f.orderId });
      expect(detail).toMatchObject({
        status: "processing",
        fulfillment: { state: "ready", simulated: true },
      });
      expect(Object.keys(detail.fulfillment!).sort()).toEqual(
        ["pharmacyName", "simulated", "state", "updatedAt"].sort()
      );
      expect(
        (await f.customer.orders.list()).find(x => x.id === f.orderId)
          ?.fulfillment?.state
      ).toBe("ready");
      const own = await f.staff.fulfillment.detail({
        orderId: f.orderId,
        organizationId: f.a,
      });
      expect(own.handoff).toMatchObject({
        driverAssignment: null,
        status: "ready_for_delivery",
      });
      expect(own).not.toHaveProperty("deliveryAddress");
      expect(own).not.toHaveProperty("contactPhone");
      expect(own.events.map(x => x.action)).toEqual(
        expect.arrayContaining(["assigned", "accepted", "preparing", "ready"])
      );
      expect(own.events[0]).not.toHaveProperty("requestHash");
      await expect(
        f.other.orders.byId({ id: f.orderId })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
    it("denies cross-pharmacy IDs, platform admin bypass, customer/driver and viewer writes", async () => {
      const f = await fixtures();
      await f.enroll();
      await f.assign();
      for (const caller of [f.other, f.admin, f.driver]) {
        await expect(
          caller.fulfillment.list({ organizationId: f.a })
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
        await expect(
          caller.fulfillment.transition({
            orderId: f.orderId,
            organizationId: f.a,
            action: "accept",
            expectedVersion: 1,
            ...request(),
          })
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
      }
      await expect(
        f.staff.fulfillment.detail({ orderId: f.orderId, organizationId: f.b })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        f.other.fulfillment.detail({ orderId: f.orderId, organizationId: f.b })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(await f.other.fulfillment.list({ organizationId: f.b })).toEqual(
        []
      );
      expect(
        await f.viewer.fulfillment.list({ organizationId: f.a })
      ).toHaveLength(1);
      await expect(
        f.viewer.fulfillment.transition({
          orderId: f.orderId,
          organizationId: f.a,
          action: "accept",
          expectedVersion: 1,
          ...request(),
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        f.staff.fulfillment.assign({
          orderId: f.orderId,
          organizationId: f.a,
          expectedVersion: 0,
          ...request(),
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    it("rechecks organization and membership suspension before reads, actions and exact retries", async () => {
      const f = await fixtures();
      await f.enroll();
      await f.assign();
      const input = {
        orderId: f.orderId,
        organizationId: f.a,
        action: "accept" as const,
        expectedVersion: 1,
        ...request(),
      };
      await f.staff.fulfillment.transition(input);
      await f.admin.pharmacies.administration.setMembership({
        organizationId: f.a,
        userId: 4,
        role: "inventory_staff",
        status: "suspended",
        reason: "Fictional suspension",
      });
      await expect(f.staff.fulfillment.transition(input)).rejects.toMatchObject(
        { code: "FORBIDDEN" }
      );
      await expect(
        f.staff.fulfillment.list({ organizationId: f.a })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await f.admin.pharmacies.administration.review({
        organizationId: f.a,
        status: "suspended",
        reason: "Fictional suspension",
      });
      await expect(
        f.customer.fulfillment.list({ organizationId: f.a })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(f.assign()).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    it("serializes competing assignments and reserves exactly once", async () => {
      const f = await fixtures();
      await f.enroll();
      const result = await Promise.allSettled([f.assign(f.a), f.assign(f.b)]);
      expect(result.filter(x => x.status === "fulfilled")).toHaveLength(1);
      expect(result.filter(x => x.status === "rejected")).toHaveLength(1);
      expect(await f.db.select().from(pharmacyOrderAssignments)).toHaveLength(
        1
      );
      const rows = await f.db.select().from(pharmacyInventory);
      expect(rows.reduce((n, x) => n + x.quantity, 0)).toBe(19);
    });
    it("binds idempotency to actor and payload and rejects stale versions", async () => {
      const f = await fixtures();
      const enrollment = { orderId: f.orderId, ...request() };
      expect(await f.admin.fulfillment.enroll(enrollment)).toEqual(
        await f.admin.fulfillment.enroll(enrollment)
      );
      const input = {
        orderId: f.orderId,
        organizationId: f.a,
        expectedVersion: 0,
        ...request(),
      };
      const result = await Promise.all([
        f.admin.fulfillment.assign(input),
        f.admin.fulfillment.assign(input),
      ]);
      expect(result[0]).toEqual(result[1]);
      await expect(
        f.admin.fulfillment.assign({ ...input, reason: "Different reason" })
      ).rejects.toMatchObject({ code: "CONFLICT" });
      const action = {
        orderId: f.orderId,
        organizationId: f.a,
        expectedVersion: 1,
        action: "accept" as const,
        ...request(),
      };
      const moved = await f.staff.fulfillment.transition(action);
      expect(await f.staff.fulfillment.transition(action)).toEqual(moved);
      await expect(
        f.customer.fulfillment.transition(action)
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(f.move("prepare", 1)).rejects.toMatchObject({
        code: "CONFLICT",
      });
      expect(
        (await f.db.select().from(fulfillmentEvents)).filter(
          e => e.action === "assigned"
        )
      ).toHaveLength(1);
    });
    it("returns stock once on rejection and forbids reassigning the same order", async () => {
      const f = await fixtures();
      await f.enroll();
      await f.assign();
      await f.move("reject", 1);
      expect(
        (await f.staff.pharmacies.inventory.list({ organizationId: f.a }))[0]
      ).toMatchObject({ quantity: 10, version: 3 });
      await expect(f.assign(f.b, 2)).rejects.toMatchObject({
        code: "CONFLICT",
      });
      await expect(f.move("accept", 2)).rejects.toMatchObject({
        code: "CONFLICT",
      });
      await f.admin.admin.updateStatus({ id: f.orderId, status: "cancelled" });
      expect(
        (await f.staff.pharmacies.inventory.list({ organizationId: f.a }))[0]
          .quantity
      ).toBe(10);
    });
    it("cancels atomically through the existing API and prevents legacy status bypass", async () => {
      const f = await fixtures();
      await f.enroll();
      await f.assign();
      await expect(
        f.admin.admin.updateStatus({ id: f.orderId, status: "confirmed" })
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await f.move("accept", 1);
      await f.move("prepare", 2);
      await expect(
        f.admin.admin.updateStatus({ id: f.orderId, status: "shipped" })
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await f.move("ready", 3);
      await f.admin.admin.updateStatus({ id: f.orderId, status: "cancelled" });
      await f.admin.admin.updateStatus({ id: f.orderId, status: "cancelled" });
      expect(
        (await f.staff.pharmacies.inventory.list({ organizationId: f.a }))[0]
          .quantity
      ).toBe(10);
      expect(
        (await f.customer.orders.byId({ id: f.orderId })).fulfillment?.state
      ).toBe("cancelled");
      expect(
        (await f.db.select().from(products).where(eq(products.id, 1)))[0].stock
      ).toBe(3);
    });
    it("does not allow disabling the feature to bypass a managed order", async () => {
      const f = await fixtures();
      await f.enroll();
      await f.assign();
      vi.stubEnv("SIMULATED_FULFILLMENT_ENABLED", "false");
      await expect(
        f.admin.admin.updateStatus({ id: f.orderId, status: "confirmed" })
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(
        f.staff.fulfillment.list({ organizationId: f.a })
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    });
    it("requires available stock, an approved pharmacy and active management", async () => {
      const f = await fixtures();
      await f.enroll();
      await f.customer.pharmacies.inventory.adjust({
        organizationId: f.a,
        productId: 1,
        delta: -10,
        expectedVersion: 1,
        ...request(),
      });
      await expect(f.assign()).rejects.toMatchObject({ code: "CONFLICT" });
      expect(await f.db.select().from(pharmacyOrderAssignments)).toHaveLength(
        0
      );
      await f.admin.pharmacies.administration.setMembership({
        organizationId: f.b,
        userId: 2,
        role: "owner",
        status: "suspended",
        reason: "Fictional suspension",
      });
      await expect(f.assign(f.b)).rejects.toMatchObject({ code: "CONFLICT" });
    });
    it("rolls back all reservations on an invalid second line and on audit failure", async () => {
      const f = await fixtures();
      await f.enroll();
      await f.db.insert(orderItems).values({
        orderId: f.orderId,
        productId: 2,
        quantity: 1,
        price: "0.20",
        productName: "DEMO Restricted",
      });
      await expect(f.assign()).rejects.toMatchObject({ code: "CONFLICT" });
      expect(
        (await f.staff.pharmacies.inventory.list({ organizationId: f.a }))[0]
          .quantity
      ).toBe(10);
      await f.db
        .delete(orderItems)
        .where(
          and(eq(orderItems.orderId, f.orderId), eq(orderItems.productId, 2))
        );
      await f.db.execute(
        sql`ALTER TABLE fulfillmentEvents ADD CONSTRAINT test_fulfillment_audit_failure CHECK (action <> 'assigned')`
      );
      try {
        await expect(f.assign()).rejects.toThrow();
      } finally {
        await f.db.execute(
          sql`ALTER TABLE fulfillmentEvents DROP CHECK test_fulfillment_audit_failure`
        );
      }
      expect(await f.db.select().from(pharmacyOrderAssignments)).toHaveLength(
        0
      );
      expect(
        (await f.staff.pharmacies.inventory.list({ organizationId: f.a }))[0]
          .quantity
      ).toBe(10);
      expect((await f.db.select().from(fulfillmentOrders))[0].version).toBe(0);
    });
    it("handles invalid transitions, shipment readiness and terminal delivery", async () => {
      const f = await fixtures();
      await f.enroll();
      await f.assign();
      await expect(f.move("ready", 1)).rejects.toMatchObject({
        code: "CONFLICT",
      });
      await f.move("accept", 1);
      await expect(f.move("reject", 2)).rejects.toMatchObject({
        code: "CONFLICT",
      });
      await f.move("prepare", 2);
      await f.move("ready", 3);
      await f.admin.admin.updateStatus({ id: f.orderId, status: "shipped" });
      await f.admin.admin.updateStatus({ id: f.orderId, status: "delivered" });
      await expect(
        f.admin.admin.updateStatus({ id: f.orderId, status: "cancelled" })
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect((await f.customer.orders.byId({ id: f.orderId })).status).toBe(
        "delivered"
      );
    });
    it("rejects real/nonpending/restricted enrollment and leaves legacy orders unchanged", async () => {
      const f = await fixtures();
      await f.db
        .update(orders)
        .set({ isSimulated: false })
        .where(eq(orders.id, f.orderId));
      await expect(f.enroll()).rejects.toMatchObject({ code: "CONFLICT" });
      await f.db
        .update(orders)
        .set({ isSimulated: true, status: "confirmed" })
        .where(eq(orders.id, f.orderId));
      await expect(f.enroll()).rejects.toMatchObject({ code: "CONFLICT" });
      await f.admin.admin.updateStatus({ id: f.orderId, status: "processing" });
      expect((await f.customer.orders.byId({ id: f.orderId })).status).toBe(
        "processing"
      );
      expect(await f.db.select().from(fulfillmentOrders)).toHaveLength(0);
    });
  }
);
