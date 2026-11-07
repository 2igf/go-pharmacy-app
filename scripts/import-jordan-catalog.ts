import { createHash, randomUUID } from "node:crypto";
import { readFile, open } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { users } from "../drizzle/schema";
import { getDb, closeDb } from "../server/db";
import { prepareJordanCatalog } from "../server/medication-knowledge/jordan-catalog";
import {
  applyKnowledgeImport,
  historicalCatalogPreviewEnabled,
} from "../server/medication-knowledge/repository";
import { HISTORICAL_CATALOG_SOURCE } from "../shared/historical-catalog";

// Deliberately not a phone/production promotion tool. Dataset reuse is not yet cleared.
const target = new URL(process.env.DATABASE_URL ?? "mysql://invalid/invalid");
if (
  target.pathname !== "/go_pharmacy_test_jordan" ||
  !["127.0.0.1", "localhost"].includes(target.hostname) ||
  !historicalCatalogPreviewEnabled()
)
  throw new Error("Explicit isolated Jordan staging preview required");
const inputPath = process.argv[2],
  reportPath = process.argv[3];
if (!inputPath || !reportPath)
  throw new Error("Usage: import-jordan-catalog.ts <CSV> <new-report.json>");
let reportFile: Awaited<ReturnType<typeof open>> | undefined;
const batches: Awaited<ReturnType<typeof applyKnowledgeImport>>[] = [];
try {
  const csv = await readFile(inputPath, "utf8");
  const result = prepareJordanCatalog(csv);
  const sourceVersion = createHash("sha256").update(csv).digest("hex");
  const db = await getDb();
  const [actor] = await db
    .select()
    .from(users)
    .where(eq(users.openId, "test:admin"));
  if (!actor || actor.role !== "admin")
    throw new Error("Persisted fictional staging administrator required");
  // Reserve a writable, new audit destination before any import transaction.
  reportFile = await open(reportPath, "wx");
  for (let offset = 0; offset < result.records.length; offset += 10) {
    batches.push(
      await applyKnowledgeImport(actor.id, {
        requestId: randomUUID(),
        sourceCode: HISTORICAL_CATALOG_SOURCE,
        sourceVersion,
        permissionReference:
          "User-supplied package: local controlled evaluation only; redistribution and medical review pending",
        records: result.records.slice(offset, offset + 10),
      })
    );
  }
  const { records, ...validation } = result;
  const report = {
    at: new Date().toISOString(),
    database: target.pathname.slice(1),
    sourceVersion,
    ...validation,
    valid: records.length,
    applied: batches.reduce((n, b) => n + b.applied, 0),
    skipped: batches.reduce((n, b) => n + b.skipped, 0),
    batches,
    publication: "explicit local test preview only",
    phoneDatabaseAccessed: false,
  };
  await reportFile.writeFile(JSON.stringify(report, null, 2) + "\n");
  console.log(
    JSON.stringify({
      sourceRows: result.sourceRows,
      valid: records.length,
      applied: report.applied,
      skipped: report.skipped,
      rejected: result.rejected.length,
      potentialDuplicates: result.potentialDuplicates.length,
      warningRows: result.warnings.length,
    })
  );
} catch (error) {
  if (reportFile)
    await reportFile
      .writeFile(
        JSON.stringify(
          {
            status: "incomplete",
            batches,
            note: "Inspect persisted batch audits and resume with a new report; no automatic deletion or overwrite",
          },
          null,
          2
        ) + "\n"
      )
      .catch(() => {});
  throw error;
} finally {
  await reportFile?.close();
  await closeDb();
}
