import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import {
  publicProcedure,
  protectedProcedure,
  adminProcedure,
  medicalProcedure,
  disabledProcedure,
  router,
} from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  checkout,
  changeCart,
  cartQuote,
  orderDetail,
  updateOrderStatus,
} from "./commerce";
import { statuses } from "./commerce-rules";
import { authRouter } from "./auth";
import { z } from "zod";
import { getDb } from "./db";
import {
  getProducts,
  getProductsByCategory,
  getProductById,
  searchProducts,
  getDoctors,
  getDoctorsBySpecialty,
  getDoctorById,
  getDoctorTimeSlots,
  getUserAppointments,
  getAppointmentById,
  getDoctorAppointments,
  getUserOrders,
  getOrderById,
  getUserCartItems,
  getCartItemById,
  getUserMedicationReminders,
  getMedicationReminderById,
  getMedicationReminderLogs,
  getUserAddresses,
  getAddressById,
  getUserPrescriptions,
  getPrescriptionById,
} from "./db";
import {
  products,
  appointments,
  cartItems,
  orders,
  orderItems,
  medicationReminders,
  medicationReminderLogs,
  userAddresses,
  prescriptions,
} from "../drizzle/schema";

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,

  // ============= PRODUCTS ROUTER =============
  products: router({
    list: publicProcedure
      .input(
        z.object({
          limit: z.number().int().min(1).max(100).default(20),
          offset: z.number().int().min(0).max(100000).default(0),
        })
      )
      .query(async ({ input }) => {
        return await getProducts(input.limit, input.offset);
      }),

    byCategory: publicProcedure
      .input(
        z.object({
          category: z.enum([
            "medications",
            "medical_supplies",
            "natural_products",
            "skincare",
            "baby_care",
            "pet_care",
          ]),
          limit: z.number().int().min(1).max(100).default(20),
          offset: z.number().int().min(0).max(100000).default(0),
        })
      )
      .query(async ({ input }) => {
        return await getProductsByCategory(
          input.category,
          input.limit,
          input.offset
        );
      }),

    byId: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        return await getProductById(input.id);
      }),

    search: publicProcedure
      .input(
        z.object({
          query: z.string().trim().min(1).max(100),
          limit: z.number().int().min(1).max(100).default(20),
        })
      )
      .query(async ({ input }) => {
        return await searchProducts(input.query, input.limit);
      }),

    create: adminProcedure
      .input(
        z.object({
          name: z.string().trim().min(1).max(255),
          price: z.string().regex(/^\d{1,8}(\.\d{1,2})?$/),
          category: z.enum([
            "medications",
            "medical_supplies",
            "natural_products",
            "skincare",
            "baby_care",
            "pet_care",
          ]),
          description: z.string().max(5000).optional(),
          stock: z
            .string()
            .regex(/^\d{1,6}$/)
            .optional(),
          requiresPrescription: z.boolean().optional(),
          image: z
            .string()
            .max(2048)
            .refine(
              v => !v || /^https:\/\//.test(v),
              "Image must be an HTTPS URL"
            )
            .optional(),
          manufacturer: z.string().max(255).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin") {
          throw new Error("Only admins can create products");
        }
        const db = await getDb();
        if (!db) throw new Error("Database connection failed");
        const [result] = await db.insert(products).values({
          name: input.name,
          price: input.price,
          category: input.category,
          description: input.description || null,
          stock: input.stock ? parseInt(input.stock) : 0,
          requiresPrescription: input.requiresPrescription || false,
          image: input.image || null,
          manufacturer: input.manufacturer || null,
        });
        return { id: result?.insertId || 0 };
      }),

    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().trim().min(1).max(255).optional(),
          price: z
            .string()
            .regex(/^\d{1,8}(\.\d{1,2})?$/)
            .optional(),
          category: z
            .enum([
              "medications",
              "medical_supplies",
              "natural_products",
              "skincare",
              "baby_care",
              "pet_care",
            ])
            .optional(),
          description: z.string().max(5000).optional(),
          stock: z
            .string()
            .regex(/^\d{1,6}$/)
            .optional(),
          requiresPrescription: z.boolean().optional(),
          image: z
            .string()
            .max(2048)
            .refine(
              v => !v || /^https:\/\//.test(v),
              "Image must be an HTTPS URL"
            )
            .optional(),
          manufacturer: z.string().max(255).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin") {
          throw new Error("Only admins can update products");
        }
        const db = await getDb();
        if (!db) throw new Error("Database connection failed");
        const updateData: Partial<typeof products.$inferInsert> = {};
        if (input.name) updateData.name = input.name;
        if (input.price) updateData.price = input.price;
        if (input.category) updateData.category = input.category;
        if (input.description !== undefined)
          updateData.description = input.description || null;
        if (input.stock !== undefined) updateData.stock = parseInt(input.stock);
        if (input.requiresPrescription !== undefined)
          updateData.requiresPrescription = input.requiresPrescription;
        if (input.image !== undefined) updateData.image = input.image || null;
        if (input.manufacturer !== undefined)
          updateData.manufacturer = input.manufacturer || null;

        await db
          .update(products)
          .set(updateData)
          .where(eq(products.id, input.id));
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin") {
          throw new Error("Only admins can delete products");
        }
        const db = await getDb();
        if (!db) throw new Error("Database connection failed");
        await db
          .update(products)
          .set({ isActive: false })
          .where(eq(products.id, input.id));
        return { success: true };
      }),
  }),

  // ============= DOCTORS ROUTER =============
  doctors: router({
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
  }),

  // ============= APPOINTMENTS ROUTER =============
  appointments: router({
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
  }),

  // ============= CART ROUTER =============
  cart: router({
    list: protectedProcedure.query(({ ctx }) => getUserCartItems(ctx.user.id)),
    quote: protectedProcedure.query(({ ctx }) => cartQuote(ctx.user.id)),
    add: protectedProcedure
      .input(
        z.object({
          productId: z.number().int().positive(),
          quantity: z.number().int().min(1).max(99),
        })
      )
      .mutation(({ ctx, input }) => changeCart(ctx.user.id, input)),
    remove: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ ctx, input }) => changeCart(ctx.user.id, input)),
    updateQuantity: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          quantity: z.number().int().min(1).max(99),
        })
      )
      .mutation(({ ctx, input }) => changeCart(ctx.user.id, input)),
    clear: protectedProcedure.mutation(({ ctx }) =>
      changeCart(ctx.user.id, { clear: true })
    ),
  }),
  orders: router({
    list: protectedProcedure.query(({ ctx }) => getUserOrders(ctx.user.id)),
    byId: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(({ ctx, input }) => orderDetail(input.id, ctx.user.id)),
    create: protectedProcedure
      .input(
        z
          .object({
            addressId: z.number().int().positive(),
            idempotencyKey: z.string().uuid(),
            contactName: z.string().trim().min(2).max(100),
            contactPhone: z.string().regex(/^[+0-9 ()-]{6,30}$/),
            expectedTotal: z.string().regex(/^\d{1,8}\.\d{2}$/),
            paymentMethod: z.literal("cash"),
            simulationAcknowledged: z.literal(true),
            expectedCartHash: z.string().regex(/^[a-f0-9]{64}$/),
          })
          .strict()
      )
      .mutation(({ ctx, input }) => checkout(ctx.user.id, input)),
  }),
  admin: router({
    orders: adminProcedure.query(async () => {
      const db = await getDb();
      return db
        .select()
        .from(orders)
        .orderBy(desc(orders.createdAt))
        .limit(100);
    }),
    order: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(({ ctx, input }) => orderDetail(input.id, ctx.user.id, true)),
    updateStatus: adminProcedure
      .input(
        z.object({ id: z.number().int().positive(), status: z.enum(statuses) })
      )
      .mutation(({ input }) => updateOrderStatus(input.id, input.status)),
  }),

  // ============= MEDICATION REMINDERS ROUTER =============
  medicationReminders: router({
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
  }),

  // ============= ADDRESSES ROUTER =============
  addresses: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await getUserAddresses(ctx.user.id);
    }),

    byId: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        const address = await getAddressById(input.id);
        if (!address || address.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Address not found",
          });
        }
        return address;
      }),

    create: protectedProcedure
      .input(
        z.object({
          label: z.string().trim().max(50).optional(),
          address: z.string().trim().min(5).max(500),
          latitude: z
            .string()
            .regex(/^-?\d{1,2}(\.\d{1,8})?$/)
            .refine(v => Math.abs(Number(v)) <= 90)
            .optional(),
          longitude: z
            .string()
            .regex(/^-?\d{1,3}(\.\d{1,8})?$/)
            .refine(v => Math.abs(Number(v)) <= 180)
            .optional(),
          isDefault: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const [result] = await db.insert(userAddresses).values({
          userId: ctx.user.id,
          label: input.label,
          address: input.address,
          latitude: input.latitude as any,
          longitude: input.longitude as any,
          isDefault: input.isDefault || false,
        });

        return { id: result.insertId };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const address = await getAddressById(input.id);
        if (!address || address.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Address not found",
          });
        }

        await db.delete(userAddresses).where(eq(userAddresses.id, input.id));
        return { success: true };
      }),
  }),

  // ============= NOTIFICATIONS ROUTER =============
  notifications: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getUserNotifications } = await import("./db");
      return await getUserNotifications(ctx.user.id);
    }),

    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      const { getUnreadNotificationCount } = await import("./db");
      return await getUnreadNotificationCount(ctx.user.id);
    }),

    markAsRead: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const { markNotificationAsRead } = await import("./db");
        return await markNotificationAsRead(input.id, ctx.user.id);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const { deleteNotification } = await import("./db");
        return await deleteNotification(input.id, ctx.user.id);
      }),
  }),

  // ============= PRESCRIPTIONS ROUTER =============
  prescriptions: router({
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
  }),
});

export type AppRouter = typeof appRouter;

// Import eq from drizzle-orm for use in mutations
import { eq, desc } from "drizzle-orm";
