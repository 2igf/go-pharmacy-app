import { beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { authenticateRequest, invitationCodeFor } from "./auth";
import { getDb } from "./db";
import { sessions } from "../drizzle/schema";
import { COOKIE_NAME } from "../shared/const";
import { resetFixtures, testContext, closeDb } from "./test-support";
beforeEach(async () => {
  if (process.env.TEST_DATABASE_URL) await resetFixtures();
});
afterAll(closeDb);
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "real MySQL authentication persistence",
  () => {
    it("registers with invitation, validates credentials, revokes logout and expires sessions", async () => {
      vi.stubEnv("BETA_ALLOWED_EMAILS", "legacy-registration@example.test");
      vi.stubEnv("BETA_INVITE_SECRET", "fictional-test-secret".repeat(3));
      const context = { ...(await testContext()), user: null };
      let cookie = "";
      context.res.cookie = ((name: string, token: string) => {
        cookie = `${name}=${token}`;
        return context.res;
      }) as typeof context.res.cookie;
      const caller = appRouter.createCaller(context);
      const input = {
        email: "legacy-registration@example.test",
        name: "Fictional Registration",
        password: "fictional-only-test-password",
        inviteCode: invitationCodeFor("legacy-registration@example.test"),
      };
      await expect(
        caller.auth.register({ ...input, inviteCode: "0".repeat(64) })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await caller.auth.register(input);
      const req = context.req;
      req.headers = { cookie };
      const user = await authenticateRequest(req);
      expect(user?.email).toBe(input.email);
      expect(user?.role).toBe("user");
      expect(user).not.toHaveProperty("passwordHash");
      await expect(
        caller.auth.login({
          email: input.email,
          password: "wrong-test-password",
        })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await caller.auth.login({ email: input.email, password: input.password });
      req.headers.cookie = cookie;
      expect(await authenticateRequest(req)).not.toBeNull();
      await appRouter.createCaller({ ...context, req }).auth.logout();
      expect(await authenticateRequest(req)).toBeNull();
      await caller.auth.login({ email: input.email, password: input.password });
      req.headers.cookie = cookie;
      const db = await getDb();
      await db.update(sessions).set({ expiresAt: new Date(0) });
      expect(await authenticateRequest(req)).toBeNull();
      req.headers.cookie = `${COOKIE_NAME}=${"0".repeat(64)}`;
      expect(await authenticateRequest(req)).toBeNull();
      vi.unstubAllEnvs();
    });
  }
);
