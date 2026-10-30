import {
  datetime,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { users } from "./schema";

/** Only server registration writes this marker. Existing users remain legacy. */
export const customerAccounts = mysqlTable("customerAccounts", {
  userId: int("userId")
    .primaryKey()
    .references(() => users.id),
  accessSource: mysqlEnum("accessSource", ["public", "legacy"]).notNull(),
  verificationState: mysqlEnum("verificationState", ["unverified"])
    .notNull()
    .default("unverified"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const customerPasswordResets = mysqlTable(
  "customerPasswordResets",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
    expiresAt: datetime("expiresAt", { mode: "date", fsp: 3 }).notNull(),
    usedAt: datetime("usedAt", { mode: "date", fsp: 3 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("customer_reset_user_idx").on(table.userId),
    index("customer_reset_expiry_idx").on(table.expiresAt),
  ]
);
