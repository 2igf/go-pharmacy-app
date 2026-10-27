# Deployment preparation, backup and recovery

No public deployment was performed. The supplied Docker/Compose setup is a deployment candidate; its runtime verification status is in the implementation report.

## Environment

Node 24; pnpm version in package.json; MySQL 8.4/InnoDB; utf8mb4 database; environment or secret manager configuration. APP_ORIGIN must be exactly the external origin without a trailing slash. Production requires HTTPS. DATABASE_URL must use percent-encoded credentials and target the durable database. Never place passwords in shell history or commit them. PRIVATE_BETA defaults true; BETA_ALLOWED_EMAILS controls participants. BETA_INVITE_SECRET must be random and at least 32 characters. HOST defaults loopback; PORT defaults 3000. Set TRUST_PROXY only to the real reverse-proxy IP/CIDR.

## Existing database

1. Enter maintenance mode/stop all writers and take a consistent backup.
2. Test restoration into a separate staging database.
3. Run `pnpm db:migrate`. It performs a read-only preflight before the Drizzle migrator.
4. Preflight rejects duplicate user/product carts, orphaned core references, invalid quantities/negative stock/prices. Reconcile manually from a backup; it never deletes or merges records.
5. Migrations add local auth tables, archival flag, simulated order metadata, basket idempotency and core FKs/indexes. Existing rows retain their historical meaning; legacy orders default isSimulated=false.
6. Run checks/integration smoke against staging. Reopen writes only after verification.

MySQL DDL implicitly commits. A failure halfway through a migration can leave partial DDL. **Do not rerun blindly, remove the migration ledger, disable foreign keys or manually mark a migration successful.** Restore the pre-migration backup into a new database and switch to it, or inspect the exact schema with a qualified operator and create a reviewed forward recovery. No destructive down migration is supplied.

## Backup example

Use a protected MySQL login-path or private option file to avoid credentials on the command line:

```sh
mysqldump --login-path=go_beta_backup --single-transaction --routines --triggers --events --hex-blob --databases go_pharmacy_beta > go-beta-backup.sql
mysql --login-path=go_beta_restore < go-beta-backup.sql
```

On PowerShell use mysql's `--result-file` option when exporting to avoid text-redirection encoding ambiguity. Encrypt backups, store them off-host, restrict access, choose a retention policy, and rehearse restoration. A Docker named volume provides persistence, not a backup.

## Docker candidate

Set MYSQL_PASSWORD, MYSQL_ROOT_PASSWORD, DATABASE_URL (host `db`), APP_ORIGIN, BETA_ALLOWED_EMAILS, BETA_INVITE_SECRET and TRUST_PROXY in the deployment environment. Password values in DATABASE_URL must be URL encoded.

```sh
docker compose build
docker compose up -d db
docker compose run --rm app node dist/ops/migrate.js
docker compose up -d app
```

The app port is published only on host loopback. Terminate TLS using the operator's existing reverse proxy; set its body cap to 64 KiB and add request timeouts. Database port is not published. The app runs as the unprivileged node user. `/healthz` is process liveness and `/readyz` checks DB connectivity plus session-table availability. No endpoint exposes configuration or secrets. The in-memory limiter assumes one process.

Seed only an empty non-production development/demo database. The production Docker runtime deliberately rejects the fictional seed command by default; for a private staging demo, explicitly run with NODE_ENV=staging and CONFIRM_FICTIONAL_SEED=yes. Create admin and invitations using the local source tools with a private environment. The production image does not contain invitation generation tools.

For source deployment, `pnpm build`; provide the production environment; `pnpm start`. Keep database storage outside the app release directory and use a supervisor. Verify HTTPS cookies and CSRF through the actual proxy before admitting testers.
# Pharmacy migration safety update

Before migration0004 or any later migration, use the explicit target and backup
requirements in [PHARMACY_MIGRATION_V1.md](PHARMACY_MIGRATION_V1.md).
The migration command now requires MIGRATION_EXPECTED_DATABASE, and non-test
targets require prior authorization and verified backup/restore attestations.
This work did not migrate or deploy the demo backend.
