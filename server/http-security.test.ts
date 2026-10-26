import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "./app";
afterEach(() => vi.unstubAllEnvs());
async function withServer(test: (url: string) => Promise<void>) {
  const server = createServer(createApp());
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    await test(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}
describe("real Express HTTP boundaries", () => {
  it("rejects cross-origin and absent-origin writes", async () =>
    withServer(async url => {
      vi.stubEnv("APP_ORIGIN", url);
      for (const origin of [undefined, "https://attacker.example"]) {
        const response = await fetch(`${url}/api/trpc/auth.logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(origin ? { Origin: origin } : {}),
          },
          body: "{}",
        });
        expect(response.status).toBe(403);
      }
    }));
  it("returns security headers and disables legacy OAuth", async () =>
    withServer(async url => {
      const response = await fetch(`${url}/healthz`);
      expect(response.status).toBe(200);
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("x-powered-by")).toBeNull();
      expect(
        (await fetch(`${url}/api/oauth/callback?code=fake&state=fake`)).status
      ).toBe(404);
      const unauth = await fetch(`${url}/api/trpc/cart.list`);
      expect(unauth.status).toBe(401);
      expect(await unauth.text()).not.toContain("stack");
    }));
  it("caps auth attempts over real HTTP", async () =>
    withServer(async url => {
      vi.stubEnv("APP_ORIGIN", url);
      let status = 0;
      for (let i = 0; i < 21; i++)
        status = (
          await fetch(`${url}/api/trpc/auth.login`, {
            method: "POST",
            headers: { Origin: url, "Content-Type": "application/json" },
            body: "{}",
          })
        ).status;
      expect(status).toBe(429);
    }));
  it("sends production browser protections and rejects batched authentication", async () =>
    withServer(async url => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("APP_ORIGIN", url);
      const health = await fetch(`${url}/healthz`);
      expect(health.headers.get("strict-transport-security")).toContain(
        "max-age="
      );
      expect(health.headers.get("content-security-policy")).toContain(
        "frame-ancestors 'none'"
      );
      const response = await fetch(
        `${url}/api/trpc/auth.login,auth.login?batch=1`,
        {
          method: "POST",
          headers: { Origin: url, "Content-Type": "application/json" },
          body: "{}",
        }
      );
      expect(response.status).toBe(400);
    }));
});
