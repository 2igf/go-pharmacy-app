# Medication knowledge foundation

This is a reference directory, independent of the pharmacy marketplace. `products`, `pharmacyInventory`, `officialMedicinePrices`, carts and orders are neither joined into imported knowledge nor modified by any knowledge procedure. Existing `officialMedicinePrices` remains the commerce pricing authority tied to products and pricing jurisdictions. `knowledgeRegistrations.priceJod` is a separate, nullable historical source quote; it cannot set a selling price.

Migration 0009 extends the foundation without changing applied migration 0008. `knowledgeProductFacts` can actually represent source-entered dosage form, route, manufacturer, package identifier, prescription/OTC status, image reference/rights provenance, publication date and source update timestamp. Every absent fact defaults to `null`; RxNorm's limited adapter cannot assert any non-null fact from parsing a name. Structured facts stay private drafts and participate in immutable snapshots and rollback, including pre-0009 snapshots whose missing facts become unknown. Description and interaction label sections are stored as additional unreviewed original-language sections. HTTPS image references require rights provenance, but that assertion is **not** verified media permission: public `facts.mediaRightsVerified` is always false, and no image should be fetched/hotlinked/rendered until a separately authorized rights verification workflow exists.

## Available API

Public read-only queries:

- `medicationKnowledge.search({ q?, country?, limit? })`: `country` defaults to `JO`, which requires an explicitly verified Jordan registration on a published local record. `international` is an explicit separate scope for vocabulary records. Search matches stored names and ingredient names using bound literal strings. Maximum 50 results.
- `medicationKnowledge.detail({ id, language? })`: source external identifier, source/version/reference/terms, import update time, untranslated names, sourced ingredient relationships and explicit unknown fields. Drafts/tombstones return the same `NOT_FOUND` as missing records. Names stay in their original language; no automatic translation or country/clinical inference occurs.

Administrator procedures recheck the **persisted** platform role, including within write transactions:

- `previewStructured` (query): validate JSON/CSV and return draft preview, without persistence or publication.
- `importStructured` (mutation): explicit permission reference, UUID retry key and at most ten records. All imported records, country claims, prices and clinical sections remain drafts.
- `importRxNorm` (mutation): UUID retry key and at most ten distinct numeric RxCUIs. It accepts no URL, host, source authority, country registration or clinical payload.
- `batches` (query): latest 100 import audit records, excluding retry hashes.
- `rollback({ batchId })` (mutation): atomic restoration/tombstoning with retained immutable versions and rollback actor/time. A changed current version blocks rollback instead of overwriting a newer import. Repeated rollback is a conflict.

There is deliberately no public write endpoint, automatic bulk job, medical review grant, country-registration approval endpoint or clinical publication endpoint. An administrator's import permission is not qualified medical review. Future publication requires a separately authorized review workflow; changing a draft's status is outside this implementation.

## Normalization and provenance

Migration 0008 adds nine tables:

| Table                      | Responsibility                                                                                                        |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `knowledgeSources`         | Two fixed source definitions, terms and scope; also serialize operations per source                                   |
| `knowledgeImportBatches`   | Administrator, permission reference, source version, retry hash, counts and rollback audit                            |
| `knowledgeDrugs`           | Source-scoped external identifier, preferred name, current version and publication/tombstone state                    |
| `knowledgeNames`           | Generic, brand and synonym names with original language                                                               |
| `knowledgeIngredients`     | Immutable source-scoped ingredient identities/content revisions                                                       |
| `knowledgeDrugIngredients` | Explicit sourced relationships and optional source-entered strength text                                              |
| `knowledgeRegistrations`   | Country authority/reference, registration number, package text, nullable JOD quote/source/date and draft review state |
| `knowledgeLabelSections`   | Original-language sections, draft state and future qualified reviewer identity/time                                   |
| `knowledgeDrugVersions`    | Immutable normalized snapshots, original source version, import/rollback action and batch linkage                     |

Deduplication uses source + external identifier + normalized content hash. The first name remains preferred; secondary relationships are sorted for deterministic hashing. Identical content creates an audited skipped batch, not another content version. An identical UUID retry returns its original result. A reused retry key with changed content conflicts. External identifiers differing only by case are rejected on the current MySQL collation rather than silently overwriting one another.

Transactions lock the acting administrator and fixed source row, then update the normalized rows and version together. Public detail uses a repeatable-read transaction so an import/rollback cannot mix versions of names, ingredients and provenance in one response. Rollback only modifies knowledge rows; obsolete ingredients and immutable snapshots remain for provenance. It restores the original source version, not the version of the batch being undone. `updatedAt`/`source.importedAt` describe local application of that version, including rollback; they are not a claim that an upstream authority refreshed its data at that time.

RxNorm can never acquire country registrations, prices or clinical labels through this importer. Structured records use the separate `authorized_structured` source even when their external identifier happens to equal an RxCUI. A supplied permission reference is an administrator assertion retained for review, not independent license verification. A supplied authority name does not make a draft JFDA-approved.

Unknown prices are `null`. Public price rendering suppresses missing-source, undated, future-dated and more-than-365-day-old quotes. Even a displayed dated source quote is reference information, with its date and authority, rather than confirmation of current legal or marketplace price. Currently no structured draft can reach this public price path. Missing language, form, manufacturer, package, registration, label and availability facts must remain unknown.

## Limited lawful RxNorm adapter

