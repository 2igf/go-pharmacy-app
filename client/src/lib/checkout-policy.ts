// These errors prove validation/authorization or a rolled-back transaction rejected the request.
// Transport failures and internal errors must retain the original idempotency key.
export function mayReviewRejectedCheckout(code: string | undefined) {
  return ["BAD_REQUEST", "NOT_FOUND", "FORBIDDEN", "CONFLICT"].includes(
    code ?? ""
  );
}
