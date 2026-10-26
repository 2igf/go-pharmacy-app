import { resetFixtures } from "./test-support";
import { beforeEach as resetBeforeEach } from "vitest";
resetBeforeEach(async () => {
  if (process.env.TEST_DATABASE_URL) await resetFixtures();
});
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock context for public procedures
function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe.skipIf(!process.env.TEST_DATABASE_URL)("products router", () => {
  it("should list products", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.products.list({ limit: 10, offset: 0 });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeLessThanOrEqual(10);
  });

  it("should search products", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.products.search({ query: "test", limit: 10 });

    expect(Array.isArray(result)).toBe(true);
  });

  it("should filter products by category", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.products.byCategory({
      category: "medications",
      limit: 10,
      offset: 0,
    });

    expect(Array.isArray(result)).toBe(true);
  });

  it("should get product by id", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // First, get a list to find a valid product ID
    const products = await caller.products.list({ limit: 1, offset: 0 });

    if (products.length > 0) {
      const product = await caller.products.byId({ id: products[0].id });
      expect(product).toBeDefined();
      expect(product?.id).toBe(products[0].id);
    }
  });
});
