import { it, expect } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  completeAccountLogout,
  clearCommittedAccountState,
  prepareAccountChange,
} from "../client/src/lib/account-lifecycle";
it("revokes server session and removes private cache even when native cancellation fails", async () => {
  const client = new QueryClient();
  client.setQueryData(["private"], { name: "fictional private data" });
  let revoked = false;
  const result = await completeAccountLogout(
    async () => {
      throw Error("native disk unavailable");
    },
    async () => {
      revoked = true;
    },
    async () => {
      client.clear();
    }
  );
  expect(revoked).toBe(true);
  expect(client.getQueryData(["private"])).toBeUndefined();
  expect(result.localCleanupFailed).toBe(true);
});
it("clears cache even when remote logout fails and never reports remote success", async () => {
  let cleared = false;
  await expect(
    completeAccountLogout(
      async () => {},
      async () => {
        throw Error("remote unavailable");
      },
      async () => {
        cleared = true;
      }
    )
  ).rejects.toThrow("remote unavailable");
  expect(cleared).toBe(true);
});
it("blocks an account switch before authentication if native cleanup cannot finish", async () => {
  await expect(
    prepareAccountChange(async () => {
      throw Error("secret native failure");
    })
  ).rejects.toThrow("LOCAL_REMINDER_CLEANUP_FAILED");
});
it("finalizes an already committed password reset despite local cancellation failure", async () => {
  let cleared = false;
  const result = await clearCommittedAccountState(
    async () => {
      throw Error("native unavailable");
    },
    async () => {
      cleared = true;
    }
  );
  expect(cleared).toBe(true);
  expect(result.localCleanupFailed).toBe(true);
});
