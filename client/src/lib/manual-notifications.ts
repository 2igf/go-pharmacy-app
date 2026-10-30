import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { getNativeApiOrigin, isAndroid } from "./api-fetch";
import { nextReminderOccurrence } from "@shared/customer-reminders";

export type NativeReminder = {
  id: number;
  medicationName: string;
  times: string[];
  weekdays: number[];
  startDate: string;
  endDate?: string | null;
  enabled: boolean;
  discreet: boolean;
};
export type NativeReminderStatus = {
  permission: "granted" | "denied" | "prompt";
  scheduled: number;
  accountKey?: string;
};
export type ReminderNativeDriver = {
  status(): Promise<NativeReminderStatus>;
  clear(): Promise<void>;
  synchronize(input: {
    accountKey: string;
    reminders: NativeReminder[];
  }): Promise<NativeReminderStatus>;
};
export function nativeReminderDefinitions<
  T extends NativeReminder & { userId: number },
>(
  rows: readonly T[],
  userId: number,
  fresh: boolean
): NativeReminder[] | undefined {
  if (!fresh || !userId || rows.some(row => row.userId !== userId))
    return undefined;
  const enabled = rows.filter(row => row.enabled);
  if (enabled.length > 20) return undefined;
  return enabled.map(
    ({
      id,
      medicationName,
      times,
      weekdays,
      startDate,
      endDate,
      enabled,
      discreet,
    }) => ({
      id,
      medicationName,
      times: [...times],
      weekdays: [...weekdays],
      startDate,
      endDate,
      enabled,
      discreet,
    })
  );
}

/** Serialize native replacements. Each queued operation checks its account and revision again. */
export function createReminderSyncCoordinator(driver: ReminderNativeDriver) {
  let revision = 0;
  let account: string | null = null;
  let active = false;
  let authStamp = 0;
  let loggedOutStamp = -1;
  let preparedAccount: string | null = null;
  let queue: Promise<void> = Promise.resolve();
  function enqueue(work: () => Promise<void>) {
    const result = queue.then(work);
    queue = result.catch(() => undefined);
    return result;
  }
  function activate(key: string, stamp: number) {
    if (stamp <= loggedOutStamp) return Promise.resolve();
    account = key;
    active = true;
    authStamp = stamp;
    const ticket = ++revision;
    return enqueue(async () => {
      if (ticket !== revision || !active || account !== key) return;
      const status = await driver.status();
      if (ticket !== revision || !active || account !== key) return;
      if (status.accountKey !== key) await driver.clear();
      if (ticket === revision) preparedAccount = key;
    });
  }
  function synchronize(key: string, reminders: NativeReminder[]) {
    if (!active || account !== key) return Promise.resolve();
    const ticket = ++revision;
    return enqueue(async () => {
      if (ticket !== revision || !active || account !== key) return;
      const status = await driver.status();
      if (ticket !== revision || !active || account !== key) return;
      if (
        status.accountKey !== key &&
        (status.accountKey !== undefined || preparedAccount !== key)
      )
        await driver.clear();
      if (ticket !== revision || !active || account !== key) return;
      await driver.synchronize({ accountKey: key, reminders });
      if (ticket === revision) preparedAccount = key;
    });
  }
  function suspend() {
    active = false;
    revision++;
  }
  function logout() {
    loggedOutStamp = Math.max(loggedOutStamp, authStamp);
    account = null;
    preparedAccount = null;
    active = false;
    const ticket = ++revision;
    return enqueue(async () => {
      if (ticket === revision) await driver.clear();
    });
  }
  return { activate, synchronize, suspend, logout };
}

