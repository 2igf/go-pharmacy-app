import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  prepareJordanCatalog,
  barcodeStatus,
} from "./medication-knowledge/jordan-catalog";
import {
  applyKnowledgeImport,
  searchKnowledge,
  knowledgeDetail,
  rollbackKnowledgeImport,
  historicalCatalogPreviewEnabled,
} from "./medication-knowledge/repository";
import { closeDb, resetFixtures } from "./test-support";
import { getDb } from "./db";
import { products } from "../drizzle/schema";
import { knowledgeDrugs } from "../drizzle/medication-knowledge";
import { HISTORICAL_CATALOG_SOURCE } from "../shared/historical-catalog";
import { assertJordanCatalogMigrationState } from "../scripts/migration-policy";

const sample = {
  product_id: "JO-MED-0001",
  barcode: "4714534315122",
  trade_name: "Fictional Brand",
  generic_name: "Fictional Ingredient",
  strength: "5 mg",
  dosage_form: "Tablet",
  package_size: "28",
  route: "Oral",
  manufacturer_or_agent_ar: "مورد تجريبي",
  manufacturer_or_agent_en: "Fictional supplier",
  therapeutic_category: "Fictional category",
  atc_code: "N06DA02",
  public_price_jod: "1.250",
  hospital_price_jod: "",
  price_source_year: "2021",
  price_source_url: "https://opendata.gov.jo/en/dataset/drug-prices-838-2021",
  jfda_list_source_url: "https://opendata.gov.jo/en/dataset/fictional-list",
  source_date: "2021-02-28",
  last_checked: "2026-08-27",
  verification_status: "Unreviewed source claim",
  clinical_source_url: "",
  clinical_label_date: "",
  standard_dose_reference_en: "UNREVIEWED CLINICAL TEXT MUST NEVER PUBLISH",
  prescription_status: "OTC source claim",
};
function csv(rows: Record<string, string>[] = [sample]) {
  const keys = Object.keys(sample);
  const quote = (v: string) => '"' + v.replaceAll('"', '""') + '"';
  return [
    keys.map(quote).join(","),
    ...rows.map(row => keys.map(k => quote(row[k] ?? "")).join(",")),
  ].join("\n");
}
const record = () => prepareJordanCatalog(csv()).records[0];
const input = (records = [record()]) => ({
  requestId: randomUUID(),
  sourceCode: HISTORICAL_CATALOG_SOURCE,
  sourceVersion: "fictional-source-digest",
  permissionReference: "Local test only",
  records,
});
const browse = (q = "", offset = 0) =>
  searchKnowledge({ q, country: "historical_jo", limit: 20, offset });

