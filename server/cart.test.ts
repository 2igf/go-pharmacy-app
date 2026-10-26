import { resetFixtures } from "./test-support";
import { beforeEach as resetBeforeEach } from "vitest";
resetBeforeEach(async () => {
  if (process.env.TEST_DATABASE_URL) await resetFixtures();
});
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createAuthContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      phone: null,
      profileImage: null,
      loginMethod: "test",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe.skipIf(!process.env.TEST_DATABASE_URL)("cart router", () => {
  it("should list user cart items", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.cart.list();

    expect(Array.isArray(result)).toBe(true);
  });

  it("should clear cart", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.cart.clear();

    expect(result).toEqual({ success: true });
  });
});

describe.skipIf(!process.env.TEST_DATABASE_URL)("orders router", () => {
  it("should list user orders", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.orders.list();

    expect(Array.isArray(result)).toBe(true);
  });
});
