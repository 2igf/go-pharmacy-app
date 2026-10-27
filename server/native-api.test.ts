import { describe, expect, it } from "vitest";
import { normalizeApiOrigin, nativeRequestUrl } from "../shared/native-api";

describe("Android API destination policy", () => {
  it("accepts a canonical HTTPS origin, including a non-default TLS port", () => {
    expect(normalizeApiOrigin(" https://beta.example.test:8443/ ")).toBe(
      "https://beta.example.test:8443"
    );
  });
  it.each([
    "",
    "http://beta.example.test",
    "https://localhost",
    "https://127.0.0.1:3017",
    "https://[::1]",
    "https://user:pass@beta.example.test",
    "https://beta.example.test/path",
    "https://beta.example.test?token=secret",
    "https://beta.example.test#x",
  ])("rejects unsafe or ambiguous origin %s", value => {
    expect(() => normalizeApiOrigin(value)).toThrow();
  });
  it("confines native transport to this configured server's tRPC API", () => {
    const origin = "https://beta.example.test";
    expect(nativeRequestUrl(origin, `${origin}/api/trpc/auth.me?batch=1`)).toBe(
      `${origin}/api/trpc/auth.me?batch=1`
    );
    for (const input of [
      "https://attacker.test/api/trpc/auth.me",
      `${origin}/outside`,
      `${origin}/api/trpc/../secrets`,
    ])
      expect(() => nativeRequestUrl(origin, input)).toThrow();
  });
});
