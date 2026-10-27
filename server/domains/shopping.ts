import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { checkout, changeCart, cartQuote, orderDetail } from "../commerce";
import { getUserCartItems, getUserOrders } from "../db";
import { withCustomerFulfillment } from "../fulfillment";

export const cartRouter = router({
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
});

export const ordersRouter = router({
  list: protectedProcedure.query(async ({ ctx }) =>
    withCustomerFulfillment(await getUserOrders(ctx.user.id))
  ),
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
});
