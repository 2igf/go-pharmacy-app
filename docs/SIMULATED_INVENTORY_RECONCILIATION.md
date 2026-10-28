# Current simulation ledgers and future reconciliation

This phase documents the existing separation; it does not redesign stock accounting.

| Ledger | Current role | Changes today |
| --- | --- | --- |
| products.stock | Central catalog simulation availability/checkout gate | Decrement once when a new customer order commits; restore once on valid cancellation |
| pharmacyInventory.quantity | Available units in one approved pharmacy | Decrement once at explicit assignment; return on rejection/cancellation; no second decrement on accept/prepare/ready |
| fulfillmentStockLines | Order/product reservation record | held at assignment, consumed at simulated ready, released on rejection/cancellation |

These are independent simulation ledgers with different starting quantities. A pending
unassigned order has affected only the central ledger. Assignment does not reconcile or
transfer central stock; the pharmacy ledger records its own availability. This is not a
claim that the platform has two physical copies of the same medicine. Official medicine
pricing remains a separate untouched jurisdiction model; no official prices were invented.

Current cancellation follows each ledger's existing transaction/idempotency rules. A
pharmacy rejection returns its reservation, while the customer order remains pending
until explicit admin cancellation restores central simulated stock. No timeout/reassign
or automatic historical-order assignment was introduced. Never silently zero negative
counts or clamp stock returns; a reconciliation conflict must stop and preserve records.

Before a future accounting change, separately design and approve:

- The authoritative per-location physical on-hand quantity, reserved quantity and available
  calculation, plus how customer availability is derived from approved pharmacies.
- A precise meaning/migration plan for the legacy central stock field, with verified
  backups, historical simulation handling and an observable reconciliation report.
- A unique movement ledger for order reservation, commit, cancellation, return and reversal;
  prevent the same action from moving stock twice across retries or asynchronous workers.
- Reservation expiry, suspended-provider recovery, rejected-order reassignment and explicit
  multi-pharmacy rules, with one atomic release/transfer and no lost/double-counted units.
- Operational stock counts/imports while holds exist, return overflow handling, manager
  approvals and auditable adjustment policies. Physical totals must not overwrite available
  quantities without accounting for reservations.
- Lot/expiry/prescription safety, regulated pricing sources and jurisdiction requirements
  before any real dispensing/sales. No such capability is enabled by this test foundation.

Use only fictional data while these requirements remain undesigned. GO Captain/delivery,
real payments and commercial inventory reconciliation need separate reviewed phases.
