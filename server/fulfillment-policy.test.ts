import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  fulfillmentTransition,
  fulfillmentMutationSchema,
  deliveryHandoff,
} from "../shared/fulfillment";

describe("simulated fulfillment contracts", () => {
  it("maps tenant transitions onto existing order statuses without skipping preparation", () => {
    expect(fulfillmentTransition("assigned", "accept")).toEqual({
      state: "accepted",
      orderStatus: "confirmed",
    });
    expect(fulfillmentTransition("assigned", "reject")).toEqual({
      state: "rejected",
      orderStatus: "pending",
    });
    expect(fulfillmentTransition("accepted", "prepare")).toEqual({
      state: "preparing",
      orderStatus: "processing",
    });
    expect(fulfillmentTransition("preparing", "ready")).toEqual({
      state: "ready",
      orderStatus: "processing",
    });
    for (const state of [
      "assignment_pending",
      "rejected",
      "cancelled",
      "ready",
    ] as const)
      expect(() => fulfillmentTransition(state, "accept")).toThrow();
    expect(() => fulfillmentTransition("assigned", "ready")).toThrow();
  });
  it("rejects caller supplied roles, unbounded IDs, invalid versions and empty reasons", () => {
    const input = {
      organizationId: 1,
      orderId: 2,
      expectedVersion: 1,
      action: "accept",
      reason: "Fictional verification",
      requestId: randomUUID(),
    };
    expect(fulfillmentMutationSchema.safeParse(input).success).toBe(true);
    for (const extra of [
      { role: "admin" },
      { expectedVersion: -1 },
      { organizationId: 0 },
      { orderId: 2147483648 },
      { reason: " " },
      { requestId: "not-uuid" },
      { action: "deliver" },
    ])
      expect(
        fulfillmentMutationSchema.safeParse({ ...input, ...extra }).success
      ).toBe(false);
  });
  it("prepares a minimal delivery handoff only for ready orders without driver/medical/customer data", () => {
    expect(
      deliveryHandoff({
        orderId: 7,
        organizationId: 8,
        state: "accepted",
        version: 2,
      })
    ).toBeNull();
    expect(
      deliveryHandoff({
        orderId: 7,
        organizationId: 8,
        state: "ready",
        version: 4,
      })
    ).toEqual({
      contractVersion: 1,
      simulated: true,
      orderId: 7,
      pickupOrganizationId: 8,
      fulfillmentVersion: 4,
      status: "ready_for_delivery",
      driverAssignment: null,
    });
  });
});
