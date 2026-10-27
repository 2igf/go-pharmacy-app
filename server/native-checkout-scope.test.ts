import { describe, expect, it } from "vitest";
import { checkoutStorageKey } from "../client/src/lib/checkout-policy";
describe("native pending checkout server scope", () => {
  it("retains an ambiguous request for its origin without leaking it to another server sharing a user ID", () => {
    const storage = new Map<string, string>();
    const pendingA = JSON.stringify({
      idempotencyKey: "request-A",
      contactName: "Fictional A",
      addressId: 1,
    });
    storage.set(checkoutStorageKey(1, "https://a.example.test"), pendingA);
    expect(
      storage.get(checkoutStorageKey(1, "https://b.example.test"))
    ).toBeUndefined();
    storage.set(checkoutStorageKey(1, "https://b.example.test"), "request-B");
    storage.delete(checkoutStorageKey(1, "https://b.example.test"));
    expect(storage.get(checkoutStorageKey(1, "https://a.example.test/"))).toBe(
      pendingA
    );
    expect(
      storage.get(checkoutStorageKey(2, "https://a.example.test"))
    ).toBeUndefined();
  });
  it("preserves the existing same-origin browser storage key", () => {
    expect(checkoutStorageKey(1, null)).toBe("checkout:1");
  });
});
