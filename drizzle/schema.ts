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
  index
} from "drizzle-orm/mysql-core";

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
