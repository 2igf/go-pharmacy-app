# GO Partners Pharmacy Portal V1 — execution plan

Base bbef4089071326d2a161d98d59c86894997931ef. New branch
feat/go-partners-pharmacy-portal-v1. Implement in the isolated foundation checkout;
the Ops/tunnel checkout remains untouched. Detailed user mission authorizes
implementation, test-only fixtures and engineering decisions without another
design-approval cycle. No schema migration or new API is planned.

## Design

Add a separate Arabic RTL Partners shell and routes /partners/login,
/partners/pharmacy, /inventory, /members, /activity. The last three suffixes are
under /partners/pharmacy. Reuse Login with an optional fixed success destination;
customer default and shopping pages/design remain unchanged. Extend existing
BetaAdmin with a link to /admin/pharmacies, an existing protected admin surface.

Use all nine existing pharmacy procedures. Admin can inspect/review applications
and explicitly provision known account IDs, but can list members only with an
active owner/manager membership. Do not silently enroll admins or broaden policy.
Extract the unchanged status transition map into shared code for UI hints and
backend enforcement; other backend authorization remains untouched.

Each authenticated portal/admin account gets an ephemeral React Query scope using
the existing tRPC client. Each selected organization gets another fresh scope and
keyed component state. No previous-data placeholder, no cross-account private
cache reuse, and errors hide stale private data. Memberships and private data
refresh periodically. URL org IDs must match the caller's returned memberships.

Inventory uses bounded registered-stock pages plus existing catalog search/pages.
Selecting a catalog product seeks inventory at productId-1/limit1 to get its real
quantity/version or prove absence (zero/version0). No global stock substitution.
Adjustments require reason and confirmation. Preserve an ambiguous request's UUID
and exact payload in sessionStorage scoped to backend origin/user/organization;
retries reuse it. Definitive conflicts require refresh/review, never auto-overwrite.

## Tasks

1. Save a private guarded backup of all existing test rows before baseline131.
   Run baseline; after final automated tests restore original rows transactionally
   in FK order, then add isolated named fictional browser fixtures without edits
   to pre-existing rows. Demo gets read-only fingerprints only.
2. Write failing helper/route/stock-request tests and real HTTP portal-flow tests.
3. Implement shared hints, scoped query boundary, portal and protected admin UI.
4. Run full tests/types/build and bounded independent review. No new dependencies.
5. Restore/verify original test rows; add fictional test-only browser accounts and
   pharmacies. Start loopback-only server, test actual browser login/navigation,
   approval/rejection/membership/stock/audit/context isolation and denial states.
6. Verify customer regressions and Android sync/build if bundled functionality is
   affected; no phone acceptance or Checkout fix claim. Record evidence/docs and
   commit new branch; no main/push/deployment/Android publication.

## Review focus

- Admin without tenant membership must not receive a broader read API.
- Switching account/org must remount state, clear private cache, and hide errors' stale data.
- Ambiguous stock retries retain exact payload/UUID; conflict does not silently retry.
- Quantities come from pharmacy inventory; empty catalog matches never mean global stock.
- Pending/suspended/viewer UI controls never substitute for backend guards.

## Ledger

- Verified clean expected source/ancestry and created requested branch.
- Existing DB account cannot create a new schema. Preserve test rows with private
  backup/transactional restore, then add separate browser fixtures. No DB grants
  or existing Demo/test records need to be overwritten for browser verification.

- Baseline131/22files passed before implementation. New helpers observed RED.
- Implemented separate Partners shell and protected admin pharmacy section with
  existing nine APIs, no schema/role-policy expansion/dependency changes.
- Review found two stale-data presentation cases; added RED/GREEN coverage and
  fixed unmount/confirmation guards. Follow-up review found no concrete blocker.
- Browser exposed inherited session/driver timezone mismatch (SYSTEM+03 vs Z).
  Real UTC pool regression RED then fix queues SET on raw connection; no global
  MySQL setting/data rewrite. All141 tests/25files passed; both TS checks passed.
- Restored all25 original test tables/13 rows before additive browser fixtures;
  a second75-row snapshot/restore preserved intermediate browser work during rerun.
- Browser27 verification observations passed against real backend/MySQL. Staff
  and owner adjustments produced stock14/version3 for A; B stayed25. UI approvals,
  rejection, membership suspension/reactivation, viewer/customer/foreign denials,
  account/org switching, catalog search/filter and old customer/admin routes verified.
- Final local origin localhost:3022 (bind127.0.0.1), separate from older127.0.0.1
  apps. No public deployment/tunnel changes. Original18-table Demo fingerprints match.
- Android sync/debug build passed, five JS/CSS assets match final web build;
  source native config unchanged. No emulator/phone test or APK publication.
- Android Checkout validation remains OPEN. Customer Canva/UI not redesigned.
