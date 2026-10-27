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
import { createApp } from "./app";
import { hashPassword } from "./auth";
import { getDb } from "./db";
import { credentials } from "../drizzle/schema";
import { resetFixtures, closeDb } from "./test-support";
beforeEach(async () => {
  if (process.env.TEST_DATABASE_URL) await resetFixtures();
});
afterEach(() => vi.unstubAllEnvs());
afterAll(closeDb);
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "fulfillment real HTTP session boundary",
  () => {
    it("enforces session roles, strict bodies, tenant IDs and customer ownership despite forged headers", async () => {
      vi.stubEnv("SIMULATED_FULFILLMENT_ENABLED", "true");
      vi.stubEnv("TRUST_PROXY", "");
      const password = "fictional-fulfillment-http-password";
      const passwordHash = await hashPassword(password);
      const emails = [
        "customer-a@example.test",
        "customer-b@example.test",
        "admin@example.test",
      ];
      await (await getDb())
        .insert(credentials)
        .values(
          emails.map((email, i) => ({ userId: i + 1, email, passwordHash }))
        );
      const server = createServer(createApp());
      await new Promise<void>(resolve =>
        server.listen(0, "127.0.0.1", resolve)
      );
      const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      vi.stubEnv("APP_ORIGIN", origin);
      async function session(email: string) {
        let cookie = "";
        async function call(
          path: string,
          input: unknown,
          post = false,
          extra = {}
        ) {
          const r = await fetch(
            `${origin}/api/trpc/${path}${post ? "" : `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`}`,
            {
              method: post ? "POST" : "GET",
              headers: {
                Origin: origin,
                "Content-Type": "application/json",
                Cookie: cookie,
                ...extra,
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
        const login = await call("auth.login", { email, password }, true);
        expect(login.status).toBe(200);
        cookie = login.cookie!.split(";")[0];
        return {
          call,
          async post(path: string, input: unknown) {
            const r = await call(path, input, true);
            expect(r.status).toBe(200);
            return r.body.result.data.json;
          },
          async get(path: string, input: unknown) {
            const r = await call(path, input);
            expect(r.status).toBe(200);
            return r.body.result.data.json;
          },
        };
      }
      try {
        const a = await session(emails[0]),
          b = await session(emails[1]),
          admin = await session(emails[2]);
        const org = await a.post("pharmacies.submitApplication", {
          name: "DEMO HTTP Fulfillment",
          registrationNumber: "HTTP-FULFILL",
          countryCode: "JO",
        });
        await admin.post("pharmacies.administration.review", {
          organizationId: org.id,
          status: "approved",
          reason: "Fictional approval",
        });
        await admin.post("pharmacies.administration.setMembership", {
          organizationId: org.id,
          userId: 1,
          role: "owner",
          status: "active",
          reason: "Fictional member",
        });
        await a.post("pharmacies.inventory.adjust", {
          organizationId: org.id,
          productId: 1,
          delta: 5,
          expectedVersion: 0,
          requestId: randomUUID(),
          reason: "Fictional stock",
        });
        await a.post("cart.add", { productId: 1, quantity: 1 });
        const quote = await a.get("cart.quote", undefined);
        const order = await a.post("orders.create", {
          addressId: 1,
          idempotencyKey: randomUUID(),
          contactName: "Fictional HTTP",
          contactPhone: "00000000",
          expectedTotal: quote.total,
          expectedCartHash: quote.fingerprint,
          paymentMethod: "cash",
          simulationAcknowledged: true,
        });
        const enroll = {
          orderId: order.orderId,
          requestId: randomUUID(),
          reason: "Fictional enrollment",
        };
        expect(
          (
            await b.call("fulfillment.enroll", enroll, true, {
              "x-go-pharmacy-role": "admin",
            })
          ).status
        ).toBe(403);
        await admin.post("fulfillment.enroll", enroll);
        const assignment = {
          orderId: order.orderId,
          organizationId: org.id,
          expectedVersion: 0,
          requestId: randomUUID(),
          reason: "Fictional assignment",
        };
        await admin.post("fulfillment.assign", assignment);
        expect(
          (
            await b.call(
              "fulfillment.detail",
              { orderId: order.orderId, organizationId: org.id },
              false,
              {
                "x-organization-id": String(org.id),
                "x-go-pharmacy-role": "pharmacist",
              }
            )
          ).status
        ).toBe(403);
        const action = {
          orderId: order.orderId,
          organizationId: org.id,
          expectedVersion: 1,
          action: "accept",
          requestId: randomUUID(),
          reason: "Fictional acceptance",
        };
        expect(
          (
            await a.call(
              "fulfillment.transition",
              { ...action, role: "admin" },
              true
            )
          ).status
        ).toBe(400);
        await a.post("fulfillment.transition", action);
        expect(
          (await a.get("orders.byId", { id: order.orderId })).fulfillment.state
        ).toBe("accepted");
        expect(
          (await b.call("orders.byId", { id: order.orderId })).status
        ).toBe(404);
        const detail = await a.get("fulfillment.detail", {
          orderId: order.orderId,
          organizationId: org.id,
        });
        expect(detail).not.toHaveProperty("contactName");
        expect(detail.events).toHaveLength(2);
      } finally {
        server.closeAllConnections();
        await new Promise<void>(resolve => server.close(() => resolve()));
      }
    });
  }
);
