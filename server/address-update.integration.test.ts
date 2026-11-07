import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { userAddresses } from "../drizzle/schema";
import { getDb } from "./db";
import { appRouter } from "./routers";
import { closeDb, resetFixtures, testContext } from "./test-support";

beforeEach(async () => {
  if (process.env.TEST_DATABASE_URL) await resetFixtures();
});
afterAll(closeDb);

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "saved address editing in isolated MySQL",
  () => {
    it("saves Arabic address edits without changing the id, metadata or a previous order snapshot", async () => {
      const db = await getDb();
      await db
        .update(userAddresses)
        .set({
          isDefault: true,
          latitude: "31.95000000",
          longitude: "35.91000000",
        })
        .where(eq(userAddresses.id, 1));
      const customer = appRouter.createCaller(await testContext(1));
      const before = await customer.addresses.byId({ id: 1 });
      await customer.cart.add({ productId: 1, quantity: 1 });
      const quote = await customer.cart.quote();
      const created = await customer.orders.create({
        addressId: 1,
        contactName: "Fictional Customer",
        contactPhone: "0000000000",
        expectedTotal: quote.total,
        expectedCartHash: quote.fingerprint,
        paymentMethod: "cash",
        simulationAcknowledged: true,
        idempotencyKey: randomUUID(),
      });
      const snapshot = await customer.orders.byId({ id: created.orderId });
      expect(snapshot.deliveryAddress).toBe(before.address);

      expect(
        await customer.addresses.update({
          id: 1,
          address: "  عنوان اختبار جديد مبنى ١٢ وشقة ۳  ",
        })
      ).toEqual({ success: true });
      const after = await customer.addresses.byId({ id: 1 });
      expect(after).toMatchObject({
        id: before.id,
        userId: before.userId,
        label: before.label,
        isDefault: before.isDefault,
        address: "عنوان اختبار جديد مبنى ١٢ وشقة ۳",
        latitude: null,
        longitude: null,
      });
      expect(after.createdAt).toEqual(before.createdAt);
      expect(
        (await customer.addresses.list()).filter(
          address => address.id === before.id
        )
      ).toHaveLength(1);
      const orderAfter = await customer.orders.byId({ id: created.orderId });
      expect(orderAfter.deliveryAddress).toBe(snapshot.deliveryAddress);
      expect(orderAfter.deliveryLatitude).toBe(snapshot.deliveryLatitude);
      expect(orderAfter.deliveryLongitude).toBe(snapshot.deliveryLongitude);
      expect(orderAfter.orderNumber).toBe(snapshot.orderNumber);
      expect(orderAfter.totalAmount).toBe(snapshot.totalAmount);
    });

    it("rejects another customer's edit and missing records without changing the owner's address", async () => {
      const customer = appRouter.createCaller(await testContext(1));
      const owner = appRouter.createCaller(await testContext(2));
      const before = await owner.addresses.byId({ id: 2 });
      await expect(
        customer.addresses.update({
          id: 2,
          address: "Unauthorized fictional edit",
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        customer.addresses.update({
          id: 999999,
          address: "Missing fictional address",
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(await owner.addresses.byId({ id: 2 })).toEqual(before);
    });
  }
);
