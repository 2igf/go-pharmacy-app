import { eq, and, desc, gte, lte, like, or } from "drizzle-orm";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  products,
  doctors,
  appointments,
  orders,
  cartItems,
  medicationReminders,
  userAddresses,
  prescriptions,
  doctorTimeSlots,
  medicationReminderLogs,
  notifications as notificationsTable,
  InsertNotification,
} from "../drizzle/schema";
import { TRPCError } from "@trpc/server";
import mysql from "mysql2/promise";
import type { PoolConnection } from "mysql2";

let _pool: mysql.Pool | undefined;
let _db: MySql2Database | undefined;
export async function getDb() {
  if (!process.env.DATABASE_URL)
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "Database is not configured",
    });
  if (!_db) {
    _pool = mysql.createPool({
      uri: process.env.DATABASE_URL,
      connectionLimit: 5,
      timezone: "Z",
    });
    // timezone:"Z" controls driver conversion, not MySQL's session timezone.
    // Queue this before pooled application queries; TIMESTAMP reads must be UTC.
    _pool.pool.on("connection", (connection: PoolConnection) => {
      connection.query("SET time_zone = '+00:00'", error => {
        if (error) connection.destroy(); // Never continue with inconsistent dates.
      });
    });
    _db = drizzle(_pool);
  }
  return _db!;
}
export async function closeDb() {
  await _pool?.end();
  _pool = undefined;
  _db = undefined;
}

// ============= USER QUERIES =============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = [
      "name",
      "email",
      "phone",
      "loginMethod",
      "profileImage",
    ] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============= PRODUCT QUERIES =============

export async function getProducts(limit: number = 20, offset: number = 0) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(products)
    .where(eq(products.isActive, true))
    .orderBy(products.id)
    .limit(limit)
    .offset(offset);
}

export async function getProductsByCategory(
  category: string,
  limit: number = 20,
  offset: number = 0
) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(products)
    .where(
      and(
        eq(
          products.category,
          category as typeof products.$inferSelect.category
        ),
        eq(products.isActive, true)
      )
    )
    .limit(limit)
    .offset(offset);
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function searchProducts(query: string, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(products)
    .where(
      // Simple search - can be enhanced with full-text search
      and(
        eq(products.isActive, true),
        or(
          like(products.name, `%${query.replace(/[\\%_]/g, "\\$&")}%`),
          like(products.description, `%${query.replace(/[\\%_]/g, "\\$&")}%`)
        )
      )
    )
    .limit(limit);
}

// ============= DOCTOR QUERIES =============

export async function getDoctors(limit: number = 20, offset: number = 0) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(doctors).limit(limit).offset(offset);
}

export async function getDoctorsBySpecialty(
  specialty: string,
  limit: number = 20,
  offset: number = 0
) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(doctors)
    .where(eq(doctors.specialty, specialty as any))
    .limit(limit)
    .offset(offset);
}

export async function getDoctorById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(doctors)
    .where(eq(doctors.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getDoctorTimeSlots(doctorId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(doctorTimeSlots)
    .where(eq(doctorTimeSlots.doctorId, doctorId));
}

// ============= APPOINTMENT QUERIES =============

export async function getUserAppointments(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(appointments)
    .where(eq(appointments.userId, userId))
    .orderBy(desc(appointments.appointmentDate));
}

export async function getAppointmentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getDoctorAppointments(doctorId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(appointments)
    .where(eq(appointments.doctorId, doctorId))
    .orderBy(desc(appointments.appointmentDate));
}

// ============= ORDER QUERIES =============

export async function getUserOrders(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt));
}

export async function getOrderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============= CART QUERIES =============

export async function getUserCartItems(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(cartItems).where(eq(cartItems.userId, userId));
}

export async function getCartItemById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(cartItems)
    .where(eq(cartItems.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============= MEDICATION REMINDER QUERIES =============

export async function getUserMedicationReminders(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(medicationReminders)
    .where(eq(medicationReminders.userId, userId))
    .orderBy(desc(medicationReminders.createdAt));
}

export async function getMedicationReminderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(medicationReminders)
    .where(eq(medicationReminders.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getMedicationReminderLogs(reminderId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(medicationReminderLogs)
    .where(eq(medicationReminderLogs.reminderId, reminderId))
    .orderBy(desc(medicationReminderLogs.scheduledTime));
}

// ============= ADDRESS QUERIES =============

export async function getUserAddresses(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(userAddresses)
    .where(eq(userAddresses.userId, userId));
}

export async function getAddressById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(userAddresses)
    .where(eq(userAddresses.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============= PRESCRIPTION QUERIES =============

export async function getUserPrescriptions(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(prescriptions)
    .where(eq(prescriptions.userId, userId))
    .orderBy(desc(prescriptions.issuedDate));
}

export async function getPrescriptionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(prescriptions)
    .where(eq(prescriptions.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============= NOTIFICATION QUERIES =============

export async function getUserNotifications(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt));
}

export async function getUnreadNotificationCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;

  const result = await db
    .select()
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.userId, userId),
        eq(notificationsTable.isRead, false)
      )
    );
  return result.length;
}

export async function createNotification(notification: InsertNotification) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.insert(notificationsTable).values(notification);
  return result;
}

export async function markNotificationAsRead(id: number, userId: number) {
  const db = await getDb();
  if (!db) return false;

  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(
      and(eq(notificationsTable.id, id), eq(notificationsTable.userId, userId))
    );
  return true;
}

export async function deleteNotification(id: number, userId: number) {
  const db = await getDb();
  if (!db) return false;

  await db
    .delete(notificationsTable)
    .where(
      and(eq(notificationsTable.id, id), eq(notificationsTable.userId, userId))
    );
  return true;
}
