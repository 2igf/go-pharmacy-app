import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import {
  knowledgeRecordSchema,
  publicKnowledgeSearchSchema,
} from "../shared/medication-knowledge";
import {
  normalizeRxNorm,
  fetchRxNormRecords,
  clearRxNormCache,
} from "./medication-knowledge/rxnorm";
import { parseStructuredPayload } from "./medication-knowledge/structured";
import { medicationKnowledgeRouter } from "./medication-knowledge/router";
import {
  applyKnowledgeImport,
  publicKnowledgePrice,
} from "./medication-knowledge/repository";
import {
  knowledgeDrugs,
  knowledgeDrugVersions,
  knowledgeImportBatches,
  knowledgeRegistrations,
  knowledgeProductFacts,
} from "../drizzle/medication-knowledge";
import { products, users, officialMedicinePrices } from "../drizzle/schema";
import { getDb } from "./db";
import { closeDb, resetFixtures, testContext } from "./test-support";

const properties = {
  properties: {
    rxcui: "202433",
    name: "Tylenol",
    tty: "BN",
    language: "ENG",
    suppress: "N",
    synonym: "",
  },
};
const related = {
  relatedGroup: {
    conceptGroup: [
      {
        tty: "IN",
        conceptProperties: [
          {
            rxcui: "161",
            name: "acetaminophen",
            tty: "IN",
            language: "ENG",
            suppress: "N",
          },
        ],
      },
    ],
  },
};
function manualRecord(overrides: Record<string, unknown> = {}) {
  return {
    externalId: "fictional-item-1",
    names: [
      {
        name: "Fictional Item",
        language: "en" as const,
        kind: "generic" as const,
      },
    ],
    ingredients: [],
    registrations: [],
    labels: [],
    sourceReference: "Authorized fictional test document",
    ...overrides,
  };
}
function structured(overrides: Record<string, unknown> = {}) {
  return {
    format: "json" as const,
    permissionReference: "Fictional permission test-reference",
    records: [manualRecord()],
    ...overrides,
  };
}
describe("medication knowledge normalization without database/network", () => {
  it("defaults every product fact to unknown and preserves only explicit structured facts", () => {
    const row = knowledgeRecordSchema.parse(manualRecord());
    expect(row.facts).toEqual({
      dosageForm: null,
      route: null,
      manufacturer: null,
      packageIdentifier: null,
      prescriptionStatus: null,
      imageReference: null,
      mediaRights: null,
      publicationDate: null,
      sourceUpdatedAt: null,
    });
    const facts = {
      dosageForm: "Fictional tablet",
      route: "Fictional oral",
      manufacturer: "Fictional manufacturer",
      packageIdentifier: "Fictional package-1",
      prescriptionStatus: "prescription",
      imageReference: "https://example.test/fictional.jpg",
      mediaRights: "Fictional authorized image license reference",
      publicationDate: "2026-10-01",
      sourceUpdatedAt: "2026-10-02T00:00:00Z",
    };
    expect(knowledgeRecordSchema.parse(manualRecord({ facts })).facts).toEqual(
      facts
    );
    expect(
      knowledgeRecordSchema.safeParse(
        manualRecord({
          facts: { imageReference: "https://example.test/image.jpg" },
        })
      ).success
    ).toBe(false);
    expect(
      knowledgeRecordSchema.safeParse(
        manualRecord({
          facts: {
            imageReference: "javascript:alert(1)",
            mediaRights: "Fictional license",
          },
        })
      ).success
    ).toBe(false);
    expect(
      knowledgeRecordSchema.safeParse(
        manualRecord({ facts: { publicationDate: "2026-02-30" } })
      ).success
    ).toBe(false);
    expect(normalizeRxNorm("202433", properties, related).facts).toEqual(
      row.facts
    );
  });
  it("suppresses missing, undated, future and stale prices while preserving a dated sourced quote", () => {
    const now = new Date("2026-10-30T00:00:00Z").getTime();
    const quote = {
      priceJod: "1.500",
      priceAsOf: new Date("2026-10-01T00:00:00Z"),
      priceSourceReference: "Fictional verified source",
    };
    expect(publicKnowledgePrice(quote, now)).toEqual({
      priceJod: "1.500",
      priceState: "sourced",
    });
    for (const value of [
      { ...quote, priceAsOf: null },
      { ...quote, priceAsOf: new Date("2020-01-01") },
      { ...quote, priceAsOf: new Date("2027-01-01") },
      { ...quote, priceSourceReference: null },
    ])
      expect(publicKnowledgePrice(value, now).priceJod).toBe(null);
    expect(
      publicKnowledgePrice({ ...quote, priceJod: null }, now).priceState
    ).toBe("unknown");
  });
  it("normalizes only sourced brand and ingredient relationships without inventing country data", () => {
    const row = normalizeRxNorm("202433", properties, related);
    expect(row.names).toEqual([
      { name: "Tylenol", language: "en", kind: "brand" },
    ]);
    expect(row.ingredients).toEqual([
      {
        externalId: "161",
        name: "acetaminophen",
        language: "en",
        strength: null,
      },
    ]);
    expect(row.registrations).toEqual([]);
    expect(row.labels).toEqual([]);
    expect(row.sourceReference).toBe(
      "https://rxnav.nlm.nih.gov/REST/rxcui/202433/properties.json"
    );
  });
  it("rejects mismatched, suppressed or unsupported upstream concepts", () => {
    expect(() => normalizeRxNorm("161", properties, related)).toThrow();
    expect(() =>
      normalizeRxNorm(
        "202433",
        { properties: { ...properties.properties, suppress: "Y" } },
        related
      )
    ).toThrow();
    expect(() =>
      normalizeRxNorm(
        "202433",
        { properties: { ...properties.properties, tty: "UNKNOWN" } },
        related
      )
    ).toThrow();
  });
  it.each([
    { externalId: "" },
    { userId: 2 },
    { source: "rxnorm" },
    { reviewState: "verified" },
    { names: [] },
    { registrations: [{ country: "JO", reviewState: "verified" }] },
    {
      labels: [
        { section: "dosage", language: "ar", content: "x", reviewed: true },
      ],
    },
  ])("rejects spoofed or malformed content %j", value => {
    expect(knowledgeRecordSchema.safeParse(manualRecord(value)).success).toBe(
      false
    );
  });
  it("defaults public search to verified Jordan scope and rejects URL/import fields", () => {
    expect(publicKnowledgeSearchSchema.parse({}).country).toBe("JO");
    expect(
      publicKnowledgeSearchSchema.safeParse({ url: "http://127.0.0.1" }).success
    ).toBe(false);
  });
  it("supports bounded CSV with quoted text and rejects missing headers/duplicate source identifiers", () => {
    const parsed = parseStructuredPayload({
      format: "csv",
      permissionReference: "Fictional permission reference",
      csv: 'externalId,name,language,kind,sourceReference\nfictional-1,"Fictional, item",en,generic,Test document',
    });
    expect(parsed[0].names[0].name).toBe("Fictional, item");
    expect(() =>
      parseStructuredPayload({
        format: "csv",
        permissionReference: "Fictional permission reference",
        csv: "name\nMissing id",
      })
    ).toThrow();
    expect(() =>
      parseStructuredPayload(
        structured({ records: [manualRecord(), manualRecord()] })
      )
    ).toThrow();
    expect(() =>
      parseStructuredPayload({
        format: "csv",
        permissionReference: "Fictional permission reference",
        csv: 'externalId,name,language,kind,sourceReference\nfictional-1,"Invalid"tail,en,generic,Test document',
      })
    ).toThrow();
  });
  it("validates regulatory prices as explicit dated JOD values and keeps unknown values null", () => {
    const row = knowledgeRecordSchema.parse(
      manualRecord({
        registrations: [
          {
            country: "JO",
            authority: "Fictional authority",
            sourceReference: "Fictional test source",
            registrationNumber: null,
            packageDescription: null,
            priceJod: null,
            priceAsOf: null,
            priceSourceReference: null,
          },
        ],
      })
    );
    expect(row.registrations[0].priceJod).toBe(null);
    expect(
      knowledgeRecordSchema.safeParse(
        manualRecord({
          registrations: [{ ...row.registrations[0], priceJod: "1.500" }],
        })
      ).success
    ).toBe(false);
  });
  it("fetches only allowlisted bounded RxNorm paths and caches a successful response", async () => {
    clearRxNormCache();
    const fetchMock = vi.fn(
      async (url: string | URL | Request, options?: RequestInit) => {
        expect(String(url)).toMatch(
          /^https:\/\/rxnav\.nlm\.nih\.gov\/REST\/(?:version\.json|rxcui\/202433\/(?:properties\.json|related\.json\?tty=IN\+BN))$/
        );
        expect(options?.redirect).toBe("error");
        return new Response(
          JSON.stringify(
            String(url).includes("version")
              ? { version: "Fictional-Test-Version" }
              : String(url).includes("properties")
                ? properties
                : related
          ),
          { headers: { "content-type": "application/json" } }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);
    try {
      await fetchRxNormRecords(["202433"]);
      await fetchRxNormRecords(["202433"]);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      await expect(fetchRxNormRecords(["../proprietary"])).rejects.toThrow();
      await expect(fetchRxNormRecords(Array(11).fill("161"))).rejects.toThrow();
    } finally {
      vi.unstubAllGlobals();
      clearRxNormCache();
    }
  });
  it("fails closed on invalid upstream content and oversized responses", async () => {
    for (const response of [
      new Response("unexpected", { headers: { "content-type": "text/html" } }),
      new Response("{}", {
        headers: {
          "content-type": "application/json",
          "content-length": "900000",
        },
      }),
      new Response("{invalid", {
        headers: { "content-type": "application/json" },
      }),
    ]) {
      clearRxNormCache();
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => response)
      );
      try {
        await expect(fetchRxNormRecords(["161"])).rejects.toMatchObject({
          code: "BAD_GATEWAY",
        });
      } finally {
        vi.unstubAllGlobals();
        clearRxNormCache();
      }
    }
  });
});
beforeEach(async () => {
  if (process.env.TEST_DATABASE_URL) await resetFixtures();
});
afterAll(closeDb);
async function caller(id = 1) {
  return medicationKnowledgeRouter.createCaller(await testContext(id));
}
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "medication knowledge on isolated V2 MySQL",
  () => {
    it("restores pre-0009 snapshots without facts as all unknown values", async () => {
      const row = normalizeRxNorm("202433", properties, related);
      const input = {
        requestId: randomUUID(),
        sourceCode: "rxnorm" as const,
        sourceVersion: "Fictional-Pre-0009",
        permissionReference: null,
        records: [row],
      };
      await applyKnowledgeImport(3, input);
      const db = await getDb();
      // Dedicated fixture only: emulate immutable snapshot JSON written before migration 0009 existed.
      await db.update(knowledgeDrugVersions).set({
        snapshot: sql`JSON_REMOVE(${knowledgeDrugVersions.snapshot}, '$.record.facts')`,
      });
      const updated = await applyKnowledgeImport(3, {
        ...input,
        requestId: randomUUID(),
        records: [
          {
            ...row,
            names: [
              {
                name: "Fictional updated vocabulary",
                language: "en",
                kind: "brand",
              },
            ],
          },
        ],
      });
      await (await caller(3)).rollback({ batchId: updated.batchId });
      const [drug] = await (
        await caller()
      ).search({ country: "international" });
      const detail = await (await caller()).detail({ id: drug.id });
      expect(detail.facts).toEqual({
        ...row.facts,
        mediaRightsVerified: false,
      });
      expect(detail.source.version).toBe("Fictional-Pre-0009");
    });
    it("persists explicit draft facts and description/interactions, and restores their provenance on rollback", async () => {
      const facts = {
        dosageForm: "Fictional tablet",
        route: "Fictional oral",
        manufacturer: "Fictional first manufacturer",
        packageIdentifier: "Fictional package",
        prescriptionStatus: "prescription",
        imageReference: "https://example.test/fictional.jpg",
        mediaRights: "Fictional explicit rights document",
        publicationDate: "2026-10-01",
        sourceUpdatedAt: "2026-10-02T00:00:00Z",
      };
      const labels = [
        {
          section: "description",
          language: "en",
          content: "Fictional original description",
        },
        {
          section: "interactions",
          language: "en",
          content: "Fictional unreviewed source section",
        },
      ];
      const access = await caller(3);
      await access.importStructured({
        requestId: randomUUID(),
        ...structured({ records: [manualRecord({ facts, labels })] }),
      });
      const db = await getDb();
      const [first] = await db.select().from(knowledgeProductFacts);
      expect(first).toMatchObject({
        dosageForm: facts.dosageForm,
        manufacturer: facts.manufacturer,
        publicationDate: facts.publicationDate,
        sourceUpdatedAt: new Date(facts.sourceUpdatedAt),
        prescriptionStatus: "prescription",
      });
      const second = await access.importStructured({
        requestId: randomUUID(),
        ...structured({
          records: [
            manualRecord({
              facts: {
                ...facts,
                manufacturer: "Fictional changed manufacturer",
              },
              labels,
            }),
          ],
        }),
      });
      await access.rollback({ batchId: second.batchId });
      const [restored] = await db.select().from(knowledgeProductFacts);
      expect(restored).toEqual(first);
      const [drug] = await db.select().from(knowledgeDrugs);
      expect(drug.state).toBe("draft");
      await expect(
        (await caller()).detail({ id: drug.id })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(await (await caller()).search({})).toEqual([]);
    });
    it("rejects unsourced RxNorm facts and keeps imported vocabulary facts explicitly unknown", async () => {
      const row = normalizeRxNorm("202433", properties, related);
      await expect(
        applyKnowledgeImport(3, {
          requestId: randomUUID(),
          sourceCode: "rxnorm",
          sourceVersion: "Fictional-Test-Version",
          permissionReference: null,
          records: [
            {
              ...row,
              facts: {
                ...row.facts,
                dosageForm: "Inferred from a name - prohibited",
              },
            },
          ],
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      const db = await getDb();
      expect(await db.select().from(knowledgeImportBatches)).toEqual([]);
      await applyKnowledgeImport(3, {
        requestId: randomUUID(),
        sourceCode: "rxnorm",
        sourceVersion: "Fictional-Test-Version",
        permissionReference: null,
        records: [row],
      });
      const [drug] = await (
        await caller()
      ).search({ country: "international" });
      expect((await (await caller()).detail({ id: drug.id })).facts).toEqual({
        ...row.facts,
        mediaRightsVerified: false,
      });
    });
    it("exposes public reads and blocks every administration procedure before network/import work", async () => {
      const access = await caller();
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      try {
        await expect(
          access.previewStructured(structured())
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
        await expect(
          access.importRxNorm({ requestId: randomUUID(), ids: ["161"] })
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
        await expect(access.batches()).rejects.toMatchObject({
          code: "FORBIDDEN",
        });
        await expect(access.rollback({ batchId: 1 })).rejects.toMatchObject({
          code: "FORBIDDEN",
        });
        const anonymous = medicationKnowledgeRouter.createCaller({
          ...(await testContext()),
          user: null,
        });
        expect(await anonymous.search({})).toEqual([]);
        expect(fetchMock).not.toHaveBeenCalled();
      } finally {
        vi.unstubAllGlobals();
      }
    });
    it("keeps international vocabulary separate from Jordan registration and marketplace data", async () => {
      const db = await getDb();
      const catalog = await db.select().from(products);
      const prices = await db.select().from(officialMedicinePrices);
      const imported = await applyKnowledgeImport(3, {
        requestId: randomUUID(),
        sourceCode: "rxnorm",
        sourceVersion: "Fictional-Test-Version",
        permissionReference: null,
        records: [normalizeRxNorm("202433", properties, related)],
      });
      expect(imported.applied).toBe(1);
      expect(await (await caller()).search({})).toEqual([]);
      const international = await (
        await caller()
      ).search({ country: "international", q: "acetaminophen" });
      expect(international).toHaveLength(1);
      const detail = await (
        await caller()
      ).detail({ id: international[0].id, language: "ar" });
      expect(detail.registrations).toEqual([]);
      expect(detail.labels).toEqual([]);
      expect(detail.unknown).toMatchObject({
        jordanRegistration: true,
        jordanPrice: true,
        clinicalLabel: true,
      });
      expect(detail.source.code).toBe("rxnorm");
      expect(await db.select().from(products)).toEqual(catalog);
      expect(await db.select().from(officialMedicinePrices)).toEqual(prices);
      expect(await db.select().from(knowledgeRegistrations)).toEqual([]);
    });
    it("requires persisted admin authorization and never publishes structured country/clinical drafts", async () => {
      await expect(
        (await caller()).importStructured({
          ...structured(),
          requestId: randomUUID(),
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      const staleAdmin = await testContext(3);
      const db = await getDb();
      await db.update(users).set({ role: "user" }).where(eq(users.id, 3));
      await expect(
        medicationKnowledgeRouter
          .createCaller(staleAdmin)
          .importStructured({ ...structured(), requestId: randomUUID() })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await db.update(users).set({ role: "admin" }).where(eq(users.id, 3));
      const records = [
        manualRecord({
          registrations: [
            {
              country: "JO",
              authority: "Fictional source",
              sourceReference: "Test-only reference",
              registrationNumber: "Fictional",
              packageDescription: "Fictional package",
              priceJod: "1.500",
              priceAsOf: "2020-01-01T00:00:00Z",
              priceSourceReference: "Fictional old price",
            },
          ],
          labels: [
            {
              section: "warnings",
              language: "ar",
              content: "Fictional unreviewed text",
            },
          ],
        }),
      ];
      const result = await (
        await caller(3)
      ).importStructured({
        ...structured({ records }),
        requestId: randomUUID(),
      });
      expect(result.applied).toBe(1);
      expect(await (await caller()).search({ country: "JO" })).toEqual([]);
      expect(
        await (await caller()).search({ country: "international" })
      ).toEqual([]);
      const [draft] = await db.select().from(knowledgeDrugs);
      expect(draft.state).toBe("draft");
      await expect(
        (await caller()).detail({ id: draft.id })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      const [registration] = await db.select().from(knowledgeRegistrations);
      expect(registration.reviewState).toBe("draft");
    });
    it("deduplicates content, enforces retry hashes and preserves an auditable reversible version history", async () => {
      const input = {
        requestId: randomUUID(),
        sourceCode: "rxnorm" as const,
        sourceVersion: "Fictional-Test-Version",
        permissionReference: null,
        records: [normalizeRxNorm("202433", properties, related)],
      };
      const first = await applyKnowledgeImport(3, input);
      expect(await applyKnowledgeImport(3, input)).toEqual(first);
      const duplicate = await applyKnowledgeImport(3, {
        ...input,
        requestId: randomUUID(),
      });
      expect(duplicate.applied).toBe(0);
      expect(duplicate.skipped).toBe(1);
      await expect(
        applyKnowledgeImport(3, {
          ...input,
          records: [
            {
              ...input.records[0],
              names: [{ name: "Different", language: "en", kind: "brand" }],
            },
          ],
        })
      ).rejects.toMatchObject({ code: "CONFLICT" });
      const updated = await applyKnowledgeImport(3, {
        ...input,
        sourceVersion: "Fictional-New-Version",
        requestId: randomUUID(),
        records: [
          {
            ...input.records[0],
            names: [
              {
                name: "Updated fictional source name",
                language: "en",
                kind: "brand",
              },
            ],
          },
        ],
      });
      await expect(
        (await caller(3)).rollback({ batchId: first.batchId })
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await (await caller(3)).rollback({ batchId: updated.batchId });
      const rows = await (await caller()).search({ country: "international" });
      expect(rows[0].name).toBe("Tylenol");
      expect(
        (await (await caller()).detail({ id: rows[0].id })).source.version
      ).toBe("Fictional-Test-Version");
      const db = await getDb();
      expect(await db.select().from(knowledgeDrugVersions)).toHaveLength(3);
      expect(
        (await db.select().from(knowledgeImportBatches)).find(
          batch => batch.id === updated.batchId
        )?.status
      ).toBe("rolled_back");
    });
    it("rejects country claims under the RxNorm source and serializes concurrent idempotent imports", async () => {
      const row = normalizeRxNorm("202433", properties, related);
      const input = {
        requestId: randomUUID(),
        sourceCode: "rxnorm" as const,
        sourceVersion: "Fictional-Test-Version",
        permissionReference: null,
        records: [row],
      };
      const outcomes = await Promise.all(
        Array.from({ length: 4 }, () => applyKnowledgeImport(3, input))
      );
      expect(new Set(outcomes.map(result => result.batchId)).size).toBe(1);
      const registration = knowledgeRecordSchema.parse(
        manualRecord({
          registrations: [
            {
              country: "JO",
              authority: "Fictional authority",
              sourceReference: "Fictional source",
            },
          ],
        })
      ).registrations;
      await expect(
        applyKnowledgeImport(3, {
          ...input,
          requestId: randomUUID(),
          records: [{ ...row, registrations: registration }],
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(await (await caller()).search({ country: "JO" })).toEqual([]);
      expect(
        await (await getDb()).select().from(knowledgeImportBatches)
      ).toHaveLength(1);
    });
    it("separates the same external identifier across sources and treats search punctuation literally", async () => {
      const row = normalizeRxNorm("202433", properties, related);
      await applyKnowledgeImport(3, {
        requestId: randomUUID(),
        sourceCode: "rxnorm",
        sourceVersion: "Fictional-Test-Version",
        permissionReference: null,
        records: [row],
      });
      await (
        await caller(3)
      ).importStructured({
        requestId: randomUUID(),
        ...structured({
          records: [
            manualRecord({
              externalId: "202433",
              names: [
                { name: "Fictional JFDA claim", language: "ar", kind: "brand" },
              ],
              sourceReference: "Fictional local test only",
            }),
          ],
        }),
      });
      const rows = await (await caller()).search({ country: "international" });
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe("Tylenol");
      expect(await (await caller()).search({})).toEqual([]);
      expect(
        await (
          await caller()
        ).search({ country: "international", q: "' OR 1=1 --" })
      ).toEqual([]);
      expect(
        await (await caller()).search({ country: "international", q: "%" })
      ).toEqual([]);
      expect(await (await getDb()).select().from(knowledgeDrugs)).toHaveLength(
        2
      );
    });
    it("rolls back a new import to a tombstone and keeps audit records", async () => {
      const result = await applyKnowledgeImport(3, {
        requestId: randomUUID(),
        sourceCode: "rxnorm",
        sourceVersion: "Fictional-Test-Version",
        permissionReference: null,
        records: [normalizeRxNorm("202433", properties, related)],
      });
      await (await caller(3)).rollback({ batchId: result.batchId });
      expect(
        await (await caller()).search({ country: "international" })
      ).toEqual([]);
      const db = await getDb();
      expect((await db.select().from(knowledgeDrugs))[0].state).toBe("removed");
      expect(await db.select().from(knowledgeDrugVersions)).toHaveLength(2);
      expect(await db.select().from(knowledgeProductFacts)).toEqual([]);
      await expect(
        (await caller(3)).rollback({ batchId: result.batchId })
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });
  }
);
