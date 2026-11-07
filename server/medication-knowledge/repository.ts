import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, isNotNull, or, sql } from "drizzle-orm";
import { users } from "../../drizzle/schema";
import {
  knowledgeSources,
  knowledgeImportBatches,
  knowledgeDrugs,
  knowledgeNames,
  knowledgeIngredients,
  knowledgeDrugIngredients,
  knowledgeRegistrations,
  knowledgeLabelSections,
  knowledgeDrugVersions,
  knowledgeProductFacts,
} from "../../drizzle/medication-knowledge";
import {
  knowledgeRecordSchema,
  knowledgeFactsSchema,
  NLM_ATTRIBUTION,
  type KnowledgeRecord,
} from "../../shared/medication-knowledge";
import { getDb } from "../db";

type Db = Awaited<ReturnType<typeof getDb>>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Source = typeof knowledgeSources.$inferSelect;
export type KnowledgeImport = {
  requestId: string;
  sourceCode: "rxnorm" | "authorized_structured";
  sourceVersion: string | null;
  permissionReference: string | null;
  records: KnowledgeRecord[];
};
const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const conflict = () =>
  new TRPCError({
    code: "CONFLICT",
    message:
      "Import changed or newer knowledge versions exist. Refresh and review before retrying.",
  });
const missing = () =>
  new TRPCError({ code: "NOT_FOUND", message: "Knowledge record not found" });
export async function requireKnowledgeAdmin(
  db: Db | Tx,
  actorId: number,
  lock = false
) {
  const query = db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, actorId))
    .limit(1);
  const [user] = await (lock ? query.for("update") : query);
  if (user?.role !== "admin")
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Persisted administrator authorization required",
    });
}
function canonicalRecord(value: KnowledgeRecord) {
  const row = knowledgeRecordSchema.parse(value);
  const sort = <T>(values: T[]) =>
    [...values].sort((a, b) =>
      JSON.stringify(a).localeCompare(JSON.stringify(b))
    );
  const result = {
    ...row,
    names: [row.names[0], ...sort(row.names.slice(1))],
    ingredients: sort(row.ingredients),
    registrations: sort(row.registrations),
    labels: sort(row.labels),
  };
  if (
    new Set(row.ingredients.map(item => item.externalId)).size !==
      row.ingredients.length ||
    new Set(row.names.map(item => `${item.language}:${item.kind}:${item.name}`))
      .size !== row.names.length ||
    new Set(row.labels.map(item => `${item.language}:${item.section}`)).size !==
      row.labels.length
  )
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Duplicate knowledge relationships",
    });
  return result;
}
async function replaceChildren(
  tx: Tx,
  drugId: number,
  sourceId: number,
  row: KnowledgeRecord | null
) {
  await tx
    .delete(knowledgeProductFacts)
    .where(eq(knowledgeProductFacts.drugId, drugId));
  await tx.delete(knowledgeNames).where(eq(knowledgeNames.drugId, drugId));
  await tx
    .delete(knowledgeDrugIngredients)
    .where(eq(knowledgeDrugIngredients.drugId, drugId));
  await tx
    .delete(knowledgeRegistrations)
    .where(eq(knowledgeRegistrations.drugId, drugId));
  await tx
    .delete(knowledgeLabelSections)
    .where(eq(knowledgeLabelSections.drugId, drugId));
  if (!row) return;
  const facts = knowledgeFactsSchema.parse(row.facts ?? {});
  await tx.insert(knowledgeProductFacts).values({
    ...facts,
    drugId,
    sourceUpdatedAt: facts.sourceUpdatedAt
      ? new Date(facts.sourceUpdatedAt)
      : null,
  });
  await tx
    .insert(knowledgeNames)
    .values(row.names.map(name => ({ ...name, drugId })));
  for (const ingredient of row.ingredients) {
    const contentHash = hash({
      name: ingredient.name,
      language: ingredient.language,
    });
    let [existing] = await tx
      .select()
      .from(knowledgeIngredients)
      .where(
        and(
          eq(knowledgeIngredients.sourceId, sourceId),
          eq(knowledgeIngredients.externalId, ingredient.externalId),
          eq(knowledgeIngredients.contentHash, contentHash)
        )
      )
      .limit(1);
    if (existing && existing.externalId !== ingredient.externalId)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Source identifiers differing only by case conflict in this registry",
      });
    if (!existing) {
      const [result] = await tx.insert(knowledgeIngredients).values({
        sourceId,
        externalId: ingredient.externalId,
        contentHash,
        name: ingredient.name,
        language: ingredient.language,
      });
      [existing] = await tx
        .select()
        .from(knowledgeIngredients)
        .where(eq(knowledgeIngredients.id, result.insertId))
        .limit(1);
    }
    await tx.insert(knowledgeDrugIngredients).values({
      drugId,
      ingredientId: existing.id,
      strength: ingredient.strength,
    });
  }
  if (row.registrations.length)
    await tx.insert(knowledgeRegistrations).values(
      row.registrations.map(item => ({
        ...item,
        drugId,
        priceAsOf: item.priceAsOf ? new Date(item.priceAsOf) : null,
        reviewState: "draft" as const,
      }))
    );
  if (row.labels.length)
    await tx.insert(knowledgeLabelSections).values(
      row.labels.map(item => ({
        ...item,
        drugId,
        reviewState: "draft" as const,
      }))
    );
}
function validateSource(source: Source, records: KnowledgeRecord[]) {
  if (source.code !== "rxnorm") return;
  if (
    records.some(
      row =>
        !/^[1-9]\d{0,8}$/.test(row.externalId) ||
        row.sourceReference !==
          `https://rxnav.nlm.nih.gov/REST/rxcui/${row.externalId}/properties.json` ||
        row.registrations.length ||
        row.labels.length ||
        Object.entries(row.facts).some(([key, value]) => key !== "dosageForm" && value !== null) ||
        (row.facts.dosageForm !== null && !["SCD", "SBD"].includes(row.termType)) ||
        row.names.some(name => name.language !== "en") ||
        row.ingredients.some(
          item =>
            !/^[1-9]\d{0,8}$/.test(item.externalId) || item.language !== "en"
        )
    )
  )
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "RxNorm vocabulary cannot assert country registrations, prices, clinical labels or unsupported product facts",
    });
}
function importResult(batch: typeof knowledgeImportBatches.$inferSelect) {
  return {
    batchId: batch.id,
    applied: batch.applied,
    skipped: batch.skipped,
    status: batch.status,
  };
}

