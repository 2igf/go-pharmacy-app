import { z } from "zod";
import { desc } from "drizzle-orm";
import { adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { orderDetail, updateOrderStatus } from "../commerce";
import { statuses } from "../commerce-rules";
import { orders } from "../../drizzle/schema";

export const adminRouter = router({
  orders: adminProcedure.query(async () => {
    const db = await getDb();
    return db.select().from(orders).orderBy(desc(orders.createdAt)).limit(100);
  }),
  order: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(({ ctx, input }) => orderDetail(input.id, ctx.user.id, true)),
  updateStatus: adminProcedure
    .input(
      z.object({ id: z.number().int().positive(), status: z.enum(statuses) })
    )
    .mutation(({ ctx, input }) =>
      updateOrderStatus(input.id, input.status, ctx.user.id)
    ),
});
