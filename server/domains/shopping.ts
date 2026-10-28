import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { checkout, changeCart, cartQuote, orderDetail } from "../commerce";
import { getUserCartItems, getUserOrders } from "../db";
import { withCustomerFulfillment } from "../fulfillment";
import { checkoutSchema } from "../../shared/checkout";

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
    .input(checkoutSchema)
    .mutation(({ ctx, input }) => checkout(ctx.user.id, input)),
});
