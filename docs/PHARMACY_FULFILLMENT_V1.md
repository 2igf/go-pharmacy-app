# Pharmacy Order Fulfillment Foundation V1

Source: feat/go-partners-pharmacy-portal-v1 at d6196e21691edefb25bb5ea158197f4af474ad45.
Work branch: feat/pharmacy-order-fulfillment-v1. Controlled fictional simulation only.

## Architecture and activation

Reuse Express/tRPC, Drizzle/MySQL, the existing order/customer lifecycle, single-pharmacy
assignment relationship, pharmacy inventory and organization membership authorization.
No checkout changes or historical-order backfill. An administrator explicitly enrolls
one pending simulated order, then explicitly assigns an eligible pharmacy.

`SIMULATED_FULFILLMENT_ENABLED` defaults **false**. The local controlled test launcher
enables it only against go_pharmacy_test after migration0005. No mobile HTTPS service,
Demo environment, global setting or production configuration was changed. Unsupported
older schemas remain usable with the flag off. Managed orders cannot bypass their
guards by turning the flag off: legacy status writes discover the aggregate table and
refuse managed changes while disabled. Finish/reconcile in-flight orders before disabling.

Orders must be unpaid cash simulations with a SIM- number. Products must be active,
unexpired, named with a DEMO prefix, non-prescription and outside the medications category.
This is a restrictive fictional-product convention, not a licensing/compliance system.
Only fictional accounts/products/orders were used for verification.

## State integration

| Operation | Fulfillment state | Existing orders.status | Pharmacy inventory |
| --- | --- | --- | --- |
| Explicit admin enrollment | assignment_pending /v0 | pending | unchanged |
| Admin assignment | assigned /v1 | pending | reserve by subtracting available quantity |
| Staff accept | accepted /v2 | confirmed | reservation remains held |
| Staff prepare | preparing /v3 | processing | reservation remains held |
| Staff ready | ready /v4 | processing | reservation marked consumed (simulation) |
| Staff reject (assigned only) | rejected | pending | return reservation once |
| Existing admin cancellation before shipment | cancelled | cancelled | return held/consumed simulated units once |
| Existing admin shipment, then delivery | ready milestone retained | shipped, then delivered | unchanged |

Versions are illustrative for a straight path; each committed action increments the
aggregate version. Same-status legacy calls are harmless no-ops. The existing transition
validator still prevents cancellation after shipment and invalid jumps. A managed order
cannot be confirmed/processed through the legacy endpoint; pharmacy transitions own those
steps. Shipment requires ready. Rejected fulfillment is terminal in V1; the administrator
may cancel the customer order, but cannot reassign it to another pharmacy. No driver,
dispatch, proof-of-delivery or physical shipment workflow was introduced.

## Inventory, concurrency and audit

The existing catalog stock ledger remains the simulated customer checkout ledger.
Pharmacy inventory.quantity now represents **available** units after fulfillment holds.
These are distinct simulation ledgers; no central price/official price change was made.
Manual stock adjustment continues to operate on available units. Operators must not
interpret a physical total including held units as an available-stock count.

All assignment/state/cancellation effects use transactions. Lock order is customer,
order, organization, membership, then stock/catalog resources in product-ID order.
The shared organization lock serializes stock adjustments, review, membership changes
and fulfillment operations. Current locking reads are used for management eligibility
and request replay, including after waiting for a concurrent revocation/assignment.
Insufficient stock, invalid line, stale expectedVersion, audit failure and stock-return
overflow roll back the entire transaction. Overflow requires explicit reconciliation;
units are never silently discarded. No automatic deadlock retry creates a new request.

The existing assignment primary key prevents two pharmacies for one order. New events
bind a globally unique UUID to actor, action, order, organization, version and reason hash.
Exact replay returns the original result; changed payload/actor conflicts. Authorization
and organization status are rechecked before tenant replay. Replaying a previously
successful request does not mean the current order is still in that old state; refresh
the detail after success. Events are append-only through the API and include stock deltas,
actor, reason, before/result and timestamp. They are separate fulfillmentEvents records;
the existing organizationAuditEvents and its APIs remain intact.

## API contracts

| Procedure | Server permission / purpose |
| --- | --- |
| fulfillment.configuration | authenticated capability information, never a grant |
| fulfillment.enroll | admin; explicit pending simulation enrollment, UUID/reason |
| fulfillment.eligible | admin; eligible candidates from bounded approved-ID page |
| fulfillment.assign | admin; recheck eligibility/availability, expectedVersion and UUID |
| fulfillment.administration.list | admin; bounded managed-order queue |
| fulfillment.list | approved pharmacy + active membership; own assigned orders only |
| fulfillment.detail | same tenant permission; minimal items/status + last50 own audit events |
| fulfillment.transition | active owner/manager/inventory_staff; accept/reject/prepare/ready |

Viewer may inspect the minimal order DTO but cannot mutate. Platform customer/pharmacist/
admin roles alone never grant organization access. Persisted roles were not expanded;
delivery_driver/super_admin remain future vocabulary, not enabled authentication roles.
IDs, role-shaped bodies and forged headers do not grant permissions. Strict schemas
reject extra inputs, invalid versions/IDs/actions and missing reasons.

