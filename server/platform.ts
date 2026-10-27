import {
  applicationContracts,
  platformServices,
  type PlatformCapabilities,
} from "../shared/applications";
import { resolvePersistedRole, canUseService } from "./access-policy";
import { protectedProcedure, router } from "./_core/trpc";

export const platformRouter = router({
  /** Informational discovery. Every operation still enforces its server guard. */
  capabilities: protectedProcedure.query(
    ({ ctx }): PlatformCapabilities => ({
      contractVersion: 1,
      role: resolvePersistedRole(ctx.user.role)!,
      services: platformServices.filter(service =>
        canUseService(ctx.user.role, service)
      ),
      applications: applicationContracts,
    })
  ),
});