export type ReminderOpenEvent = { reminderId?: number; accountKey?: string };
interface GoRemindersPlugin extends ReminderNativeDriver {
  requestPermission(): Promise<NativeReminderStatus>;
  consumeOpen(): Promise<ReminderOpenEvent>;
  addListener(
    event: "reminderOpened",
    listener: (value: ReminderOpenEvent) => void
  ): Promise<PluginListenerHandle>;
}
const GoReminders = registerPlugin<GoRemindersPlugin>("GoReminders");
export const MANUAL_REMINDER_STATUS_EVENT = "go-reminders-status";
export const MANUAL_REMINDER_SYNC_ERROR_EVENT = "go-reminders-sync-error";
let lastSyncError = "";
export function manualReminderSyncError() {
  return lastSyncError;
}
export function reportManualReminderSyncFailure() {
  lastSyncError =
    "تعذرت مزامنة التنبيهات المحلية. أعد المحاولة عند فتح صفحة التذكيرات؛ لم يتم تأكيد الجدولة على الجهاز.";
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event(MANUAL_REMINDER_SYNC_ERROR_EVENT));
}
function publish(status: NativeReminderStatus) {
  if (typeof window !== "undefined")
    window.dispatchEvent(
      new CustomEvent(MANUAL_REMINDER_STATUS_EVENT, { detail: status })
    );
  return status;
}
export const manualReminderSync = createReminderSyncCoordinator({
  status: () => GoReminders.status(),
  clear: () => GoReminders.clear(),
  synchronize: async input => {
    const result = await GoReminders.synchronize(input);
    lastSyncError = "";
    return publish(result);
  },
});
export function manualReminderAccountKey(userId: number) {
  return `${getNativeApiOrigin() ?? window.location.origin}|${userId}`;
}
export const manualReminderQueryKey = (accountKey: string | null) =>
  ["manual-reminders", accountKey] as const;
export async function clearNativeRemindersForLogout() {
  if (isAndroid()) await manualReminderSync.logout();
}
export async function manualNotificationStatus() {
  if (!isAndroid())
    return {
      platform: "web" as const,
      permission: "unavailable" as const,
      scheduled: 0,
    };
  return { ...(await GoReminders.status()), platform: "android" as const };
}
export async function requestManualNotificationPermission() {
  if (!isAndroid()) return manualNotificationStatus();
  return {
    ...publish(await GoReminders.requestPermission()),
    platform: "android" as const,
  };
}
export async function listenForReminderOpen(
  listener: (event: ReminderOpenEvent) => void
) {
  if (!isAndroid()) return { remove: async () => {} };
  return GoReminders.addListener("reminderOpened", listener);
}
export async function consumeReminderOpen() {
  return isAndroid() ? GoReminders.consumeOpen() : ({} as ReminderOpenEvent);
}

/** Local device wall-clock occurrences eligible for an explicit user statement. */
export function recentManualOccurrences(
  reminder: NativeReminder & { createdAt: Date | string },
  now = new Date(),
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
) {
  if (!reminder.enabled) return [];
  const oldest = Math.max(
    now.getTime() - 7 * 86400000,
    Math.floor(new Date(reminder.createdAt).getTime() / 60000) * 60000
  );
  const result: Date[] = [];
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(part => part.type === type)?.value ?? "";
  const firstDay = new Date(
    `${read("year")}-${read("month")}-${read("day")}T00:00:00Z`
  ).getTime();
  for (let day = 0; day <= 7; day++) {
    const date = new Date(firstDay - day * 86400000);
    const localDate = date.toISOString().slice(0, 10);
    if (
      localDate < reminder.startDate ||
      (reminder.endDate && localDate > reminder.endDate) ||
      !reminder.weekdays.includes(date.getUTCDay())
    )
      continue;
    for (const time of reminder.times) {
      const instant = nextReminderOccurrence(
        {
          times: [time],
          weekdays: reminder.weekdays,
          startDate: localDate,
          endDate: localDate,
          timezone,
        },
        new Date(date.getTime() - 36 * 3600000)
      );
      if (!instant || instant.getTime() < oldest || instant > now) continue;
      result.push(instant);
    }
  }
  return result.sort((a, b) => b.getTime() - a.getTime());
}
