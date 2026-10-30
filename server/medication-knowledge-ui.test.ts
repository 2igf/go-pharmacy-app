import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  KnowledgeDetailContent,
  KnowledgeScopeNotice,
  type KnowledgeDetail,
} from "../client/src/pages/MedicationKnowledge";
import { NLM_ATTRIBUTION } from "../shared/medication-knowledge";
beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());
function fixture(overrides: Partial<KnowledgeDetail> = {}): KnowledgeDetail {
  return {
    id: 1,
    externalId: "161",
    name: "FICTIONAL ENGLISH SOURCE NAME",
    termType: "IN",
    version: 1,
    facts: {
      dosageForm: null,
      route: null,
      manufacturer: null,
      packageIdentifier: null,
      prescriptionStatus: null,
      imageReference: null,
      mediaRights: null,
      publicationDate: null,
      sourceUpdatedAt: null,
      mediaRightsVerified: false,
    },
    updatedAt: new Date("2026-10-29T00:00:00Z"),
    names: [
      {
        name: "FICTIONAL ENGLISH SOURCE NAME",
        kind: "generic",
        language: "en",
      },
    ],
    ingredients: [],
    registrations: [],
    labels: [],
    source: {
      code: "rxnorm",
      title: "RxNorm TEST FIXTURE",
      homepage: "https://rxnav.nlm.nih.gov/",
      termsReference: "https://lhncbc.nlm.nih.gov/RxNav/TermsofService.html",
      reference: "https://rxnav.nlm.nih.gov/REST/rxcui/161/properties.json",
      scope: "international_vocabulary",
      version: "TEST-ONLY-VERSION",
      importedAt: new Date("2026-10-29T00:00:00Z"),
      attribution: NLM_ATTRIBUTION,
    },
    unknown: {
      jordanRegistration: true,
      jordanPrice: true,
      clinicalLabel: true,
      localAvailability: true,
    },
    advisory: "TEST-ONLY advisory",
    ...overrides,
  };
}
describe("read-only medication knowledge presentation", () => {
  it("renders supplied product facts and reviewed description/interactions without inventing missing fields", () => {
    const data = fixture();
    data.facts.manufacturer = "FICTIONAL SOURCED MANUFACTURER";
    data.labels = [
      {
        section: "description",
        language: "en",
        content: "TEST REVIEWED DESCRIPTION",
        reviewedAt: new Date(),
      },
      {
        section: "interactions",
        language: "en",
        content: "TEST REVIEWED INTERACTIONS",
        reviewedAt: new Date(),
      },
    ];
    const html = renderToStaticMarkup(
      createElement(KnowledgeDetailContent, { data, language: "en" })
    );
    expect(html).toContain("FICTIONAL SOURCED MANUFACTURER");
    expect(html).toContain("وصف المصدر");
    expect(html).toContain("تداخلات المصدر");
    expect(html).not.toContain("<img");
  });
  it("does not expose URL credentials supplied in a source reference", () => {
    const data = fixture();
    data.source.reference =
      "https://source-user:private-source-password@example.test/path";
    const html = renderToStaticMarkup(
      createElement(KnowledgeDetailContent, { data, language: "en" })
    );
    expect(html).not.toContain("private-source-password");
    expect(html).not.toContain("source-user");
  });
  it("does not turn stale source prices into current Jordan prices", () => {
    const data = fixture({
      registrations: [
        {
          id: 1,
          drugId: 1,
          country: "JO",
          authority: "FICTIONAL TEST AUTHORITY",
          sourceReference: "FICTIONAL TEST REFERENCE",
          registrationNumber: "TEST-REGISTRATION",
          packageDescription: null,
          priceJod: "2.500",
          priceAsOf: new Date("2020-01-01T00:00:00Z"),
          priceSourceReference: "FICTIONAL OLD PRICE",
          reviewState: "verified",
          verifiedAt: new Date("2026-10-29T00:00:00Z"),
          priceState: "stale_or_unverified",
        },
      ],
    });
    const html = renderToStaticMarkup(
      createElement(KnowledgeDetailContent, { data, language: "ar" })
    );
    expect(html).toContain("السعر الأردني: غير معروف");
    expect(html).toContain("بيانات السعر قديمة أو غير موثقة");
    expect(html).not.toContain("2.500");
  });
  it("distinguishes verified Jordan scope from international vocabulary", () => {
    const jordan = renderToStaticMarkup(
      createElement(KnowledgeScopeNotice, { country: "JO" })
    );
    const global = renderToStaticMarkup(
      createElement(KnowledgeScopeNotice, { country: "international" })
    );
    expect(jordan).toContain("تسجيل أردني موثق");
    expect(global).toContain("لا يعني اعتماداً أو تسجيلاً في الأردن");
  });
  it("renders sparse source facts as unknown and preserves English names without an invented Arabic translation", () => {
    const html = renderToStaticMarkup(
      createElement(KnowledgeDetailContent, { data: fixture(), language: "ar" })
    );
    expect(html).toContain("FICTIONAL ENGLISH SOURCE NAME");
    expect(html).toContain("لا تتوفر ترجمة عربية موثقة");
    expect(html).toContain("الشكل الصيدلاني");
    expect(html).toContain("الشركة المصنّعة");
    expect(html).toContain("غير معروف");
    expect(html).toContain("السعر الأردني: غير معروف");
    expect(html).toContain("التوفر المحلي: غير معروف");
    expect(html).toContain("TEST-ONLY-VERSION");
    expect(html).toContain("NLM is not responsible");
    expect(html).toContain(
      'href="https://lhncbc.nlm.nih.gov/RxNav/TermsofService.html"'
    );
    expect(html).not.toContain("أضف إلى العربة");
  });
  it("does not display unreviewed, wrong-language, or dosing text", () => {
    const data = fixture({
      labels: [
        {
          section: "warnings",
          language: "ar",
          content: "REVIEWED SOURCE WARNING",
          reviewedAt: new Date("2026-10-29T00:00:00Z"),
        },
        {
          section: "warnings",
          language: "en",
          content: "WRONG LANGUAGE CONTENT",
          reviewedAt: new Date(),
        },
        {
          section: "side_effects",
          language: "ar",
          content: "UNREVIEWED CONTENT",
          reviewedAt: null,
        },
        {
          section: "dosage",
          language: "ar",
          content: "DOSING CONTENT",
          reviewedAt: new Date(),
        },
      ],
    });
    const html = renderToStaticMarkup(
      createElement(KnowledgeDetailContent, { data, language: "ar" })
    );
    expect(html).toContain("REVIEWED SOURCE WARNING");
    expect(html).not.toContain("WRONG LANGUAGE CONTENT");
    expect(html).not.toContain("UNREVIEWED CONTENT");
    expect(html).not.toContain("DOSING CONTENT");
  });
  it("prints unsafe source references as plain text without executable links", () => {
    const data = fixture();
    data.source.reference = "javascript:alert(1)";
    const html = renderToStaticMarkup(
      createElement(KnowledgeDetailContent, { data, language: "en" })
    );
    expect(html).toContain("javascript:alert(1)");
    expect(html).not.toContain('href="javascript:');
  });
});
