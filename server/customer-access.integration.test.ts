import {
  beforeEach,
  afterAll,
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { appRouter } from "./routers";
import { authenticateRequest } from "./auth";
import { hashPassword, verifyPassword } from "./auth";
import { createDecipheriv } from "node:crypto";
import { mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { and, eq, isNull } from "drizzle-orm";
import { credentials, sessions, users } from "../drizzle/schema";
import {
  customerAccounts,
  customerPasswordResets,
} from "../drizzle/customer-access";
import { getDb } from "./db";
import {
  flushCustomerResetDeliveries,
  hashResetToken,
} from "./customer-access/recovery";
import { customerPhoneSchema } from "../shared/customer-auth";
import { resetFixtures, testContext, closeDb } from "./test-support";

let caseId = 0;
let sink = "";
beforeEach(async () => {
  caseId++;
  sink = path.resolve(
    `.local/customer-access-tests/run-${Date.now()}-${caseId}`
  );
  vi.stubEnv("CUSTOMER_RESET_DEV_DIR", sink);
  vi.stubEnv("CUSTOMER_RESET_MAIL_MODE", "development");
  vi.stubEnv("RESET_WEB_ORIGIN", "http://127.0.0.1:3999");
  if (process.env.TEST_DATABASE_URL) await resetFixtures();
});
afterEach(async () => {
  await flushCustomerResetDeliveries();
  vi.unstubAllEnvs();
});
afterAll(closeDb);
const password = "fictional-public-password";
const nextPassword = "fictional-replacement-password";
async function publicCaller() {
  const context = { ...(await testContext()), user: null };
  Object.defineProperty(context.req, "ip", {
    value: `fictional-test-${caseId}`,
    configurable: true,
  });
  let cookie = "";
  context.res.cookie = ((name: string, token: string) => {
    cookie = `${name}=${token}`;
    return context.res;
  }) as typeof context.res.cookie;
  return {
    caller: appRouter.createCaller(context),
    context,
    getCookie: () => cookie,
  };
}
async function register(email = `public-${caseId}@example.test`) {
  const access = await publicCaller();
  await access.caller.auth.register({
    email,
    name: "Public Customer",
    password,
  });
  return { ...access, email };
}
async function deliveredTokens() {
  await flushCustomerResetDeliveries();
  const files = await readdir(path.join(sink, "outbox")).catch(() => []);
  if (!files.length) return [];
  const key = await readFile(path.join(sink, "mail.key"));
  return Promise.all(
    files.map(async file => {
      const envelope = JSON.parse(
        await readFile(path.join(sink, "outbox", file), "utf8")
      );
      const decipher = createDecipheriv(
        "aes-256-gcm",
        key,
        Buffer.from(envelope.iv, "base64")
      );
      decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
      const message = JSON.parse(
        Buffer.concat([
          decipher.update(Buffer.from(envelope.ciphertext, "base64")),
          decipher.final(),
        ]).toString("utf8")
      );
      const link = new URL(message.resetUrl);
      return {
        token: new URLSearchParams(link.hash.slice(1)).get("token")!,
        message,
        link,
      };
    })
  );
}
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "public customer access on real MySQL",
  () => {
    it("registers a customer without beta allowlist or invitation and authenticates its session", async () => {
      const context = { ...(await testContext()), user: null };
      let cookie = "";
      context.res.cookie = ((name: string, token: string) => {
        cookie = `${name}=${token}`;
        return context.res;
      }) as typeof context.res.cookie;
      const caller = appRouter.createCaller(context);
      await expect(
        caller.auth.register({
          email: "public-customer@example.test",
          name: "Public Customer",
          password: "fictional-public-password",
          phone: "٠٧٩١٢٣٤٥٦٧",
        } as never)
      ).resolves.toMatchObject({ success: true });
      context.req.headers.cookie = cookie;
      const user = await authenticateRequest(context.req);
      expect(user).toMatchObject({
        email: "public-customer@example.test",
        role: "user",
        phone: "0791234567",
      });
    });
    it("never accepts supplied roles, organization roles, verification state or user ids", async () => {
      const { caller } = await publicCaller();
      for (const extra of [
        { role: "admin" },
        { userId: 3 },
        { organizationRole: "owner" },
        { verificationState: "verified" },
      ]) {
        await expect(
          caller.auth.register({
            email: `escalation-${caseId}@example.test`,
            name: "Customer",
            password,
            ...extra,
          } as never)
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      }
      const db = await getDb();
      expect((await db.select().from(customerAccounts)).length).toBe(0);
    });
    it("normalizes international/Persian phones and rejects ambiguous local countries and invalid Jordan mobiles", async () => {
      expect(customerPhoneSchema.parse("+۴۴ (۷۷) ۰۰۹۰۰۱۲۳")).toBe(
        "+447700900123"
      );
      expect(customerPhoneSchema.safeParse("0551234567").success).toBe(false);
      expect(customerPhoneSchema.safeParse("0761234567").success).toBe(false);
      expect(customerPhoneSchema.safeParse("+0123456789").success).toBe(false);
      const access = await register();
      access.context.req.headers.cookie = access.getCookie();
      const user = await authenticateRequest(access.context.req);
      const caller = appRouter.createCaller({ ...access.context, user });
      await caller.auth.updateProfile({
        name: "New Name",
        phone: "+۴۴۷۷۰۰۹۰۰۱۲۳",
      });
      expect((await caller.auth.me())?.role).toBe("user");
      expect(await caller.auth.accountStatus()).toEqual({
        accessSource: "public",
        verificationState: "unverified",
        emailVerified: false,
      });
      const db = await getDb();
      expect(
        (await db.select().from(users).where(eq(users.id, user!.id)))[0].phone
      ).toBe("+447700900123");
    });
    it("handles normalized duplicate and concurrent registration with one credential and no orphan users", async () => {
      const { caller } = await publicCaller();
      const input = {
        email: `duplicate-${caseId}@example.test`,
        name: "Duplicate Customer",
        password,
      };
      const results = await Promise.allSettled([
        caller.auth.register(input),
        caller.auth.register({
          ...input,
          email: `  ${input.email.toUpperCase()}  `,
        }),
      ]);
      expect(
        results.filter(result => result.status === "fulfilled").length
      ).toBe(1);
      expect(
        results
          .filter(result => result.status === "rejected")
          .map(result => (result as PromiseRejectedResult).reason.code)
      ).toEqual(["CONFLICT"]);
      await expect(caller.auth.register(input)).rejects.toMatchObject({
        code: "CONFLICT",
      });
      const db = await getDb();
      expect(
        (await db.select().from(users).where(eq(users.email, input.email)))
          .length
      ).toBe(1);
      expect(
        (
          await db
            .select()
            .from(credentials)
            .where(eq(credentials.email, input.email))
        ).length
      ).toBe(1);
    });
    it("refuses duplicate signup for an existing legacy account without credentials", async () => {
      const { caller } = await publicCaller();
      await expect(
        caller.auth.register({
          email: "customer-a@example.test",
          name: "Duplicate legacy",
          password,
        })
      ).rejects.toMatchObject({ code: "CONFLICT" });
      const db = await getDb();
      expect(
        (
          await db
            .select()
            .from(users)
            .where(eq(users.email, "customer-a@example.test"))
        ).length
      ).toBe(1);
    });
    it("preserves legacy allowlist boundaries including privileged accounts with public markers", async () => {
      const db = await getDb();
      await db.insert(credentials).values({
        userId: 3,
        email: "admin@example.test",
        passwordHash: await hashPassword(password),
      });
      await db
        .insert(customerAccounts)
        .values({ userId: 3, accessSource: "public" });
      vi.stubEnv("BETA_ALLOWED_EMAILS", "");
      const { caller } = await publicCaller();
      await expect(
        caller.auth.login({ email: "admin@example.test", password })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await caller.auth.requestPasswordReset({ email: "admin@example.test" });
      expect((await deliveredTokens()).length).toBe(0);
      vi.stubEnv("BETA_ALLOWED_EMAILS", "admin@example.test");
      await expect(
        caller.auth.login({ email: "admin@example.test", password })
      ).resolves.toMatchObject({ success: true });
    });
    it("returns uniform provider-unavailable and configured-channel responses without revealing account presence", async () => {
      const access = await register();
      vi.stubEnv("CUSTOMER_RESET_MAIL_MODE", "disabled");
      vi.stubEnv("RESEND_API_KEY", "");
      expect(
        await access.caller.auth.requestPasswordReset({ email: access.email })
      ).toEqual({ accepted: true, delivery: "unavailable" });
      expect(
        await access.caller.auth.requestPasswordReset({
          email: `absent-${caseId}@example.test`,
        })
      ).toEqual({ accepted: true, delivery: "unavailable" });
      vi.stubEnv("CUSTOMER_RESET_MAIL_MODE", "development");
      expect(
        await access.caller.auth.requestPasswordReset({ email: access.email })
      ).toEqual({ accepted: true, delivery: "development" });
      expect(
        await access.caller.auth.requestPasswordReset({
          email: `absent-${caseId}@example.test`,
        })
      ).toEqual({ accepted: true, delivery: "development" });
      const messages = await deliveredTokens();
      expect(messages.length).toBe(1);
      expect(messages[0].link.origin).toBe("http://127.0.0.1:3999");
      expect(messages[0].link.search).toBe("?mode=reset");
      expect(messages[0].link.hash.startsWith("#token=")).toBe(true);
      const db = await getDb();
      const [row] = await db.select().from(customerPasswordResets);
      expect(row.tokenHash === hashResetToken(messages[0].token)).toBe(true);
      expect(row.tokenHash === messages[0].token).toBe(false);
      const encrypted = await readFile(
        path.join(
          sink,
          "outbox",
          (await readdir(path.join(sink, "outbox")))[0]
        ),
        "utf8"
      );
      expect(
        encrypted.includes(messages[0].token) ||
          encrypted.includes(access.email)
      ).toBe(false);
    });
    it("rejects expired/malformed codes and mismatched confirmation without changing password or session", async () => {
      const access = await register();
      await access.caller.auth.requestPasswordReset({ email: access.email });
      const [{ token }] = await deliveredTokens();
      const db = await getDb();
      await db
        .update(customerPasswordResets)
        .set({ expiresAt: new Date(Date.now() - 1) });
      await expect(
        access.caller.auth.resetPassword({
          token,
          password: nextPassword,
          confirmPassword: nextPassword,
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(
        access.caller.auth.resetPassword({
          token,
          password: nextPassword,
          confirmPassword: "another-value",
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(
        access.caller.auth.resetPassword({
          token: "malformed",
          password: nextPassword,
          confirmPassword: nextPassword,
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(
        await verifyPassword(
          password,
          (
            await db
              .select()
              .from(credentials)
              .where(eq(credentials.email, access.email))
          )[0].passwordHash
        )
      ).toBe(true);
      access.context.req.headers.cookie = access.getCookie();
      expect(await authenticateRequest(access.context.req)).not.toBeNull();
    });
    it("permits one concurrent reset, revokes every session and other tokens, rejects replay, and signs in only with new password", async () => {
      const access = await register();
      await access.caller.auth.login({ email: access.email, password });
      await access.caller.auth.requestPasswordReset({ email: access.email });
      await access.caller.auth.requestPasswordReset({ email: access.email });
      const messages = await deliveredTokens();
      expect(messages.length).toBe(2);
      const input = {
        token: messages[0].token,
        password: nextPassword,
        confirmPassword: nextPassword,
      };
      const results = await Promise.allSettled([
        access.caller.auth.resetPassword(input),
        access.caller.auth.resetPassword(input),
      ]);
      expect(
        results.filter(result => result.status === "fulfilled").length
      ).toBe(1);
      expect(
        results
          .filter(result => result.status === "rejected")
          .map(result => (result as PromiseRejectedResult).reason.code)
      ).toEqual(["BAD_REQUEST"]);
      const db = await getDb();
      const [credential] = await db
        .select()
        .from(credentials)
        .where(eq(credentials.email, access.email));
      expect(
        (
          await db
            .select()
            .from(sessions)
            .where(eq(sessions.userId, credential.userId))
        ).length
      ).toBe(0);
      expect(
        (
          await db
            .select()
            .from(customerPasswordResets)
            .where(
              and(
                eq(customerPasswordResets.userId, credential.userId),
                isNull(customerPasswordResets.usedAt)
              )
            )
        ).length
      ).toBe(0);
      for (const { token } of messages)
        await expect(
          access.caller.auth.resetPassword({ ...input, token })
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(
        access.caller.auth.login({ email: access.email, password })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await expect(
        access.caller.auth.login({
          email: access.email,
          password: nextPassword,
        })
      ).resolves.toMatchObject({ success: true });
    });
    it("completes parallel public logins when the database pool is saturated", async () => {
      const access = await register();
      const result = await Promise.all(
        Array.from({ length: 5 }, () =>
          access.caller.auth.login({ email: access.email, password })
        )
      );
      expect(result.every(row => row.success)).toBe(true);
    }, 5000);
    it("enforces email and trusted IP reset limits for direct procedure calls", async () => {
      const { caller } = await publicCaller();
      for (let attempt = 0; attempt < 5; attempt++)
        await caller.auth.requestPasswordReset({
          email: `limited-${caseId}@example.test`,
        });
      await expect(
        caller.auth.requestPasswordReset({
          email: `limited-${caseId}@example.test`,
        })
      ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
      for (let attempt = 0; attempt < 15; attempt++)
        await caller.auth.requestPasswordReset({
          email: `limited-${caseId}-${attempt}@example.test`,
        });
      await expect(
        caller.auth.requestPasswordReset({
          email: `limited-${caseId}-extra@example.test`,
        })
      ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    });
    it("blocks caller redirects, unsafe origins and production development delivery", async () => {
      const { caller } = await publicCaller();
      await expect(
        caller.auth.requestPasswordReset({
          email: `safe-${caseId}@example.test`,
          redirectUrl: "https://attacker.invalid",
        } as never)
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      for (const origin of [
        "http://external.invalid",
        "https://safe.invalid/redirect",
        "https://user:password@safe.invalid",
        "https://safe.invalid?redirect=x",
      ]) {
        vi.stubEnv("RESET_WEB_ORIGIN", origin);
        expect(
          await caller.auth.requestPasswordReset({
            email: `safe-${caseId}@example.test`,
          })
        ).toEqual({ accepted: true, delivery: "unavailable" });
      }
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("RESET_WEB_ORIGIN", "https://safe.invalid");
      vi.stubEnv("RESEND_API_KEY", "");
      expect(
        await caller.auth.requestPasswordReset({
          email: `safe-production-${caseId}@example.test`,
        })
      ).toEqual({ accepted: true, delivery: "unavailable" });
      vi.stubEnv("NODE_ENV", "test");
    });
  }
);
