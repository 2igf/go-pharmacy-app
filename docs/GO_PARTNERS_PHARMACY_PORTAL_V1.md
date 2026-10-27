# GO Partners Pharmacy Portal V1

Source: bbef4089071326d2a161d98d59c86894997931ef on
feat/pharmacy-tenancy-inventory-v1. Work branch:
feat/go-partners-pharmacy-portal-v1. This is a controlled internal-test portal,
not a commercial pharmacy, dispensing or payment release.

## Implemented surfaces

| Route | Function |
| --- | --- |
| /partners/login | Existing invitation/password login in a separate Partners shell; fixed success destination. |
| /partners/pharmacy | Identity, organization/membership state, first five real inventory records; application form. |
| /partners/pharmacy/inventory | Registered inventory pages, stock filter, catalog search/category pages, real product stock/version lookup and adjustment. |
| /partners/pharmacy/members | Authorized owner/manager member list; no tenant-role privilege mutation. |
| /partners/pharmacy/activity | Authorized, read-only audit history with reason, actor ID, time and before/after values. |
| /admin/pharmacies | Protected application queue/details, status reviews, explicit membership provisioning and authorized member editing. Linked from existing BetaAdmin. |

Partners navigation is separate from customer shopping navigation. Arabic RTL,
existing components/tokens, confirmations, loading/empty/error states are reused.
No customer page, Canva specification, product price model or visual identity was
redesigned. App.tsx selects the surface; new modules are lazy loaded. Login's
default customer destination remains /products. No login/authentication rewrite.

The new dashboard intentionally shows no sales/order/customer metrics. Its small
inventory preview is labelled as the first five records, not a platform total.
Lists use existing bounded cursor/offset contracts. Registered-stock filters
apply to the displayed page; central catalog search is capped by the existing
100-result API and labelled accordingly.

## Existing APIs reused

All nine pharmacy procedures remain unchanged in name, input semantics and guard:
submitApplication, mine, inventory.list, inventory.adjust, members.list,
audit.list, administration.list, administration.review,
administration.setMembership under pharmacies.*. Existing products.list,
products.byCategory/search and auth.me/login/logout are also reused. No new
endpoint, parallel backend, migration or database table was introduced.

The existing organization transition map and stock input schema were extracted
unchanged to shared/pharmacy-policy.ts so UI validation/hints reuse the actual
contracts. Backend role/membership/locking/audit authorization remains authoritative.
Existing procedure-surface and all-role medical shutdown tests still pass.

## Security and state boundaries

- A platform role never substitutes for organization membership. Portal selection
  is restricted to the caller's mine response. A foreign/malformed ?org selector
  does not fall back to another pharmacy or fetch foreign private records.
- Account and organization changes mount fresh private React Query scopes using
  the same tRPC client; those caches clear on unmount. Keyed forms/cursors do not
  carry into another organization. No previous-data placeholder is used.
- Private query failures hide retained data. A membership-discovery error unmounts
  admin member records. A failed/in-flight stock detail refresh or changed version
  cannot confirm an old review. Periodic refreshes update membership/data state;
  the backend enforces revocation immediately on each operation.
- Viewer can inspect inventory only. Inventory staff can adjust own stock but
  cannot open member/audit routes. Owner/manager can inspect permitted records.
- Admin governance can review/provision through existing APIs. Admin cannot
  approve its own application and does not automatically gain tenant member/audit
  visibility. Such lists appear only with an active owner/manager membership.
  Provisioning uses known account IDs, not a new public user directory.
- Approval and membership activation remain separate. Supported organization
  transitions and immutable ownership rules are preserved; no automatic enrollment.
- Unknown/unapproved/suspended memberships/organizations expose no operational UI.
  No medical, driver, payment or pharmacy-order assignment workflow was enabled.

## Inventory correctness

Quantities are never substituted from products.stock. Catalog selection seeks
inventory.list at afterProductId=productId-1/limit1. An exact match supplies the
real version/quantity; absence proves the existing zero/version0 semantics.

Adjustment requires a reason, explicit confirmation and the observed expectedVersion.
A UUID is generated once per reviewed request. An ambiguous network/service
failure retains the exact request for safe replay. The pending payload is stored
in sessionStorage scoped to backend origin, account and organization; no password,
cookie or bearer token is stored there. The existing backend binds replay to actor
and payload, checks authorization again and audits exactly one stock change.

Definitive rejection clears the pending attempt. A conflict explicitly asks the
operator to refresh/review; it never silently adopts a newer version and resubmits.
Changing organization/account cannot display another context's pending form.

## Audit time correction

