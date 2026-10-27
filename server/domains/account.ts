import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, getUserAddresses, getAddressById } from "../db";
import { userAddresses } from "../../drizzle/schema";

export const addressesRouter = router({
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
});

export const notificationsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { getUserNotifications } = await import("../db");
    return await getUserNotifications(ctx.user.id);
  }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const { getUnreadNotificationCount } = await import("../db");
    return await getUnreadNotificationCount(ctx.user.id);
  }),

  markAsRead: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const { markNotificationAsRead } = await import("../db");
      return await markNotificationAsRead(input.id, ctx.user.id);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const { deleteNotification } = await import("../db");
      return await deleteNotification(input.id, ctx.user.id);
    }),
});
