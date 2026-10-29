# Architecture

Latest customer surface: [Canva restoration V1](CUSTOMER_CANVA_RESTORATION_V1.md).
This is a scoped React/CSS/asset change; operational Partners/Admin layouts and
the backend/database/authentication contracts remain unchanged.

Latest checkout verification: [Android Checkout & E2E V1](ANDROID_CHECKOUT_E2E_V1.md),
[test procedure](ANDROID_CHECKOUT_TESTING.md) and
[inventory reconciliation requirements](SIMULATED_INVENTORY_RECONCILIATION.md).
The reproduced Arabic-number validation failure is corrected and the full simulated
journey is verified on API36 WebView; physical-phone acceptance remains untested.

Current extension: [Simulated pharmacy fulfillment V1](PHARMACY_FULFILLMENT_V1.md),
with [test-only migration safety](PHARMACY_FULFILLMENT_MIGRATION_V1.md) and
[local testing](PHARMACY_FULFILLMENT_LOCAL_TESTING.md). Explicit enrollment and
single-pharmacy reservation are opt-in; existing checkout and Demo remain intact.

Previous interface phase: [GO Partners Pharmacy Portal V1](GO_PARTNERS_PHARMACY_PORTAL_V1.md)
and [local controlled testing](GO_PARTNERS_LOCAL_TESTING.md). This adds the
pharmacy/admin frontend above the existing nine scoped APIs; no new schema/API.

Latest backend extension: [Pharmacy tenancy and inventory V1](PHARMACY_TENANCY_V1.md),
with [migration safety](PHARMACY_MIGRATION_V1.md) and
[executed verification](PHARMACY_VERIFICATION_V1.md). The earlier multi-app report
is a historical baseline; pharmacy inventory now has explicit scoped APIs.

React 19 and Tailwind retain the existing green/white identity and Arabic RTL. A shared BetaLayout owns navigation and the simulation notice. Existing catalog/product components remain; incomplete checkout/account/admin interactions have been replaced with connected forms. tRPC uses SuperJSON on the same origin; Zod validates procedures server-side.

Express in `server/app.ts` applies request IDs, redacted structural logs, security headers, bounded request/auth limits, exact-origin JSON mutation checks and API 404s. `server/_core/index.ts` validates environment, binds the configured host/port and chooses Vite development or static build serving. No alternate-port fallback masks configuration errors.

Local auth stores salted scrypt hashes in credentials, separate from user records. Random 256-bit opaque cookies are represented by SHA-256 hashes in sessions and expire after eight hours. Every request joins the session to the current database user/role and checks the allowlist. Logout deletes that session. Tokens/hashes never enter auth.me. Invitations are HMAC-SHA256 over normalized email using an operator-only secret; codes do not prove mailbox ownership and must be delivered privately to the intended participant.

Commerce uses a pooled mysql2/Drizzle connection. All cart writers and checkout lock the user row first; checkout locks products in ascending product ID. Product availability, expiry, prescription flags and integer quantities are checked inside the transaction. Conditional stock decrement, order/items, cart deletion and notification commit together. Money is parsed to integer minor units and bounded before formatting back into DECIMAL strings.

Checkout persists a user-scoped idempotency key and request digest. Existing requests replay before reading the now-cleared cart. New requests must match the quoted basket fingerprint and total. Client sessionStorage preserves one pending fictional checkout through an ambiguous network error/reload; do not clear it after a network error. Definitive conflict responses allow review/reset. MySQL uniquely indexes user/key, and user/product for carts.

Cancellation follows the same user/order locks and restores inventory only on the first valid transition. State graph: pending → confirmed → processing → shipped → delivered; cancellation is permitted before shipped. Terminal states cannot reopen. Product deletion archives the record so order references remain.

MySQL migrations are additive. Core commerce/auth relationships have restrictive FKs; sessions cascade on user removal. Legacy clinical relationships remain unmodified and inaccessible. Database DDL is not assumed transactional. See recovery procedures.
# Multi-application foundation update

The current modular boundaries and reserved roles are documented in
[Multi-App Architecture Foundation V1](MULTI_APP_FOUNDATION_V1.md), with
[historical inventory](MULTI_APP_INVENTORY_V1.md) and
[executed verification / Android limits](MULTI_APP_VERIFICATION_V1.md).
The underlying MVP architecture below remains applicable.