export async function applyKnowledgeImport(
  actorId: number,
  input: KnowledgeImport
) {
  const records = input.records
    .map(canonicalRecord)
    .sort((a, b) => a.externalId.localeCompare(b.externalId));
  if (
    !records.length ||
    records.length > 10 ||
    new Set(records.map(row => row.externalId)).size !== records.length ||
    (input.sourceCode === "authorized_structured" && !input.permissionReference)
  )
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Bounded import requires distinct identifiers and explicit structured-import permission",
    });
  const requestHash = hash({
    source: input.sourceCode,
    sourceVersion: input.sourceVersion,
    permissionReference: input.permissionReference,
    records,
  });
  const db = await getDb();
  return db.transaction(async tx => {
    await requireKnowledgeAdmin(tx, actorId, true);
    const [source] = await tx
      .select()
      .from(knowledgeSources)
      .where(eq(knowledgeSources.code, input.sourceCode))
      .for("update");
    if (!source)
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Knowledge source registry unavailable",
      });
    validateSource(source, records);
    const [retry] = await tx
      .select()
      .from(knowledgeImportBatches)
      .where(
        and(
          eq(knowledgeImportBatches.actorId, actorId),
          eq(knowledgeImportBatches.requestId, input.requestId)
        )
      )
      .limit(1);
    if (retry) {
      if (retry.requestHash !== requestHash || retry.status !== "applied")
        throw conflict();
      return importResult(retry);
    }
    const [batch] = await tx.insert(knowledgeImportBatches).values({
      actorId,
      sourceId: source.id,
      requestId: input.requestId,
      requestHash,
      sourceVersion: input.sourceVersion,
      permissionReference: input.permissionReference,
    });
    let applied = 0,
      skipped = 0;
    for (const row of records) {
      const contentHash = hash(row);
      const [existing] = await tx
        .select()
        .from(knowledgeDrugs)
        .where(
          and(
            eq(knowledgeDrugs.sourceId, source.id),
            eq(knowledgeDrugs.externalId, row.externalId)
          )
        )
        .limit(1)
        .for("update");
      if (existing && existing.externalId !== row.externalId)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Source identifiers differing only by case conflict in this registry",
        });
      if (
        existing &&
        existing.state !== "removed" &&
        existing.contentHash === contentHash
      ) {
        skipped++;
        continue;
      }
      const version = (existing?.currentVersion ?? 0) + 1;
      const values = {
        name: row.names[0].name,
        termType: row.termType,
        state:
          source.code === "rxnorm"
            ? ("published" as const)
            : ("draft" as const),
        currentVersion: version,
        contentHash,
        sourceReference: row.sourceReference,
        updatedAt: new Date(),
      };
      let drugId: number;
      if (existing) {
        drugId = existing.id;
        await tx
          .update(knowledgeDrugs)
          .set(values)
          .where(
            and(
              eq(knowledgeDrugs.id, drugId),
              eq(knowledgeDrugs.sourceId, source.id),
              eq(knowledgeDrugs.currentVersion, existing.currentVersion)
            )
          );
      } else {
        const [inserted] = await tx.insert(knowledgeDrugs).values({
          ...values,
          sourceId: source.id,
          externalId: row.externalId,
        });
        drugId = inserted.insertId;
      }
      await replaceChildren(tx, drugId, source.id, row);
      await tx.insert(knowledgeDrugVersions).values({
        drugId,
        version,
        batchId: batch.insertId,
        action: "import",
        snapshot: { record: row, sourceVersion: input.sourceVersion },
      });
      applied++;
    }
    await tx
      .update(knowledgeImportBatches)
      .set({ applied, skipped })
      .where(eq(knowledgeImportBatches.id, batch.insertId));
    return {
      batchId: batch.insertId,
      applied,
      skipped,
      status: "applied" as const,
    };
  });
}
export async function rollbackKnowledgeImport(
  actorId: number,
  batchId: number
) {
  const db = await getDb();
  return db.transaction(async tx => {
    await requireKnowledgeAdmin(tx, actorId, true);
    const [initial] = await tx
      .select()
      .from(knowledgeImportBatches)
      .where(eq(knowledgeImportBatches.id, batchId))
      .limit(1);
    if (!initial) throw missing();
    const [source] = await tx
      .select()
      .from(knowledgeSources)
      .where(eq(knowledgeSources.id, initial.sourceId))
      .for("update");
    const [batch] = await tx
      .select()
      .from(knowledgeImportBatches)
      .where(
        and(
          eq(knowledgeImportBatches.id, batchId),
          eq(knowledgeImportBatches.sourceId, source.id)
        )
      )
      .for("update");
    if (batch.status !== "applied") throw conflict();
    const versions = await tx
      .select()
      .from(knowledgeDrugVersions)
      .where(
        and(
          eq(knowledgeDrugVersions.batchId, batch.id),
          eq(knowledgeDrugVersions.action, "import")
        )
      )
      .orderBy(asc(knowledgeDrugVersions.drugId));
    for (const version of versions) {
      const [drug] = await tx
        .select()
        .from(knowledgeDrugs)
        .where(
          and(
            eq(knowledgeDrugs.id, version.drugId),
            eq(knowledgeDrugs.sourceId, source.id)
          )
        )
        .for("update");
      if (!drug || drug.currentVersion !== version.version) throw conflict();
      const [previous] = await tx
        .select()
        .from(knowledgeDrugVersions)
        .where(
          and(
            eq(knowledgeDrugVersions.drugId, drug.id),
            eq(knowledgeDrugVersions.version, version.version - 1)
          )
        )
        .limit(1);
      const snapshot = previous?.snapshot ?? null;
      const restoredRecord = snapshot?.record ?? null;
      const nextVersion = drug.currentVersion + 1;
      await replaceChildren(tx, drug.id, source.id, restoredRecord);
      await tx
        .update(knowledgeDrugs)
        .set({
          currentVersion: nextVersion,
          contentHash: hash(restoredRecord),
          state: restoredRecord
            ? source.code === "rxnorm"
              ? "published"
              : "draft"
            : "removed",
          name: restoredRecord?.names[0].name ?? drug.name,
          termType: restoredRecord?.termType ?? drug.termType,
          sourceReference:
            restoredRecord?.sourceReference ?? drug.sourceReference,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(knowledgeDrugs.id, drug.id),
            eq(knowledgeDrugs.sourceId, source.id),
            eq(knowledgeDrugs.currentVersion, version.version)
          )
        );
      await tx.insert(knowledgeDrugVersions).values({
        drugId: drug.id,
        version: nextVersion,
        batchId: batch.id,
        action: "rollback",
        snapshot,
      });
    }
    await tx
      .update(knowledgeImportBatches)
      .set({
        status: "rolled_back",
        rolledBackAt: new Date(),
        rolledBackBy: actorId,
      })
      .where(eq(knowledgeImportBatches.id, batch.id));
    return {
      batchId: batch.id,
      status: "rolled_back" as const,
      restored: versions.length,
    };
  });
}
export async function searchKnowledge(input: {
  q: string;
  country: "JO" | "international";
  limit: number;
  offset?: number;
}) {
  const db = await getDb();
  const match = input.q.toLowerCase();
  const rows = await db
    .select({
      id: knowledgeDrugs.id,
      name: knowledgeDrugs.name,
      termType: knowledgeDrugs.termType,
      sourceCode: knowledgeSources.code,
      sourceTitle: knowledgeSources.title,
      sourceReference: knowledgeDrugs.sourceReference,
      updatedAt: knowledgeDrugs.updatedAt,
    })
    .from(knowledgeDrugs)
    .innerJoin(
      knowledgeSources,
      eq(knowledgeDrugs.sourceId, knowledgeSources.id)
    )
    .where(
      and(
        eq(knowledgeDrugs.state, "published"),
        input.country === "international"
          ? eq(knowledgeSources.scope, "international_vocabulary")
          : and(
              eq(knowledgeSources.scope, "authorized_draft"),
              sql`EXISTS (SELECT 1 FROM ${knowledgeRegistrations} WHERE ${knowledgeRegistrations.drugId} = ${knowledgeDrugs.id} AND ${knowledgeRegistrations.country} = 'JO' AND ${knowledgeRegistrations.reviewState} = 'verified' AND ${knowledgeRegistrations.verifiedAt} IS NOT NULL AND ${knowledgeRegistrations.registrationNumber} IS NOT NULL)`
            ),
        match
          ? or(
              sql`LOCATE(${match}, LOWER(${knowledgeDrugs.name})) > 0`,
              sql`EXISTS (SELECT 1 FROM ${knowledgeNames} WHERE ${knowledgeNames.drugId} = ${knowledgeDrugs.id} AND LOCATE(${match}, LOWER(${knowledgeNames.name})) > 0)`,
              sql`EXISTS (SELECT 1 FROM ${knowledgeDrugIngredients} JOIN ${knowledgeIngredients} ON ${knowledgeIngredients.id} = ${knowledgeDrugIngredients.ingredientId} WHERE ${knowledgeDrugIngredients.drugId} = ${knowledgeDrugs.id} AND LOCATE(${match}, LOWER(${knowledgeIngredients.name})) > 0)`
            )
          : undefined
      )
    )
    .orderBy(asc(knowledgeDrugs.name), asc(knowledgeDrugs.id))
    .limit(input.limit)
    .offset(input.offset ?? 0);
  return rows.map(row => ({
    ...row,
    scope: input.country,
    jordanRegistration: "unknown" as const,
    jordanPriceJod: null,
  }));
}
export async function knowledgeDetail(id: number, language: "ar" | "en") {
  const connection = await getDb();
  return connection.transaction(
    async db => {
      const [joined] = await db
        .select()
        .from(knowledgeDrugs)
        .innerJoin(
          knowledgeSources,
          eq(knowledgeDrugs.sourceId, knowledgeSources.id)
        )
        .where(
          and(eq(knowledgeDrugs.id, id), eq(knowledgeDrugs.state, "published"))
        )
        .limit(1);
      if (!joined) throw missing();
      const drug = joined.knowledgeDrugs,
        source = joined.knowledgeSources;
      const names = await db
        .select({
          name: knowledgeNames.name,
          kind: knowledgeNames.kind,
          language: knowledgeNames.language,
        })
        .from(knowledgeNames)
        .where(eq(knowledgeNames.drugId, drug.id));
      const ingredients = await db
        .select({
          externalId: knowledgeIngredients.externalId,
          name: knowledgeIngredients.name,
          language: knowledgeIngredients.language,
          strength: knowledgeDrugIngredients.strength,
        })
        .from(knowledgeDrugIngredients)
        .innerJoin(
          knowledgeIngredients,
          eq(knowledgeDrugIngredients.ingredientId, knowledgeIngredients.id)
        )
        .where(
          and(
            eq(knowledgeDrugIngredients.drugId, drug.id),
            eq(knowledgeIngredients.sourceId, source.id)
          )
        );
      const registrations =
        source.code === "rxnorm"
          ? []
          : await db
              .select()
              .from(knowledgeRegistrations)
              .where(
                and(
                  eq(knowledgeRegistrations.drugId, drug.id),
                  eq(knowledgeRegistrations.reviewState, "verified"),
                  isNotNull(knowledgeRegistrations.verifiedAt),
                  isNotNull(knowledgeRegistrations.registrationNumber)
                )
              );
      const labels =
        source.code === "rxnorm"
          ? []
          : await db
              .select({
                section: knowledgeLabelSections.section,
                language: knowledgeLabelSections.language,
                content: knowledgeLabelSections.content,
                reviewedAt: knowledgeLabelSections.reviewedAt,
              })
              .from(knowledgeLabelSections)
              .innerJoin(users, eq(knowledgeLabelSections.reviewedBy, users.id))
              .where(
                and(
                  eq(knowledgeLabelSections.drugId, drug.id),
                  eq(knowledgeLabelSections.language, language),
                  eq(knowledgeLabelSections.reviewState, "medical_reviewed"),
                  isNotNull(knowledgeLabelSections.reviewedAt),
                  or(eq(users.role, "doctor"), eq(users.role, "pharmacist"))
                )
              );
      const [version] = await db
        .select({
          snapshot: knowledgeDrugVersions.snapshot,
          importedAt: knowledgeDrugVersions.createdAt,
        })
        .from(knowledgeDrugVersions)
        .where(
          and(
            eq(knowledgeDrugVersions.drugId, drug.id),
            eq(knowledgeDrugVersions.version, drug.currentVersion)
          )
        )
        .limit(1);
      const [storedFacts] = await db
        .select()
        .from(knowledgeProductFacts)
        .where(eq(knowledgeProductFacts.drugId, drug.id))
        .limit(1);
      const facts = storedFacts
        ? knowledgeFactsSchema.parse({
            dosageForm: storedFacts.dosageForm,
            route: storedFacts.route,
            manufacturer: storedFacts.manufacturer,
            packageIdentifier: storedFacts.packageIdentifier,
            prescriptionStatus: storedFacts.prescriptionStatus,
            imageReference: storedFacts.imageReference,
            mediaRights: storedFacts.mediaRights,
            publicationDate: storedFacts.publicationDate,
            sourceUpdatedAt: storedFacts.sourceUpdatedAt?.toISOString() ?? null,
          })
        : knowledgeFactsSchema.parse({});
      const publicRegistrations = registrations.map(row => {
        return { ...row, ...publicKnowledgePrice(row) };
      });
      return {
        id: drug.id,
        externalId: drug.externalId,
        name: drug.name,
        termType: drug.termType,
        version: drug.currentVersion,
        updatedAt: drug.updatedAt,
        names,
        facts: { ...facts, mediaRightsVerified: false as const },
        ingredients,
        registrations: publicRegistrations,
        labels,
        source: {
          code: source.code,
          title: source.title,
          homepage: source.homepage,
          termsReference: source.termsReference,
          reference: drug.sourceReference,
          scope: source.scope,
          version: version?.snapshot?.sourceVersion ?? null,
          importedAt: version?.importedAt ?? null,
          attribution: source.code === "rxnorm" ? NLM_ATTRIBUTION : null,
        },
        unknown: {
          jordanRegistration: !registrations.some(row => row.country === "JO"),
          jordanPrice: !publicRegistrations.some(
            row => row.country === "JO" && row.priceJod !== null
          ),
          clinicalLabel: labels.length === 0,
          localAvailability: true,
        },
        advisory:
          "Reference information only; no diagnosis, prescription or dosage recommendation. Country registration and availability require authoritative local verification.",
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" }
  );
}
export function publicKnowledgePrice(
  row: {
    priceJod: string | null;
    priceAsOf: Date | null;
    priceSourceReference: string | null;
  },
  now = Date.now()
) {
  const fresh =
    row.priceAsOf &&
    row.priceAsOf.getTime() <= now &&
    row.priceAsOf.getTime() >= now - 365 * 86400000 &&
    row.priceSourceReference;
  return {
    priceJod: fresh ? row.priceJod : null,
    priceState:
      row.priceJod === null
        ? ("unknown" as const)
        : fresh
          ? ("sourced" as const)
          : ("stale_or_unverified" as const),
  };
}