Primary references inspected for this implementation:

- [RxNorm API documentation](https://lhncbc.nlm.nih.gov/RxNav/APIs/RxNormAPIs.html): non-proprietary RxNorm vocabulary, with the proprietary endpoint exception. This implementation does **not** call the proprietary API.
- [RxNav Terms of Service](https://lhncbc.nlm.nih.gov/RxNav/TermsofService.html): free access; maximum 20 requests/second/IP; recommended 12–24 hour cache; attribution and no NLM logo.
- [Concept properties](https://lhncbc.nlm.nih.gov/RxNav/APIs/api-RxNorm.getRxConceptProperties.html), [related types](https://lhncbc.nlm.nih.gov/RxNav/APIs/api-RxNorm.getRelatedByType.html) and [dataset version](https://lhncbc.nlm.nih.gov/RxNav/APIs/api-RxNorm.getRxNormVersion.html).

Only fixed HTTPS paths on `rxnav.nlm.nih.gov` are fetched: `/REST/version.json`, numeric `/REST/rxcui/{id}/properties.json`, and `/REST/rxcui/{id}/related.json?tty=IN+BN`. Redirects are refused, requests/body reads expire after ten seconds, responses are capped at 512 KB, and JSON/concept identity/language/suppression/type are validated. Calls are serialized with at least 100 ms between network starts, below the documented single-process limit. The bounded 200-entry cache retains successful responses for twelve hours. Multi-process deployments would require a shared rate limiter/cache before increasing concurrency.

The adapter preserves supplied generic/brand names and ingredient links. It does not parse a dose from a drug name, infer a brand's ingredients, translate labels, fetch a patient-specific recommendation, or infer Jordan registration/availability. Source attribution is returned for display via `NLM_ATTRIBUTION`; no NLM logo is added.

Real read-only endpoint inspection confirmed RxCUI `161` as acetaminophen (`IN`) and `202433` as Tylenol (`BN`) with related ingredient `161`. The authorized V2 evidence runner performs only this two-ID live import. Its sanitized result is `docs/evidence/v2/knowledge-live.json`. Run after disposable V2 fixtures exist:

```powershell
node --import tsx .local/v2/knowledge-import.ts
```

The private runner reads the existing `.local/v2/db.json` without printing credentials, refuses any database except a local `go_pharmacy_test_v2`, and requires the fictional `test:admin` fixture. It never resets fixtures. Final full regression runs against the separate `go_pharmacy_test_v2regression`, preserving this staging import and browser/native journey records. Network failure is reported as a failure, without a success claim.

## Authorized structured JSON / CSV

An authenticated administrator can preview this **fictional example**:

```ts
await caller.medicationKnowledge.previewStructured({
  format: "json",
  permissionReference:
    "Internal authorized document reference - fictional example",
  records: [
    {
      externalId: "fictional-item-1",
      names: [{ name: "Fictional example", language: "en", kind: "generic" }],
      ingredients: [],
      registrations: [],
      labels: [],
      sourceReference: "Authorized source document and page reference",
    },
  ],
});
```

Use `importStructured` with the same payload plus a new UUID `requestId` to persist an unreviewed draft. Registration objects accept `country`, `authority`, `sourceReference`, optional nullable `registrationNumber`, `packageDescription`, `priceJod`, `priceAsOf` and `priceSourceReference`. A non-null JOD quote requires `country: "JO"`, a source reference and an ISO timestamp. Draft clinical sections accept original `language`, a supported `section`, and source text; they are not published or translated.

CSV uses `{ format: "csv", permissionReference, csv }`, plus `requestId` for persistence. Required headers are `externalId,name,language,kind,sourceReference`; optional headers are `ingredientExternalId,ingredientName,country,authority,registrationNumber,packageDescription,priceJod,priceAsOf,priceSourceReference`. Quoted commas/newlines and escaped double quotes are supported. Duplicate/missing/unknown headers, malformed quoting, invalid field counts and duplicate identifiers are rejected. Maximum 100,000 characters and ten data records. No spreadsheet expressions execute and no URL in imported data is fetched.

## Jordan/JFDA discovery and current gate

An official API **does exist**: [Jordan Open Data package metadata](https://opendata.gov.jo/api/3/action/package_show?id=drug-prices-838-2021). The coordinator's saved response is `docs/evidence/v2/jordan-metadata.json`. It identifies the JFDA organization, a 2021 dataset and a `Drug2020` XLS resource whose metadata was last modified on 2025-07-16. These labels do not establish that prices/registrations are current.

The response has `license_id=JORDONIAN-DEFAULT`, but its license URL incorrectly points to Instagram. The [official Jordanian Open Government Data License page](https://opendata.gov.jo/en/pages/jordanian-open-government-data-license) supplied a heading without retrievable license terms during inspection. Automated JFDA ingestion therefore remains pending confirmation of current authoritative data and usable license terms/permission. No XLS was bulk imported and no fictional fixture is represented as a real Jordan registration.

## Verification

`server/medication-knowledge.integration.test.ts` covers normalization, sourced brand/ingredient mapping, malformed data, CSV, unknown/stale prices, upstream failure/caps, fixed allowlisted paths/cache, source/country separation, literal search, role revalidation, denied public writes, duplicate/retry/concurrent imports, immutable history and rollback protection. Without `TEST_DATABASE_URL`, only no-database cases run. Database cases require the authorized disposable V2 clone and migration 0008.
