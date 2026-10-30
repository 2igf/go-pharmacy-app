import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  authErrorMessage,
  clearAccountCache,
  consumeRecoveryFragment,
  recoveryDeliveryMessage,
} from "../client/src/lib/auth-feedback";
import { customerAuthMessages } from "../shared/customer-auth";

describe("customer authentication feedback", () => {
  it("identifies TLS and unavailable-server failures without echoing transport details", () => {
    expect(
      authErrorMessage(
        {
          cause: { message: "SSLHandshakeException certificate private-data" },
        },
        "login"
      )
    ).toContain("HTTPS");
    expect(
      authErrorMessage({ data: { code: "SERVICE_UNAVAILABLE" } }, "login")
    ).toContain("الخادم غير متاح");
    expect(
      authErrorMessage(
        { cause: { message: "SSL certificate private-data" } },
        "login"
      )
    ).not.toContain("private-data");
  });
  it("does not reveal whether an email exists or echo server secrets", () => {
    expect(
      authErrorMessage(
        { data: { code: "UNAUTHORIZED" }, message: "private@example.test" },
        "login"
      )
    ).toBe(customerAuthMessages.credentials);
    expect(authErrorMessage({ data: { code: "CONFLICT" } }, "register")).toBe(
      customerAuthMessages.duplicate
    );
    expect(
      authErrorMessage(
        { data: { code: "INTERNAL_SERVER_ERROR" }, message: "secret-token" },
        "reset"
      )
    ).not.toContain("secret-token");
  });
  it("distinguishes rate limits, invalid recovery codes and network failures", () => {
    expect(
      authErrorMessage({ data: { code: "TOO_MANY_REQUESTS" } }, "request")
    ).toBe(customerAuthMessages.rate);
    expect(authErrorMessage({ data: { code: "BAD_REQUEST" } }, "reset")).toBe(
      customerAuthMessages.token
    );
    expect(authErrorMessage(new TypeError("Failed to fetch"), "login")).toMatch(
      /الاتصال.*connection/i
    );
  });
  it("never claims an email was sent for unavailable or development delivery", () => {
    expect(recoveryDeliveryMessage("unavailable")).toMatch(/غير مهيأة/);
    expect(recoveryDeliveryMessage("development")).toMatch(/لم يُرسل/);
    expect(recoveryDeliveryMessage("email")).toMatch(/إذا كان/);
  });
  it("consumes only a valid fragment token and immediately scrubs the URL", () => {
    const token = "a".repeat(64);
    const replacements: unknown[][] = [];
    const history = {
      state: { preserved: true },
      replaceState: (...args: unknown[]) => replacements.push(args),
    };
    expect(
      consumeRecoveryFragment(
        { hash: `#token=${token}`, pathname: "/login", search: "?mode=reset" },
        history
      )
    ).toBe(token);
    expect(replacements).toEqual([[history.state, "", "/login?mode=reset"]]);
    expect(
      consumeRecoveryFragment(
        { hash: "#token=bad", pathname: "/reset-password", search: "" },
        history
      )
    ).toBe("");
    expect(replacements.at(-1)?.[2]).toBe("/reset-password");
    expect(
      consumeRecoveryFragment(
        { hash: "", pathname: "/login", search: `?token=${token}` },
        history
      )
    ).toBe("");
  });
  it("clears data belonging to a previous account before another account is shown", async () => {
    const client = new QueryClient();
    client.setQueryData(["orders"], [{ ownerId: 1 }]);
    client.setQueryData(["auth", "me"], { id: 1 });
    await clearAccountCache(client);
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(client.getQueryData(["orders"])).toBeUndefined();
  });
  it("prevents a previous account's late response from repopulating the cache", async () => {
    const client = new QueryClient();
    let finish!: (value: { ownerId: number }) => void;
    const response = new Promise<{ ownerId: number }>(resolve => {
      finish = resolve;
    });
    const pending = client.fetchQuery({
      queryKey: ["orders"],
      queryFn: () => response,
    });
    const settled = pending.catch(() => undefined);
    await clearAccountCache(client);
    finish({ ownerId: 1 });
    await settled;
    expect(client.getQueryData(["orders"])).toBeUndefined();
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });
});
