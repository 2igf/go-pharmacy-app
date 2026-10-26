import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
const caller = appRouter.createCaller({
  user: { id: 1, role: "user" },
  req: { headers: {} },
  res: {},
} as TrpcContext);
describe("patient data is unavailable in Beta", () => {
  it("blocks reminders, prescriptions and appointment operations", async () => {
    await expect(caller.medicationReminders.list()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      caller.medicationReminders.create({
        medicationName: "fictional",
        frequency: "once_daily",
        startDate: new Date(),
        reminderTimes: ["08:00"],
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.prescriptions.list()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      caller.appointments.byDoctor({ doctorId: 1 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller.appointments.create({
        doctorId: 1,
        appointmentDate: new Date(),
        consultationType: "in_clinic",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
