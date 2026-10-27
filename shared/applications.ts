/** Shared vocabulary only. Clients cannot grant themselves roles or services. */
export const platformRoles = [
  "customer",
  "delivery_driver",
  "doctor",
  "pharmacist",
  "clinic",
  "admin",
  "super_admin",
] as const;
export type PlatformRole = (typeof platformRoles)[number];

export const platformServices = [
  "identity",
  "catalog",
  "personal",
  "administration",
  "medical",
  "delivery",
  "partner_inventory",
] as const;
export type PlatformService = (typeof platformServices)[number];

export const applicationContracts = [
  {
    id: "go_pharmacy",
    name: "GO Pharmacy",
    status: "available",
    services: ["identity", "catalog", "personal"],
  },
  {
    id: "go_captain",
    name: "GO Captain",
    status: "planned",
    services: ["identity", "delivery"],
  },
  {
    id: "go_partners",
    name: "GO Partners",
    status: "planned",
    services: ["identity", "medical", "partner_inventory"],
  },
  {
    id: "go_admin",
    name: "GO Admin",
    status: "embedded_beta",
    services: ["identity", "administration"],
  },
] as const satisfies readonly {
  id: string;
  name: string;
  status: "available" | "planned" | "embedded_beta";
  services: readonly PlatformService[];
}[];

export type PlatformCapabilities = {
  contractVersion: 1;
  role: PlatformRole;
  services: PlatformService[];
  applications: typeof applicationContracts;
};
