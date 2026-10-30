import { describe, expect, it } from "vitest";
import {
  createReminderSyncCoordinator,
  nativeReminderDefinitions,
  recentManualOccurrences,
  manualNotificationStatus,
  requestManualNotificationPermission,
  type NativeReminder,
  type ReminderNativeDriver,
} from "../client/src/lib/manual-notifications";

const reminder = {
  id: 1,
  userId: 7,
  medicationName: "FICTIONAL REMINDER",
  times: ["08:00"],
  weekdays: [1],
  startDate: "2026-10-29",
  enabled: true,
  discreet: true,
};
function nativeDriver() {
  const calls: string[] = [];
  let key: string | undefined;
  const driver: ReminderNativeDriver = {
    status: async () => ({
      permission: "granted",
      scheduled: 0,
      accountKey: key,
    }),
    clear: async () => {
      calls.push("clear");
      key = undefined;
    },
    synchronize: async input => {
      calls.push(
        `sync:${input.accountKey}:${input.reminders.map(item => item.id)}`
      );
      key = input.accountKey;
      return {
        permission: "granted",
        scheduled: input.reminders.length,
        accountKey: key,
      };
    },
  };
  return { driver, calls };
}
describe("native manual reminder client isolation", () => {
  it("truthfully reports no local scheduling on web without requesting native permission", async () => {
    expect(await manualNotificationStatus()).toEqual({
      platform: "web",
      permission: "unavailable",
      scheduled: 0,
    });
    expect(await requestManualNotificationPermission()).toEqual({
      platform: "web",
      permission: "unavailable",
      scheduled: 0,
    });
  });
  it("reports a native clear failure without poisoning later valid queue work", async () => {
    const { driver, calls } = nativeDriver();
    const clear = driver.clear;
    let fail = true;
    driver.clear = async () => {
      if (fail) {
        fail = false;
        throw new Error("synthetic native failure");
      }
      await clear();
    };
    const sync = createReminderSyncCoordinator(driver);
    await expect(sync.activate("origin|7", 1)).rejects.toThrow(
      "synthetic native failure"
    );
    await sync.synchronize("origin|7", [reminder]);
    expect(calls).toEqual(["clear", "sync:origin|7:1"]);
  });
  it("uses the later DST overlap once and excludes nonexistent spring minutes", () => {
    const definition = {
      ...reminder,
      weekdays: [0],
      times: ["01:30"],
      startDate: "2026-11-01",
      endDate: "2026-11-01",
      createdAt: "2026-10-31T00:00:00Z",
    };
    expect(
      recentManualOccurrences(
        definition,
        new Date("2026-11-01T07:00:00Z"),
        "America/New_York"
      )
    ).toEqual([new Date("2026-11-01T06:30:00Z")]);
    expect(
      recentManualOccurrences(
        {
          ...definition,
          times: ["02:30"],
          startDate: "2026-03-08",
          endDate: "2026-03-08",
          createdAt: "2026-03-07T00:00:00Z",
        },
        new Date("2026-03-08T10:00:00Z"),
        "America/New_York"
      )
    ).toEqual([]);
  });
  it("offers only past scheduled local minutes after creation for manual reporting", () => {
    const now = new Date(2026, 9, 29, 12, 30, 45);
    const definition = {
      ...reminder,
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      times: ["08:00", "12:30", "13:00"],
      startDate: "2026-10-28",
      endDate: "2026-10-29",
      createdAt: new Date(2026, 9, 29, 9, 0),
    };
    expect(recentManualOccurrences(definition, now)).toEqual([
      new Date(2026, 9, 29, 12, 30),
    ]);
    expect(
      recentManualOccurrences({ ...definition, enabled: false }, now)
    ).toEqual([]);
    expect(
      recentManualOccurrences({ ...definition, weekdays: [] }, now)
    ).toEqual([]);
    expect(
      recentManualOccurrences({ ...definition, endDate: "2026-10-28" }, now)
    ).toEqual([]);
  });
  it("finishes an in-flight old-account operation before clearing and replacing it", async () => {
    const { driver, calls } = nativeDriver();
    let release!: () => void;
    let started!: () => void;
    const began = new Promise<void>(resolve => {
      started = resolve;
    });
    const hold = new Promise<void>(resolve => {
      release = resolve;
    });
    const original = driver.synchronize;
    driver.synchronize = async input => {
      if (input.accountKey === "origin|7") {
        started();
        await hold;
      }
      return original(input);
    };
    const sync = createReminderSyncCoordinator(driver);
    await sync.activate("origin|7", 1);
    const pendingA = sync.synchronize("origin|7", [reminder]);
    await began;
    const changed = sync.activate("origin|8", 2);
    const pendingB = sync.synchronize("origin|8", [{ ...reminder, id: 2 }]);
    release();
    await Promise.all([pendingA, changed, pendingB]);
    expect(calls.slice(-3)).toEqual([
      "sync:origin|7:1",
      "clear",
      "sync:origin|8:2",
    ]);
  });
  it("rejects foreign/cached data and sends only enabled owned minimal definitions", () => {
    expect(nativeReminderDefinitions([reminder], 7, false)).toBeUndefined();
    expect(nativeReminderDefinitions([reminder], 8, true)).toBeUndefined();
    expect(
      nativeReminderDefinitions([reminder, { ...reminder, userId: 8 }], 7, true)
    ).toBeUndefined();
    expect(
      nativeReminderDefinitions([{ ...reminder, enabled: false }], 7, true)
    ).toEqual([]);
    const payload = nativeReminderDefinitions(
      [{ ...reminder, dosage: "PRIVATE", notes: "PRIVATE" }],
      7,
      true
    );
    expect(payload).toHaveLength(1);
    expect(payload?.[0]).not.toHaveProperty("userId");
    expect(payload?.[0]).not.toHaveProperty("notes");
    expect(payload?.[0]).not.toHaveProperty("dosage");
  });
  it("clears a previous native account before synchronizing another", async () => {
    const { driver, calls } = nativeDriver();
    const sync = createReminderSyncCoordinator(driver);
    await sync.activate("origin|7", 1);
    await sync.synchronize("origin|7", [reminder]);
    await sync.activate("origin|8", 2);
    await sync.synchronize("origin|8", [{ ...reminder, id: 2 }]);
    expect(calls).toEqual([
      "clear",
      "sync:origin|7:1",
      "clear",
      "sync:origin|8:2",
    ]);
  });
  it("does not allow delayed account A work to overwrite account B", async () => {
    const { driver, calls } = nativeDriver();
    const sync = createReminderSyncCoordinator(driver);
    const first = sync.activate("origin|7", 1);
    const stale = sync.synchronize("origin|7", [reminder]);
    const second = sync.activate("origin|8", 2);
    const latest = sync.synchronize("origin|8", [{ ...reminder, id: 2 }]);
    await Promise.all([first, stale, second, latest]);
    expect(calls).toEqual(["clear", "sync:origin|8:2"]);
    await sync.synchronize("origin|7", [reminder]);
    expect(calls.at(-1)).toBe("sync:origin|8:2");
  });
  it("preserves existing schedules on auth-network errors and blocks stale resync after logout", async () => {
    const { driver, calls } = nativeDriver();
    const sync = createReminderSyncCoordinator(driver);
    await sync.activate("origin|7", 1);
    await sync.synchronize("origin|7", [reminder]);
    sync.suspend();
    await sync.synchronize("origin|7", [reminder]);
    expect(calls.at(-1)).toBe("sync:origin|7:1");
    await sync.logout();
    const count = calls.length;
    await sync.activate("origin|7", 1);
    await sync.synchronize("origin|7", [reminder]);
    expect(calls).toHaveLength(count);
    await sync.activate("origin|7", 2);
    await sync.synchronize("origin|7", [reminder]);
    expect(calls.at(-1)).toBe("sync:origin|7:1");
  });
});
