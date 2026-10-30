import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  createReminderSchema,
  isScheduledOccurrence,
  nextReminderOccurrence,
} from "../shared/customer-reminders";
import { manualRemindersRouter } from "./customer-reminders/router";
import { appRouter } from "./routers";
import {
  users,
  medicationReminders,
  medicationReminderLogs,
} from "../drizzle/schema";
import {
  customerReminders,
  customerReminderEvents,
} from "../drizzle/customer-reminders";
import { getDb } from "./db";
import { closeDb, resetFixtures, testContext } from "./test-support";

function definition(overrides: Record<string, unknown> = {}) {
  return {
    requestId: randomUUID(),
    medicationName: "Fictional manual item",
    dosage: "User entered text",
    times: ["08:00", "20:30"],
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    startDate: "2026-01-01",
    timezone: "Asia/Amman",
    ...overrides,
  };
}
describe("manual reminder schedule validation without a database", () => {
  it("uses only the later offset for a repeated autumn local time", () => {
    const schedule = createReminderSchema.parse(
      definition({ times: ["01:30"], timezone: "America/New_York" })
    );
    expect(
      isScheduledOccurrence(schedule, new Date("2026-11-01T05:30:00Z"))
    ).toBe(false);
    expect(
      isScheduledOccurrence(schedule, new Date("2026-11-01T06:30:00Z"))
    ).toBe(true);
    expect(
      nextReminderOccurrence(
        schedule,
        new Date("2026-11-01T04:00:00Z")
      )?.toISOString()
    ).toBe("2026-11-01T06:30:00.000Z");
  });
  it("accepts an explicitly entered schedule and defaults to discreet", () => {
    const parsed = createReminderSchema.parse(definition());
    expect(parsed.discreet).toBe(true);
    expect(parsed.enabled).toBe(true);
  });
  it.each([
    { times: [] },
    { times: ["25:00"] },
    { times: ["8:00"] },
    { times: ["08:00", "08:00"] },
    { times: Array.from({ length: 9 }, (_, i) => `0${i}:00`) },
    { weekdays: [] },
    { weekdays: [7] },
    { weekdays: [1, 1] },
    { startDate: "2026-02-30" },
    { endDate: "2025-01-01" },
    { timezone: "Mars/Olympus" },
    { medicationName: " " },
    { medicationName: "a".repeat(121) },
    { dosage: "a".repeat(121) },
    { notes: "a".repeat(501) },
    { userId: 2 },
    { role: "admin" },
    { prescribedDose: "unsafe" },
  ])("rejects invalid or client-owned fields %j", invalid => {
    expect(createReminderSchema.safeParse(definition(invalid)).success).toBe(
      false
    );
  });
  it("matches the local timezone/day/minute and rejects seconds or dates outside the definition", () => {
    const schedule = createReminderSchema.parse(
      definition({ weekdays: [4], endDate: "2026-10-29" })
    );
    expect(
      isScheduledOccurrence(schedule, new Date("2026-10-29T05:00:00Z"))
    ).toBe(true);
    for (const time of [
      "2026-10-29T05:00:01Z",
      "2026-10-29T06:00:00Z",
      "2026-10-30T05:00:00Z",
      "2025-10-30T05:00:00Z",
    ])
      expect(isScheduledOccurrence(schedule, new Date(time))).toBe(false);
  });
  it("finds a future start date and skips a daylight-saving gap without shifting the entered time", () => {
    const distant = createReminderSchema.parse(
      definition({ startDate: "2027-06-01", times: ["08:00"], timezone: "UTC" })
    );
    expect(
      nextReminderOccurrence(
        distant,
        new Date("2026-01-01T00:00:00Z")
      )?.toISOString()
    ).toBe("2027-06-01T08:00:00.000Z");
    const gap = createReminderSchema.parse(
      definition({ times: ["02:30"], timezone: "America/New_York" })
    );
    expect(
      nextReminderOccurrence(
        gap,
        new Date("2026-03-08T05:00:00Z")
      )?.toISOString()
    ).toBe("2026-03-09T06:30:00.000Z");
  });
  it("covers the full first selected week at the western timezone boundary", () => {
    const schedule = createReminderSchema.parse(
      definition({
        startDate: "2027-06-06",
        times: ["23:59"],
        weekdays: [6],
        timezone: "Etc/GMT+12",
      })
    );
    expect(
      nextReminderOccurrence(
        schedule,
        new Date("2026-01-01T00:00:00Z")
      )?.toISOString()
    ).toBe("2027-06-13T11:59:00.000Z");
  });
});

