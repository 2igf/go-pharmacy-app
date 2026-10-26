import { describe, it, expect, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
vi.mock("./db", async importOriginal => ({
  ...(await importOriginal<typeof import("./db")>()),
  markNotificationAsRead: vi.fn(async () => true),
  deleteNotification: vi.fn(async () => true),
  getAppointmentById: vi.fn(async () => ({
    id: 7,
    userId: 2,
    notes: "private",
  })),
}));
import { appRouter } from "./routers";
import * as db from "./db";
const ctx = {
  user: { id: 1, role: "user" },
  req: { headers: {} },
  res: {},
} as TrpcContext;
describe("Beta security regression", () => {
  it("passes the acting user to notification read mutation", async () => {
    await appRouter.createCaller(ctx).notifications.markAsRead({ id: 7 });
    expect(db.markNotificationAsRead).toHaveBeenCalledWith(7, 1);
  });
  it("passes the acting user to notification deletion", async () => {
    await appRouter.createCaller(ctx).notifications.delete({ id: 7 });
    expect(db.deleteNotification).toHaveBeenCalledWith(7, 1);
  });
  it("blocks unauthenticated appointment lookup", async () => {
    await expect(
      appRouter
        .createCaller({ ...ctx, user: null })
        .appointments.byId({ id: 7 })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
  it("blocks medical data even for a Beta customer", async () => {
    await expect(
      appRouter.createCaller(ctx).appointments.byId({ id: 7 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("uses a server role guard for product creation", async () => {
    await expect(
      appRouter
        .createCaller(ctx)
        .products.create({
          name: "Sample",
          price: "1.00",
          category: "skincare",
        })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
