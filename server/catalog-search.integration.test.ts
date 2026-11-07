import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { products } from "../drizzle/schema";
import { getDb } from "./db";
import { appRouter } from "./routers";
import { closeDb, resetFixtures, testContext } from "./test-support";

// This suite only inserts fictional rows after the shared dedicated-database
// guard succeeds. It never touches a configured normal application database.
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "complete server catalog discovery",
  () => {
    beforeEach(async () => {
      await resetFixtures();
      const db = await getDb();
      await db.insert(products).values([
        ...Array.from({ length: 125 }, (_, index) => ({
          id: 1000 + index,
          name: `Fictional Catalog ${String(index).padStart(3, "0")}`,
          category: "skincare" as const,
          price: "2.00",
          stock: 1,
        })),
        {
          id: 5000,
          name: "إِبــرَاهِيم آلام على",
          category: "medications",
          price: "7.00",
          stock: 0,
          manufacturer: "FictionalMaker",
          activeIngredient: "FictionalIngredient",
          description: "FictionalDescription",
          requiresPrescription: true,
        },
        {
          id: 5001,
          name: "Fictional 50%_!\\ literal",
          category: "medical_supplies",
          price: "8.00",
        },
        {
          id: 5002,
          name: "Fictional Hidden",
          category: "skincare",
          price: "9.00",
          isActive: false,
        },
      ]);
    });
    afterAll(closeDb);

    async function caller() {
      return appRouter.createCaller({ ...(await testContext()), user: null });
    }

    it("finds a record beyond the legacy first hundred with normalized Arabic and English fields", async () => {
      const api = await caller();
      expect(
        (await api.products.list({ limit: 100, offset: 0 })).some(
          item => item.id === 5000
        )
      ).toBe(false);
      for (const query of [
        "ابراهيم الام",
        "إِبـرَاهِيم",
        "علي",
        "fictionalmaker",
        "FICTIONALINGREDIENT",
        "fictionaldescription",
      ]) {
        const result = await api.products.browse({ query });
        expect(result.items.map(item => item.id)).toEqual([5000]);
        expect(result.items[0].requiresPrescription).toBe(true);
        expect(result.items[0].stock).toBe(0);
      }
    });

    it("paginates all active matches with a deterministic tie breaker and no missing rows", async () => {
      const api = await caller();
      const ids: number[] = [];
      let hasMore = true;
      for (let offset = 0; hasMore; offset += 20) {
        const result = await api.products.browse({
          query: "Fictional Catalog",
          sort: "price_low",
          limit: 20,
          offset,
        });
        ids.push(...result.items.map(item => item.id));
        hasMore = result.hasMore;
      }
      expect(ids).toEqual(
        Array.from({ length: 125 }, (_, index) => 1000 + index)
      );
      expect(new Set(ids).size).toBe(125);
    });

    it("filters before paging and sorts prices on the server", async () => {
      const api = await caller();
      const category = await api.products.browse({
        category: "medications",
        query: "ابراهيم",
      });
      expect(category.items.map(item => item.id)).toEqual([5000]);
      expect(
        (await api.products.browse({ category: "baby_care" })).items
      ).toEqual([]);
      const descending = await api.products.browse({
        query: "Fictional",
        sort: "price_high",
        limit: 2,
      });
      expect(descending.items.map(item => item.id)).toEqual([5001, 5000]);
      expect(descending.hasMore).toBe(true);
      expect((await api.products.browse({ query: "Hidden" })).items).toEqual(
        []
      );
      expect(
        (await api.products.browse({ query: "no such fictional item" })).hasMore
      ).toBe(false);
    });

    it("searches percent, underscore, escape and backslash literally instead of as LIKE wildcards", async () => {
      const api = await caller();
      for (const query of ["50%_!\\", "%", "_", "!", "\\"]) {
        expect(
          (await api.products.browse({ query })).items.map(item => item.id)
        ).toEqual([5001]);
      }
      expect(
        (await api.products.browse({ query: "%' OR 1=1 --" })).items
      ).toEqual([]);
    });

    it("rejects invalid category, sort and pagination input at the public boundary", async () => {
      const api = await caller();
      for (const invalid of [
        { limit: 101 },
        { offset: -1 },
        { limit: 1.5 },
        { query: "x".repeat(101) },
        { category: "unknown" as never },
        { sort: "unknown" as never },
      ]) {
        await expect(api.products.browse(invalid)).rejects.toMatchObject({
          code: "BAD_REQUEST",
        });
      }
    });
  }
);
