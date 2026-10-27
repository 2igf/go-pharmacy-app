import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { stockAdjustmentSchema } from "@shared/pharmacy-policy";
export type Outputs = inferRouterOutputs<AppRouter>;
export type Membership = Outputs["pharmacies"]["mine"][number];
export function privateQueryData<T>(query: { data?: T; error?: unknown }) {
  return query.error ? undefined : query.data;
}
export function canConfirmStockReview(
  expectedVersion: number,
  currentVersion: number,
  hasError: boolean,
  fetching: boolean
) {
  return !hasError && !fetching && expectedVersion === currentVersion;
}
export function selectPortalMembership(
  members: Membership[],
  selector: string | null
) {
  if (selector === null) return members[0];
  if (!/^[1-9][0-9]*$/.test(selector)) return undefined;
  return members.find(member => member.organizationId === Number(selector));
}
export function portalPermissions(member?: Membership) {
  const active =
    member?.organizationStatus === "approved" &&
    member.membershipStatus === "active";
  const management =
    active && (member?.role === "owner" || member?.role === "manager");
  return {
    inventory: !!active,
    adjust: !!active && member?.role !== "viewer",
    members: !!management,
    activity: !!management,
  };
}
export function stockRequestKey(
  origin: string,
  userId: number,
  organizationId: number
) {
  return `partners:stock:v1:${encodeURIComponent(origin)}:${userId}:${organizationId}`;
}
export function readPendingStock(
  serialized: string | null,
  organizationId: number
) {
  if (!serialized || serialized.length > 5000) return undefined;
  try {
    const parsed = stockAdjustmentSchema.safeParse(JSON.parse(serialized));
    return parsed.success && parsed.data.organizationId === organizationId
      ? parsed.data
      : undefined;
  } catch {
    return undefined;
  }
}
export function isDefinitiveStockError(error: unknown) {
  const code = (error as { data?: { code?: string } })?.data?.code;
  return (
    !!code &&
    [
      "CONFLICT",
      "BAD_REQUEST",
      "FORBIDDEN",
      "UNAUTHORIZED",
      "NOT_FOUND",
    ].includes(code)
  );
}
export const statusLabels = {
  pending: "قيد المراجعة",
  approved: "معتمدة",
  rejected: "مرفوضة",
  suspended: "موقوفة",
} as const;
export const memberStatusLabels = {
  pending: "بانتظار التفعيل",
  active: "نشطة",
  suspended: "موقوفة",
} as const;
export const roleLabels = {
  owner: "مالك",
  manager: "مدير",
  inventory_staff: "موظف مخزون",
  viewer: "مشاهد",
} as const;
