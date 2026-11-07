import { describe, expect, it } from "vitest";
import { escapeCatalogLike, normalizeCatalogSearch } from "./catalog-search";

describe("catalog literal search normalization", () => {
  it("normalizes Arabic vowel marks, tatweel, alef and ya variants", () => {
    expect(normalizeCatalogSearch("  إِبــرَاهِيم آلام على  ")).toBe(
      "ابراهيم الام علي"
    );
    expect(normalizeCatalogSearch("ا\u0654دوية")).toBe("ادوية");
    expect(normalizeCatalogSearch("و\u0654 ي\u0654")).toBe("و ي");
    expect(normalizeCatalogSearch("PANADOL Extra")).toBe("panadol extra");
  });

  it("treats LIKE wildcard and escape characters as literal text", () => {
    expect(escapeCatalogLike("50%_!\\")).toBe("50!%!_!!\\");
  });
});
