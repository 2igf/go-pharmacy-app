import { createHash } from "node:crypto";

/** Git on Windows may check out identical SQL with CRLF. Permit only that exact
 * byte transformation; SQL, spaces and statements remain integrity protected.
 */
export function acceptedMigrationHashes(contents: string) {
  const lf = contents.replaceAll("\r\n", "\n");
  return [lf, lf.replaceAll("\n", "\r\n")].map(value =>
    createHash("sha256").update(value).digest("hex")
  );
}

export function assertMigrationHistory(
  local: { when: number; tag: string; hashes: string[] }[],
  applied: { created_at: string | number; hash: string }[],
  tenantTableCount: number,
  fulfillmentTableCount = 0
) {
  for (let i = 0; i < applied.length; i++) {
    if (
      !local[i] ||
      String(local[i].when) !== String(applied[i].created_at) ||
      !local[i].hashes.includes(applied[i].hash)
    )
      throw new Error(
        "Migration journal is not an intact prefix of checked-in history; stop for manual review"
      );
  }
  const tenancy = local.find(entry => entry.tag === "0004_pharmacy_tenancy");
  if (!tenancy) throw new Error("Tenancy migration missing from local journal");
  const tenancyApplied = applied.some(
    entry => String(entry.created_at) === String(tenancy.when)
  );
  if (
    (tenantTableCount > 0 && !tenancyApplied) ||
    (tenancyApplied && tenantTableCount !== 7)
  )
    throw new Error(
      "Partial/untracked tenancy DDL detected. MySQL DDL is not transactional; restore/reconcile before retrying"
    );
  const fulfillment = local.find(
    entry => entry.tag === "0005_simulated_fulfillment"
  );
  const fulfillmentApplied =
    fulfillment &&
    applied.some(
      entry => String(entry.created_at) === String(fulfillment.when)
    );
  if (
    (fulfillmentTableCount > 0 && !fulfillmentApplied) ||
    (fulfillmentApplied && fulfillmentTableCount !== 3)
  )
    throw new Error(
      "Partial/untracked fulfillment DDL detected; restore/reconcile before retrying"
    );
}

/** Explicit target acknowledgement is required before any migration connection. */
export function assertMigrationTarget(
  url: string | undefined,
  expected: string | undefined,
  dataApproval?: string,
  backupVerified?: string
) {
  if (!url) throw new Error("DATABASE_URL is required");
  const parsed = new URL(url);
  const database = decodeURIComponent(parsed.pathname.slice(1));
  if (parsed.protocol !== "mysql:" || !database || database !== expected)
    throw new Error(
      "MIGRATION_EXPECTED_DATABASE must exactly match the target database"
    );
  if (
    !/^go_pharmacy_test(_[a-z0-9]+)?$/.test(database) &&
    (dataApproval !== database || backupVerified !== database)
  )
    throw new Error(
      "Existing-data migration requires explicit approval and a verified backup/restore drill"
    );
  return database;
}
