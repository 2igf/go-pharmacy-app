import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  checkoutSchema,
  checkoutPhonePattern,
  checkoutValidationIssues,
  parsePendingCheckout,
} from "../shared/checkout";
const request = () => ({
  addressId: 1,
  contactName: "عميل اختبار خيالي",
  contactPhone: "079 123 4567",
  expectedTotal: "0.10",
  expectedCartHash: "a".repeat(64),
  paymentMethod: "cash",
  simulationAcknowledged: true,
  idempotencyKey: randomUUID(),
});
describe("checkout input and safe Arabic validation", () => {
  it("accepts Arabic/Persian phone numerals and preserves existing ASCII formatting", () => {
    expect(
      checkoutSchema.parse({ ...request(), contactPhone: "٠٧٩ ١٢٣ ٤٥٦٧" })
        .contactPhone
    ).toBe("079 123 4567");
    expect(
      checkoutSchema.parse({ ...request(), contactPhone: "۰۷۹ ۱۲۳ ۴۵۶۷" })
        .contactPhone
    ).toBe("079 123 4567");
    for (const contactPhone of ["+962 (79) 123-4567", " 0791234567 "])
      expect(
        checkoutSchema.parse({ ...request(), contactPhone }).contactPhone
      ).toBe(contactPhone);
  });
  it("uses a valid HTML Unicode-v pattern with the same permitted phone characters", () => {
    const pattern = new RegExp(`^(?:${checkoutPhonePattern})$`, "v");
    for (const value of ["٠٧٩ ١٢٣ ٤٥٦٧", "۰۷۹۱۲۳۴۵۶۷", "+962 (79) 123-4567"])
      expect(pattern.test(value)).toBe(true);
    for (const value of ["079abc4567", "<script>", "12345"])
      expect(pattern.test(value)).toBe(false);
  });
  it("names rejected fields in Arabic without including values or credentials", () => {
    const secret = "never-echo-this-sensitive-value";
    const parsed = checkoutSchema.safeParse({
      ...request(),
      contactPhone: secret,
      addressId: 0,
      role: secret,
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const issues = checkoutValidationIssues(parsed.error.issues);
    expect(issues.map(i => i.field)).toEqual(
      expect.arrayContaining(["contactPhone", "addressId", "request"])
    );
    expect(issues.find(i => i.field === "contactPhone")?.message).toContain(
      "رقم الاختبار"
    );
    expect(JSON.stringify(issues)).not.toContain(secret);
  });
  it("validates restored drafts while retaining the original request identity", () => {
    const input = request();
    expect(parsePendingCheckout(JSON.stringify(input))).toEqual(input);
    expect(
      parsePendingCheckout(
        JSON.stringify({ ...input, contactPhone: "٠٧٩١٢٣٤٥٦٧" })
      )?.idempotencyKey
    ).toBe(input.idempotencyKey);
    for (const value of [
      "{",
      JSON.stringify({ ...input, role: "admin" }),
      JSON.stringify({ ...input, expectedCartHash: "" }),
      "x".repeat(10000),
    ])
      expect(parsePendingCheckout(value)).toBeNull();
  });
});
