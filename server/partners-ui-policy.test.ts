import { describe, expect, it } from "vitest";
import {
  portalPermissions,
  selectPortalMembership,
  stockRequestKey,
  readPendingStock,
  isDefinitiveStockError,
  privateQueryData,
  canConfirmStockReview,
} from "../client/src/partners/policy";
import {
  organizationTransitions,
  stockAdjustmentSchema,
} from "../shared/pharmacy-policy";
const member = {
  organizationId: 11,
  name: "Fictional A",
  countryCode: "JO",
  organizationStatus: "approved" as const,
  membershipStatus: "active" as const,
  role: "inventory_staff" as const,
};
describe("Partners UI boundaries and request state", () => {
  it("hides retained private data on background errors", () => {
    expect(privateQueryData({ data: [member], error: null })).toEqual([member]);
    expect(
      privateQueryData({ data: [member], error: new Error("Access revoked") })
    ).toBeUndefined();
  });
  it("rejects confirmation on a failed/loading detail or changed version, including zero-stock records", () => {
    expect(canConfirmStockReview(0, 0, false, false)).toBe(true);
    expect(canConfirmStockReview(0, 0, true, false)).toBe(false);
    expect(canConfirmStockReview(0, 0, false, true)).toBe(false);
    expect(canConfirmStockReview(3, 4, false, false)).toBe(false);
  });
  it("does not substitute another organization for a foreign or malformed URL selector", () => {
    expect(selectPortalMembership([member], null)).toEqual(member);
    expect(selectPortalMembership([member], "11")).toEqual(member);
    for (const id of ["22", "11abc", "0", "NaN", "-1"])
      expect(selectPortalMembership([member], id)).toBeUndefined();
  });
  it("uses active membership, never a global account role, for navigation hints", () => {
    expect(portalPermissions(undefined).inventory).toBe(false);
    expect(portalPermissions(member)).toEqual({
      inventory: true,
      adjust: true,
      members: false,
      activity: false,
    });
    expect(portalPermissions({ ...member, role: "viewer" })).toEqual({
      inventory: true,
      adjust: false,
      members: false,
      activity: false,
    });
    expect(portalPermissions({ ...member, role: "manager" }).activity).toBe(
      true
    );
    expect(portalPermissions({ ...member, role: "owner" }).members).toBe(true);
    for (const state of ["pending", "rejected", "suspended"] as const)
      expect(
        portalPermissions({ ...member, organizationStatus: state }).adjust
      ).toBe(false);
    expect(
      portalPermissions({ ...member, membershipStatus: "suspended" }).inventory
    ).toBe(false);
  });
  it("preserves an exact pending request only in its own account, backend and organization scope", () => {
    const request = stockAdjustmentSchema.parse({
      organizationId: 11,
      productId: 1,
      delta: 2,
      expectedVersion: 3,
      requestId: "891254fc-f27c-4b75-ae9c-b20ad96a4b6f",
      reason: "Fictional recount",
    });
    expect(readPendingStock(JSON.stringify(request), 11)).toEqual(request);
    expect(readPendingStock(JSON.stringify(request), 22)).toBeUndefined();
    expect(readPendingStock("malformed", 11)).toBeUndefined();
    const base = stockRequestKey("https://beta.example.test", 1, 11);
    expect(
      new Set([
        base,
        stockRequestKey("https://other.example.test", 1, 11),
        stockRequestKey("https://beta.example.test", 2, 11),
        stockRequestKey("https://beta.example.test", 1, 22),
      ]).size
    ).toBe(4);
  });
  it("keeps ambiguous failures retryable but requires explicit review after a definitive rejection", () => {
    expect(isDefinitiveStockError({ message: "Network failed" })).toBe(false);
    expect(
      isDefinitiveStockError({ data: { code: "INTERNAL_SERVER_ERROR" } })
    ).toBe(false);
    for (const code of [
      "CONFLICT",
      "BAD_REQUEST",
      "FORBIDDEN",
      "UNAUTHORIZED",
      "NOT_FOUND",
    ])
      expect(isDefinitiveStockError({ data: { code } })).toBe(true);
  });
  it("uses the existing transition/stock contracts, including negative counts and stale versions", () => {
    expect(organizationTransitions.rejected).toEqual(["pending"]);
    expect(organizationTransitions.approved).toEqual(["suspended"]);
    for (const delta of [0, 1.5, 100001])
      expect(
        stockAdjustmentSchema.safeParse({
          organizationId: 1,
          productId: 1,
          delta,
          expectedVersion: 0,
          requestId: "891254fc-f27c-4b75-ae9c-b20ad96a4b6f",
          reason: "Fictional reason",
        }).success
      ).toBe(false);
  });
});
