// These errors prove validation/authorization or a rolled-back transaction rejected the request.
// Transport failures and internal errors must retain the original idempotency key.
export function mayReviewRejectedCheckout(code: string | undefined) {
  return ["BAD_REQUEST", "NOT_FOUND", "FORBIDDEN", "CONFLICT"].includes(
    code ?? ""
  );
}
import { normalizeApiOrigin } from "@shared/native-api";

// Browser storage is already isolated by website origin. A packaged app can
// switch backend origins, so its pending submission must include that scope.
export function checkoutStorageKey(userId: number, apiOrigin: string | null) {
  return apiOrigin
    ? `checkout:native:${encodeURIComponent(normalizeApiOrigin(apiOrigin))}:${userId}`
    : `checkout:${userId}`;
}

/** Cached data alone is not proof of current ownership after an account switch. */
export function visibleCustomerOrder<T extends { userId: number }>(
  order: T | undefined,
  userId: number | undefined,
  error: unknown
): T | undefined {
  return !error && userId !== undefined && order?.userId === userId
    ? order
    : undefined;
}
