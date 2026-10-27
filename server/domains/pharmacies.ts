import { z } from "zod";
import { stockAdjustmentSchema } from "../../shared/pharmacy-policy";
import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import {
  applyPharmacy,
  myPharmacies,
  listPharmacies,
  reviewPharmacy,
  setPharmacyMembership,
  listPharmacyInventory,
  adjustPharmacyInventory,
  listPharmacyMembers,
  listPharmacyAudit,
} from "../pharmacy";

const id = z.number().int().positive().max(2147483647);
const limit = z.number().int().min(1).max(100).default(50);
const afterId = z.number().int().min(0).max(2147483647).default(0);
const reason = z.string().trim().min(3).max(500);
const status = z.enum(["pending", "approved", "rejected", "suspended"]);

export const pharmaciesRouter = router({
  submitApplication: protectedProcedure
    .input(
      z
        .object({
          name: z.string().trim().min(3).max(200),
          registrationNumber: z
            .string()
            .trim()
            .min(3)
            .max(100)
            .regex(/^[A-Za-z0-9/-]+$/)
            .transform(v => v.toUpperCase()),
          countryCode: z.literal("JO"),
        })
        .strict()
    )
    .mutation(({ ctx, input }) => applyPharmacy(ctx.user.id, input)),
  mine: protectedProcedure
    .input(z.object({ afterId, limit }).strict())
    .query(({ ctx, input }) => myPharmacies(ctx.user.id, input)),
  inventory: router({
    list: protectedProcedure
      .input(
        z
          .object({ organizationId: id, afterProductId: afterId, limit })
          .strict()
      )
      .query(({ ctx, input }) => listPharmacyInventory(ctx.user.id, input)),
    adjust: protectedProcedure
      .input(stockAdjustmentSchema)
      .mutation(({ ctx, input }) =>
        adjustPharmacyInventory(ctx.user.id, input)
      ),
  }),
  members: router({
    list: protectedProcedure
      .input(
        z.object({ organizationId: id, afterUserId: afterId, limit }).strict()
      )
      .query(({ ctx, input }) => listPharmacyMembers(ctx.user.id, input)),
  }),
  audit: router({
    list: protectedProcedure
      .input(
        z
          .object({ organizationId: id, beforeId: id.optional(), limit })
          .strict()
      )
      .query(({ ctx, input }) => listPharmacyAudit(ctx.user.id, input)),
  }),
  administration: router({
    list: adminProcedure
      .input(z.object({ status: status.optional(), afterId, limit }).strict())
      .query(({ input }) => listPharmacies(input)),
    review: adminProcedure
      .input(z.object({ organizationId: id, status, reason }).strict())
      .mutation(({ ctx, input }) => reviewPharmacy(ctx.user.id, input)),
    setMembership: adminProcedure
      .input(
        z
          .object({
            organizationId: id,
            userId: id,
            role: z.enum(["owner", "manager", "inventory_staff", "viewer"]),
            status: z.enum(["pending", "active", "suspended"]),
            reason,
          })
          .strict()
      )
      .mutation(({ ctx, input }) => setPharmacyMembership(ctx.user.id, input)),
  }),
});
