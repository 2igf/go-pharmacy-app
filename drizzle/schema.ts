import { 
  int, 
  mysqlEnum, 
  mysqlTable, 
  text, 
  timestamp, 
  varchar,
  decimal,
  boolean,
  datetime,
  json,
  uniqueIndex,
  index,
  primaryKey,
  check,
  foreignKey
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 * Extended with additional fields for pharmacy app.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "doctor", "pharmacist"]).default("user").notNull(),
  profileImage: text("profileImage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Products table for medications and medical supplies
 */
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: mysqlEnum("category", [
    "medications",
    "medical_supplies",
    "natural_products",
    "skincare",
    "baby_care",
    "pet_care"
  ]).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  stock: int("stock").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  image: text("image"),
  requiresPrescription: boolean("requiresPrescription").default(false).notNull(),
  activeIngredient: varchar("activeIngredient", { length: 255 }),
  manufacturer: varchar("manufacturer", { length: 255 }),
  expiryDate: datetime("expiryDate"),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0"),
  reviewCount: int("reviewCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

/**
 * Doctors table for doctor profiles
 */
export const doctors = mysqlTable("doctors", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  specialty: mysqlEnum("specialty", [
    "dermatology",
    "dentistry",
    "orthopedics",
    "pediatrics",
    "internal_medicine",
    "cardiology",
    "neurology",
    "general_practice"
  ]).notNull(),
  bio: text("bio"),
  qualifications: text("qualifications"),
  clinic: varchar("clinic", { length: 255 }),
  clinicLocation: varchar("clinicLocation", { length: 255 }),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  consultationFee: decimal("consultationFee", { precision: 10, scale: 2 }).notNull(),
  consultationDuration: int("consultationDuration").default(30), // in minutes
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0"),
  reviewCount: int("reviewCount").default(0).notNull(),
  waitTime: int("waitTime").default(30).notNull(), // in minutes
  isAvailable: boolean("isAvailable").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Doctor = typeof doctors.$inferSelect;
export type InsertDoctor = typeof doctors.$inferInsert;

/**
 * Doctor availability/time slots
 */
export const doctorTimeSlots = mysqlTable("doctorTimeSlots", {
  id: int("id").autoincrement().primaryKey(),
  doctorId: int("doctorId").notNull(),
  dayOfWeek: varchar("dayOfWeek", { length: 1 }).notNull(), // 0-6 (Sunday-Saturday)
  startTime: varchar("startTime", { length: 5 }).notNull(), // HH:MM format
  endTime: varchar("endTime", { length: 5 }).notNull(),
  isBooked: boolean("isBooked").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DoctorTimeSlot = typeof doctorTimeSlots.$inferSelect;
export type InsertDoctorTimeSlot = typeof doctorTimeSlots.$inferInsert;

/**
 * Appointments for doctor consultations
 */
export const appointments = mysqlTable("appointments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  doctorId: int("doctorId").notNull(),
  appointmentDate: datetime("appointmentDate").notNull(),
  status: mysqlEnum("status", ["scheduled", "completed", "cancelled", "no_show"]).default("scheduled").notNull(),
  consultationType: mysqlEnum("consultationType", ["in_clinic", "video", "chat"]).default("in_clinic").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = typeof appointments.$inferInsert;

/**
 * Prescriptions from doctors
 */
export const prescriptions = mysqlTable("prescriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  doctorId: int("doctorId").notNull(),
  appointmentId: int("appointmentId"),
  prescriptionImage: text("prescriptionImage"),
  medications: json("medications"), // JSON array of medication details
  notes: text("notes"),
  issuedDate: datetime("issuedDate").notNull(),
  expiryDate: datetime("expiryDate").notNull(),
  status: mysqlEnum("status", ["active", "expired", "used"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Prescription = typeof prescriptions.$inferSelect;
export type InsertPrescription = typeof prescriptions.$inferInsert;

/**
 * Shopping cart items
 */
export const cartItems = mysqlTable("cartItems", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: 'restrict' }),
  productId: int("productId").notNull().references(() => products.id, { onDelete: 'restrict' }),
  quantity: int("quantity").notNull(),
  prescriptionId: int("prescriptionId"), // For prescription-required items
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex('cart_user_product_unique').on(table.userId, table.productId)]);

export type CartItem = typeof cartItems.$inferSelect;
export type InsertCartItem = typeof cartItems.$inferInsert;

/**
 * Orders/Purchases
 */
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: 'restrict' }),
  idempotencyKey: varchar("idempotencyKey", { length: 64 }),
  requestHash: varchar("requestHash", { length: 64 }),
  isSimulated: boolean("isSimulated").default(false).notNull(),
  contactName: varchar("contactName", { length: 100 }),
  contactPhone: varchar("contactPhone", { length: 30 }),
  orderNumber: varchar("orderNumber", { length: 50 }).notNull().unique(),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }).notNull(),
  status: mysqlEnum("status", [
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
    "cancelled"
  ]).default("pending").notNull(),
  deliveryAddress: text("deliveryAddress").notNull(),
  deliveryLatitude: decimal("deliveryLatitude", { precision: 10, scale: 8 }),
  deliveryLongitude: decimal("deliveryLongitude", { precision: 11, scale: 8 }),
  estimatedDelivery: datetime("estimatedDelivery"),
  actualDelivery: datetime("actualDelivery"),
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "card"]).notNull(),
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "completed", "failed"]).default("pending").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex('order_user_idempotency_unique').on(table.userId, table.idempotencyKey), index('orders_user_created_idx').on(table.userId, table.createdAt)]);

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

