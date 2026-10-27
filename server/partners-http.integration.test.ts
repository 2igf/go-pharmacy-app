import {
  beforeEach,
  afterEach,
  afterAll,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "./app";
import { getDb } from "./db";
import { credentials } from "../drizzle/schema";
import { hashPassword } from "./auth";
import { resetFixtures, closeDb } from "./test-support";
import { randomUUID } from "node:crypto";

beforeEach(async () => {
  if (process.env.TEST_DATABASE_URL) await resetFixtures();
});
afterEach(() => vi.unstubAllEnvs());
afterAll(closeDb);
async function withServer(run: (origin: string) => Promise<void>) {
  vi.stubEnv("TRUST_PROXY", "");
  vi.stubEnv(
    "BETA_ALLOWED_EMAILS",
    "customer-a@example.test,customer-b@example.test,admin@example.test"
  );
  const db = await getDb();
  const passwordHash = await hashPassword("fictional-portal-http-password");
  await db
    .insert(credentials)
    .values(
      [1, 2, 3].map((userId, i) => ({
        userId,
        email: [
          "customer-a@example.test",
          "customer-b@example.test",
          "admin@example.test",
        ][i],
        passwordHash,
      }))
    );
  const server = createServer(createApp());
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  vi.stubEnv("APP_ORIGIN", origin);
  try {
    await run(origin);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}
async function account(origin: string, email: string) {
  let cookie = "";
  const request = (path: string, input?: unknown, method = "GET", extra = {}) =>
    fetch(
      `${origin}/api/trpc/${path}${method === "GET" && input !== undefined ? `?input=${encodeURIComponent(JSON.stringify({ json: input }))}` : ""}`,
      {
        method,
        headers: {
          Origin: origin,
          "Content-Type": "application/json",
          Cookie: cookie,
          ...extra,
        },
        ...(method === "POST" ? { body: JSON.stringify({ json: input }) } : {}),
      }
    );
  const login = await request(
    "auth.login",
    { email, password: "fictional-portal-http-password" },
    "POST"
  );
  expect(login.status).toBe(200);
  cookie = login.headers.get("set-cookie")!.split(";")[0];
  return {
    request,
    async post(path: string, input: unknown) {
      const r = await request(path, input, "POST");
      expect(r.status).toBe(200);
      return (await r.json()).result.data.json;
    },
    async get(path: string, input?: unknown) {
      const r = await request(path, input);
      expect(r.status).toBe(200);
      return (await r.json()).result.data.json;
    },
  };
}
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "GO Partners real HTTP acceptance contracts",
  () => {
    it("reviews, activates, adjusts and audits with real sessions and tenant isolation", async () =>
      withServer(async origin => {
        const a = await account(origin, "customer-a@example.test"),
          b = await account(origin, "customer-b@example.test"),
          admin = await account(origin, "admin@example.test");
        const orgA = await a.post("pharmacies.submitApplication", {
          name: "Fictional HTTP Pharmacy A",
          registrationNumber: "HTTP-A",
          countryCode: "JO",
        });
        const orgB = await b.post("pharmacies.submitApplication", {
          name: "Fictional HTTP Pharmacy B",
          registrationNumber: "HTTP-B",
          countryCode: "JO",
        });
        expect(
          (
            await a.request("pharmacies.inventory.list", {
              organizationId: orgA.id,
            })
          ).status
        ).toBe(403);
        for (const [org, userId] of [
          [orgA, 1],
          [orgB, 2],
        ] as const) {
          await admin.post("pharmacies.administration.review", {
            organizationId: org.id,
            status: "approved",
            reason: "Fictional administrative approval",
          });
          await admin.post("pharmacies.administration.setMembership", {
            organizationId: org.id,
            userId,
            role: "owner",
            status: "active",
            reason: "Fictional explicit membership activation",
          });
        }
        const stock = {
          organizationId: orgA.id,
          productId: 1,
          delta: 8,
          expectedVersion: 0,
          requestId: randomUUID(),
          reason: "Fictional physical inventory",
        };
        expect(
          (await a.post("pharmacies.inventory.adjust", stock)).quantity
        ).toBe(8);
        expect(
          (await a.post("pharmacies.inventory.adjust", stock)).quantity
        ).toBe(8);
        expect(
          (
            await a.get("pharmacies.inventory.list", {
              organizationId: orgA.id,
            })
          )[0].quantity
        ).toBe(8);
        expect(
          (
            await b.request(
              "pharmacies.inventory.adjust",
              { ...stock, requestId: randomUUID() },
              "POST",
              {
                "X-Go-Pharmacy-Role": "admin",
                "X-Organization-Id": String(orgA.id),
              }
            )
          ).status
        ).toBe(403);
        expect(
          (
            await b.request("pharmacies.audit.list", {
              organizationId: orgA.id,
            })
          ).status
        ).toBe(403);
        expect(
          (
            await admin.request("pharmacies.members.list", {
              organizationId: orgA.id,
            })
          ).status
        ).toBe(403);
        await admin.post("pharmacies.administration.setMembership", {
          organizationId: orgA.id,
          userId: 3,
          role: "manager",
          status: "active",
          reason: "Explicit test reviewer membership",
        });
        expect(
          (
            await admin.get("pharmacies.members.list", {
              organizationId: orgA.id,
            })
          )
            .map((m: { userId: number }) => m.userId)
            .sort()
        ).toEqual([1, 3]);
        expect(
          (
            await a.get("pharmacies.audit.list", { organizationId: orgA.id })
          ).filter((e: { action: string }) => e.action === "stock_adjusted")
        ).toHaveLength(1);
        expect(
          (
            await a.request(
              "pharmacies.inventory.adjust",
              { ...stock, delta: 0, requestId: randomUUID() },
              "POST"
            )
          ).status
        ).toBe(400);
        await admin.post("pharmacies.administration.review", {
          organizationId: orgA.id,
          status: "suspended",
          reason: "Fictional suspension",
        });
        expect(
          (await a.request("pharmacies.inventory.adjust", stock, "POST")).status
        ).toBe(403);
        await admin.post("pharmacies.administration.review", {
          organizationId: orgA.id,
          status: "approved",
          reason: "Fictional reinstatement",
        });
        await admin.post("pharmacies.administration.setMembership", {
          organizationId: orgA.id,
          userId: 1,
          role: "owner",
          status: "suspended",
          reason: "Fictional staff revocation",
        });
        expect(
          (
            await a.request("pharmacies.inventory.list", {
              organizationId: orgA.id,
            })
          ).status
        ).toBe(403);
      }));
    it("shows rejected applications without opening inventory and blocks self approval/escalation", async () =>
      withServer(async origin => {
        const a = await account(origin, "customer-a@example.test"),
          admin = await account(origin, "admin@example.test");
        const org = await a.post("pharmacies.submitApplication", {
          name: "Fictional rejected pharmacy",
          registrationNumber: "HTTP-REJECT",
          countryCode: "JO",
        });
        expect(
          (
            await a.request(
              "pharmacies.administration.review",
              {
                organizationId: org.id,
                status: "approved",
                reason: "Attempted role escalation",
              },
              "POST",
              { "X-Go-Pharmacy-Role": "admin" }
            )
          ).status
        ).toBe(403);
        await admin.post("pharmacies.administration.review", {
          organizationId: org.id,
          status: "rejected",
          reason: "Fictional missing verification",
        });
        expect((await a.get("pharmacies.mine", {}))[0].organizationStatus).toBe(
          "rejected"
        );
        expect(
          (
            await a.request("pharmacies.inventory.list", {
              organizationId: org.id,
            })
          ).status
        ).toBe(403);
        const own = await admin.post("pharmacies.submitApplication", {
          name: "Fictional admin applicant",
          registrationNumber: "HTTP-SELF",
          countryCode: "JO",
        });
        expect(
          (
            await admin.request(
              "pharmacies.administration.review",
              {
                organizationId: own.id,
                status: "approved",
                reason: "Attempted self approval",
              },
              "POST"
            )
          ).status
        ).toBe(403);
      }));
  }
);
