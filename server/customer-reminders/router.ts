import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { users } from "../../drizzle/schema";
import {
  customerReminders,
  customerReminderEvents,
} from "../../drizzle/customer-reminders";
import {
  createReminderSchema,
  updateReminderSchema,
  reminderIdentitySchema,
  reminderTimezoneSchema,
  isScheduledOccurrence,
  MAX_ACTIVE_REMINDERS,
  MAX_REMINDER_DEFINITIONS,
  REMINDER_REPORT_WINDOW_MS,
} from "../../shared/customer-reminders";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";

type Db = Awaited<ReturnType<typeof getDb>>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Reminder = typeof customerReminders.$inferSelect;
const missing = () =>
  new TRPCError({ code: "NOT_FOUND", message: "التذكير غير موجود" });
const conflict = () =>
  new TRPCError({
    code: "CONFLICT",
    message: "تم تغيير التذكير. حدّث الصفحة وحاول مجدداً",
  });
const identityVersion = z
  .object({
    id: z.number().int().positive(),
    version: z.number().int().positive(),
  })
  .strict();

// Read the persisted platform role; a stale context/header cannot grant personal access.
const customerProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const db = await getDb();
  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, ctx.user.id))
    .limit(1);
  if (user?.role !== "user")
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "هذه الخدمة متاحة لحساب العميل فقط",
    });
  return next({ ctx });
});
async function ownerTransaction<T>(
  userId: number,
  work: (tx: Tx) => Promise<T>
) {
  const db = await getDb();
  return db.transaction(async tx => {
    // Per-owner serialization prevents the active-limit and retry races, including distinct reminders.
    const [user] = await tx
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .for("update");
    if (user?.role !== "user")
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "هذه الخدمة متاحة لحساب العميل فقط",
      });
    return work(tx);
  });
}
async function ownReminder(
  tx: Tx | Db,
  userId: number,
  id: number,
  lock = false
) {
  const query = tx
    .select()
    .from(customerReminders)
    .where(
      and(eq(customerReminders.id, id), eq(customerReminders.userId, userId))
    )
    .limit(1);
  const [row] = await (lock ? query.for("update") : query);
  if (!row) throw missing();
  return row;
}
function visible(row: Reminder) {
  const { requestHash: _hash, requestId: _request, ...result } = row;
  return result;
}
function normalizedFields(
  input:
    | z.output<typeof createReminderSchema>
    | z.output<typeof updateReminderSchema>
) {
  return {
    medicationName: input.medicationName,
    dosage: input.dosage || null,
    notes: input.notes || null,
    times: input.times,
    weekdays: input.weekdays,
    startDate: input.startDate,
    endDate: input.endDate || null,
    timezone: input.timezone,
    enabled: input.enabled,
    discreet: input.discreet,
  };
}
async function checkCapacity(
  tx: Tx,
  userId: number,
  creating: boolean,
  enabling: boolean
) {
  const [counts] = await tx
    .select({
      total: sql<number>`count(*)`,
      active: sql<number>`coalesce(sum(${customerReminders.enabled}), 0)`,
    })
    .from(customerReminders)
    .where(eq(customerReminders.userId, userId));
  if (
    (creating && Number(counts.total) >= MAX_REMINDER_DEFINITIONS) ||
    (enabling && Number(counts.active) >= MAX_ACTIVE_REMINDERS)
  )
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "وصلت إلى حد التذكيرات. أوقف تذكيراً أو احذفه أولاً",
    });
}

