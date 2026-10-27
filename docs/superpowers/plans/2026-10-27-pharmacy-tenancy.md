# Pharmacy tenancy and inventory V1 — implementation plan

Base: b256aaf39d8a4c18398fae1d72d97a1d083b3b0c. Branch:
feat/pharmacy-tenancy-inventory-v1. User explicitly authorizes implementation,
dedicated test DB migrations and engineering choices; demo migration is forbidden.

## Design

Keep one backend/catalog/database. Add organizations, memberships, inventory,
audit events, country pricing jurisdictions/official prices and an unused future
order-assignment relationship. Existing customer product.stock/product.price and
checkout remain independent beta fixtures. No backfill, sales or medical activation.
Only pharmacy onboarding for JO is exposed; provider types may expand later.

Organization statuses: pending/approved/rejected/suspended. Membership roles:
owner/manager/inventory_staff/viewer; status pending/active/suspended. Only platform
admin governance endpoints approve organizations and provision/activate members.
The applying account receives a pending owner membership, not operational access.
An admin needs a separate active membership to use tenant inventory endpoints.
Owner/manager can inspect membership and audit data; active staff can read stock;
viewer cannot write. No role or organization header is trusted.

All tenant operations lock the organization row, then validate current status,
membership and operation permission in the same transaction. Governance changes
use the same lock order. Stock delta requires expectedVersion, UUID requestId and
reason; reject negative/overflow totals, conflicts and changed replay payloads.
Successful stock mutation and immutable-through-API audit commit atomically.

Official prices are separate, empty, source/effectivity-aware DECIMAL(12,3) records
under a country/currency jurisdiction. JO/JOD metadata only; no official price
values, importer, pricing claim or checkout link is introduced.

## Tasks / verification

1. Capture clean Git/base and existing checks; add failing real-MySQL tenancy tests.
2. Add Drizzle tables, FKs/checks/unique indexes and generate additive migration0004.
3. Add target/backup and partial-DDL migration preflight; test on guarded
   go_pharmacy_test only; hash existing test rows before/after upgrade and rerun.
4. Implement transactional service and strict additive pharmacies.* tRPC routers.
5. Test two pharmacies, own/cross-tenant reads/writes/memberships/audit, lifecycle,
   role spoofing, admin-without-membership, idempotency/concurrency, constraints,
   audit rollback and old customer/admin compatibility. Run full suite + types/build.
6. Verify unchanged Android/client source and bundled asset compatibility; review
   security with a fresh bounded reviewer. Document migration/backup/recovery,
   exact results, all new APIs, limits and unresolved Android checkout validation.

## Review focus

- Client organization IDs are selectors, never authorization.
- Approval alone must not reactivate suspended members; no self approval.
- Revocation and stock writes serialize on the same parent lock.
- Failed/audit-failed stock writes cannot leave stock changes committed.
- Partial MySQL DDL and migration journal mismatch fail before rerunning CREATE.

## Ledger

- Verified base/clean tree; new branch created. No changes to Ops server checkout.
- Implementation uses the already isolated foundation checkout; no extra clone
  or monorepo is needed. Demo DB will only receive read-only preservation checks.

- Completed seven-table additive migration on dedicated go_pharmacy_test only;
  demo schema remains18tables; hashes of demo users/orders/items/products match.
- Resolved observed LF/CRLF migration-history mismatch without accepting SQL drift.
- Actual MySQL migration exposed generated70-character FK name; named constraint
  explicitly, tested partial-DDL rejection, removed only verified-empty new test
  tables, then upgraded/reran successfully with old row hashes unchanged.
- Corrected reserved tRPC property apply to new submitApplication before release.
- Review P2 fixed: stable0004 recognition allows future0005; contiguous applied
  history validated. Follow-up bounded review found no new actionable issue.
- Final full suite:131passed/22files, zero failed/skipped; new focused18passed;
  both TS checks and production build exit0. Actual audit failure uses test-only
  CHECK (not SUPER/trigger changes); transaction rollback proven.
- Android/client/config/dependencies unchanged; new JS/CSS bytes equal APK assets.
  No new APK rebuild, emulator/physical-phone test or Checkout fix claimed.
- No main modification, push, merge, deployment, non-test migration or real sale.
