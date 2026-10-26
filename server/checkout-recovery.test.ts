import { describe, expect, it } from "vitest";
import { mayReviewRejectedCheckout } from "../client/src/lib/checkout-policy";
describe("checkout failure recovery policy", () => {
  it.each(["BAD_REQUEST", "NOT_FOUND", "FORBIDDEN", "CONFLICT"])(
    "allows correction after definitive %s rejection",
    code => {
      expect(mayReviewRejectedCheckout(code)).toBe(true);
    }
  );
  it.each([undefined, "INTERNAL_SERVER_ERROR", "TIMEOUT", "UNAUTHORIZED"])(
    "preserves original key after ambiguous or authentication error %s",
    code => {
      expect(mayReviewRejectedCheckout(code)).toBe(false);
    }
  );
});