Existing orders.list and orders.byId expose an additive nullable `fulfillment` summary:
state, pharmacyName, updatedAt and simulated. They first enforce customer ownership.
No private stock quantities, membership, actor, rejection reason or audit/request hash
is exposed to the customer. Existing fields and procedure names remain compatible.
The customer UI is unchanged and still renders its existing order.status.

Future delivery contract: contractVersion1, simulated, orderId, pickupOrganizationId,
fulfillmentVersion, ready_for_delivery and null driverAssignment. It is exposed only for
ready orders whose customer state remains processing. No customer/address/medical data,
driver identity or assignment endpoint is included.

## Minimal UI

- `/admin/fulfillment`: protected enrollment from the latest100 orders, managed-order
  list, eligible pharmacy chooser (first50 approved organizations) and reviewed assignment.
- `/partners/pharmacy/orders`: own assigned-order list/detail and reviewed transitions;
  role-specific actions, Arabic RTL, existing components/tokens, loading/error/empty states.
- Existing `/admin` and Partners navigation link to the new pages. No Canva redesign.

Each reviewed payload gets one UUID. Ambiguous failures retain that exact in-memory
request for explicit retry. Changing page/account/org or reloading discards the UI draft;
the server's state/version/UUID guards prevent repeated effects. Review again after a
fresh read. Private query errors hide retained records and stale confirmations. Existing
account/org cache scopes are reused. A regular controlled confirm button is opted into
for the new fulfillment dialog so Radix cannot also cancel/unmount the in-flight request.
Existing inventory/admin confirmation defaults were preserved.

## Executed verification

- Baseline: 141 passed /25 files, real dedicated MySQL test DB.
- Final verification evidence: tests.txt, typescript.txt, test-typescript.txt, build.txt.
  Final full run: **161 passed, zero failed/skipped,28 files**. Both TypeScript checks
  and production build exited0. Android Debug built with JDK21; signature verified,
  and all eight packaged JS/CSS hashes match the production build.
  The full suite includes 161 tests /28 files: 15 fulfillment database scenarios, three
  shared-contract cases, one real HTTP/session scenario and one additional migration
  preflight case, alongside all existing tests. See final logs for actual outcome.
- Real HTTP tests exercise cookies/login, forged role/org headers, strict input,
  cross-account order ownership and minimal DTOs against the actual backend/test DB.
- The 15 database cases include two-pharmacy assignment races, simultaneous duplicate
  requests, stale versions, active-management suspension while waiting for its lock,
  suspended staff/orgs, invalid transitions, audit-failure rollback, stock-return overflow,
  legacy status bypass/feature-disable protection, cancellation and shipment readiness.
- Browser: 13 recorded actual observations against real services, including enrollment,
  assignment, accept/prepare/ready, rejection/stock return, B isolation, viewer/customer/
  suspended membership, existing customer screen and response-loss RED/GREEN reproduction.
  These are not 13 independent automated E2E tests. A temporary loopback test proxy dropped
  exactly one enrollment response **after backend commit**; fixed retry succeeded without
  duplicate enrollment. That proxy was stopped and direct loopback service restored.
- Independent focused static review found the dialog issue; actual browser reproduction
  failed before the fix and passed after it. No other concrete server blocker was reported.
  This is not a comprehensive security certification.
- Actual Android Debug rebuild uses unchanged Capacitor/Gradle/native configuration.
  No phone/emulator acceptance, publication, update installation or remote HTTPS test
  was performed in this phase. The installed mobile HTTPS environment was not modified.

## Data and limitations

Only migration0005 was applied, to go_pharmacy_test. Three new tables, foreign keys,
unique keys, indexes and checks; no existing table alteration, row backfill or data rewrite.
See PHARMACY_FULFILLMENT_MIGRATION_V1.md for preflight/backup/recovery requirements.
Pre-task backup contained25 tables/91 rows; original data was restored before migration
and after baseline verification. Before the final regression run, all28 tables/137 rows
(including browser activity) were preserved privately, then restored with FK enforcement.
Backup files, DB credentials, invite secrets and test account passwords remain ignored
under .local and are absent from published assets/evidence. Final original-row and Demo
fingerprint comparisons are recorded in preservation-final.json.

**Android Checkout validation remains OPEN and unresolved.** No checkout redesign,
real medication sale, prescription dispensing, payment, medical activation, Captain app,
automatic pharmacy selection, reassignment, timeout release or bulk import was implemented.
Historical orders are untouched unless explicitly selected by an admin; verification used
only newly created fictional orders. No narrow-viewport/mobile browser test was executed.
Existing build-size and clearCookie advisories remain. No dependency upgrade or fresh
dependency audit was performed.

Next: controlled operator acceptance of reservation/available-stock semantics and rejection/
admin cancellation, then design reassignment/expiry separately. Resolve the independent
Android Checkout issue before connecting any real delivery/fulfillment operations.

Local instructions: [PHARMACY_FULFILLMENT_LOCAL_TESTING.md](PHARMACY_FULFILLMENT_LOCAL_TESTING.md).
