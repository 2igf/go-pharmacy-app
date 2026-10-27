# Multi-App Architecture Foundation V1 — implementation plan

Source: user mission in this task; Android branch `feat/android-capacitor-debug` at
`889c7e40472e27a50f5c2c26b900b0dbe63ce41e`, descending from MVP
`943498797d8adc11af7fde0fb9f681df1021857c`.

## Constraints and design decision

Implement in `feat/multi-app-foundation-v1` in an independent local clone. Keep
one React client, one Express/tRPC backend, one MySQL schema. Extract existing
routers by domain without changing their procedure paths, validators, handlers,
transaction service or ownership checks. Do not create a monorepo or microservices.
Preserve all pages, design, Capacitor, authentication, existing data and medical
shutdown. No schema migration, deployment, payment or dispensing changes.

Use a shared vocabulary for seven intended roles and four applications. Resolve
only existing persisted roles on the server (`user` maps to `customer`); reserve
new roles without making them assignable or privileged. Centralize service gates
in existing tRPC middleware. Publish authenticated, informational capability
metadata; headers/application names never grant access. Future driver/provider
services deny all users, including administrators, until scoped data models exist.

Alternatives: a full multi-client monorepo creates needless packaging churn now;
documentation alone leaves the combined router and policy drift unresolved. The
minimal domain extraction and enforced gates satisfy the requested foundation.

## Review focus

- Unknown or future role strings fail closed; no role from headers or input.
- Legacy doctor/pharmacist personal shopping remains available, never medical access.
- Medical gates precede handlers for every role, including admin.
- Old API names and validators remain compatible with the installed APK.
- Personal records stay user scoped; no tenant grants without tenant ownership data.

## Execution

1. Inventory historical routes/pages/schema; compare original `d9a383e`, MVP and
   Android references. Record absent master spec and incomplete portals honestly.
2. Run existing suite using guarded disposable MySQL test database. Add failing
   policy/capability tests and pin the existing procedure manifest before extraction.
3. Add shared application/service vocabulary, server policy and enforced procedure
   gates; add authenticated `platform.capabilities` (contract version 1).
4. Extract catalog, shopping, account, administration and inactive medical routers;
   keep auth, transaction and DB implementations shared. Test real MySQL ownership
   for existing provider roles as ordinary personal accounts.
5. Run full suite, both TypeScript checks, production build; rebuild Android and
   run native checks when tools permit. Confirm original server is untouched.
6. Write `docs/MULTI_APP_FOUNDATION_V1.md` and inventory/compatibility evidence;
   independent bounded code review, address findings and commit the new branch.

## Ledger

- Verified source branch and MVP ancestry; source checkout is clean on separate
  `ops/android-cloudflare-test` branch. No changes to its running services.
- Ruling: proceed within the detailed user-authorized minimal architecture and
  engineering discretion; no extra design approval round is needed.
- No `GOPHARM_MASTER_SPEC_AR.md` found in local project files or available Git path
  history. Original source code is used as historical evidence, not safety approval.
- Android checkout validation remains an explicitly unresolved issue outside scope.

- Completed domain extraction: all ten router bodies normalized-AST equal to base;
  52 legacy procedure paths pinned and retained, discovery query added.
- Completed RED/GREEN policy and full verification: 113/113 tests, no skips;
  both TypeScript checks and production build exit0. Tests use guarded test DB.
- Actual browser catalog/search passed; demo four-table hashes unchanged across
  smoke/browser checks. No migration, sale or demo write performed.
- Android sync/build/lint/test APK exit0; lint 0 errors/14 warnings; app/test APK
  installed on own dedicated API36 emulator; instrumentation OK (2 tests).
- Independent bounded review found no important defect. No source changes
  after final tests beyond documentation/evidence and generated-file cleanup.
- Source/runtime Ops checkout remains clean at 62a77ff and public health200;
  original main remains d9a383e. No deploy, push, merge or phone checkout claim.
