import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { users } from "../drizzle/schema";
import { getDb } from "./db";
import { appRouter } from "./routers";
import { resetFixtures, testContext, closeDb } from "./test-support";

beforeEach(async () => {
  if (process.env.TEST_DATABASE_URL) await resetFixtures();
});
afterAll(closeDb);

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "provider accounts remain personal, never cross-user operational accounts",
  () => {
    it.each(["doctor", "pharmacist"] as const)(
      "isolates %s carts, addresses and orders in real MySQL",
      async role => {
        const db = await getDb();
        await db.update(users).set({ role }).where(eq(users.id, 1));
        const provider = appRouter.createCaller(await testContext(1));
        const customer = appRouter.createCaller(await testContext(2));
        await customer.cart.add({ productId: 1, quantity: 1 });
        const quote = await customer.cart.quote();
        const order = await customer.orders.create({
          addressId: 2,
          contactName: "Fictional Customer",
          contactPhone: "0000000000",
          expectedTotal: quote.total,
          expectedCartHash: quote.fingerprint,
          paymentMethod: "cash",
          simulationAcknowledged: true,
          idempotencyKey: randomUUID(),
        });
        expect(await provider.orders.list()).toEqual([]);
        await expect(
          provider.orders.byId({ id: order.orderId })
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
        await expect(provider.addresses.byId({ id: 2 })).rejects.toMatchObject({
          code: "NOT_FOUND",
        });
        await expect(
          provider.addresses.delete({ id: 2 })
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
        expect(
          (await provider.addresses.list()).map(address => address.userId)
        ).toEqual([1]);
        expect(await provider.cart.list()).toEqual([]);
        await provider.cart.add({ productId: 1, quantity: 1 });
        const item = (await provider.cart.list())[0];
        await expect(
          customer.cart.remove({ id: item.id })
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
        expect((await customer.orders.byId({ id: order.orderId })).userId).toBe(
          2
        );
        await expect(
          provider.admin.order({ id: order.orderId })
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
        await expect(
          provider.appointments.byDoctor({ doctorId: 1 })
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
      }
    );
  }
);
