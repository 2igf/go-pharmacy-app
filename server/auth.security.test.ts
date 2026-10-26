import { describe, it, expect, vi, afterEach } from "vitest";
import {
  betaAllowed,
  hashPassword,
  verifyPassword,
  normalizeEmail,
  validInvitation,
  invitationCodeFor,
  validateAuthConfig,
} from "./auth";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
afterEach(() => vi.unstubAllEnvs());
describe("portable authentication", () => {
  it("rejects copied placeholder invitation secrets", () => {
    vi.stubEnv(
      "BETA_INVITE_SECRET",
      "REPLACE_WITH_CRYPTOGRAPHIC_RANDOM_SECRET_32_OR_MORE_CHARACTERS"
    );
    expect(() => validateAuthConfig()).toThrow();
  });
  it("binds each invitation to its normalized email", () => {
    vi.stubEnv("BETA_INVITE_SECRET", "fictional-test-secret".repeat(3));
    const code = invitationCodeFor("Invited@Example.test");
    expect(validInvitation("invited@example.test", code)).toBe(true);
    expect(validInvitation("other@example.test", code)).toBe(false);
    expect(validInvitation("invited@example.test", "0".repeat(64))).toBe(false);
  });
  it("normalizes email and denies private registration by default", () => {
    vi.stubEnv("PRIVATE_BETA", "true");
    vi.stubEnv("BETA_ALLOWED_EMAILS", " Invited@Example.test ");
    expect(normalizeEmail(" A@B.test ")).toBe("a@b.test");
    expect(betaAllowed("invited@example.test")).toBe(true);
    expect(betaAllowed("other@example.test")).toBe(false);
    expect(betaAllowed(null)).toBe(false);
  });
  it("fails closed for misspelled Beta settings", () => {
    vi.stubEnv("PRIVATE_BETA", "FALSE");
    vi.stubEnv("BETA_ALLOWED_EMAILS", "");
    expect(betaAllowed("a@example.test")).toBe(false);
  });
  it("hashes with independent salts and verifies passwords", async () => {
    const first = await hashPassword("fictional-test-password");
    const second = await hashPassword("fictional-test-password");
    expect(first).not.toBe(second);
    expect(first).not.toContain("fictional-test-password");
    expect(await verifyPassword("fictional-test-password", first)).toBe(true);
    expect(await verifyPassword("wrong-password", first)).toBe(false);
    expect(await verifyPassword("fictional-test-password", "malformed")).toBe(
      false
    );
  });
  it("does not accept role escalation input", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: { headers: {} },
      res: {},
    } as TrpcContext);
    await expect(
      caller.auth.register({
        email: "a@example.test",
        password: "fictional-passphrase",
        name: "Test",
        role: "admin",
      } as never)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
