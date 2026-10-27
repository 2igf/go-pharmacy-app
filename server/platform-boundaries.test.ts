import { describe, expect, it } from "vitest";
import { resolvePersistedRole, canUseService } from "./access-policy";
import { platformRoles, applicationContracts } from "../shared/applications";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import legacyApiManifest from "./legacy-api-manifest.json";

const context = (role: string | null) =>
  ({
    user: role === null ? null : { id: 1, role },
    req: { headers: { "x-go-pharmacy-role": "super_admin" } },
    res: {},
  }) as unknown as TrpcContext;

describe("multi-app service boundaries", () => {
  it("preserves the installed client API surface, with one additive discovery query", () => {
    expect(Object.keys(appRouter._def.procedures).sort()).toEqual(
      [
        ...legacyApiManifest,
        "platform.capabilities",
        "pharmacies.submitApplication",
        "pharmacies.mine",
        "pharmacies.inventory.list",
        "pharmacies.inventory.adjust",
        "pharmacies.members.list",
        "pharmacies.audit.list",
        "pharmacies.administration.list",
        "pharmacies.administration.review",
        "pharmacies.administration.setMembership",
        "fulfillment.configuration",
        "fulfillment.enroll",
        "fulfillment.assign",
        "fulfillment.eligible",
        "fulfillment.administration.list",
        "fulfillment.list",
        "fulfillment.detail",
        "fulfillment.transition",
      ].sort()
    );
  });

  it("keeps every legacy medical operation gated before input parsing or handlers", async () => {
    for (const role of [
      "user",
      "admin",
      "doctor",
      "pharmacist",
      "delivery_driver",
      "clinic",
      "super_admin",
    ]) {
      const caller = appRouter.createCaller(context(role)) as unknown as Record<
        string,
        Record<string, (input?: unknown) => Promise<unknown>>
      >;
      for (const path of legacyApiManifest.filter(path =>
        /^(doctors|appointments|prescriptions|medicationReminders)\./.test(path)
      )) {
        const [domain, operation] = path.split(".");
        await expect(caller[domain][operation]()).rejects.toMatchObject({
          code: "FORBIDDEN",
        });
      }
    }
  });
  it("maps only supported database roles, never reserves authority from future strings", () => {
    expect(resolvePersistedRole("user")).toBe("customer");
    for (const role of ["admin", "doctor", "pharmacist"])
      expect(resolvePersistedRole(role)).toBe(role);
    for (const role of [
      "customer",
      "delivery_driver",
      "clinic",
      "super_admin",
      "ADMIN",
      "",
      null,
    ]) {
      expect(resolvePersistedRole(role)).toBeNull();
      expect(canUseService(role, "personal")).toBe(false);
      expect(canUseService(role, "administration")).toBe(false);
    }
  });

  it("keeps personal accounts for all existing roles and admin operations restricted", () => {
    for (const role of ["user", "doctor", "pharmacist", "admin"]) {
      expect(canUseService(role, "personal")).toBe(true);
      expect(canUseService(role, "administration")).toBe(role === "admin");
    }
  });

  it.each([...platformRoles, "user", "unknown"])(
    "keeps unfinished services off for %s",
    async role => {
      for (const service of [
        "medical",
        "delivery",
        "partner_inventory",
      ] as const)
        expect(canUseService(role, service)).toBe(false);
      const caller = appRouter.createCaller(context(role));
      for (const operation of [
        () => caller.doctors.list({ limit: 1, offset: 0 }),
        () => caller.appointments.byId({ id: 2 }),
        () => caller.appointments.byDoctor({ doctorId: 2 }),
        () => caller.prescriptions.byId({ id: 2 }),
        () => caller.medicationReminders.list(),
      ])
        await expect(operation()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  );

  it("returns additive versioned capabilities without promoting a role from headers", async () => {
    const result = await appRouter
      .createCaller(context("pharmacist"))
      .platform.capabilities();
    expect(result.contractVersion).toBe(1);
    expect(result.role).toBe("pharmacist");
    expect(result.services).toEqual(["identity", "catalog", "personal"]);
    expect(result.applications).toEqual(applicationContracts);
    const admin = await appRouter
      .createCaller(context("admin"))
      .platform.capabilities();
    expect(admin.services).toContain("administration");
    await expect(
      appRouter.createCaller(context(null)).platform.capabilities()
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      appRouter.createCaller(context("super_admin")).platform.capabilities()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it.each([
    "user",
    "doctor",
    "pharmacist",
    "delivery_driver",
    "clinic",
    "super_admin",
  ])(
    "rejects administrative operations for %s before reaching the database",
    async role => {
      const caller = appRouter.createCaller(context(role));
      await expect(caller.admin.orders()).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(caller.products.delete({ id: 1 })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    }
  );
});
