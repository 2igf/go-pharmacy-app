import { z } from "zod";

/** Existing backend rules, shared with UI for hints/validation, never a grant. */
export const organizationTransitions = {
  pending: ["approved", "rejected"],
  approved: ["suspended"],
  rejected: ["pending"],
  suspended: ["approved", "rejected"],
} as const;
export const stockAdjustmentSchema = z
  .object({
    organizationId: z.number().int().positive().max(2147483647),
    productId: z.number().int().positive().max(2147483647),
    delta: z
      .number()
      .int()
      .min(-100000)
      .max(100000)
      .refine(v => v !== 0),
    expectedVersion: z.number().int().min(0).max(2147483646),
    requestId: z
      .string()
      .uuid()
      .transform(v => v.toLowerCase()),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();
