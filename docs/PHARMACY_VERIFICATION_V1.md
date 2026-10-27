# Pharmacy tenancy V1 — executed verification and limitations

Windows, 2026-10-27. Base b256aaf39d8a4c18398fae1d72d97a1d083b3b0c;
branch feat/pharmacy-tenancy-inventory-v1. No main change, push, merge, deployment,
demo migration, real sale, dispensing or new application UI.

## Results

| Check | Actual result |
| --- | --- |
| Initial tenancy RED | 11 integration cases failed before the new API existed. |
| Focused tenancy/migration suite | 18 passed: 13 real-MySQL tenancy cases and 5 migration-policy cases. |
| Full suite with guarded real MySQL | **131 passed, 0 failed, 0 skipped; 22 files.** Existing customer/admin/session/native/commerce/medical regressions included. |
| TypeScript application/server/shared | Exit0, pnpm check. |
| TypeScript tests/scripts/Capacitor | Exit0, pnpm test:types. |
| Production React + backend build | Exit0; existing nonfatal >500kB chunk advisory remains. |
| Migration0004 upgrade | go_pharmacy_test only; 18→25 tables. Pre-existing users/orders/orderItems/products hashes unchanged across upgrade. |
| Migration rerun | Passed preflight; no duplicate DDL or metadata. |
| Schema generation consistency | db:generate reports no schema changes after explicit FK naming. |
| Partial MySQL DDL guard | Actual partial/untracked state rejected before rerunning. |
| Non-test target guard | Actual demo preflight rejected missing approval/backup attestations before a migration connection. |
| Database constraints | 13 new FKs, 5 CHECKs observed; no temporary test CHECK remains. Real orphan/duplicate/negative-stock writes rejected. |
| Native HTTP/session test | Extended existing test: authenticated pharmacies.mine200, unauthorized stock mutation403, logged-out mine401. Local trusted-proxy fixture, not a phone/TLS deployment. |
| Android/client compatibility | No diff in client/, android/, capacitor.config.ts, package.json or lockfile. Built JS/CSS bytes match those inside the previous Foundation APK. No new APK needed/rebuilt. |
| Bounded independent review | One future-migration preflight issue found, fixed and statically rechecked; no remaining actionable finding in scope. Not a full repository audit or independent test rerun. |

Commands used Node24 and pinned pnpm10.34.5. TEST_DATABASE_URL is private; fixture
cleanup asserts a disposable DB name and equality to DATABASE_URL. Demo received
no fixture cleanup or DDL. Read-only demo table count and four-table hashes are
recorded separately; hashes are preservation evidence, not a backup.

## Executed security scenarios

- Two pharmacies hold different quantities of the same catalog product. Staff
  read their own stock; foreign/nonexistent organization selectors are denied
  for stock reads/writes, memberships and audit. Audit result sets are tenant scoped.
- Platform pharmacist role alone grants no membership. Admin without membership
  is denied operational stock read/write and private member/audit reads.
- Forged role/organization headers and extra role input do not grant access.
  Anonymous callers are denied; admin provisioning remains protected.
- Pending approval/membership, viewer/staff/manager permissions, rejection/reopening,
  invalid transitions and ownership-transfer rejection are tested.
- Organization and membership suspensions deny access. Reinstating an organization
  does not reactivate suspended staff. Revoked users cannot replay old adjustments.
  A waiting adjustment is denied after concurrent organization suspension commits.
- Invalid/fractional/zero/excessive deltas, negative/overflow totals and unknown
  catalog references fail. Global stock/price and official prices stay independent.
- Concurrent same-version updates have one winner. Concurrent duplicate request
  IDs cause one change; changed payload or another actor replaying that ID conflicts.
- A temporary CHECK in the disposable DB forces a real audit insert failure;
  inventory creation rolls back. It is removed in finally. No SUPER privilege or
  less-safe MySQL binary-log setting was enabled.
- Existing checkout atomicity, ownership, admin product/order operations, login/
  logout, native transport and all-role medical denial remain in the full suite.

## Migration debugging and review corrections

The old migration0003 journal used an LF hash while this Windows clone used CRLF.
Preflight admits exactly those two byte forms, with a regression; it does not
rewrite history or ignore SQL changes.

Drizzle generated one FK name exceeding MySQL's64-character limit. Actual test
migration failed, leaving empty new tables because MySQL DDL commits implicitly.
The FK was named explicitly in schema and pending SQL/snapshot. Actual preflight
rejected the partial state. Guarded recovery removed only seven verified-empty
new test tables; old row hashes matched. Corrected upgrade and rerun passed.
A regression checks all new SQL identifier lengths.

Review found that using the latest local migration to recognize tenancy would
block a future migration0005. Stable0004 identification and contiguous-prefix
validation now cover future pending migrations, skipped history and partial DDL.
Follow-up static review passed. New onboarding is submitApplication because tRPC
reserves apply as a router key; no old endpoint was renamed. The old52 procedures
plus capabilities remain, with nine additive pharmacy procedures (62 total).

## Important files

- drizzle/schema.ts; drizzle/0004_pharmacy_tenancy.sql; meta/0004_snapshot.json;
  meta/_journal.json: seven-table model and additive migration.
- server/pharmacy.ts: common-lock authorization and transactional tenant service.
- server/domains/pharmacies.ts; server/routers.ts: nine strict additive APIs.
- scripts/migration-policy.ts; scripts/db-preflight.ts: target, backup, history and
  partial-DDL gates. Existing migrate.ts still runs preflight first.
- server/pharmacy.integration.test.ts; server/migration-policy.test.ts: new tests.
- server/native-auth.integration.test.ts; server/platform-boundaries.test.ts:
  extended native HTTP and API compatibility coverage.
- server/test-support.ts: FK-safe cleanup in guarded disposable DB only.
- server/access-policy.ts: comment clarifying scoped inventory, no behavior change
  or global platform-role grant.
- docs/PHARMACY_TENANCY_V1.md, PHARMACY_MIGRATION_V1.md, this report and evidence.
- Exact delivery list: evidence/pharmacy/modified-files.txt.

## Limits and next step

1. **Android Checkout validation error remains OPEN and unresolved.** No Checkout
   changes, physical-phone reproduction, phone acceptance or new emulator checkout
   test occurred. Packaging/transaction tests do not close it.
2. New APIs require migration0004 on the selected backend. Demo/current phone
   tunnel was not migrated/deployed; this local branch does not activate it there.
3. Tested populated test-DB upgrade/rerun, not a separate empty-DB bootstrap or
   non-test restore drill. Non-test backup/approval remain mandatory; operational
   acknowledgement variables do not create or verify a backup.
4. No Partners/Captain UI, government license verification, invitation delivery,
   owner transfer, batches/expiry/reservations, pricing importer or pharmacy order
   workflow. Assignment table is relationship-only, with no active API.
5. Official prices remain empty; no regulatory pricing compliance, legal approval
   or actual medicine sale is claimed. Mock customer checkout remains isolated.
6. Audit is append-only through API, not tamper-proof against privileged SQL.
   Production least-privilege grants/external retention require deployment review.
7. V1 serializes operations per organization. No load benchmark was executed.
   Lists are bounded/cursor-based; different pharmacies use different parent locks.
8. Existing clearCookie deprecation/build-size/dependency notes remain. No dependency
   versions changed or new dependency audit was performed.

Recommended next step: a small internal onboarding/membership/inventory interface
using these contracts in an explicitly approved isolated beta environment. Keep
checkout unchanged and diagnose its Android validation issue separately before
any inventory reservation/fulfillment integration.
