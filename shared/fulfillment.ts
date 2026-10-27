import { z } from "zod";
export const fulfillmentStates = [
  "assignment_pending",
  "assigned",
  "accepted",
  "rejected",
  "preparing",
  "ready",
  "cancelled",
] as const;
export type FulfillmentState = (typeof fulfillmentStates)[number];
export const fulfillmentActions = [
  "accept",
  "reject",
  "prepare",
  "ready",
] as const;
export const fulfillmentId = z.number().int().positive().max(2147483647);
export const fulfillmentRequest = z
  .object({
    orderId: fulfillmentId,
    requestId: z
      .string()
      .uuid()
      .transform(v => v.toLowerCase()),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();
export const fulfillmentAssignSchema = fulfillmentRequest
  .extend({
    organizationId: fulfillmentId,
    expectedVersion: z.number().int().min(0).max(2147483646),
  })
  .strict();
export const fulfillmentMutationSchema = fulfillmentAssignSchema
  .extend({ action: z.enum(fulfillmentActions) })
  .strict();
export function fulfillmentTransition(
  state: FulfillmentState,
  action: (typeof fulfillmentActions)[number]
) {
  const transitions = {
    accept: { from: "assigned", state: "accepted", orderStatus: "confirmed" },
    reject: { from: "assigned", state: "rejected", orderStatus: "pending" },
    prepare: {
      from: "accepted",
      state: "preparing",
      orderStatus: "processing",
    },
    ready: { from: "preparing", state: "ready", orderStatus: "processing" },
  } as const;
  const next = transitions[action];
  if (next.from !== state) throw new Error("Invalid fulfillment transition");
  return { state: next.state, orderStatus: next.orderStatus };
}
/** A contract only. No driver identity, location, patient data or dispatch API. */
export function deliveryHandoff(input: {
  orderId: number;
  organizationId: number;
  state: FulfillmentState;
  version: number;
}) {
  return input.state === "ready"
    ? {
        contractVersion: 1 as const,
        simulated: true as const,
        orderId: input.orderId,
        pickupOrganizationId: input.organizationId,
        fulfillmentVersion: input.version,
        status: "ready_for_delivery" as const,
        driverAssignment: null,
      }
    : null;
}
export const fulfillmentLabels: Record<FulfillmentState, string> = {
  assignment_pending: "بانتظار الإسناد",
  assigned: "أُسند للصيدلية",
  accepted: "قبلته الصيدلية",
  rejected: "رفضته الصيدلية",
  preparing: "قيد التحضير التجريبي",
  ready: "جاهز للتوصيل التجريبي",
  cancelled: "ملغى",
};
