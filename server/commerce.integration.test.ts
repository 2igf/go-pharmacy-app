import { beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { appRouter } from "./routers";
import { checkout, cartFingerprint } from "./commerce";
import { getDb } from "./db";
import {
  products,
  cartItems,
  orders,
  orderItems,
  notifications,
} from "../drizzle/schema";
import { resetFixtures, testContext, closeDb } from "./test-support";
beforeEach(async () => {
  if (process.env.TEST_DATABASE_URL) await resetFixtures();
});
afterAll(closeDb);
const input = (userId = 1) => ({
  addressId: userId,
  contactName: "Fictional Tester",
  contactPhone: "0000000000",
  expectedTotal: "0.20",
  expectedCartHash: cartFingerprint([
    { productId: 1, price: "0.10", quantity: 2 },
  ]),
  paymentMethod: "cash" as const,
  simulationAcknowledged: true as const,
  idempotencyKey: randomUUID(),
});
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "real MySQL commerce and ownership",
  () => {
    it("isolates carts when both users add the same product", async () => {
      const a = appRouter.createCaller(await testContext(1));
      const b = appRouter.createCaller(await testContext(2));
      await a.cart.add({ productId: 1, quantity: 1 });
      await b.cart.add({ productId: 1, quantity: 2 });
      expect((await a.cart.list())[0].quantity).toBe(1);
      expect((await b.cart.list())[0].quantity).toBe(2);
      const other = (await b.cart.list())[0];
      await expect(
        a.cart.updateQuantity({ id: other.id, quantity: 1 })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(a.cart.remove({ id: other.id })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect((await b.cart.list())[0].quantity).toBe(2);
    });
    it("prevents concurrent overselling and rolls back the losing checkout", async () => {
      const db = await getDb();
      await db.insert(cartItems).values([
        { userId: 1, productId: 1, quantity: 2 },
        { userId: 2, productId: 1, quantity: 2 },
      ]);
      const results = await Promise.allSettled([
        checkout(1, input(1)),
        checkout(2, input(2)),
      ]);
      expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter(r => r.status === "rejected")).toHaveLength(1);
      expect(
        (await db.select().from(products).where(eq(products.id, 1)))[0].stock
      ).toBe(1);
      expect(await db.select().from(orders)).toHaveLength(1);
      expect(await db.select().from(cartItems)).toHaveLength(1);
    });
    it("creates one order for concurrent duplicate requests and replays after cart clear", async () => {
      const db = await getDb();
      await db
        .insert(cartItems)
        .values({ userId: 1, productId: 1, quantity: 2 });
      const request = input();
      const [one, two] = await Promise.all([
        checkout(1, request),
        checkout(1, request),
      ]);
      expect(one).toEqual(two);
      expect(await checkout(1, request)).toEqual(one);
      expect(await db.select().from(orders)).toHaveLength(1);
      await expect(
        checkout(1, { ...request, contactName: "Different person" })
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });
    it("rolls back stock and order when quoted prices change", async () => {
      const db = await getDb();
      await db
        .insert(cartItems)
        .values({ userId: 1, productId: 1, quantity: 2 });
      await expect(
        checkout(1, { ...input(), expectedTotal: "0.01" })
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(
        (await db.select().from(products).where(eq(products.id, 1)))[0].stock
      ).toBe(3);
      expect(await db.select().from(orders)).toHaveLength(0);
      expect(await db.select().from(cartItems)).toHaveLength(1);
    });
    it("rejects a changed basket even when total remains the same", async () => {
      const db = await getDb();
      await db
        .insert(products)
        .values({
          id: 3,
          name: "Different fictional product",
          category: "skincare",
          price: "0.10",
          stock: 3,
        });
      await db
        .insert(cartItems)
        .values({ userId: 1, productId: 3, quantity: 2 });
      await expect(checkout(1, input())).rejects.toMatchObject({
        code: "CONFLICT",
      });
      expect(await db.select().from(orders)).toHaveLength(0);
      expect(
        (await db.select().from(products).where(eq(products.id, 3)))[0].stock
      ).toBe(3);
    });
    it("rolls back a failure after order insertion without losing the cart", async () => {
      const db = await getDb();
      await db
        .insert(cartItems)
        .values({ userId: 1, productId: 1, quantity: 2 });
      // Inject an adapter failure while keeping the real MySQL transaction/rollback.
      // This avoids requiring SUPER privileges or weakening server binary-log policy.
      const transaction = db.transaction.bind(db);
      const fault = vi
        .spyOn(db, "transaction")
        .mockImplementationOnce((callback, config) =>
          transaction(async tx => {
            const insert = tx.insert.bind(tx);
            const injection = vi
              .spyOn(tx, "insert")
              .mockImplementation(table => {
                if (table === orderItems)
                  throw new Error("Injected order item adapter failure");
                return insert(table);
              });
            try {
              return await callback(tx);
            } finally {
              injection.mockRestore();
            }
          }, config)
        );
      try {
        await expect(checkout(1, input())).rejects.toThrow();
        expect(await db.select().from(orders)).toHaveLength(0);
        expect(await db.select().from(cartItems)).toHaveLength(1);
        expect(
          (await db.select().from(products).where(eq(products.id, 1)))[0].stock
        ).toBe(3);
      } finally {
        fault.mockRestore();
      }
    });
    it("supports administrator product CRUD, zero inventory and archival without deleting history", async () => {
      const db = await getDb();
      const admin = appRouter.createCaller(await testContext(3));
      const customer = appRouter.createCaller(await testContext());
      const created = await admin.products.create({
        name: "DEMO Created",
        category: "skincare",
        price: "1.25",
        stock: "8",
      });
      await admin.products.update({
        id: created.id,
        stock: "0",
        price: "2.10",
      });
      expect((await admin.products.byId({ id: created.id }))?.stock).toBe(0);
      await expect(
        customer.cart.add({ productId: created.id, quantity: 1 })
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await admin.products.delete({ id: created.id });
      expect(
        (await db.select().from(products).where(eq(products.id, created.id)))[0]
          .isActive
      ).toBe(false);
      expect(
        (await customer.products.list({ limit: 100, offset: 0 })).some(
          p => p.id === created.id
        )
      ).toBe(false);
      await expect(
        customer.products.update({ id: created.id, stock: "9" })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        admin.products.create({
          name: "Bad",
          category: "skincare",
          price: "-1",
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
    it("rejects unavailable and expired inventory", async () => {
      const db = await getDb();
      const customer = appRouter.createCaller(await testContext());
      await expect(
        customer.cart.add({ productId: 99999, quantity: 1 })
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await db
        .update(products)
        .set({ expiryDate: new Date(0) })
        .where(eq(products.id, 1));
      await expect(
        customer.cart.add({ productId: 1, quantity: 1 })
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });
    it("rejects prescription flags at both cart add and checkout", async () => {
      const db = await getDb();
      const a = appRouter.createCaller(await testContext());
      await expect(
        a.cart.add({ productId: 2, quantity: 1 })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await a.cart.add({ productId: 1, quantity: 2 });
      await db
        .update(products)
        .set({ requiresPrescription: true })
        .where(eq(products.id, 1));
      await expect(checkout(1, input())).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(await db.select().from(orders)).toHaveLength(0);
    });
    it("rejects fractional quantities, empty carts and foreign addresses", async () => {
      const a = appRouter.createCaller(await testContext());
      await expect(
        a.cart.add({ productId: 1, quantity: 1.1 })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(checkout(1, input())).rejects.toMatchObject({
        code: "CONFLICT",
      });
      await a.cart.add({ productId: 1, quantity: 2 });
      await expect(
        checkout(1, { ...input(), addressId: 2 })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
    it("isolates notifications, orders, addresses and admin capabilities", async () => {
      const db = await getDb();
      const a = appRouter.createCaller(await testContext());
      const b = appRouter.createCaller(await testContext(2));
      await db
        .insert(notifications)
        .values({
          id: 100,
          userId: 2,
          title: "Private test",
          message: "Fictional",
          type: "system",
        });
      await a.notifications.markAsRead({ id: 100 });
      await a.notifications.delete({ id: 100 });
      expect((await b.notifications.list())[0].isRead).toBe(false);
      await b.cart.add({ productId: 1, quantity: 2 });
      const order = await b.orders.create(input(2));
      await expect(a.orders.byId({ id: order.orderId })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await expect(a.addresses.byId({ id: 2 })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await expect(a.admin.orders()).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(
        a.admin.updateStatus({ id: order.orderId, status: "confirmed" })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    it("persists customer-to-admin lifecycle and restores cancelled stock once", async () => {
      const db = await getDb();
      const a = appRouter.createCaller(await testContext());
      const admin = appRouter.createCaller(await testContext(3));
      await a.cart.add({ productId: 1, quantity: 2 });
      const order = await a.orders.create(input());
      expect((await a.orders.byId({ id: order.orderId })).totalAmount).toBe(
        "0.20"
      );
      expect(await a.cart.list()).toHaveLength(0);
      await admin.admin.updateStatus({
        id: order.orderId,
        status: "confirmed",
      });
      expect((await a.orders.byId({ id: order.orderId })).status).toBe(
        "confirmed"
      );
      await Promise.all([
        admin.admin.updateStatus({ id: order.orderId, status: "cancelled" }),
        admin.admin.updateStatus({ id: order.orderId, status: "cancelled" }),
      ]);
      expect(
        (await db.select().from(products).where(eq(products.id, 1)))[0].stock
      ).toBe(3);
      await expect(
        admin.admin.updateStatus({ id: order.orderId, status: "delivered" })
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });
  }
);
