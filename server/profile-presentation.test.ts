import { describe, expect, it } from "vitest";
import {
  customerOrderStatus,
  shortOrderNumber,
} from "../client/src/customer/profile";

describe("customer order presentation", () => {
  it.each([
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
  ])("localizes %s without exposing the backend state", status => {
    expect(customerOrderStatus(status)).not.toContain(status);
    expect(customerOrderStatus(status)).not.toBe("الحالة غير متاحة");
  });
  it("uses a truthful fallback for unknown API states", () => {
    expect(customerOrderStatus("future_state")).toBe("الحالة غير متاحة");
  });
  it("shortens long identifiers and retains short order numbers", () => {
    expect(shortOrderNumber("SIM-12345678-abcd-1234-abcdef123456")).toBe(
      "…ef123456"
    );
    expect(shortOrderNumber("GO-123456")).toBe("GO-123456");
  });
});
