import { describe, expect, it } from "vitest";
import {
  customerNavigation,
  productArtwork,
  filterCatalog,
  ownedCustomerRecords,
  ownedCustomerQuote,
} from "../client/src/customer/policy";

describe("Canva customer presentation boundaries", () => {
  it("does not display another customer's cached quote, totals or products", () => {
    const quote = { items: [{ userId: 1, productId: 3 }], total: "10.00" };
    expect(ownedCustomerQuote(quote, 2, null)).toBeUndefined();
    expect(ownedCustomerQuote(quote, 1, null)).toBe(quote);
    expect(
      ownedCustomerQuote(quote, 1, new Error("failed refetch"))
    ).toBeUndefined();
    expect(ownedCustomerQuote(quote, undefined, null)).toBeUndefined();
  });
  it("hides foreign cached addresses during account changes and any failed refetch", () => {
    const cached = [
      { userId: 1, address: "Fictional A" },
      { userId: 2, address: "Fictional B" },
    ];
    expect(ownedCustomerRecords(cached, 2, null)).toEqual([cached[1]]);
    expect(
      ownedCustomerRecords(cached, 2, new Error("failed refetch"))
    ).toEqual([]);
    expect(ownedCustomerRecords(cached, undefined, null)).toEqual([]);
    expect(ownedCustomerRecords(undefined, 2, null)).toEqual([]);
  });
  it("preserves six RTL destinations including unavailable medical placeholders", () => {
    expect(customerNavigation.map(n => n.href)).toEqual([
      "/",
      "/products",
      "/cart",
      "/doctors",
      "/reminders",
      "/profile",
    ]);
    expect(
      customerNavigation.filter(n => n.unavailable).map(n => n.href)
    ).toEqual(["/doctors", "/reminders"]);
  });
  it("never substitutes medicine artwork for unrelated or fictional products", () => {
    expect(productArtwork({ name: "DEMO Test Product" })).toBeNull();
    expect(productArtwork({ name: "DEMO Panadol Extra" })).toBeNull();
    expect(productArtwork({ name: "بانادول اكسترا" })).toBe(
      "/canva/product-panadol.png"
    );
    expect(productArtwork({ name: "A", imageUrl: "/catalog/actual.png" })).toBe(
      "/catalog/actual.png"
    );
    expect(
      productArtwork({ name: "A", imageUrl: "javascript:alert(1)" })
    ).toBeNull();
    expect(
      productArtwork({ name: "A", imageUrl: "http://example.test/item.png" })
    ).toBeNull();
    expect(
      productArtwork({ name: "A", imageUrl: "//untrusted.test/item.png" })
    ).toBeNull();
  });
  it("searches real API names/manufacturers without manufacturing catalog records", () => {
    const items = [
      {
        id: 1,
        name: "منتج اختبار",
        category: "skincare",
        manufacturer: "Dove",
      },
      { id: 2, name: "ضماد", category: "medical_supplies" },
    ];
    expect(filterCatalog(items, "dove", "all")).toEqual([items[0]]);
    expect(filterCatalog(items, "", "medical_supplies")).toEqual([items[1]]);
    expect(filterCatalog(items, "عيادة", "all")).toEqual([]);
  });
});