beforeEach(async () => {
  if (process.env.TEST_DATABASE_URL) await resetFixtures();
});
afterAll(closeDb);
async function caller(id = 1) {
  return manualRemindersRouter.createCaller(await testContext(id));
}
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "owner-only manual reminders on isolated MySQL",
  () => {
    it("persists CRUD, pause, resume and optimistic versions across callers", async () => {
      const first = await (await caller()).create(definition());
      expect(first).toMatchObject({
        userId: 1,
        version: 1,
        enabled: true,
        discreet: true,
      });
      expect(await (await caller()).detail({ id: first.id })).toEqual(first);
      const { requestId: _requestId, ...fields } = definition();
      await expect(
        (await caller()).update({
          ...fields,
          id: first.id,
          version: 1,
          userId: 1,
        } as never)
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      const updated = await (
        await caller()
      ).update({
        ...fields,
        id: first.id,
        version: first.version,
        enabled: false,
      });
      expect(updated).toMatchObject({ version: 2, enabled: false });
      await expect(
        (await caller()).update({ ...fields, id: first.id, version: 1 })
      ).rejects.toMatchObject({ code: "CONFLICT" });
      const resumed = await (
        await caller()
      ).update({ ...fields, id: first.id, version: 2, enabled: true });
      expect(resumed.version).toBe(3);
      await expect(
        (await caller()).remove({ id: first.id, version: 2 })
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await (await caller()).remove({ id: first.id, version: 3 });
      expect(await (await caller()).list()).toEqual([]);
    });
    it("serializes duplicate requests, rejects key reuse and caps active definitions", async () => {
      const input = definition();
      const rows = await Promise.all(
        Array.from({ length: 5 }, async () => (await caller()).create(input))
      );
      expect(new Set(rows.map(row => row.id)).size).toBe(1);
      await expect(
        (await caller()).create({ ...input, medicationName: "Different" })
      ).rejects.toMatchObject({ code: "CONFLICT" });
      for (let i = 1; i < 20; i++) await (await caller()).create(definition());
      await expect((await caller()).create(definition())).rejects.toMatchObject(
        { code: "PRECONDITION_FAILED" }
      );
      expect(await (await caller()).list()).toHaveLength(20);
      const { requestId: _requestId, ...fields } = definition();
      const first = rows[0];
      const paused = await (
        await caller()
      ).update({ ...fields, id: first.id, version: 1, enabled: false });
      await (await caller()).create(definition());
      await expect(
        (await caller()).update({
          ...fields,
          id: paused.id,
          version: paused.version,
          enabled: true,
        })
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
      expect(
        (await (await caller()).list()).filter(row => row.enabled)
      ).toHaveLength(20);
    });
    it("accepts only one concurrent versioned edit and a paused definition cannot create history", async () => {
      const { requestId: _requestId, ...fields } = definition();
      const row = await (await caller()).create(definition());
      const access = await caller();
      const outcomes = await Promise.allSettled([
        access.update({ ...fields, id: row.id, version: 1, enabled: false }),
        access.update({
          ...fields,
          id: row.id,
          version: 1,
          notes: "Concurrent edit",
        }),
      ]);
      expect(
        outcomes.filter(result => result.status === "fulfilled")
      ).toHaveLength(1);
      expect(
        outcomes.filter(result => result.status === "rejected")
      ).toHaveLength(1);
      const latest = await access.detail({ id: row.id });
      const paused = latest.enabled
        ? await access.update({
            ...fields,
            id: row.id,
            version: latest.version,
            enabled: false,
          })
        : latest;
      await expect(
        access.record({
          id: row.id,
          version: paused.version,
          scheduledAt: new Date().toISOString(),
          status: "skipped",
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(await access.history({ id: row.id })).toEqual([]);
    });
    it("uses owner predicates for every procedure without leaking another account's existence", async () => {
      const row = await (await caller()).create(definition());
      const other = await caller(2);
      const { requestId: _requestId, ...fields } = definition();
      expect(await other.list()).toEqual([]);
      for (const id of [row.id, 2147483647]) {
        await expect(other.detail({ id })).rejects.toMatchObject({
          code: "NOT_FOUND",
        });
        await expect(other.history({ id })).rejects.toMatchObject({
          code: "NOT_FOUND",
        });
        await expect(
          other.update({ ...fields, id, version: 1 })
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
        await expect(other.remove({ id, version: 1 })).rejects.toMatchObject({
          code: "NOT_FOUND",
        });
        await expect(
          other.record({
            id,
            version: 1,
            scheduledAt: new Date().toISOString(),
            status: "taken",
          })
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
      }
    });
    it("requires persisted customer role and rejects spoofed ownership/clinical fields", async () => {
      const context = await testContext(1);
      const db = await getDb();
      await db.update(users).set({ role: "pharmacist" }).where(eq(users.id, 1));
      await expect(
        manualRemindersRouter.createCaller(context).list()
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        (await caller(3)).create(definition())
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await db.update(users).set({ role: "user" }).where(eq(users.id, 1));
      await expect(
        (await caller()).create({ ...definition(), userId: 2 } as never)
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(
        appRouter.createCaller(await testContext()).medicationReminders.list()
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(await db.select().from(medicationReminders)).toEqual([]);
      expect(await db.select().from(medicationReminderLogs)).toEqual([]);
    });
    it("rejects anonymous access and all persisted professional roles", async () => {
      const context = await testContext();
      await expect(
        manualRemindersRouter.createCaller({ ...context, user: null }).list()
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      const db = await getDb();
      for (const role of ["admin", "doctor", "pharmacist"] as const) {
        await db.update(users).set({ role }).where(eq(users.id, 1));
        await expect(
          manualRemindersRouter.createCaller(context).create(definition())
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
      }
      expect(await db.select().from(customerReminders)).toEqual([]);
    });
    it("persists explicit device timezone as user-reported provenance while preserving the saved zone", async () => {
      const now = new Date();
      now.setUTCSeconds(0, 0);
      const row = await (
        await caller()
      ).create(
        definition({
          times: [now.toISOString().slice(11, 16)],
          timezone: "Asia/Amman",
          startDate: now.toISOString().slice(0, 10),
        })
      );
      const input = {
        id: row.id,
        version: 1,
        scheduledAt: now.toISOString(),
        status: "skipped" as const,
      };
      await expect((await caller()).record(input)).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      const event = await (
        await caller()
      ).record({ ...input, timezone: "UTC" });
      expect(event).toMatchObject({
        status: "skipped",
        source: "user_reported",
        timezone: "UTC",
      });
      expect((await (await caller()).detail({ id: row.id })).timezone).toBe(
        "Asia/Amman"
      );
      expect((await (await caller()).history({ id: row.id }))[0].timezone).toBe(
        "UTC"
      );
      await expect(
        (await caller()).record({ ...input, timezone: "Mars/Olympus" })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
    it("stores explicit user reports only, validates occurrence bounds, isolates history and cascades only its new events", async () => {
      const now = new Date();
      now.setUTCSeconds(0, 0);
      const time = now.toISOString().slice(11, 16);
      const date = now.toISOString().slice(0, 10);
      const db = await getDb();
      const [legacy] = await db.insert(medicationReminders).values({
        userId: 1,
        medicationName: "Preserved fictional legacy",
        frequency: "once_daily",
        startDate: now,
      });
      await db
        .insert(medicationReminderLogs)
        .values({ reminderId: legacy.insertId, userId: 1, scheduledTime: now });
      const legacyDefinitions = await db.select().from(medicationReminders);
      const legacyHistory = await db.select().from(medicationReminderLogs);
      const row = await (
        await caller()
      ).create(definition({ times: [time], timezone: "UTC", startDate: date }));
      const other = await (
        await caller(2)
      ).create(definition({ times: [time], timezone: "UTC", startDate: date }));
      await (
        await caller(2)
      ).record({
        id: other.id,
        version: 1,
        scheduledAt: now.toISOString(),
        status: "skipped",
      });
      expect(await (await caller()).history({ id: row.id })).toEqual([]);
      const input = {
        id: row.id,
        version: row.version,
        scheduledAt: now.toISOString(),
        status: "taken" as const,
      };
      const event = await (await caller()).record(input);
      expect(event).toMatchObject({
        status: "taken",
        source: "user_reported",
        reminderId: row.id,
      });
      expect(await (await caller()).record(input)).toEqual(event);
      await expect(
        (await caller()).record({ ...input, status: "skipped" })
      ).rejects.toMatchObject({ code: "CONFLICT" });
      for (const delta of [-86400000, 86400000, -60000])
        await expect(
          (await caller()).record({
            ...input,
            scheduledAt: new Date(now.getTime() + delta).toISOString(),
          })
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(
        (await caller()).record({ ...input, status: "delivered" } as never)
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(await (await caller()).history({ id: row.id })).toHaveLength(1);
      await (await caller()).remove({ id: row.id, version: 1 });
      expect(await db.select().from(customerReminderEvents)).toHaveLength(1);
      expect(await (await caller(2)).history({ id: other.id })).toHaveLength(1);
      expect(await db.select().from(customerReminders)).toHaveLength(1);
      expect(await db.select().from(medicationReminders)).toEqual(
        legacyDefinitions
      );
      expect(await db.select().from(medicationReminderLogs)).toEqual(
        legacyHistory
      );
    });
  }
);
