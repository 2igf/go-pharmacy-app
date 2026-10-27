import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const native = vi.hoisted(() => ({ platform: "android", request: vi.fn() }));
vi.mock("@capacitor/core", () => ({
  Capacitor: { getPlatform: () => native.platform },
  CapacitorHttp: { request: native.request },
}));
import { apiFetch, saveNativeApiOrigin } from "../client/src/lib/api-fetch";
beforeEach(() => {
  native.platform = "android";
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  native.request.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("native tRPC transport", () => {
  it("keeps HTTPS native cookies out of the application's fetch response and disables redirects", async () => {
    saveNativeApiOrigin("https://beta.example.test");
    native.request.mockResolvedValue({
      status: 200,
      data: '{"result":true}',
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": "session=private; HttpOnly; Secure",
      },
    });
    const response = await apiFetch(
      "https://beta.example.test/api/trpc/auth.login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"json":{"email":"fictional@example.test"}}',
      }
    );
    expect(response.headers.has("set-cookie")).toBe(false);
    expect(await response.json()).toEqual({ result: true });
    expect(native.request).toHaveBeenCalledWith(
      expect.objectContaining({
        disableRedirects: true,
        method: "POST",
        headers: expect.objectContaining({
          origin: "https://localhost",
          "x-go-pharmacy-client": "android",
        }),
      })
    );
  });
  it("rejects missing configuration and an unexpected destination before native I/O", async () => {
    await expect(
      apiFetch("https://beta.example.test/api/trpc/auth.me")
    ).rejects.toThrow();
    saveNativeApiOrigin("https://beta.example.test");
    await expect(
      apiFetch("https://attacker.example/api/trpc/auth.me")
    ).rejects.toThrow();
    expect(native.request).not.toHaveBeenCalled();
  });
  it("does not follow a redirect carrying a session to another host", async () => {
    saveNativeApiOrigin("https://beta.example.test");
    native.request.mockResolvedValue({
      status: 302,
      data: "",
      headers: { Location: "https://other.example" },
    });
    await expect(
      apiFetch("https://beta.example.test/api/trpc/auth.me")
    ).rejects.toThrow();
    expect(native.request).toHaveBeenCalledTimes(1);
  });
  it("preserves the web same-origin cookie fetch path", async () => {
    native.platform = "web";
    const webFetch = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", webFetch);
    await apiFetch("/api/trpc/auth.me");
    expect(webFetch).toHaveBeenCalledWith("/api/trpc/auth.me", {
      credentials: "include",
    });
    expect(native.request).not.toHaveBeenCalled();
  });
});
