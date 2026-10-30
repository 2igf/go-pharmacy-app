import mysql from "mysql2/promise";
import { getDb, closeDb } from "./db";
import { users, products, userAddresses } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";
export function assertTestDatabase() {
  const url = new URL(
    process.env.TEST_DATABASE_URL ?? "mysql://invalid/invalid"
  );
  if (!/^go_pharmacy_test(_[a-z0-9]+)?$/.test(url.pathname.slice(1)))
    throw new Error("Tests require a dedicated go_pharmacy_test database");
  if (process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL)
    throw new Error("Refusing to use a different database for fixtures");
}
export async function resetFixtures() {
  assertTestDatabase();
  const connection = await mysql.createConnection(
    process.env.TEST_DATABASE_URL!
  );
  try {
    // Only test tables in an explicitly named disposable database. Never disable FK enforcement.
    for (const table of [
      "fulfillmentEvents",
      "fulfillmentStockLines",
      "fulfillmentOrders",
      "pharmacyOrderAssignments",
      "officialMedicinePrices",
      "organizationAuditEvents",
      "pharmacyInventory",
      "organizationMemberships",
      "organizations",
      "knowledgeDrugVersions",
      "knowledgeLabelSections",
      "knowledgeRegistrations",
      "knowledgeDrugIngredients",
      "knowledgeNames",
      "knowledgeIngredients",
      "knowledgeProductFacts",
      "knowledgeDrugs",
      "knowledgeImportBatches",
      "customerReminderEvents",
      "customerReminders",
      "customerPasswordResets",
      "customerAccounts",
      "sessions",
      "credentials",
      "notifications",
      "orderItems",
      "cartItems",
      "orders",
      "userAddresses",
      "medicationReminderLogs",
      "medicationReminders",
      "doctorReviews",
      "productReviews",
      "prescriptions",
      "appointments",
      "doctorTimeSlots",
      "doctors",
      "products",
      "users",
    ])
      await connection.query(`DELETE FROM \`${table}\``);
    const db = await getDb();
    await db.insert(users).values([
      {
        id: 1,
        openId: "test:a",
        name: "Fictional A",
        email: "customer-a@example.test",
      },
      {
        id: 2,
        openId: "test:b",
        name: "Fictional B",
        email: "customer-b@example.test",
      },
      {
        id: 3,
        openId: "test:admin",
        name: "Fictional Admin",
        email: "admin@example.test",
        role: "admin",
      },
    ]);
    await db.insert(products).values([
      {
        id: 1,
        name: "DEMO Test Product",
        price: "0.10",
        category: "skincare",
        stock: 3,
      },
      {
        id: 2,
        name: "DEMO Restricted",
        price: "0.20",
        category: "medications",
        stock: 20,
        requiresPrescription: true,
      },
    ]);
    await db.insert(userAddresses).values([
      { id: 1, userId: 1, label: "Test A", address: "Fictional A Test Street" },
      { id: 2, userId: 2, label: "Test B", address: "Fictional B Test Street" },
    ]);
  } finally {
    await connection.end();
  }
}
export async function testContext(userId = 1): Promise<TrpcContext> {
  const { eq } = await import("drizzle-orm");
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  return {
    user,
    req: { headers: {}, protocol: "http" },
    res: { cookie() {}, clearCookie() {} },
  } as unknown as TrpcContext;
}
export { closeDb };
