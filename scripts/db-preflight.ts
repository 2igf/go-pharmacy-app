import "dotenv/config";
import mysql, { type RowDataPacket } from "mysql2/promise";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const db = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [tables] = await db.query<RowDataPacket[]>(
    "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE()"
  );
  // MySQL on Windows may normalize table names to lowercase.
  const names = new Set(tables.map(row => String(row.name).toLowerCase()));
  const checks: [string, string][] = [
    [
      "cartItems",
      "SELECT COUNT(*) AS n FROM (SELECT userId, productId FROM cartItems GROUP BY userId, productId HAVING COUNT(*) > 1) duplicate_cart",
    ],
    [
      "cartItems",
      "SELECT COUNT(*) AS n FROM cartItems WHERE quantity < 1 OR quantity > 99",
    ],
    [
      "products",
      "SELECT COUNT(*) AS n FROM products WHERE stock < 0 OR price < 0",
    ],
    [
      "orderItems",
      "SELECT COUNT(*) AS n FROM orderItems WHERE quantity < 1 OR price < 0",
    ],
  ];
  for (const [child, column, parent] of [
    ["cartItems", "userId", "users"],
    ["cartItems", "productId", "products"],
    ["orders", "userId", "users"],
    ["orderItems", "orderId", "orders"],
    ["orderItems", "productId", "products"],
    ["notifications", "userId", "users"],
    ["userAddresses", "userId", "users"],
  ])
    checks.push([
      child,
      `SELECT COUNT(*) AS n FROM \`${child}\` c LEFT JOIN \`${parent}\` p ON p.id = c.\`${column}\` WHERE p.id IS NULL`,
    ]);
  let failed = false;
  for (const [table, query] of checks) {
    if (!names.has(table.toLowerCase())) continue;
    const [rows] = await db.query<RowDataPacket[]>(query);
    if (Number(rows[0].n)) {
      failed = true;
      console.error(
        `Preflight failed for ${table}: ${rows[0].n} incompatible record(s). Back up and reconcile manually.`
      );
    }
  }
  if (failed) process.exitCode = 1;
  else
    console.log(
      "Database preflight passed. Keep writes stopped during migration; take a backup first."
    );
} finally {
  await db.end();
}
