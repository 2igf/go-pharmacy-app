import { z } from "zod";
import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import {
  fulfillmentId,
  fulfillmentRequest,
  fulfillmentAssignSchema,
  fulfillmentMutationSchema,
} from "../../shared/fulfillment";
import {
  fulfillmentEnabled,
  enrollOrder,
  assignOrder,
  transitionOrder,
  listAssignedOrders,
  assignedOrderDetail,
  eligiblePharmacies,
  adminFulfillmentOrders,
} from "../fulfillment";
const after = z.number().int().min(0).max(2147483647).default(0);
const limit = z.number().int().min(1).max(50).default(25);
export const fulfillmentRouter = router({
  configuration: protectedProcedure.query(() => ({
    enabled: fulfillmentEnabled(),
    simulated: true as const,
  })),
  enroll: adminProcedure
    .input(fulfillmentRequest)
    .mutation(({ ctx, input }) => enrollOrder(ctx.user.id, input)),
  assign: adminProcedure
    .input(fulfillmentAssignSchema)
    .mutation(({ ctx, input }) => assignOrder(ctx.user.id, input)),
  eligible: adminProcedure
    .input(z.object({ orderId: fulfillmentId, afterId: after, limit }).strict())
    .query(({ input }) => eligiblePharmacies(input)),
  administration: router({
    list: adminProcedure
      .input(z.object({ afterOrderId: after, limit }).strict())
      .query(({ input }) => adminFulfillmentOrders(input)),
  }),
  list: protectedProcedure
    .input(
      z
        .object({ organizationId: fulfillmentId, afterOrderId: after, limit })
        .strict()
    )
    .query(({ ctx, input }) => listAssignedOrders(ctx.user.id, input)),
  detail: protectedProcedure
    .input(
      z
        .object({ organizationId: fulfillmentId, orderId: fulfillmentId })
        .strict()
    )
    .query(({ ctx, input }) => assignedOrderDetail(ctx.user.id, input)),
  transition: protectedProcedure
    .input(fulfillmentMutationSchema)
    .mutation(({ ctx, input }) => transitionOrder(ctx.user.id, input)),
});