export const manualRemindersRouter = router({
  list: customerProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    return (
      await db
        .select()
        .from(customerReminders)
        .where(eq(customerReminders.userId, ctx.user.id))
        .orderBy(desc(customerReminders.id))
        .limit(MAX_REMINDER_DEFINITIONS)
    ).map(visible);
  }),
  detail: customerProcedure
    .input(reminderIdentitySchema)
    .query(async ({ ctx, input }) =>
      visible(await ownReminder(await getDb(), ctx.user.id, input.id))
    ),
  create: customerProcedure
    .input(createReminderSchema)
    .mutation(async ({ ctx, input }) =>
      ownerTransaction(ctx.user.id, async tx => {
        const fields = normalizedFields(input);
        const requestHash = createHash("sha256")
          .update(JSON.stringify(fields))
          .digest("hex");
        const [existing] = await tx
          .select()
          .from(customerReminders)
          .where(
            and(
              eq(customerReminders.userId, ctx.user.id),
              eq(customerReminders.requestId, input.requestId)
            )
          )
          .limit(1);
        if (existing) {
          if (existing.requestHash !== requestHash) throw conflict();
          return visible(existing);
        }
        await checkCapacity(tx, ctx.user.id, true, input.enabled);
        const [result] = await tx.insert(customerReminders).values({
          ...fields,
          userId: ctx.user.id,
          requestId: input.requestId,
          requestHash,
        });
        return visible(await ownReminder(tx, ctx.user.id, result.insertId));
      })
    ),
  update: customerProcedure
    .input(updateReminderSchema)
    .mutation(async ({ ctx, input }) =>
      ownerTransaction(ctx.user.id, async tx => {
        const row = await ownReminder(tx, ctx.user.id, input.id, true);
        if (row.version !== input.version) throw conflict();
        if (!row.enabled && input.enabled)
          await checkCapacity(tx, ctx.user.id, false, true);
        await tx
          .update(customerReminders)
          .set({ ...normalizedFields(input), version: row.version + 1 })
          .where(
            and(
              eq(customerReminders.id, row.id),
              eq(customerReminders.userId, ctx.user.id),
              eq(customerReminders.version, input.version)
            )
          );
        return visible(await ownReminder(tx, ctx.user.id, row.id));
      })
    ),
  remove: customerProcedure
    .input(identityVersion)
    .mutation(async ({ ctx, input }) =>
      ownerTransaction(ctx.user.id, async tx => {
        const row = await ownReminder(tx, ctx.user.id, input.id, true);
        if (row.version !== input.version) throw conflict();
        // FK cascades only this new definition's user-reported history; legacy clinical data is unrelated.
        await tx
          .delete(customerReminders)
          .where(
            and(
              eq(customerReminders.id, row.id),
              eq(customerReminders.userId, ctx.user.id),
              eq(customerReminders.version, input.version)
            )
          );
        return { success: true as const };
      })
    ),
  history: customerProcedure
    .input(
      z
        .object({
          id: z.number().int().positive(),
          limit: z.number().int().min(1).max(100).default(50),
        })
        .strict()
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      await ownReminder(db, ctx.user.id, input.id);
      return db
        .select({
          id: customerReminderEvents.id,
          reminderId: customerReminderEvents.reminderId,
          scheduledAt: customerReminderEvents.scheduledAt,
          status: customerReminderEvents.status,
          timezone: customerReminderEvents.timezone,
          source: customerReminderEvents.source,
          recordedAt: customerReminderEvents.recordedAt,
        })
        .from(customerReminderEvents)
        .innerJoin(
          customerReminders,
          eq(customerReminderEvents.reminderId, customerReminders.id)
        )
        .where(
          and(
            eq(customerReminders.userId, ctx.user.id),
            eq(customerReminders.id, input.id)
          )
        )
        .orderBy(
          desc(customerReminderEvents.scheduledAt),
          desc(customerReminderEvents.id)
        )
        .limit(input.limit);
    }),
  record: customerProcedure
    .input(
      z
        .object({
          id: z.number().int().positive(),
          version: z.number().int().positive(),
          scheduledAt: z.iso.datetime(),
          status: z.enum(["taken", "skipped"]),
          timezone: reminderTimezoneSchema.optional(),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) =>
      ownerTransaction(ctx.user.id, async tx => {
        const row = await ownReminder(tx, ctx.user.id, input.id, true);
        if (row.version !== input.version) throw conflict();
        const instant = new Date(input.scheduledAt);
        const timezone = input.timezone ?? row.timezone;
        // Retries return the immutable original statement even if the definition was subsequently paused.
        const [existing] = await tx
          .select()
          .from(customerReminderEvents)
          .innerJoin(
            customerReminders,
            eq(customerReminderEvents.reminderId, customerReminders.id)
          )
          .where(
            and(
              eq(customerReminders.id, row.id),
              eq(customerReminders.userId, ctx.user.id),
              eq(customerReminderEvents.scheduledAt, instant)
            )
          )
          .limit(1);
        if (existing) {
          const event = existing.customerReminderEvents;
          if (event.status !== input.status || event.timezone !== timezone)
            throw conflict();
          return event;
        }
        const now = Date.now();
        if (
          !row.enabled ||
          !isScheduledOccurrence({ ...row, timezone }, instant) ||
          instant.getTime() > now ||
          instant.getTime() < now - REMINDER_REPORT_WINDOW_MS ||
          instant.getTime() <
            Math.floor(row.createdAt.getTime() / 60000) * 60000
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "يمكن تسجيل وقت مجدول حدث خلال آخر سبعة أيام بعد إنشاء التذكير، عندما يكون مفعّلاً",
          });
        const [result] = await tx.insert(customerReminderEvents).values({
          reminderId: row.id,
          scheduledAt: instant,
          timezone,
          status: input.status,
          source: "user_reported",
        });
        const [event] = await tx
          .select({
            id: customerReminderEvents.id,
            reminderId: customerReminderEvents.reminderId,
            scheduledAt: customerReminderEvents.scheduledAt,
            status: customerReminderEvents.status,
            timezone: customerReminderEvents.timezone,
            source: customerReminderEvents.source,
            recordedAt: customerReminderEvents.recordedAt,
          })
          .from(customerReminderEvents)
          .innerJoin(
            customerReminders,
            eq(customerReminderEvents.reminderId, customerReminders.id)
          )
          .where(
            and(
              eq(customerReminderEvents.id, result.insertId),
              eq(customerReminders.id, row.id),
              eq(customerReminders.userId, ctx.user.id)
            )
          )
          .limit(1);
        return event;
      })
    ),
});
