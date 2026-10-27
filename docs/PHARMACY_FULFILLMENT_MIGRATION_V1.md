# Fulfillment migration0005 — test-only rollout and recovery

This phase authorizes the dedicated test database only. **Do not migrate Demo or the
mobile HTTPS backend's database without separate explicit authorization.**

0005_simulated_fulfillment.sql creates fulfillmentOrders (order PK/state/version),
fulfillmentStockLines (assignment/product PK, held/consumed/released quantities) and
fulfillmentEvents (append-only API audit/idempotency with unique request UUID). Existing
pharmacyOrderAssignments is reused unchanged. No backfill; all new tables start empty.
Drizzle snapshot0005 and journal entry are checked in. Schema generation found no drift.

Before applying:
1. Stop writers to the selected test DB, including the local Partners test server. Never
   stop the older3017 customer app,3018 HTTPS backend, Cloudflare tunnel or MySQL itself.
2. Take a private full backup including data, schema, Drizzle journal and sequence counters.
   Verify its hash and rehearse restoration to an authorized disposable target. Keep secrets
   and backups outside Git/static assets. This workspace preserved all original test rows
   and verified restoration; private evidence helpers are workspace-specific, not a general
   production backup tool. A production rollout requires an operational backup/restore drill.
3. Set DATABASE_URL privately and MIGRATION_EXPECTED_DATABASE to the exact test DB name.
   Existing preflight rejects other data targets without explicit approval + backup markers.
   Do not invent those markers for Demo. Run existing db:migrate with Node24/pinned pnpm.
4. Preflight checks intact migration hashes/prefix, MySQL8 support, existing row integrity,
   seven tenancy tables and whether all three fulfillment tables agree with the journal.
   Old0000..0004 SQL/hashes are unchanged. MySQL DDL auto-commits: partial DDL is a stop.
5. Verify three tables/FKs/checks/indexes, unchanged old rows, an intact six-entry journal
   and no assignments/enrollment rows after migration. Rerun migration: no data change.
   Then enable SIMULATED_FULFILLMENT_ENABLED only in the controlled test process.

Recovery:
- Leave the feature disabled and stop its writers on any DDL failure. Preserve diagnostics
  and compare SHOW CREATE TABLE/constraints to checked-in SQL. Never edit the journal to
  make an incomplete schema appear successful, disable FKs or rerun blindly.
- If and only if the new three tables are unjournaled and verified empty, an authorized
  test recovery can drop just those empty new tables in child-first order (events,
  stock lines, aggregate), correct the un-applied migration and retry from the clean prefix.
- If any new table has rows or journaled DDL, stop this cleanup path. Retain all records,
  take a fresh backup and prepare a reviewed forward repair, or restore the complete
  verified backup to a separate approved target. Do not truncate historical tables.
- Turning the feature off is not a stock release. Pending holds need approved reconciliation
  or normal cancellation while enabled; the legacy API intentionally refuses bypass.

Actual test run initially found an auto-generated65-character FK identifier. It was
shortened explicitly to fulfillment_line_assignment_fk in schema, SQL and snapshot.
The preflight rejected partial DDL. Only the three empty, unjournaled new test tables
were recovered, then migration and an idempotent rerun succeeded. No original table
was dropped or altered. Regression tests now inspect identifiers in0004 and0005 and
cover partial/untracked fulfillment DDL. See migration-initial-failure.txt,
identifier-red.txt, partial-ddl-refused.txt, migration.txt and migration-rerun.txt.