Browser testing exposed an inherited three-hour timestamp transport offset:
MySQL session SYSTEM used local+03 while mysql2 timezone:"Z" treated returned
TIMESTAMP strings as UTC. server/db.ts now queues SET time_zone='+00:00' on each
raw pooled connection before application commands, and destroys the connection
on setup failure. No global MySQL setting or stored row was changed.

A real seven-query pool test failed before the fix and passed after it. Installed
mysql2 event/queue order was independently reviewed. Existing login, expiry,
commerce and ownership regressions passed with the session setting. This aligns
transport; it is not a historical data rewrite.

## Executed verification

| Check | Result |
| --- | --- |
| Baseline before implementation | 131 passed /22 files, real guarded MySQL DB. |
| Final full Vitest suite | **141 passed, zero failed/skipped /25 files**. |
| New tests | Seven UI policy/request-state cases, two real HTTP acceptance flows, one pooled UTC integration case. |
| TypeScript application + tests/scripts | Both exit0. |
| Production React/backend build | Exit0; existing >500kB advisory remains. |
| Android debug build | Actual Capacitor asset sync and Gradle assembleDebug succeeded. New lazy Portal/Admin chunks are bundled locally. No Android publication/install/device acceptance claim. |
| Browser integration | 27 recorded actual-browser verification points against the real local backend/test DB: approval, explicit activation, rejection, member management, owner/staff adjustment, viewer, audit, foreign/org/role denials, account/org switching and suspension. See browser-checks.json for exact observations; these are not 27 independent automated E2E tests. |
| Review | Two stale-data presentation findings fixed with RED/GREEN cases; follow-up found no concrete blocker. UTC pool hook also statically reviewed. Not an exhaustive security certification. |

Browser scenarios are actual UI interactions; pure policy tests are not presented
as DOM component tests. The native HTTP fixture simulates the existing trusted
proxy boundary locally, not a new public TLS deployment. Android was built, not
tested on a physical phone or a newly launched emulator in this phase.

## Data preservation

No migration was required or run. Demo and Ops checkouts were not used for fixtures.
Before automated tests, all25 existing test tables/13 original rows were backed
up privately. Existing reset-based tests ran in the authorized test DB, then those
rows and sequences were restored/verified without disabling FKs. Browser fixture
accounts/products/organizations were then added with distinct names, without
updating original rows. Before the UTC regression rerun, all75 then-current test
rows were backed up/restored again, preserving the browser approval work.

Private backup/credentials/runtime files remain under ignored .local/partners,
excluded from Git/Docker/static assets; passwords are not printed in evidence.
Read-only original-row and Demo fingerprints are recorded separately. The demo
schema and customer users/orders/products receive no DDL, seed or cleanup.
Final preservation check: all13 original test rows remain; added fictional fixture
and browser activity bring the test DB to88 rows. All18 Demo table fingerprints
match the initial snapshot, and no temporary test CHECK constraint remains.

## Important files

client/src/partners/Portal.tsx, Inventory.tsx, Records.tsx, AdminPharmacies.tsx,
common.tsx and policy.ts implement the new surfaces/state boundaries.
App.tsx adds surface dispatch/lazy loading; BetaAdmin.tsx adds the protected link;
Login.tsx adds a fixed optional success destination. shared/pharmacy-policy.ts
holds existing shared contracts; server pharmacy/router changes only consume
them. server/db.ts fixes connection-session UTC. Three new test files and evidence
cover the changes. Exact file list: evidence/partners/modified-files.txt.

## Limits and next phase

**Android Checkout validation remains OPEN and unresolved.** Checkout code was
not changed; no phone checkout, real order, payment or dispensing was tested.

The portal has no government-license verification, user directory, bulk import,
pharmacy order assignment, reservation, pricing importer or full Partners/Captain
application. Membership provisioning is administrative; owner transfer is still
unavailable. Audit uses account IDs supplied by existing API, not invented names.
The new dashboard is functional V1, not an approved final visual design.

Desktop browser verification is recorded. Responsive Tailwind layouts are
implemented, but no reduced-viewport/mobile browser test was available through
the current browser capability. Existing dependency/clearCookie/build-size notes
remain; no dependency upgrade or fresh dependency audit occurred.

Recommended next phase: controlled usability testing with fictional pharmacy
operators, then a narrowly scoped workflow improvement based on that feedback.
Diagnose the separate Android Checkout issue before any fulfillment/reservation
integration. Real commercial operation requires its own reviewed scope.

Local access and safe test instructions: [GO_PARTNERS_LOCAL_TESTING.md](GO_PARTNERS_LOCAL_TESTING.md).
