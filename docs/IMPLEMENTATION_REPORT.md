# GO Pharmacy — implementation and verification report

Date: 2026-10-26 (Asia/Amman). Delivery is a local release candidate, not a merged or publicly deployed service.

## A. Executive summary

**Verdict: READY WITH DOCUMENTED NON-CRITICAL LIMITATIONS — for a small, fictional-data, controlled Private Beta candidate.**

The original React/TypeScript/Express/tRPC/Drizzle/MySQL application now has portable invited authentication, private persistent carts, authoritative quotations, atomic simulated orders with inventory/idempotency protection, working tracking/account/admin workflows, additive database migrations and operational documentation. No real payment, dispensing, consultation, medical record or live delivery is supported.

This verdict applies to the delivered branch and measured local environment. Hosted HTTPS/proxy, Docker runtime and external operations still require operator validation before access is opened. The formal security workbench report has partial repository coverage and an original-snapshot warning; it is not certification of the final immutable commit or of the unchanged remote main.

## B. Security fixes

Confirmed baseline defects and resulting controls:

| Baseline defect | Resulting behavior | Evidence |
| --- | --- | --- |
| Public appointment reads returned private rows | All clinical procedures fail closed before handlers, for every role | Reproduced regression tests failed before fix; gate and negative tests pass |
| Cart add used JavaScript && and lost the user predicate | User/item and user/product conditions use SQL and(...); user locks serialize mutation | Two-user same-product integration plus foreign item update/remove tests |
| Notification mutations used only record ID | Read/delete constrain both notification ID and acting user ID | Actual MySQL foreign notification remains unread and undeleted |
| Prescription/stock checks absent from checkout | Cart and locked checkout reject restricted, expired, unavailable or excessive quantities | Prescription flag changed after cart insertion; concurrent stock tests |
| Checkout was not transactional or idempotent | One transaction commits stock, order/items, cart deletion and notification; request keys replay originals | Concurrent duplicate, oversell, rollback and cancellation tests |
| OAuth state was predictable and unbound | Legacy callback is unregistered; local sessions/invitations replace that active login path | Real HTTP callback 404; local registration/login/session tests |
| Vite host checks overridden | Loopback default plus explicit localhost/127.0.0.1 allowed hosts | Source review of active startup and Vite configuration |
| Insecure cross-site cookie defaults and long JWT sessions | Opaque 256-bit cookies, hashed database sessions, eight-hour expiry, logout revocation, Lax/HttpOnly/Secure in production | Credential, expiry/logout and cookie tests |

Server role checks protect administration; user input cannot grant roles. API writes require exact-origin JSON and reject cross-site metadata. Request/auth limits, batch caps, 64 KiB bodies, security headers, generic internal errors, useful validation messages and structural logs are implemented. No fixture secret was found in the public build assets by exact-value checks.

Independent reviews found two additional issues: invitation-by-email-only was strengthened with per-email HMAC codes; checkout retries were bound to a basket fingerprint. A fresh final reviewer found a definitive-error recovery trap in Checkout; it was reproduced in the real browser, fixed, and verified through correction followed by a successful order. Generated private invitation files are excluded from Git and Docker context.

## C. Functional improvements

- Landing/catalog/product details and existing visual identity retained; broken search/navigation and fabricated ratings/operational claims removed from exposed flows.
- Registration requires an allowed email and its private invitation code; passwords use salted scrypt; no external provider is required.
- Persistent cart quantity/remove operations use actual products/prices. The server calculates totals in integer minor units. Simulation shipping/tax are zero.
- Checkout captures fictional contact/address information and explicit simulation acknowledgement. No card data is collected. Unknown or failed requests retain the original key for safe replay; definitive rejections allow correction.
- SIM-prefixed orders persist and expose private history and working /order/<id> tracking. Basket content and price changes require review.
- Administrators can create/update/archive products, set stock including zero, select existing categories, view all recent orders and advance valid statuses. Ordinary users are denied on the server.
- Cancellation before shipping restores stock once; shipped/delivered/cancelled orders cannot be reopened through invalid transitions. Product archival preserves order references.
- Account name/phone and fictional addresses persist; notification ownership is enforced.

## D. Significant files