describe("Jordan package validation and strict nonclinical mapping", () => {
  it("preserves historical price and source language while leaving registration, manufacturer and prescription status unknown", () => {
    const row = record();
    expect(row.facts.manufacturer).toBeNull();
    expect(row.facts.prescriptionStatus).toBeNull();
    expect(row.labels).toEqual([]);
    expect(row.registrations).toEqual([]);
    expect(row.historicalCatalog).toMatchObject({
      priceSourceYear: "2021",
      publicPriceHistoricalJod: "1.250",
      supplierEn: "Fictional supplier",
      currentRegistration: "unverified",
      medicalReview: "unreviewed",
      reuseStatus: "pending",
      prescriptionStatusClaim: "OTC source claim",
    });
    expect(JSON.stringify(row)).not.toContain("UNREVIEWED CLINICAL TEXT");
    expect(row.ingredients[0]).toMatchObject({
      name: "Fictional Ingredient",
      language: "en",
      strength: "5 mg",
    });
    expect(prepareJordanCatalog(csv()).excludedFields).toContain(
      "standard_dose_reference_en"
    );
  });
  it("distinguishes valid GTIN, missing, local identifier and failed checksum", () => {
    expect(barcodeStatus("4714534315122")).toBe("valid_gtin");
    expect(barcodeStatus("4714534315123")).toBe("invalid_checksum");
    expect(barcodeStatus("1234567")).toBe("non_gtin");
    expect(barcodeStatus("")).toBe("missing");
  });
  it("retains missing strength and flagged barcodes as unknown rather than fabricating them", () => {
    const result = prepareJordanCatalog(
      csv([
        { ...sample, strength: "", barcode: "1234567", atc_code: " N06DA02 " },
      ])
    );
    expect(result.rejected).toEqual([]);
    expect(result.records[0].ingredients[0].strength).toBeNull();
    expect(result.records[0].historicalCatalog?.atcCode).toBe("N06DA02");
    expect(result.warnings[0].reasons).toEqual(
      expect.arrayContaining([
        "strength_missing",
        "barcode_non_gtin",
        "atc_whitespace_trimmed",
      ])
    );
  });
  it("rejects malformed fields, unsafe sources, invalid dates and unsupported price years with per-row reasons", () => {
    const bad = [
      { ...sample, generic_name: "" },
      { ...sample, product_id: "JO-MED-0002", barcode: "bad" },
      {
        ...sample,
        product_id: "JO-MED-0003",
        price_source_url: "https://evil.test/value",
      },
      { ...sample, product_id: "JO-MED-0004", source_date: "2021-02-30" },
      { ...sample, product_id: "JO-MED-0005", price_source_year: "2026" },
    ];
    const result = prepareJordanCatalog(csv(bad));
    expect(result.records).toHaveLength(0);
    expect(result.rejected).toHaveLength(5);
    expect(result.rejected.every(r => r.row >= 2 && r.reasons.length > 0)).toBe(
      true
    );
  });
  it("rejects duplicate IDs but flags ambiguous package/barcode matches without automatic merging", () => {
    const result = prepareJordanCatalog(
      csv([sample, sample, { ...sample, product_id: "JO-MED-0002" }])
    );
    expect(result.records).toHaveLength(2);
    expect(result.rejected[0].reasons).toContain("duplicate_product_id");
    expect(
      result.potentialDuplicates.some(d => d.reason === "same_barcode")
    ).toBe(true);
  });
  it("requires bounded CSV, distinct headers and full source mapping", () => {
    expect(() => prepareJordanCatalog("bad,headers\n1,2")).toThrow();
    expect(() => prepareJordanCatalog("x".repeat(4_000_001))).toThrow();
    expect(() =>
      prepareJordanCatalog(csv(Array.from({ length: 1001 }, () => sample)))
    ).toThrow();
  });
  it("refuses a production preview even with the flag enabled", () => {
    vi.stubEnv("HISTORICAL_KNOWLEDGE_PREVIEW_ENABLED", "true");
    vi.stubEnv("NODE_ENV", "production");
    expect(historicalCatalogPreviewEnabled()).toBe(false);
    vi.unstubAllEnvs();
  });
  it("preflight fails closed for partial/untracked additive DDL", () => {
    expect(() =>
      assertJordanCatalogMigrationState(false, false, false)
    ).not.toThrow();
    expect(() =>
      assertJordanCatalogMigrationState(true, true, true)
    ).not.toThrow();
    for (const state of [
      [false, true, false],
      [false, false, true],
      [true, true, false],
      [true, false, true],
    ])
      expect(() =>
        assertJordanCatalogMigrationState(
          ...(state as [boolean, boolean, boolean])
        )
      ).toThrow();
  });
});

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "Jordan catalog MySQL integration",
  () => {
    beforeEach(async () => {
      vi.stubEnv("NODE_ENV", "test");
      vi.stubEnv("HISTORICAL_KNOWLEDGE_PREVIEW_ENABLED", "true");
      await resetFixtures();
    });
    afterAll(async () => {
      vi.unstubAllEnvs();
      await closeDb();
    });
    it("imports idempotently, separates countries and exposes only sourced historical detail", async () => {
      const request = input();
      const first = await applyKnowledgeImport(3, request);
      expect(first.applied).toBe(1);
      expect(await applyKnowledgeImport(3, request)).toEqual(first);
      expect((await applyKnowledgeImport(3, input())).skipped).toBe(1);
      const [found] = await browse();
      expect(found.externalId).toBe("JO-MED-0001");
      for (const q of [
        "fictional brand",
        "fictional ingredient",
        "4714534315122",
        "n06da02",
        "JO-MED-0001",
      ])
        expect((await browse(q))[0].id).toBe(found.id);
      expect(
        await searchKnowledge({ q: "", country: "JO", limit: 20 })
      ).toEqual([]);
      expect(
        await searchKnowledge({ q: "", country: "international", limit: 20 })
      ).toEqual([]);
      const detail = await knowledgeDetail(found.id, "ar");
      expect(detail.labels).toEqual([]);
      expect(detail.registrations).toEqual([]);
      expect(detail.unknown.jordanPrice).toBe(true);
      expect(detail.historicalCatalog?.priceSourceYear).toBe("2021");
      expect(await (await getDb()).select().from(products)).toHaveLength(2);
    });
    it("prevents unauthorized imports, metadata injection through other sources and automatic overwrites", async () => {
      await expect(applyKnowledgeImport(1, input())).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(
        applyKnowledgeImport(3, {
          ...input(),
          sourceCode: "authorized_structured",
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await applyKnowledgeImport(3, input());
      const changed = record();
      changed.names[0].name = "Changed";
      await expect(
        applyKnowledgeImport(3, input([changed]))
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect((await browse())[0].name).toBe("Fictional Brand");
      const unsafe = record();
      unsafe.registrations = [
        {
          country: "JO",
          authority: "Unverified source claim",
          sourceReference: "Fictional",
          registrationNumber: "unverified",
          packageDescription: null,
          priceJod: null,
          priceAsOf: null,
          priceSourceReference: null,
        },
      ];
      await expect(applyKnowledgeImport(3, input([unsafe]))).rejects.toThrow();
    });
    it("disables list, direct detail and import without explicit preview", async () => {
      await applyKnowledgeImport(3, input());
      const [found] = await browse();
      vi.stubEnv("HISTORICAL_KNOWLEDGE_PREVIEW_ENABLED", "false");
      expect(await browse()).toEqual([]);
      await expect(knowledgeDetail(found.id, "en")).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await expect(applyKnowledgeImport(3, input())).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });
    it("provides stable server pagination beyond the first 100 records", async () => {
      const rows = Array.from({ length: 105 }, (_, i) => ({
        ...sample,
        product_id: `JO-MED-${String(i + 1).padStart(4, "0")}`,
        trade_name: `Fictional ${String(i).padStart(3, "0")}`,
        barcode: "",
      }));
      const prepared = prepareJordanCatalog(csv(rows)).records;
      for (let i = 0; i < prepared.length; i += 10)
        await applyKnowledgeImport(3, input(prepared.slice(i, i + 10)));
      const ids: number[] = [];
      for (let offset = 0; offset < 120; offset += 20)
        ids.push(...(await browse("", offset)).map(r => r.id));
      expect(ids).toHaveLength(105);
      expect(new Set(ids).size).toBe(105);
      expect(await browse("", 120)).toEqual([]);
    });
    it("serializes concurrent imports and reverses only the new batch without erasing audit history", async () => {
      const concurrent = await Promise.all([
        applyKnowledgeImport(3, input()),
        applyKnowledgeImport(3, input()),
      ]);
      expect(concurrent.reduce((n, b) => n + b.applied, 0)).toBe(1);
      const imported = concurrent.find(b => b.applied === 1)!;
      await expect(
        rollbackKnowledgeImport(1, imported.batchId)
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(
        (await rollbackKnowledgeImport(3, imported.batchId)).restored
      ).toBe(1);
      expect(await browse()).toEqual([]);
      const [retained] = await (await getDb())
        .select()
        .from(knowledgeDrugs)
        .where(eq(knowledgeDrugs.externalId, "JO-MED-0001"));
      expect(retained.state).toBe("removed");
      expect(retained.currentVersion).toBe(2);
      expect((await applyKnowledgeImport(3, input())).applied).toBe(1);
      expect(
        (await knowledgeDetail(retained.id, "en")).historicalCatalog?.rowSha256
      ).toBe(record().historicalCatalog?.rowSha256);
    });
  }
);
