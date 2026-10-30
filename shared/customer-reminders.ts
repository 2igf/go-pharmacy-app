import { z } from "zod";

export const MAX_ACTIVE_REMINDERS = 20;
export const MAX_REMINDER_DEFINITIONS = 100;
export const REMINDER_REPORT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "أدخل التاريخ بصيغة سنة-شهر-يوم")
  .refine(value => value >= "1970-01-01", "اختر تاريخاً من سنة 1970 فما بعدها")
  .refine(value => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return (
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "أدخل تاريخاً صالحاً");
export const reminderTimezoneSchema = z
  .string()
  .min(1)
  .max(80)
  .refine(value => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "اختر منطقة زمنية صالحة");
export const reminderFields = {
  medicationName: z
    .string()
    .trim()
    .min(1, "أدخل اسم الدواء يدوياً")
    .max(120, "اسم الدواء طويل جداً")
    .refine(
      value => !/[\u0000-\u001f\u007f-\u009f]/.test(value),
      "احذف محارف التحكم من اسم الدواء"
    ),
  dosage: z
    .string()
    .trim()
    .max(120, "نص الجرعة طويل جداً")
    .nullable()
    .optional(),
  notes: z
    .string()
    .trim()
    .max(500, "الملاحظات طويلة جداً")
    .nullable()
    .optional(),
  times: z
    .array(
      z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "أدخل الوقت بصيغة HH:mm")
    )
    .min(1, "اختر وقتاً واحداً على الأقل")
    .max(8, "الحد الأقصى ثمانية أوقات يومياً")
    .refine(
      values => new Set(values).size === values.length,
      "احذف الأوقات المكررة"
    )
    .transform(values => [...values].sort()),
  weekdays: z
    .array(z.number().int().min(0).max(6))
    .min(1, "اختر يوماً واحداً على الأقل")
    .max(7)
    .refine(
      values => new Set(values).size === values.length,
      "احذف الأيام المكررة"
    )
    .transform(values => [...values].sort((a, b) => a - b)),
  startDate: dateSchema,
  endDate: dateSchema.nullable().optional(),
  timezone: reminderTimezoneSchema,
  enabled: z.boolean().default(true),
  discreet: z.boolean().default(true),
};
function validRange(value: { startDate: string; endDate?: string | null }) {
  return !value.endDate || value.endDate >= value.startDate;
}
const rangeMessage = {
  message: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية أو مساوياً له",
  path: ["endDate"],
};
export const createReminderSchema = z
  .object({
    ...reminderFields,
    requestId: z.uuid("معرّف الطلب غير صالح"),
  })
  .strict()
  .refine(validRange, rangeMessage);
export const updateReminderSchema = z
  .object({
    ...reminderFields,
    id: z.number().int().positive(),
    version: z.number().int().positive(),
  })
  .strict()
  .refine(validRange, rangeMessage);
export const reminderIdentitySchema = z
  .object({ id: z.number().int().positive() })
  .strict();
export type ReminderSchedule = {
  times: string[];
  weekdays: number[];
  startDate: string;
  endDate?: string | null;
  timezone: string;
};

/** Exact scheduled minute in the definition's timezone; never infers a dose or marks delivery as intake. */
export function isScheduledOccurrence(
  schedule: ReminderSchedule,
  instant: Date
): boolean {
  if (
    !Number.isFinite(instant.getTime()) ||
    instant.getUTCSeconds() !== 0 ||
    instant.getUTCMilliseconds() !== 0
  )
    return false;
  const formatter = scheduleFormatter(schedule.timezone);
  const local = localParts(instant, formatter);
  return (
    matchesLocalSchedule(schedule, instant, formatter) &&
    resolveLocalMinute(local.date, local.time, formatter)?.getTime() ===
      instant.getTime()
  );
}
function scheduleFormatter(timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}
function matchesLocalSchedule(
  schedule: ReminderSchedule,
  instant: Date,
  formatter: Intl.DateTimeFormat
) {
  const { date, time } = localParts(instant, formatter);
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return (
    date >= schedule.startDate &&
    (!schedule.endDate || date <= schedule.endDate) &&
    schedule.weekdays.includes(weekday) &&
    schedule.times.includes(time)
  );
}
function localParts(instant: Date, formatter: Intl.DateTimeFormat) {
  const parts = formatter.formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(part => part.type === type)?.value ?? "";
  return {
    date: `${read("year")}-${read("month")}-${read("day")}`,
    time: `${read("hour")}:${read("minute")}`,
  };
}
/** Resolve a user-entered wall minute: skip gaps, choose the later offset once during overlap. */
function resolveLocalMinute(
  date: string,
  time: string,
  formatter: Intl.DateTimeFormat
): Date | null {
  const wall = new Date(`${date}T${time}:00Z`).getTime();
  const offsets = new Set<number>();
  for (const hours of [-36, 0, 36]) {
    const sample = wall + hours * 3600000;
    const local = localParts(new Date(sample), formatter);
    offsets.add(new Date(`${local.date}T${local.time}:00Z`).getTime() - sample);
  }
  let latest: Date | null = null;
  for (const offset of offsets) {
    const candidate = new Date(wall - offset);
    const local = localParts(candidate, formatter);
    if (
      local.date === date &&
      local.time === time &&
      (!latest || candidate > latest)
    )
      latest = candidate;
  }
  return latest;
}

/** At most nine local dates and eight entered times; avoids a minute-by-minute UI scan. */
export function nextReminderOccurrence(
  schedule: ReminderSchedule,
  after = new Date()
): Date | null {
  if (!Number.isFinite(after.getTime())) return null;
  const formatter = scheduleFormatter(schedule.timezone);
  const firstDate = [localParts(after, formatter).date, schedule.startDate]
    .sort()
    .at(-1)!;
  const firstDay = new Date(`${firstDate}T00:00:00Z`).getTime();
  for (let day = 0; day < 9; day++) {
    const calendar = new Date(firstDay + day * 86400000);
    const date = calendar.toISOString().slice(0, 10);
    if (schedule.endDate && date > schedule.endDate) return null;
    if (!schedule.weekdays.includes(calendar.getUTCDay())) continue;
    let next: Date | null = null;
    for (const time of schedule.times) {
      const instant = resolveLocalMinute(date, time, formatter);
      if (instant && instant > after && (!next || instant < next))
        next = instant;
    }
    if (next) return next;
  }
  return null;
}
