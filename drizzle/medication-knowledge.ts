import {
  date,
  datetime,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
  text,
} from "drizzle-orm/mysql-core";
import { users } from "./schema";
import type { KnowledgeRecord } from "../shared/medication-knowledge";
import type { HistoricalCatalog } from "../shared/historical-catalog";

export const knowledgeSources = mysqlTable("knowledgeSources", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 40 }).notNull().unique(),
  title: varchar("title", { length: 200 }).notNull(),
  homepage: varchar("homepage", { length: 500 }).notNull(),
  termsReference: varchar("termsReference", { length: 500 }).notNull(),
  scope: mysqlEnum("scope", [
    "international_vocabulary",
    "authorized_draft",
  ]).notNull(),
});
export const knowledgeImportBatches = mysqlTable(
  "knowledgeImportBatches",
  {
    id: int("id").autoincrement().primaryKey(),
    sourceId: int("sourceId")
      .notNull()
      .references(() => knowledgeSources.id),
    actorId: int("actorId")
      .notNull()
      .references(() => users.id),
    requestId: varchar("requestId", { length: 36 }).notNull(),
    requestHash: varchar("requestHash", { length: 64 }).notNull(),
    sourceVersion: varchar("sourceVersion", { length: 128 }),
    permissionReference: varchar("permissionReference", { length: 500 }),
    status: mysqlEnum("status", ["applied", "rolled_back"])
      .notNull()
      .default("applied"),
    applied: int("applied").notNull().default(0),
    skipped: int("skipped").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    rolledBackAt: datetime("rolledBackAt", { mode: "date", fsp: 3 }),
    rolledBackBy: int("rolledBackBy").references(() => users.id),
  },
  t => [uniqueIndex("knowledge_batch_retry_unique").on(t.actorId, t.requestId)]
);
export const knowledgeDrugs = mysqlTable(
  "knowledgeDrugs",
  {
    id: int("id").autoincrement().primaryKey(),
    sourceId: int("sourceId")
      .notNull()
      .references(() => knowledgeSources.id),
    externalId: varchar("externalId", { length: 100 }).notNull(),
    name: varchar("name", { length: 500 }).notNull(),
    termType: varchar("termType", { length: 12 }).notNull(),
    state: mysqlEnum("state", ["published", "draft", "removed"]).notNull(),
    currentVersion: int("currentVersion").notNull(),
    contentHash: varchar("contentHash", { length: 64 }).notNull(),
    sourceReference: varchar("sourceReference", { length: 500 }).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  t => [
    uniqueIndex("knowledge_drug_source_external_unique").on(
      t.sourceId,
      t.externalId
    ),
    index("knowledge_drug_state_idx").on(t.state),
  ]
);
export const knowledgeNames = mysqlTable(
  "knowledgeNames",
  {
    id: int("id").autoincrement().primaryKey(),
    drugId: int("drugId")
      .notNull()
      .references(() => knowledgeDrugs.id),
    name: varchar("name", { length: 500 }).notNull(),
    language: mysqlEnum("language", ["ar", "en"]).notNull(),
    kind: mysqlEnum("kind", ["generic", "brand", "synonym"]).notNull(),
  },
  t => [index("knowledge_name_drug_idx").on(t.drugId)]
);
export const knowledgeIngredients = mysqlTable(
  "knowledgeIngredients",
  {
    id: int("id").autoincrement().primaryKey(),
    sourceId: int("sourceId")
      .notNull()
      .references(() => knowledgeSources.id),
    externalId: varchar("externalId", { length: 100 }).notNull(),
    contentHash: varchar("contentHash", { length: 64 }).notNull(),
    name: varchar("name", { length: 500 }).notNull(),
    language: mysqlEnum("language", ["ar", "en"]).notNull(),
  },
  t => [
    uniqueIndex("knowledge_ingredient_source_hash_unique").on(
      t.sourceId,
      t.externalId,
      t.contentHash
    ),
  ]
);
export const knowledgeDrugIngredients = mysqlTable(
  "knowledgeDrugIngredients",
  {
    id: int("id").autoincrement().primaryKey(),
    drugId: int("drugId")
      .notNull()
      .references(() => knowledgeDrugs.id),
    ingredientId: int("ingredientId")
      .notNull()
      .references(() => knowledgeIngredients.id),
    strength: varchar("strength", { length: 120 }),
  },
  t => [
    uniqueIndex("knowledge_drug_ingredient_unique").on(
      t.drugId,
      t.ingredientId
    ),
  ]
);
export const knowledgeRegistrations = mysqlTable(
  "knowledgeRegistrations",
  {
    id: int("id").autoincrement().primaryKey(),
    drugId: int("drugId")
      .notNull()
      .references(() => knowledgeDrugs.id),
    country: varchar("country", { length: 2 }).notNull(),
    authority: varchar("authority", { length: 200 }).notNull(),
    sourceReference: varchar("sourceReference", { length: 500 }).notNull(),
    registrationNumber: varchar("registrationNumber", { length: 120 }),
    packageDescription: varchar("packageDescription", { length: 500 }),
    priceJod: decimal("priceJod", { precision: 12, scale: 3 }),
    priceAsOf: datetime("priceAsOf", { mode: "date", fsp: 3 }),
    priceSourceReference: varchar("priceSourceReference", { length: 500 }),
    reviewState: mysqlEnum("reviewState", ["draft", "verified"])
      .notNull()
      .default("draft"),
    verifiedAt: datetime("verifiedAt", { mode: "date", fsp: 3 }),
  },
  t => [
    index("knowledge_registration_country_idx").on(
      t.country,
      t.reviewState,
      t.drugId
    ),
  ]
);
export const knowledgeLabelSections = mysqlTable(
  "knowledgeLabelSections",
  {
    id: int("id").autoincrement().primaryKey(),
    drugId: int("drugId")
      .notNull()
      .references(() => knowledgeDrugs.id),
    section: mysqlEnum("section", [
      "indications",
      "dosage",
      "warnings",
      "side_effects",
      "contraindications",
      "description",
      "interactions",
    ]).notNull(),
    language: mysqlEnum("language", ["ar", "en"]).notNull(),
    content: text("content").notNull(),
    reviewState: mysqlEnum("reviewState", ["draft", "medical_reviewed"])
      .notNull()
      .default("draft"),
    reviewedBy: int("reviewedBy").references(() => users.id),
    reviewedAt: datetime("reviewedAt", { mode: "date", fsp: 3 }),
  },
  t => [index("knowledge_label_drug_idx").on(t.drugId, t.reviewState)]
);
export const knowledgeProductFacts = mysqlTable("knowledgeProductFacts", {
  drugId: int("drugId")
    .primaryKey()
    .references(() => knowledgeDrugs.id),
  dosageForm: varchar("dosageForm", { length: 500 }),
  route: varchar("route", { length: 500 }),
  manufacturer: varchar("manufacturer", { length: 500 }),
  packageIdentifier: varchar("packageIdentifier", { length: 500 }),
  prescriptionStatus: mysqlEnum("prescriptionStatus", ["prescription", "otc"]),
  imageReference: varchar("imageReference", { length: 500 }),
  mediaRights: varchar("mediaRights", { length: 500 }),
  publicationDate: date("publicationDate", { mode: "string" }),
  sourceUpdatedAt: datetime("sourceUpdatedAt", { mode: "date", fsp: 3 }),
  catalogMetadata: json("catalogMetadata").$type<HistoricalCatalog | null>(),
});
export const knowledgeDrugVersions = mysqlTable(
  "knowledgeDrugVersions",
  {
    id: int("id").autoincrement().primaryKey(),
    drugId: int("drugId")
      .notNull()
      .references(() => knowledgeDrugs.id),
    version: int("version").notNull(),
    batchId: int("batchId")
      .notNull()
      .references(() => knowledgeImportBatches.id),
    action: mysqlEnum("action", ["import", "rollback"]).notNull(),
    snapshot: json("snapshot").$type<{
      record: KnowledgeRecord;
      sourceVersion: string | null;
    } | null>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  t => [
    uniqueIndex("knowledge_drug_version_unique").on(t.drugId, t.version),
    index("knowledge_version_batch_idx").on(t.batchId),
  ]
);
