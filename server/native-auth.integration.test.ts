import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "./app";
import { invitationCodeFor } from "./auth";
import { closeDb, resetFixtures } from "./test-support";

beforeEach(async () => {
  if (process.env.TEST_DATABASE_URL) await resetFixtures();
});
afterEach(() => vi.unstubAllEnvs());
afterAll(closeDb);
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "Android HTTP auth against real MySQL",
  () => {
    it("issues, uses and revokes the existing opaque session through the native boundary", async () => {
      vi.stubEnv("APP_ORIGIN", "https://beta.example.test");
      vi.stubEnv("ANDROID_API_ENABLED", "true");
      vi.stubEnv("TRUST_PROXY", "loopback");
      vi.stubEnv(
        "BETA_INVITE_SECRET",
        "fictional-native-integration-secret".repeat(2)
      );
      const server = createServer(createApp());
      await new Promise<void>(resolve =>
        server.listen(0, "127.0.0.1", resolve)
      );
      const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      let cookie = "";
      const headers = () => ({
        Origin: "https://localhost",
        "X-Go-Pharmacy-Client": "android",
        "X-Forwarded-Proto": "https",
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      });
      const post = (path: string, input: unknown) =>
        fetch(`${origin}/api/trpc/${path}`, {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({ json: input }),
        });
      const get = (path: string) =>
        fetch(`${origin}/api/trpc/${path}`, { headers: headers() });
      try {
        const registered = await post("auth.register", {
          email: "customer-a@example.test",
          name: "Fictional Android User",
          password: "fictional-only-android-password",
          inviteCode: invitationCodeFor("customer-a@example.test"),
        });
        expect(registered.status).toBe(200);
        const setCookie = registered.headers.get("set-cookie")!;
        expect(setCookie).toContain("HttpOnly");
        expect(setCookie).toContain("Secure");
        expect(setCookie).toContain("SameSite=Lax");
        cookie = setCookie.split(";")[0];
        const me = await (await get("auth.me")).json();
        expect(me.result.data.json.email).toBe("customer-a@example.test");
        expect((await get("cart.list")).status).toBe(200);
        expect((await post("auth.logout", undefined)).status).toBe(200);
        expect((await get("cart.list")).status).toBe(401);
        const login = await post("auth.login", {
          email: "customer-a@example.test",
          password: "fictional-only-android-password",
        });
        expect(login.status).toBe(200);
        cookie = login.headers.get("set-cookie")!.split(";")[0];
        expect((await get("cart.list")).status).toBe(200);
      } finally {
        server.closeAllConnections();
        await new Promise<void>(resolve => server.close(() => resolve()));
      }
    });
  }
);
