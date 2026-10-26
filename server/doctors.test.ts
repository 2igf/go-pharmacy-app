import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
const caller = appRouter.createCaller({
  user: { id: 1, role: "admin" },
  req: { headers: {} },
  res: {},
} as TrpcContext);
describe("medical services are intentionally disabled", () => {
  it("blocks even admin doctor directory and availability requests", async () => {
    await expect(
      caller.doctors.list({ limit: 10, offset: 0 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller.doctors.bySpecialty({ specialty: "dermatology" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.doctors.byId({ id: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      caller.doctors.timeSlots({ doctorId: 1 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
