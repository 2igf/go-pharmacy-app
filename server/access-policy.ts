import type { PlatformRole, PlatformService } from "../shared/applications";

/** Accept ONLY roles currently persisted by the unchanged MySQL schema.
 * Future role names are vocabulary, not an activation mechanism. The argument
 * must come from the session's database user, never request input or headers.
 */
export function resolvePersistedRole(role: unknown): PlatformRole | null {
  switch (role) {
    case "user":
      return "customer";
    case "admin":
      return "admin";
    case "doctor":
      return "doctor";
    case "pharmacist":
      return "pharmacist";
    default:
      return null;
  }
}

export function canUseService(
  persistedRole: unknown,
  service: PlatformService
): boolean {
  const role = resolvePersistedRole(persistedRole);
  if (!role) return false;
  switch (service) {
    case "identity":
    case "catalog":
    case "personal":
      return true;
    case "administration":
      return role === "admin";
    // Organization inventory requires pharmacy.ts membership authorization;
    // it is never a global role grant. Medical/delivery remain unavailable.
    default:
      return false;
  }
}
