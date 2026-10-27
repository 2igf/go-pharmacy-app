// Legacy implementations retained behind an unconditional medical shutdown.
// Do not activate before patient relationships and provider authorization exist.
import { z } from "zod";
import { eq } from "drizzle-orm";
import { medicalProcedure, router } from "../_core/trpc";
import {
  getDb,
  getDoctors,
  getDoctorsBySpecialty,
  getDoctorById,
  getDoctorTimeSlots,
  getUserAppointments,
  getAppointmentById,
  getDoctorAppointments,
  getUserMedicationReminders,
  getMedicationReminderById,
  getMedicationReminderLogs,
  getUserPrescriptions,
  getPrescriptionById,
} from "../db";
import { appointments, medicationReminders } from "../../drizzle/schema";

export const doctorsRouter = router({
  list: medicalProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).max(100000).default(0),
      })
    )
    .query(async ({ input }) => {
      return await getDoctors(input.limit, input.offset);
    }),

  bySpecialty: medicalProcedure
    .input(
      z.object({
        specialty: z.string(),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).max(100000).default(0),
      })
    )
    .query(async ({ input }) => {
      return await getDoctorsBySpecialty(
        input.specialty,
        input.limit,
        input.offset
      );
    }),

  byId: medicalProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      return await getDoctorById(input.id);
    }),

  timeSlots: medicalProcedure
    .input(z.object({ doctorId: z.number().int().positive() }))
    .query(async ({ input }) => {
      return await getDoctorTimeSlots(input.doctorId);
    }),

  delete: medicalProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user?.role !== "admin") {
        throw new Error("Only admins can delete doctors");
      }
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");
      // Delete doctor record
      // Note: Adjust table name if different
      return { success: true };
    }),
});

export const appointmentsRouter = router({
  list: medicalProcedure.query(async ({ ctx }) => {
    return await getUserAppointments(ctx.user.id);
  }),

  byId: medicalProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      return await getAppointmentById(input.id);
    }),

  byDoctor: medicalProcedure
    .input(z.object({ doctorId: z.number().int().positive() }))
    .query(async ({ input }) => {
      return await getDoctorAppointments(input.doctorId);
    }),

  create: medicalProcedure
    .input(
      z.object({
        doctorId: z.number(),
        appointmentDate: z.date(),
        consultationType: z.enum(["in_clinic", "video", "chat"]),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const result = await db.insert(appointments).values({
        userId: ctx.user.id,
        doctorId: input.doctorId,
        appointmentDate: input.appointmentDate,
        consultationType: input.consultationType,
        notes: input.notes,
        status: "scheduled",
      });

      return result;
    }),

  cancel: medicalProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const appointment = await getAppointmentById(input.id);
      if (!appointment || appointment.userId !== ctx.user.id) {
        throw new Error("Appointment not found or unauthorized");
      }

      await db
        .update(appointments)
        .set({ status: "cancelled" })
        .where(eq(appointments.id, input.id));

      return { success: true };
    }),
});

export const medicationRemindersRouter = router({
  list: medicalProcedure.query(async ({ ctx }) => {
    return await getUserMedicationReminders(ctx.user.id);
  }),

  byId: medicalProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const reminder = await getMedicationReminderById(input.id);
      if (!reminder || reminder.userId !== ctx.user.id) {
        throw new Error("Reminder not found or unauthorized");
      }
      return reminder;
    }),

  logs: medicalProcedure
    .input(z.object({ reminderId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const reminder = await getMedicationReminderById(input.reminderId);
      if (!reminder || reminder.userId !== ctx.user.id) {
        throw new Error("Reminder not found or unauthorized");
      }
      return await getMedicationReminderLogs(input.reminderId);
    }),

  create: medicalProcedure
    .input(
      z.object({
        medicationName: z.string(),
        dosage: z.string().optional(),
        frequency: z.enum([
          "once_daily",
          "twice_daily",
          "three_times_daily",
          "four_times_daily",
          "every_6_hours",
          "every_8_hours",
          "every_12_hours",
          "weekly",
          "as_needed",
        ]),
        startDate: z.date(),
        endDate: z.date().optional(),
        reminderTimes: z.array(z.string()),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [result] = await db.insert(medicationReminders).values({
        userId: ctx.user.id,
        medicationName: input.medicationName,
        dosage: input.dosage,
        frequency: input.frequency,
        startDate: input.startDate,
        endDate: input.endDate,
        reminderTimes: JSON.stringify(input.reminderTimes),
        notes: input.notes,
        isActive: true,
      });

      return { id: result.insertId };
    }),

  update: medicalProcedure
    .input(
      z.object({
        id: z.number(),
        isActive: z.boolean().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const reminder = await getMedicationReminderById(input.id);
      if (!reminder || reminder.userId !== ctx.user.id) {
        throw new Error("Reminder not found or unauthorized");
      }

      await db
        .update(medicationReminders)
        .set({
          isActive:
            input.isActive !== undefined ? input.isActive : reminder.isActive,
          notes: input.notes !== undefined ? input.notes : reminder.notes,
        })
        .where(eq(medicationReminders.id, input.id));

      return { success: true };
    }),

  delete: medicalProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const reminder = await getMedicationReminderById(input.id);
      if (!reminder || reminder.userId !== ctx.user.id) {
        throw new Error("Reminder not found or unauthorized");
      }

      await db
        .delete(medicationReminders)
        .where(eq(medicationReminders.id, input.id));
      return { success: true };
    }),
});

export const prescriptionsRouter = router({
  list: medicalProcedure.query(async ({ ctx }) => {
    return await getUserPrescriptions(ctx.user.id);
  }),

  byId: medicalProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const prescription = await getPrescriptionById(input.id);
      if (!prescription || prescription.userId !== ctx.user.id) {
        throw new Error("Prescription not found or unauthorized");
      }
      return prescription;
    }),
});