| Files | Purpose |
| --- | --- |
| server/auth.ts; server/_core/context.ts, cookies.ts, trpc.ts | Password/session/invitation authentication, identity, role/medical gates and safe errors |
| server/app.ts; server/http-security.ts; server/_core/index.ts, static.ts, vite.ts | Express API boundaries, headers/limits/CSRF, explicit startup and portable serving |
| server/commerce.ts; server/commerce-rules.ts | Locked atomic checkout/cart/cancellation, idempotency, basket fingerprint and exact amounts |
| server/routers.ts; server/db.ts; server/_core/systemRouter.ts | Bound validation/authorization, ownership queries, MySQL pooling, medical/outbound-service gating |
| drizzle/schema.ts; drizzle/0003_private_beta.sql; drizzle/meta | Additive auth/commerce schema, constraints and migration state |
| scripts/db-preflight.ts; scripts/migrate.ts | Non-destructive consistency checks and migration application |
| scripts/seed-beta.ts, create-admin.ts, create-invite.ts | Guarded fictional catalog and explicit private operator setup |
| client/src/App.tsx; components/BetaLayout.tsx; pages/Login.tsx, BetaAdmin.tsx | Safe routes, simulation navigation, authentication and connected administration |
| pages/Cart.tsx, Checkout.tsx, OrderTracking.tsx, Profile.tsx | Connected customer workflow and persistence |
| client/src/lib/checkout-policy.ts | Definitive-rejection recovery versus ambiguous-failure key preservation |
| Existing Home/Products/ProductDetail/ProductModal/Notifications | Search, safe restrictions, useful errors, dialog access and removal of fabricated information |
| server/*.test.ts; server/test-support.ts; vitest.config.ts; tsconfig.tests.json | Deterministic, guarded real-MySQL tests, HTTP tests and test/script type checking |
| package.json; pnpm-lock.yaml; vite.config.ts; Dockerfile; compose.yaml | Patched dependencies, portable build and practical hosting candidate |
| README.md; docs/*.md; .env.example | Setup, scope, architecture, security, testing, demo, backup/recovery and limitations |

Legacy clinical/UI helper source is preserved but not exposed. Old seed entry points explicitly stop and direct operators to the guarded fictional seeder.

## E. Database changes

Migration 0003 adds credentials and sessions; product archival; simulation/contact/request-digest/idempotency fields; order item name snapshots; unique user/product carts and user/idempotency orders; core relational FKs with restrictive deletion; user/order/notification/session indexes. Existing orders default isSimulated=false and cannot be advanced through Beta administration. No existing data is deleted or silently merged.

Actual migrations succeeded on fresh go_pharmacy_test and go_pharmacy_demo databases using MySQL 8.4.13. Re-running migration after preflight is a no-op for applied migrations. A separate legacy-schema fixture with duplicate carts was rejected after correcting Windows lowercase metadata handling: preflight exited 1 and both original cart rows remained.

MySQL DDL is not treated as transactional. Deployment instructions require stopped writes, a backup, staging validation and restore/forward-recovery if DDL fails. Actual mysqldump/restore was exercised into go_pharmacy_restore_test; the 8.50 JD SIM order and confirmed status matched the source snapshot.

## F. Verification results

Runtime: Windows, Node 24.22.1, pnpm 10.34.5, MySQL 8.4.13, Vitest 5.0.5. MySQL was downloaded from Oracle's official ZIP and matched its published MD5 before extraction; no Windows service or global MySQL installation was created.

| Command/check | Measured result |
| --- | --- |
| Original pnpm 10.4.1 install --frozen-lockfile | Exit 0 |
| Original tsc --noEmit | No errors |
| Original vitest run | 17 passed, 10 failed, 27 total; database was not configured |
| Original vite build | Exit 0; unset analytics and bundle-size warnings |
| Security regression before fixes | 5 failed, showing the appointment/notification/role problems |
| Current npm test with TEST_DATABASE_URL | **71 passed, 0 failed, 0 skipped; 14 test files** |
| npm run check | Exit 0 |
| npm run test:types | Exit 0; tests, fixtures and operator scripts checked |
| npm run build | Exit 0; Vite frontend plus bundled Node server |
| npx --yes pnpm@10.34.5 audit --json | Exit 1 because five lower-severity findings remain: 0 critical, 0 high, 2 moderate, 3 low |
| node --import tsx scripts/migrate.ts on test/demo DBs | Exit 0; real schema application |
| node --import tsx scripts/db-preflight.ts on dirty legacy fixture | Expected exit 1; duplicate cart rejected, records preserved |
| Guarded seed on empty database | Success; four fictional products, no credentials or clinical records |
| Guarded seed on existing catalog | Rejected; product count stayed 4 |
| mysqldump + mysql restore into separate database | Exit 0; persisted order/amount/status matched |
| Actual loopback Express HTTP tests | CSRF, protected API, callback 404, limits, CSP/HSTS, stack suppression and auth batching verified |
| Actual in-app browser | Registration, required fields, search, modal, cart quantity, address/account persistence, checkout, reload, admin login/status and customer status verified |
| Responsive check | 390px and 1366px viewport; RTL and scrollWidth == clientWidth on order page |
| Private fixture secret search in public assets | No invitation secret, password or database password matched |
| git diff --check / staged diff check | Performed before local commit |

The 71 tests include real concurrent stock contention, duplicate submission after cart clear, changed-basket rejection at equal total, rollback after an injected adapter failure following order insertion, prescription/expiry/availability validation, two-user authorization negatives, admin CRUD and cancellation replay. The adapter-failure test uses the real MySQL transaction with a test-only failure injection; it does not claim MySQL server-crash testing. A trigger-based fault attempt initially required elevated binary-log privileges and was replaced instead of weakening MySQL policy.

No ESLint configuration existed; no lint pass is claimed. An intermediate pnpm version/tool option incompatibility and the preflight/checkout regressions were corrected; the final commands above are the acceptance runs. Vite warns that the local .env uses NODE_ENV=staging while building; it still emits a production build and exits 0. Local runtime intentionally uses compiled static serving with non-production cookies over loopback HTTP, not hosted TLS.

## G. Known limitations

- Fictional-data simulations only. No real patient data, regulated dispensing, clinical consultation, commercial payment/tax/accounting or live delivery.
- No mailbox verification, email delivery, MFA or self-service password recovery. Invitations are privately distributed by the operator. Legacy OAuth users are not automatically linked to new local credentials; invite/re-register creates a separate local identity, preserving old rows without unsafe email-based takeover.
- Single-process/IP rate limiting; participants sharing a network may reach the shared limit. No horizontal-scaling claim.
- Fixed category enum, at most 100 displayed catalog/admin rows; no large-catalog pagination or commercial analytics.
- Two decimal places for simulation JD amounts. No assertion of commercial JOD accounting compliance.
- Five dependency audit findings remain. See evidence/DEPENDENCY_REVIEW.md for exact paths and applicability. No critical/high dependency findings remain in the measured lockfile.
- Formal Codex Security report coverage is partial. It began at the baseline revision and warns that working-tree contents changed. It is supplementary source-review evidence, not a clean immutable-commit attestation. Generic unused UI/support and dependency internals were not exhaustively audited.
- Docker and a real HTTPS reverse proxy were not available/executed. Production cookies/proxy behavior must be verified on the eventual host; no public deployment occurred.
- Browser evidence comes from the in-app Chromium environment and viewport overrides, not physical iOS/Android devices or a cross-browser certification matrix.

## H. Deployment and collaboration readiness

Configuration, secure local authentication, migrations, guarded seed/admin/invite tools, Docker/Compose candidate, health/readiness endpoints and backup/recovery documentation are delivered. Persistent storage is a MySQL responsibility; the Docker named volume is not a backup.

Local server: http://127.0.0.1:3017 ; temporary local MySQL: 127.0.0.1:33317. Runtime is deliberately loopback-only and uses fictional demonstration data. The private .env and local working configuration are ignored and excluded from delivery archives. Do not publish the demonstration credentials or reuse them for hosting.

Branch: feat/go-pharmacy-investor-mvp. Baseline/local main and rechecked remote main: d9a383e55882aa7fdfd29711976ef1e7005faa53. Neither main was changed or merged. Final local commit and archive hashes are in the delivery manifest beside this checkout.

Connected GitHub and Windows Git Credential Manager account: ib0048259-crypto. Repository metadata reports pull=true, push=false. No remote branch/PR/merge is claimed. A reviewable local commit, source archive, patch and Git bundle are supplied; docs/DRAFT_PR.md contains the prepared PR description. Remote main still contains the original implementation until authorized review/integration.

## I. Investor demonstration

See INVESTOR_DEMO.md. The measured browser demonstration registered an invited customer, searched for the fictional cleanser, ordered two at 4.25 JD, persisted 8.50 JD, reloaded, signed in as administrator, changed pending to confirmed, then signed back as customer and displayed confirmed. Database inspection matched the UI. A second 4.25 JD order was created after reproducing and repairing invalid-name recovery. Both are simulations, not revenue or traction.

Screenshots in evidence/ show mobile and desktop order tracking. No privileged password or invitation code is embedded in these images.

## J. Release verdict and next action

**READY WITH DOCUMENTED NON-CRITICAL LIMITATIONS**, for controlled fictional-data Private Beta candidate review. No commercial or public launch readiness is asserted. The useful next step is to review the delivered branch/patch, supply write access for a Draft PR if desired, and then validate the intended HTTPS hosting configuration before admitting participants. No merge is authorized by this report.

### Security-tool measurement

The workbench completed scan 70694699-bd37-407f-b67a-f5e3fc489a93 with partial source coverage and the original-snapshot warning described above. Its measured rollout accounting reports totalTokens=37,749,176, inputTokens=37,643,603, cachedInputTokens=37,280,128, outputTokens=105,573 across three threads. These are tool-reported token counters including cached input, not a currency cost estimate or a claim that all input was freshly generated.
