import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import type { SQL } from "drizzle-orm";
import type { TrpcContext } from "./_core/context";
import { userAddresses } from "../drizzle/schema";

const storage = vi.hoisted(() => ({
  address: { id: 7, userId: 1, address: "Fictional old address" } as {
    id: number;
    userId: number;
    address: string;
  } | null,
  where: vi.fn(async (_condition: SQL) => [{ affectedRows: 1 }]),
  set: vi.fn(),
  update: vi.fn(),
  getDb: vi.fn(),
}));
vi.mock("./db", () => ({
  getDb: storage.getDb,
  getUserAddresses: vi.fn(),
  getAddressById: vi.fn(async () => storage.address),
}));
import { addressesRouter } from "./domains/account";

const context = {
  user: { id: 1, role: "user" },
  req: { headers: {} },
  res: {},
} as TrpcContext;
const caller = () => addressesRouter.createCaller(context);
beforeEach(() => {
  vi.clearAllMocks();
  storage.address = { id: 7, userId: 1, address: "Fictional old address" };
  storage.getDb.mockResolvedValue({ update: storage.update });
  storage.update.mockReturnValue({ set: storage.set });
  storage.set.mockReturnValue({ where: storage.where });
});

describe("saved address editing without database access", () => {
  it("requires an authenticated session", async () => {
    await expect(
      addressesRouter
        .createCaller({ ...context, user: null })
        .update({ id: 7, address: "New fictional address" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(storage.update).not.toHaveBeenCalled();
  });
  it.each([null, { id: 7, userId: 2, address: "Private" }])(
    "conceals absent and foreign records",
    async address => {
      storage.address = address;
      await expect(
        caller().update({ id: 7, address: "New fictional address" })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(storage.update).not.toHaveBeenCalled();
    }
  );
  it("updates only the owned address text, preserving metadata and order snapshots", async () => {
    await expect(
      caller().update({ id: 7, address: "  عنوان اختبار مبنى ١٢ وشقة ۳  " })
    ).resolves.toEqual({ success: true });
    expect(storage.update).toHaveBeenCalledExactlyOnceWith(userAddresses);
    expect(storage.set).toHaveBeenCalledExactlyOnceWith({
      address: "عنوان اختبار مبنى ١٢ وشقة ۳",
      latitude: null,
      longitude: null,
    });
    const query = new MySqlDialect().sqlToQuery(storage.where.mock.calls[0][0]);
    expect(query.sql).toContain("`userAddresses`.`id` = ?");
    expect(query.sql).toContain("`userAddresses`.`userId` = ?");
    expect(query.params).toEqual([7, 1]);
  });
  it("rejects user ownership injection", async () => {
    await expect(
      caller().update({
        id: 7,
        address: "New fictional address",
        userId: 2,
      } as never)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(storage.update).not.toHaveBeenCalled();
  });
  it.each(["    ", "1234", "a".repeat(501)])(
    "rejects invalid address length",
    async address => {
      await expect(caller().update({ id: 7, address })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      expect(storage.update).not.toHaveBeenCalled();
    }
  );
});