/**
 * Order items (products in an order)
 */
export const orderItems = mysqlTable("orderItems", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull().references(() => orders.id, { onDelete: 'restrict' }),
  productId: int("productId").notNull().references(() => products.id, { onDelete: 'restrict' }),
  productName: varchar("productName", { length: 255 }),
  quantity: int("quantity").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;

/**
 * User addresses for delivery
 */
export const userAddresses = mysqlTable("userAddresses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: 'restrict' }),
  label: varchar("label", { length: 50 }), // Home, Work, etc.
  address: text("address").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  isDefault: boolean("isDefault").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserAddress = typeof userAddresses.$inferSelect;
export type InsertUserAddress = typeof userAddresses.$inferInsert;

/**
 * Medication reminders/scheduler
 */
export const medicationReminders = mysqlTable("medicationReminders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  medicationName: varchar("medicationName", { length: 255 }).notNull(),
  dosage: varchar("dosage", { length: 100 }),
  frequency: mysqlEnum("frequency", [
    "once_daily",
    "twice_daily",
    "three_times_daily",
    "four_times_daily",
    "every_6_hours",
    "every_8_hours",
    "every_12_hours",
    "weekly",
    "as_needed"
  ]).notNull(),
  startDate: datetime("startDate").notNull(),
  endDate: datetime("endDate"),
  reminderTimes: json("reminderTimes"), // JSON array of times [HH:MM]
  notes: text("notes"),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MedicationReminder = typeof medicationReminders.$inferSelect;
export type InsertMedicationReminder = typeof medicationReminders.$inferInsert;

/**
 * Medication reminder history/logs
 */
export const medicationReminderLogs = mysqlTable("medicationReminderLogs", {
  id: int("id").autoincrement().primaryKey(),
  reminderId: int("reminderId").notNull(),
  userId: int("userId").notNull(),
  scheduledTime: datetime("scheduledTime").notNull(),
  takenTime: datetime("takenTime"),
  status: mysqlEnum("status", ["pending", "taken", "skipped", "missed"]).default("pending").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MedicationReminderLog = typeof medicationReminderLogs.$inferSelect;
export type InsertMedicationReminderLog = typeof medicationReminderLogs.$inferInsert;

/**
 * Product reviews and ratings
 */
export const productReviews = mysqlTable("productReviews", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  userId: int("userId").notNull(),
  rating: int("rating").notNull(), // 1-5
  title: varchar("title", { length: 255 }),
  comment: text("comment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductReview = typeof productReviews.$inferSelect;
export type InsertProductReview = typeof productReviews.$inferInsert;

/**
 * Doctor reviews and ratings
 */
export const doctorReviews = mysqlTable("doctorReviews", {
  id: int("id").autoincrement().primaryKey(),
  doctorId: int("doctorId").notNull(),
  userId: int("userId").notNull(),
  appointmentId: int("appointmentId"),
  rating: int("rating").notNull(), // 1-5
  title: varchar("title", { length: 255 }),
  comment: text("comment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DoctorReview = typeof doctorReviews.$inferSelect;
export type InsertDoctorReview = typeof doctorReviews.$inferInsert;

/**
 * Notifications for users
 */
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: 'restrict' }),
  type: mysqlEnum("type", [
    "order_status",
    "appointment_reminder",
    "medication_reminder",
    "system",
    "promotion"
  ]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  relatedId: int("relatedId"),
  isRead: boolean("isRead").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index('notifications_user_created_idx').on(table.userId, table.createdAt)]);

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

export const credentials = mysqlTable('credentials', {
  userId: int('userId').primaryKey().references(() => users.id, { onDelete: 'restrict' }),
  email: varchar('email', { length: 320 }).notNull().unique(),
  passwordHash: text('passwordHash').notNull(),
});
export const sessions = mysqlTable('sessions', {
  tokenHash: varchar('tokenHash', { length: 64 }).primaryKey(),
  userId: int('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: datetime('expiresAt').notNull(),
}, table => [index('sessions_expiry_idx').on(table.expiresAt)]);

// Additive tenant foundation. Legacy global catalog/stock/prices are unchanged.
export const pricingJurisdictions = mysqlTable(
  "pricingJurisdictions",
  {
    countryCode: varchar("countryCode", { length: 2 }).primaryKey(),
    currencyCode: varchar("currencyCode", { length: 3 }).notNull(),
    minorUnitDigits: int("minorUnitDigits").notNull(),
  },
  t => [
    check(
      "jurisdiction_digits_check",
      sql`${t.minorUnitDigits} BETWEEN 0 AND 3`
    ),
  ]
);

export const organizations = mysqlTable(
  "organizations",
  {
    id: int("id").autoincrement().primaryKey(),
    type: mysqlEnum("type", ["pharmacy", "clinic", "provider"]).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    countryCode: varchar("countryCode", { length: 2 })
      .notNull()
      .references(() => pricingJurisdictions.countryCode, {
        onDelete: "restrict",
      }),
    registrationNumber: varchar("registrationNumber", {
      length: 100,
    }).notNull(),
    status: mysqlEnum("status", [
      "pending",
      "approved",
      "rejected",
      "suspended",
    ])
      .default("pending")
      .notNull(),
    createdBy: int("createdBy")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => [
    uniqueIndex("organization_country_registration_unique").on(
      t.countryCode,
      t.registrationNumber
    ),
    index("organization_status_id_idx").on(t.status, t.id),
    index("organization_creator_idx").on(t.createdBy),
  ]
);

export const organizationMemberships = mysqlTable(
  "organizationMemberships",
  {
    organizationId: int("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    role: mysqlEnum("role", [
      "owner",
      "manager",
      "inventory_staff",
      "viewer",
    ]).notNull(),
    status: mysqlEnum("status", ["pending", "active", "suspended"])
      .default("pending")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => [
    primaryKey({ columns: [t.organizationId, t.userId] }),
    index("membership_user_status_idx").on(
      t.userId,
      t.status,
      t.organizationId
    ),
  ]
);

export const pharmacyInventory = mysqlTable(
  "pharmacyInventory",
  {
    organizationId: int("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    productId: int("productId")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    quantity: int("quantity").default(0).notNull(),
    version: int("version").default(0).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => [
    primaryKey({ columns: [t.organizationId, t.productId] }),
    index("inventory_product_idx").on(t.productId),
    check("inventory_quantity_check", sql`${t.quantity} BETWEEN 0 AND 1000000`),
    check("inventory_version_check", sql`${t.version} >= 0`),
  ]
);

export const organizationAuditEvents = mysqlTable(
  "organizationAuditEvents",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    actorUserId: int("actorUserId")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    action: mysqlEnum("action", [
      "organization_applied",
      "organization_reviewed",
      "membership_updated",
      "stock_adjusted",
    ]).notNull(),
    reason: varchar("reason", { length: 500 }).notNull(),
    details: json("details").notNull(),
    requestId: varchar("requestId", { length: 36 }),
    requestHash: varchar("requestHash", { length: 64 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  t => [
    index("organization_audit_id_idx").on(t.organizationId, t.id),
    index("audit_actor_idx").on(t.actorUserId),
    uniqueIndex("organization_request_unique").on(
      t.organizationId,
      t.requestId
    ),
  ]
);

// No price rows are seeded, imported, used by checkout or writable through V1 APIs.
export const officialMedicinePrices = mysqlTable(
  "officialMedicinePrices",
  {
    id: int("id").autoincrement().primaryKey(),
    countryCode: varchar("countryCode", { length: 2 }).notNull(),
    productId: int("productId")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    amount: decimal("amount", { precision: 12, scale: 3 }).notNull(),
    sourceAuthority: varchar("sourceAuthority", { length: 200 }).notNull(),
    sourceReference: varchar("sourceReference", { length: 500 }).notNull(),
    effectiveFrom: datetime("effectiveFrom").notNull(),
    effectiveTo: datetime("effectiveTo"),
    verifiedAt: datetime("verifiedAt").notNull(),
  },
  t => [
    foreignKey({
      name: "official_price_jurisdiction_fk",
      columns: [t.countryCode],
      foreignColumns: [pricingJurisdictions.countryCode],
    }).onDelete("restrict"),
    uniqueIndex("official_price_effective_unique").on(
      t.countryCode,
      t.productId,
      t.effectiveFrom
    ),
    index("official_price_product_idx").on(t.productId),
    check("official_price_nonnegative", sql`${t.amount} >= 0`),
    check(
      "official_price_dates",
      sql`${t.effectiveTo} IS NULL OR ${t.effectiveTo} > ${t.effectiveFrom}`
    ),
  ]
);

// Immutable single-pharmacy relationship. No historical-order backfill.
export const pharmacyOrderAssignments = mysqlTable(
  "pharmacyOrderAssignments",
  {
    orderId: int("orderId")
      .primaryKey()
      .references(() => orders.id, { onDelete: "restrict" }),
    organizationId: int("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    assignedBy: int("assignedBy")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    assignedAt: timestamp("assignedAt").defaultNow().notNull(),
  },
  t => [
    index("assignment_organization_idx").on(t.organizationId),
    index("assignment_actor_idx").on(t.assignedBy),
  ]
);

// Opt-in simulated fulfillment; existing orders and their statuses remain intact.
export const fulfillmentOrders = mysqlTable(
  "fulfillmentOrders",
  {
    orderId: int("orderId")
      .primaryKey()
      .references(() => orders.id, { onDelete: "restrict" }),
    state: mysqlEnum("state", [
      "assignment_pending",
      "assigned",
      "accepted",
      "rejected",
      "preparing",
      "ready",
      "cancelled",
    ])
      .default("assignment_pending")
      .notNull(),
    version: int("version").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => [
    index("fulfillment_state_order_idx").on(t.state, t.orderId),
    check("fulfillment_version_check", sql`${t.version} >= 0`),
  ]
);

export const fulfillmentStockLines = mysqlTable(
  "fulfillmentStockLines",
  {
    orderId: int("orderId").notNull(),
    productId: int("productId")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    quantity: int("quantity").notNull(),
    state: mysqlEnum("state", ["held", "consumed", "released"])
      .default("held")
      .notNull(),
  },
  t => [
    primaryKey({ columns: [t.orderId, t.productId] }),
    foreignKey({
      name: "fulfillment_line_assignment_fk",
      columns: [t.orderId],
      foreignColumns: [pharmacyOrderAssignments.orderId],
    }).onDelete("restrict"),
    check(
      "fulfillment_line_quantity_check",
      sql`${t.quantity} BETWEEN 1 AND 1000000`
    ),
  ]
);

export const fulfillmentEvents = mysqlTable(
  "fulfillmentEvents",
  {
    id: int("id").autoincrement().primaryKey(),
    orderId: int("orderId")
      .notNull()
      .references(() => fulfillmentOrders.orderId, { onDelete: "restrict" }),
    organizationId: int("organizationId").references(() => organizations.id, {
      onDelete: "restrict",
    }),
    actorUserId: int("actorUserId")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    action: mysqlEnum("action", [
      "enrolled",
      "assigned",
      "accepted",
      "rejected",
      "preparing",
      "ready",
      "cancelled",
      "shipped",
      "delivered",
    ]).notNull(),
    reason: varchar("reason", { length: 500 }).notNull(),
    requestId: varchar("requestId", { length: 36 }).unique(),
    requestHash: varchar("requestHash", { length: 64 }),
    details: json("details").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  t => [
    index("fulfillment_event_order_idx").on(t.orderId, t.id),
    index("fulfillment_event_org_idx").on(t.organizationId, t.id),
    index("fulfillment_event_actor_idx").on(t.actorUserId),
  ]
);
