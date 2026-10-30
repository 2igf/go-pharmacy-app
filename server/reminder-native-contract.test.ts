import { it, expect } from "vitest";
import { createReminderSchema } from "../shared/customer-reminders";
const base = {
  requestId: "605c63ba-10bf-4c9f-a7f3-c0c58adad8df",
  medicationName: "دواء يدوي",
  times: ["08:00"],
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  startDate: "2026-01-01",
  timezone: "Asia/Amman",
};
it("rejects names containing every native ISO control range", () => {
  for (const char of ["\t", "\n", "\u0000", "\u007f", "\u0085", "\u009f"])
    expect(
      createReminderSchema.safeParse({
        ...base,
        medicationName: `name${char}name`,
      }).success
    ).toBe(false);
});
it("shares Android's supported date floor for both date fields", () => {
  expect(
    createReminderSchema.safeParse({ ...base, startDate: "1969-12-31" }).success
  ).toBe(false);
  expect(
    createReminderSchema.safeParse({
      ...base,
      startDate: "1969-01-01",
      endDate: "1969-12-31",
    }).success
  ).toBe(false);
  expect(
    createReminderSchema.safeParse({ ...base, startDate: "1970-01-01" }).success
  ).toBe(true);
});
