# Pharmacy V1 — migration, preflight, backup and recovery

## Actual scope of execution

Only `go_pharmacy_test` received migration0004 on the existing local MySQL8.4
instance. Demo was read-only checked and was **not migrated**. New tables have no
demo users/order/catalog backfill. Official price and order-assignment tables are
empty. No environment-wide privilege, MySQL setting or service change was made.

Artifacts: `drizzle/0004_pharmacy_tenancy.sql`, `drizzle/meta/0004_snapshot.json`
and the appended journal entry. Existing migrations0000..0003 were not edited.
The SQL creates seven tables, adds their FKs/indexes/checks and inserts only
JO/JOD/3 jurisdiction metadata. No existing table is altered and no existing data
is updated or deleted.

## Preflight

The existing migration command imports scripts/db-preflight.ts before applying
any migration. It now requires:

- DATABASE_URL from an operator-managed private source; never paste it into logs.
- MIGRATION_EXPECTED_DATABASE exactly matching the URL and SELECT DATABASE().
- MySQL8 with enforced CHECK support (8.0.16+ or later8.x).
- A contiguous applied migration-journal prefix, matching local timestamps and
  content hashes. Exact LF/CRLF equivalents are allowed for Windows checkouts;
  SQL/whitespace/statement changes are not normalized away.
- No partial/untracked tenancy DDL: seven known tables and the stable0004 journal
  entry must agree. The check still allows a later migration0005 to be pending.
- Existing quantity/orphan/duplicate checks from the MVP preflight still pass.

Non-test databases require both MIGRATION_DATA_APPROVAL and
MIGRATION_BACKUP_VERIFIED to equal the expected database name. These are deliberate
**operator attestations**, not proof that a backup was created or restored. Set
them only after explicit authorization and the backup/restore process below.
Do not set them in routine application environments or CI. This task never set
them and does not authorize a demo or live migration.

For a private connection already configured to the dedicated test DB:

```powershell
$env:MIGRATION_EXPECTED_DATABASE = 'go_pharmacy_test'
pnpm exec tsx scripts/db-preflight.ts
pnpm db:migrate
```

Use the pinned pnpm10.34.5 (for example `npx --yes pnpm@10.34.5 ...` if needed).
Preflight itself is read-only. Always verify the connection before the migration
command; never substitute the demo URL for TEST_DATABASE_URL. Existing test fixture
cleanup still asserts the disposable test DB name and connection equality.

## Required backup process before any non-test migration

1. Obtain explicit approval for the named DB and schedule a write-maintenance
   window. Stop application writers and jobs; do not stop or replace MySQL data.
2. Record the application commit, migrations journal, MySQL version, table counts,
   constraints and a consistent backup. Store it in a private location outside
   web roots/repositories. Use a protected credentials file, not a password argument.
3. Use the installed version-compatible mysqldump client with single-transaction,
   routines/triggers/events and hex-blob as appropriate to the reviewed DB. Prefer
   `--result-file` on Windows to avoid shell encoding/redirection corruption.
   Dump the named DB without `--databases` if rehearsing into a different schema,
   so the dump does not select/create the original schema during restore.
4. Hash the backup, record its path/size/time/hash securely, and actually restore
   it into a separate named rehearsal DB/instance. Verify row counts, sample
   non-sensitive records, migration history, constraints and application reads.
5. Review the generated SQL at the exact commit and run preflight. Only then set
   the two explicit non-test attestations and run the migration with the expected
   database name. Verify old rows and new constraints before allowing writers.

No non-test backup or restore drill was executed by this task, because no non-test
migration was authorized. Read-only hashes are preservation evidence, not backups.

## Recovery

MySQL DDL commits implicitly: a migration failure may leave created tables even
if Drizzle has not recorded migration0004. **Do not rerun blindly, disable FKs,
mark the journal applied, add IF NOT EXISTS everywhere or delete tables with data.**

- If the application must roll back after a successful additive migration, roll
  code back to b256aaf and leave new tables/data intact. Old routes do not use them.
  This is a code rollback, not a reverse data migration.
- For partial DDL in a non-test DB, keep writers stopped, preserve a fresh private
  diagnostic backup, inspect all created objects/constraints and the journal, and
  restore/reconcile into a separate copy first. Repair or cutover requires a
  reviewed explicit operator decision. Never restore over existing data by default.
- The disposable test rehearsal encountered one generated FK name longer than
  MySQL's64-character limit. The constraint was explicitly named in the Drizzle
  schema and matched in pending SQL/snapshot. Actual preflight rejected the partial
  DDL before retry. Recovery verified all seven newly created test tables were
  empty, removed only those tables in the guarded test DB, preserved old row hashes,
  then applied the corrected migration. This is **not** an approved production
  recovery recipe. A regression test now checks migration identifier lengths.

Final upgrade and rerun succeeded. The rerun did not recreate tables or duplicate
metadata. `db:generate` reported no schema changes after the explicit FK naming.
The applied SQL must remain unchanged after this delivery; later corrections need
a new additive migration.
