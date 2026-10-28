import {
  beforeEach,
  afterEach,
  afterAll,
  it,
  describe,
  expect,
  vi,
} from "vitest";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { createApp } from "./app";
import { getDb } from "./db";
import { hashPassword } from "./auth";
import { credentials, orders, products } from "../drizzle/schema";
import { resetFixtures, closeDb } from "./test-support";
beforeEach(async () => {
  if (process.env.TEST_DATABASE_URL) await resetFixtures();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
afterAll(closeDb);
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "checkout validation over authenticated native HTTP contract",
  () => {
    it("reports safe Arabic field errors and canonicalizes numerals without duplicate orders", async () => {
      const db = await getDb();
      await db
        .insert(credentials)
        .values({
          userId: 1,
          email: "customer-a@example.test",
          passwordHash: await hashPassword("fictional-checkout-http-password"),
        });
      vi.stubEnv("APP_ORIGIN", "https://checkout.example.test");
      vi.stubEnv("ANDROID_API_ENABLED", "true");
      vi.stubEnv("TRUST_PROXY", "loopback");
      const log = vi.spyOn(console, "info").mockImplementation(() => {});
      const server = createServer(createApp());
      await new Promise<void>(r => server.listen(0, "127.0.0.1", r));
      const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      let cookie = "";
      async function call(path: string, input: unknown, post = false) {
        const r = await fetch(
          `${origin}/api/trpc/${path}${post ? "" : `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`}`,
          {
            method: post ? "POST" : "GET",
            headers: {
              Origin: "https://localhost",
              "X-Go-Pharmacy-Client": "android",
              "X-Forwarded-Proto": "https",
              "Content-Type": "application/json",
              Cookie: cookie,
            },
            ...(post ? { body: JSON.stringify({ json: input }) } : {}),
          }
        );
        return {
          status: r.status,
          body: await r.json(),
          cookie: r.headers.get("set-cookie"),
        };
      }
      try {
        const login = await call(
          "auth.login",
          {
            email: "customer-a@example.test",
            password: "fictional-checkout-http-password",
          },
          true
        );
        expect(login.status).toBe(200);
        cookie = login.cookie!.split(";")[0];
        expect(
          (await call("cart.add", { productId: 1, quantity: 1 }, true)).status
        ).toBe(200);
        const quote = (await call("cart.quote", undefined)).body.result.data
          .json;
        const input = {
          addressId: 1,
          contactName: "عميل HTTP خيالي",
          contactPhone: "٠٧٩ ١٢٣ ٤٥٦٧",
          expectedTotal: quote.total,
          expectedCartHash: quote.fingerprint,
          paymentMethod: "cash",
          simulationAcknowledged: true,
          idempotencyKey: randomUUID(),
        };
        const invalid = await call(
          "orders.create",
          { ...input, contactPhone: "never-log-this-phone-value" },
          true
        );
        expect(invalid.status).toBe(400);
        expect(invalid.body.error.json.message).toContain("رقم الاختبار");
        expect(invalid.body.error.json.data.validationFields).toEqual([
          "contactPhone",
        ]);
        expect(JSON.stringify(invalid.body)).not.toContain(
          "never-log-this-phone-value"
        );
        expect(log.mock.calls.map(c => String(c[0]))).toContain(
          JSON.stringify({
            event: "checkout_validation",
            issues: [{ field: "contactPhone", code: "invalid_format" }],
          })
        );
        expect(JSON.stringify(log.mock.calls)).not.toContain(
          "never-log-this-phone-value"
        );
        const first = await call("orders.create", input, true);
        expect(first.status).toBe(200);
        const second = await call(
          "orders.create",
          { ...input, contactPhone: "079 123 4567" },
          true
        );
        expect(second.body.result.data.json).toEqual(
          first.body.result.data.json
        );
        const stored = await db.select().from(orders);
        expect(stored).toHaveLength(1);
        expect(stored[0].contactPhone).toBe("079 123 4567");
        expect(
          (await db.select().from(products).where(eq(products.id, 1)))[0].stock
        ).toBe(2);
        expect(
          (
            await call(
              "orders.create",
              { ...input, contactPhone: "0790000000" },
              true
            )
          ).status
        ).toBe(409);
        expect(await db.select().from(orders)).toHaveLength(1);
      } finally {
        server.closeAllConnections();
        await new Promise<void>(r => server.close(() => r()));
      }
    });
  }
);
