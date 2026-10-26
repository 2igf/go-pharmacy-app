# Architecture

React 19 and Tailwind retain the existing green/white identity and Arabic RTL. A shared BetaLayout owns navigation and the simulation notice. Existing catalog/product components remain; incomplete checkout/account/admin interactions have been replaced with connected forms. tRPC uses SuperJSON on the same origin; Zod validates procedures server-side.

Express in `server/app.ts` applies request IDs, redacted structural logs, security headers, bounded request/auth limits, exact-origin JSON mutation checks and API 404s. `server/_core/index.ts` validates environment, binds the configured host/port and chooses Vite development or static build serving. No alternate-port fallback masks configuration errors.

Local auth stores salted scrypt hashes in credentials, separate from user records. Random 256-bit opaque cookies are represented by SHA-256 hashes in sessions and expire after eight hours. Every request joins the session to the current database user/role and checks the allowlist. Logout deletes that session. Tokens/hashes never enter auth.me. Invitations are HMAC-SHA256 over normalized email using an operator-only secret; codes do not prove mailbox ownership and must be delivered privately to the intended participant.

Commerce uses a pooled mysql2/Drizzle connection. All cart writers and checkout lock the user row first; checkout locks products in ascending product ID. Product availability, expiry, prescription flags and integer quantities are checked inside the transaction. Conditional stock decrement, order/items, cart deletion and notification commit together. Money is parsed to integer minor units and bounded before formatting back into DECIMAL strings.

Checkout persists a user-scoped idempotency key and request digest. Existing requests replay before reading the now-cleared cart. New requests must match the quoted basket fingerprint and total. Client sessionStorage preserves one pending fictional checkout through an ambiguous network error/reload; do not clear it after a network error. Definitive conflict responses allow review/reset. MySQL uniquely indexes user/key, and user/product for carts.

Cancellation follows the same user/order locks and restores inventory only on the first valid transition. State graph: pending → confirmed → processing → shipped → delivered; cancellation is permitted before shipped. Terminal states cannot reopen. Product deletion archives the record so order references remain.

MySQL migrations are additive. Core commerce/auth relationships have restrictive FKs; sessions cascade on user removal. Legacy clinical relationships remain unmodified and inaccessible. Database DDL is not assumed transactional. See recovery procedures.
