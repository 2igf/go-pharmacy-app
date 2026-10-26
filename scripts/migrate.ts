import "./db-preflight";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { getDb, closeDb } from "../server/db";
if (process.exitCode) throw new Error("Migration stopped by preflight");
try {
  await migrate(await getDb(), { migrationsFolder: "drizzle" });
  console.log("Migrations applied.");
} finally {
  await closeDb();
}
