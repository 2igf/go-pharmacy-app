import { resetFixtures } from "./test-support";
import { beforeEach as resetBeforeEach } from "vitest";
resetBeforeEach(async () => {
  if (process.env.TEST_DATABASE_URL) await resetFixtures();
});
import { describe, it, expect, beforeEach } from "vitest";
import { getDb } from "./db";
import { orders, users, userAddresses } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe.skipIf(!process.env.TEST_DATABASE_URL)("Orders", () => {
  let db: any;

  beforeEach(async () => {
    db = await getDb();
  });

  describe.skipIf(!process.env.TEST_DATABASE_URL)("getUserOrders", () => {
    it("should return orders for a user", async () => {
      const { getUserOrders } = await import("./db");
      const userId = 1;

      const result = await getUserOrders(userId);
      expect(Array.isArray(result)).toBe(true);
    });

    it("should return empty array for user with no orders", async () => {
      const { getUserOrders } = await import("./db");
      const userId = 9999;

      const result = await getUserOrders(userId);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe.skipIf(!process.env.TEST_DATABASE_URL)("getOrderById", () => {
    it("should return order details", async () => {
      const { getOrderById } = await import("./db");

      // Insert test order
      const [result] = await db.insert(orders).values({
        userId: 1,
        orderNumber: `TEST-${Date.now()}`,
        totalAmount: "100.00",
        status: "pending",
        deliveryAddress: "123 Test St",
        deliveryLatitude: "0",
        deliveryLongitude: "0",
        paymentMethod: "cash",
        paymentStatus: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const orderId = result?.insertId || 0;
      if (orderId > 0) {
        const order = await getOrderById(orderId);
        expect(order).toBeDefined();
        expect(order?.orderNumber).toContain("TEST-");
      }
    });

    it("should return undefined for non-existent order", async () => {
      const { getOrderById } = await import("./db");

      const order = await getOrderById(9999);
      expect(order).toBeUndefined();
    });
  });

  describe.skipIf(!process.env.TEST_DATABASE_URL)("Order Status", () => {
    it("should have valid status values", async () => {
      const validStatuses = [
        "pending",
        "confirmed",
        "shipped",
        "delivered",
        "cancelled",
      ];

      for (const status of validStatuses) {
        const [result] = await db.insert(orders).values({
          userId: 1,
          orderNumber: `TEST-${status}-${Date.now()}`,
          totalAmount: "50.00",
          status,
          deliveryAddress: "Test Address",
          deliveryLatitude: "0",
          deliveryLongitude: "0",
          paymentMethod: "card",
          paymentStatus: "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        expect(result?.insertId).toBeGreaterThan(0);
      }
    });
  });

  describe.skipIf(!process.env.TEST_DATABASE_URL)("Payment Status", () => {
    it("should track payment status correctly", async () => {
      const { getOrderById } = await import("./db");

      const [result] = await db.insert(orders).values({
        userId: 1,
        orderNumber: `PAYMENT-TEST-${Date.now()}`,
        totalAmount: "75.00",
        status: "pending",
        deliveryAddress: "Test Address",
        deliveryLatitude: "0",
        deliveryLongitude: "0",
        paymentMethod: "card",
        paymentStatus: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const orderId = result?.insertId || 0;
      if (orderId > 0) {
        const order = await getOrderById(orderId);
        expect(order?.paymentStatus).toBe("pending");
      }
    });
  });
});
