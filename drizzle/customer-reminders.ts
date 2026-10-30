import {
  boolean,
  datetime,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { users } from "./schema";

/** Manually entered personal definitions; deliberately separate from disabled clinical reminders. */
export const customerReminders = mysqlTable(
  "customerReminders",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id),
    requestId: varchar("requestId", { length: 36 }).notNull(),
    requestHash: varchar("requestHash", { length: 64 }).notNull(),
    medicationName: varchar("medicationName", { length: 120 }).notNull(),
    dosage: varchar("dosage", { length: 120 }),
    notes: varchar("notes", { length: 500 }),
    times: json("times").$type<string[]>().notNull(),
    weekdays: json("weekdays").$type<number[]>().notNull(),
    startDate: varchar("startDate", { length: 10 }).notNull(),
    endDate: varchar("endDate", { length: 10 }),
    timezone: varchar("timezone", { length: 80 }).notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    discreet: boolean("discreet").default(true).notNull(),
    version: int("version").default(1).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("customer_reminder_request_unique").on(
      table.userId,
      table.requestId
    ),
    index("customer_reminder_owner_enabled_idx").on(
      table.userId,
      table.enabled
    ),
  ]
);

/** Immutable user reports. This records the user's statement, never clinical adherence or notification delivery. */
export const customerReminderEvents = mysqlTable(
  "customerReminderEvents",
  {
    id: int("id").autoincrement().primaryKey(),
    reminderId: int("reminderId")
      .notNull()
      .references(() => customerReminders.id, { onDelete: "cascade" }),
    scheduledAt: datetime("scheduledAt", { mode: "date", fsp: 3 }).notNull(),
    timezone: varchar("timezone", { length: 80 }).notNull(),
    status: mysqlEnum("status", ["taken", "skipped"]).notNull(),
    source: mysqlEnum("source", ["user_reported"])
      .default("user_reported")
      .notNull(),
    recordedAt: timestamp("recordedAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("customer_reminder_occurrence_unique").on(
      table.reminderId,
      table.scheduledAt
    ),
    index("customer_reminder_history_idx").on(
      table.reminderId,
      table.recordedAt
    ),
  ]
);
