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
  it("allows only explicitly enabled native HTTPS mutations without weakening web origin checks", async () =>
    withServer(async url => {
      vi.stubEnv("APP_ORIGIN", "https://beta.example.test");
      const post = (headers: Record<string, string>) =>
        fetch(`${url}/api/trpc/auth.logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: "{}",
        });
      const nativeHeaders = {
        Origin: "https://localhost",
        "X-Go-Pharmacy-Client": "android",
      };
      expect((await post(nativeHeaders)).status).toBe(403);
      vi.stubEnv("ANDROID_API_ENABLED", "true");
      // Untrusted forwarded headers never establish secure transport.
      expect(
        (await post({ ...nativeHeaders, "X-Forwarded-Proto": "https" })).status
      ).toBe(403);
      vi.stubEnv("TRUST_PROXY", "loopback");
      // createApp captured proxy configuration before the stub; use a new server below.
    }));
  it("accepts a secure native request behind an explicitly trusted proxy only", async () => {
    vi.stubEnv("APP_ORIGIN", "https://beta.example.test");
    vi.stubEnv("ANDROID_API_ENABLED", "true");
    vi.stubEnv("TRUST_PROXY", "loopback");
    await withServer(async url => {
      const post = (origin: string, client = "android") =>
        fetch(`${url}/api/trpc/auth.logout`, {
          method: "POST",
          headers: {
            Origin: origin,
            "X-Go-Pharmacy-Client": client,
            "X-Forwarded-Proto": "https",
            "Content-Type": "application/json",
          },
          body: "{}",
        });
      const response = await post("https://localhost");
      expect(response.status).toBe(200);
      expect(response.headers.get("set-cookie")).toContain("HttpOnly");
      expect(response.headers.get("set-cookie")).toContain("Secure");
      expect(response.headers.get("set-cookie")).toContain("SameSite=Lax");
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
      expect((await post("https://attacker.example")).status).toBe(403);
      expect((await post("https://localhost", "web")).status).toBe(403);
    });
  });
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
