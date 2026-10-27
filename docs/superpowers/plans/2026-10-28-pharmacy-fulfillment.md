# Simulated Pharmacy Fulfillment V1 — implementation plan

Goal: explicitly enroll simulated orders, assign one approved pharmacy with available stock, and let its authorized staff accept/reject/prepare/mark ready.

Source: d6196e21691edefb25bb5ea158197f4af474ad45. Branch: feat/pharmacy-order-fulfillment-v1.

Architecture: preserve orders.status as the customer lifecycle. Add an opt-in fulfillment aggregate (one row/order), immutable single-pharmacy assignment using the existing table, reservation lines and append-only request/audit events. Explicit administrative enrollment only; no checkout/backfill changes. Assignment reserves available pharmacy quantity, rejection/cancellation returns it, ready marks it consumed. The central simulated checkout stock ledger is independent and unchanged. No reassignment in V1.

Policy decisions (engineering choices within the supplied implementation scope):
- SIMULATED_FULFILLMENT_ENABLED defaults false; enable only with migration 0005 applied to the test DB. Existing customer APIs return additive nullable public fulfillment summaries. Disabling must not permit legacy status bypass for managed orders.
- Enroll only pending, simulated SIM- orders with unpaid cash and active non-prescription, non-medication fictional catalog lines. Organization eligibility requires approved pharmacy plus at least one active owner/manager. Assignment is explicit admin selection, not an invented geographic optimizer.
- owner/manager/inventory_staff may read/mutate assigned operational orders; viewer may read the minimal item/status DTO, never customer identity/address/contact. No platform role substitutes for membership. No customer PII is needed before delivery integration.
- pending assignment -> assigned (order pending) -> accepted (confirmed) -> preparing (processing) -> ready (processing). Assigned -> rejected releases stock, order stays pending for admin cancellation. Cancellation -> cancelled releases held/consumed simulated stock. Existing admin shipment requires ready, delivery requires shipped. Rejected is terminal for fulfillment; no multi-pharmacy retry.
- Lock order: customer row -> order row -> organization -> membership -> inventory/product IDs ascending. Tenant operations reuse the exact organization authorization lock, serializing revocations and stock adjustments. Request IDs bind actor/action/order/full payload; replay checks current authorization first.
- Future delivery contract is a minimal ready-for-delivery descriptor; no driver assignment API or driver access to customer/medical data.

## Work
- [x] Preserve all current test rows and sequence counters privately; stop only this checkout's local test server, fingerprint Demo read-only, run baseline.
- [x] RED tests: strict input/state mapping, guarded migration completeness, integration assignment/isolation/revocation/concurrency/idempotency/stock/customer/status bypass/rollback.
- [x] Add migration 0005 (new tables only, no backfill), Drizzle snapshot/journal and preflight partial-DDL checks; migrate dedicated test DB only.
- [x] Implement fulfillment service/router with shared schemas and tenant authorization reuse; integrate legacy status guard and customer summaries without changing checkout.
- [x] Add minimal assigned-order Partners page and admin enrollment/assignment controls using the same protected API. Reasons, version review, UUID retries, errors and confirmation; no customer redesign.
- [x] Run focused/full Vitest, both TypeScript checks, production build, actual browser acceptance; check Android packaging because frontend changes ship in its bundle.
- [x] Restore all pre-task test rows/sequences without disabling FKs; verify Demo fingerprints. Add fictional browser fixtures only. Keep all secrets/backups ignored.
- [x] Independent final review, fix concrete security/regression findings, verify, document exact evidence/limits and commit locally.

## Review focus
- Simultaneous assignment to distinct pharmacies must yield exactly one reservation and immutable assignment.
- Revocation before retry/read/write must deny even cached/idempotent requests.
- Legacy admin transitions, feature disabling and cancellation must not bypass stock/fulfillment state.
- Stock return overflow/audit failure must roll back the entire transaction; never silently lose units.
- New private UI caches/forms must not survive account/org selection or query errors.

## Verification ledger
- Initial Git verified clean at exact source; new branch created. Reuse isolated foundation checkout, preserving the Android/Ops and main checkouts.
- Private backup: 25 tables /91 rows; SHA256 in evidence, Demo read-only snapshot. Existing test runtime stopped by verified PID/command line.

- Final: full161/161 tests passed in28 files after the dialog fix; application/test TypeScript exit0, production build exit0, actual Android Debug build+signature verified.13 browser observations; no phone/emulator claim.
- Final: independent review found one dialog cancellation/retry P2. Actual controlled response-loss browser RED then GREEN; same UUID retry produced one enrolled event. Existing dialog defaults preserved.
- Final: original91 rows present across25 old test tables; verification backup/restoration retained28 tables/137 rows;18 Demo fingerprints unchanged; no temporary test constraints.
- Final: engineering choices remain explicit enrollment only, immutable assignment/no reassignment, active management eligibility, available-stock reservation semantics, admin-only cancel through existing endpoint, minimal delivery descriptor, feature default off.
