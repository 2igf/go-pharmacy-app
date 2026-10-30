import { describe, it, expect, vi, afterEach } from "vitest";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "./app";
afterEach(() => vi.unstubAllEnvs());
describe("customer auth HTTP validation", () => {
  it("returns bilingual safe field messages without input values or stack", async () => {
    const server = createServer(createApp());
    await new Promise<void>(r => server.listen(0, "127.0.0.1", r));
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    vi.stubEnv("APP_ORIGIN", origin);
    try {
      const response = await fetch(`${origin}/api/trpc/auth.register`, {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify({
          json: {
            email: "sensitive-invalid-input",
            password: "tiny",
            name: "a",
          },
        }),
      });
      const text = await response.text();
      expect(response.status).toBe(400);
      expect(text).toContain("Enter a valid email");
      expect(text).toContain("بريداً");
      expect(text).toContain("12");
      expect(text).not.toContain("sensitive-invalid-input");
      expect(text).not.toContain("stack");
    } finally {
      server.closeAllConnections();
      await new Promise<void>(r => server.close(() => r()));
    }
  });
});
