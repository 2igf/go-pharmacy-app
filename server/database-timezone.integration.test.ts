import { afterAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { getDb, closeDb } from "./db";
afterAll(closeDb);
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "UTC timestamp transport",
  () => {
    it("sets UTC for every pooled connection so audit timestamps are not shifted", async () => {
      const db = await getDb();
      const results = await Promise.all(
        Array.from({ length: 7 }, () =>
          db.execute(
            sql`SELECT @@session.time_zone AS zone, TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), NOW()) AS offsetSeconds`
          )
        )
      );
      for (const result of results) {
      const rows = result[0] as unknown as { zone: string; offsetSeconds: number }[];
        expect(rows[0]).toMatchObject({ zone: "+00:00", offsetSeconds: 0 });
      }
    });
  }
);
