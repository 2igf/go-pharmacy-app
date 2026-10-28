import { describe, it, expect } from "vitest";
import { visibleCustomerOrder } from "../client/src/lib/checkout-policy";
describe("customer order cache visibility", () => {
  it("hides a retained record immediately when the account changes or disappears", () => {
    const order = {
      id: 7,
      userId: 1,
      deliveryAddress: "Fictional private address",
      fulfillment: { state: "ready" },
    };
    expect(visibleCustomerOrder(order, 1, null)).toBe(order);
    expect(visibleCustomerOrder(order, 2, null)).toBeUndefined();
    expect(visibleCustomerOrder(order, undefined, null)).toBeUndefined();
  });
  it("hides retained order and fulfillment details after a failed authorization refresh", () => {
    const order = { id: 7, userId: 1 };
    expect(
      visibleCustomerOrder(order, 1, new Error("NOT_FOUND"))
    ).toBeUndefined();
    expect(visibleCustomerOrder(undefined, 1, null)).toBeUndefined();
  });
});
