import { describe, it, expect } from "vitest";
import {
  safeAlarmSummary,
  safeReminderLogs,
  safeNativeProbe,
} from "../scripts/collect-reminder-diagnostics";
describe("privacy bounded reminder device evidence", () => {
  it("selects current target alarms without emitting intent extras or other packages", () => {
    const raw =
      "RTC_WAKEUP #0: Alarm{a type 0 origWhen 123456 whenElapsed 987 com.gopharmacy.beta}\n tag=*walarm*:com.gopharmacy.beta.REMINDER_ALARM\n Intent{token=PRIVATE-CONTENT}\nRTC_WAKEUP #1: Alarm{b type 0 origWhen 12 whenElapsed 3 com.gopharmacy.beta.reminderdiagnostic}\nRTC_WAKEUP #2: Alarm{c type 0 origWhen 5 whenElapsed 2 other.app}";
    const result = safeAlarmSummary(raw);
    expect(result).toEqual([
      { type: "RTC_WAKEUP", requestedEpochMs: 123456, whenElapsedMs: 987 },
    ]);
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
  });
  it("keeps only fixed structured app events", () => {
    const result = safeReminderLogs(
      "I GoReminders: event=alarm_received reminderId=7 epochMs=123\nI GoReminders: medicationName=PRIVATE-CONTENT\nI GoReminders: event=notification_posted reminderId=7 epochMs=124 token=PRIVATE-CONTENT"
    );
    expect(result).toEqual([
      { event: "alarm_received", reminderId: 7, epochMs: 123 },
    ]);
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
  });
  it("whitelists native metadata and excludes names, identities and credentials", () => {
    const result = safeNativeProbe({
      deviceNowEpochMs: 123,
      timezone: "Asia/Amman",
      accountKey: "PRIVATE-CONTENT",
      token: "PRIVATE-CONTENT",
      nativeEntries: [
        {
          reminderId: 1,
          nativeId: 2,
          nextEpochMs: 456,
          pendingIntentExists: true,
          medicationName: "PRIVATE-CONTENT",
        },
      ],
    });
    expect(result.nativeEntries).toEqual([
      {
        reminderId: 1,
        nativeId: 2,
        nextEpochMs: 456,
        pendingIntentExists: true,
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
  });
  it("rejects malformed native metadata and bounds arrays", () => {
    expect(safeNativeProbe(null)).toEqual({});
    expect(
      safeNativeProbe({
        nativeEntries: Array.from({ length: 100 }, () => ({ reminderId: 1 })),
      }).nativeEntries
    ).toHaveLength(20);
  });
});
