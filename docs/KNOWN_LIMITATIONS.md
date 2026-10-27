# Known limitations and release gates

Current pharmacy scope/issues are in [PHARMACY_VERIFICATION_V1.md](PHARMACY_VERIFICATION_V1.md).
Scoped inventory APIs exist in the new branch, but demo was not migrated/deployed.
**Android Checkout validation remains unresolved.** No medical/sales workflow was activated.

- This is fictional-data Private Beta software. Regulatory authorization, licensed pharmacy operations, prescription review, clinical privacy controls, medical safety processes, commercial accounting, real payments, fulfillment and legal terms are outside the release.
- Clinical modules and old role-specific fulfillment dashboards remain preserved but inaccessible. No appointment-conflict engine is claimed because appointments are disabled.
- No email delivery, mailbox verification, self-service password recovery, MFA or public role management. Operator-mediated per-email invitation codes and allowlist access are required. Rotate the invitation secret if a code is exposed.
- Single process rate limiting; use an upstream limiter and shared storage before horizontal scaling. Login locks are IP-based and may affect users sharing a network.
- Catalog/admin display up to 100 products/orders at a time; fixed enum categories; no advanced pagination/analytics. These limits suit a small seeded demonstration, not a large pharmacy catalog.
- Prices use two decimal places and zero tax/shipping/discounts for simulation. No claim of commercial JOD precision or tax compliance.
- Soft archival preserves historical product references. Existing clinical tables do not receive a wholesale schema redesign. MySQL migration DDL needs backup/restore recovery, not assumed rollback.
- Expired sessions are rejected, but periodic cleanup is an operator task. Logout revokes the current session only; removing an email from the allowlist blocks all that participant's sessions.
- Pending checkout details are stored per user in sessionStorage to support safe retry; use fictional data and a private browser profile. Do not clear pending requests after network errors without first checking order history.
- HTTPS termination, real reverse proxy, off-host backups, restoration rehearsal and production hosting must be configured and tested by the operator before access is opened.
- Docker configuration is not considered tested unless the implementation report explicitly says it was built/run. No infrastructure, PR, merge or deployment result is implied by its files.
- Current dependency audit, browser/device coverage and release verdict are in IMPLEMENTATION_REPORT.md. No test or security scan claims exhaustive proof of absence of vulnerabilities.

Legacy OAuth identities are retained without automatic email-based attachment to new local credentials. Invite/re-registration creates a distinct local account; any historical account linking requires a separately reviewed operator migration.
# Foundation V1 acceptance note — 2026-10-27

**Android checkout validation remains OPEN and unresolved.** The foundation work
does not fix or reproduce the known physical-phone validation problem. Existing
checkout recovery, idempotency and API tests do not establish phone acceptance.
See [current verification report](MULTI_APP_VERIFICATION_V1.md) for exact limits.
Provider/clinic/driver/super-admin workflows remain inactive; planned role names
do not grant access. See [architecture](MULTI_APP_FOUNDATION_V1.md).
