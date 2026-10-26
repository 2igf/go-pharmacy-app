import { describe, expect, it } from "vitest";
import {
  moneyToCents,
  centsToMoney,
  quoteLines,
  assertTransition,
} from "./commerce-rules";
describe("exact Beta commerce rules", () => {
  it("adds decimal prices exactly", () => {
    expect(
      quoteLines([
        { price: "0.10", quantity: 3 },
        { price: "0.20", quantity: 1 },
      ])
    ).toEqual({
      subtotal: "0.50",
      shipping: "0.00",
      tax: "0.00",
      total: "0.50",
    });
  });
  it.each(["-1", "NaN", "1.001", "1e2", "100000000.00"])(
    "rejects invalid price %s",
    value => expect(() => moneyToCents(value)).toThrow()
  );
  it.each([0, -1, 1.1, 100])("rejects invalid quantity %s", quantity =>
    expect(() => quoteLines([{ price: "1.00", quantity }])).toThrow()
  );
  it("formats safely", () => expect(centsToMoney(1234)).toBe("12.34"));
  it("rejects overflow", () =>
    expect(() =>
      quoteLines([{ price: "99999999.99", quantity: 2 }])
    ).toThrow());
  it("rejects backward and terminal transitions", () => {
    expect(() => assertTransition("delivered", "cancelled")).toThrow();
    expect(() => assertTransition("processing", "pending")).toThrow();
    expect(() => assertTransition("cancelled", "confirmed")).toThrow();
    expect(() => assertTransition("shipped", "cancelled")).toThrow();
  });
  it("accepts supported status transitions and repeat no-op", () => {
    expect(() => assertTransition("pending", "confirmed")).not.toThrow();
    expect(() => assertTransition("confirmed", "cancelled")).not.toThrow();
    expect(() => assertTransition("cancelled", "cancelled")).not.toThrow();
  });
});
