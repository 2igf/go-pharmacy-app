import { createHash } from "node:crypto";
import {
  knowledgeRecordSchema,
  type KnowledgeRecord,
} from "../../shared/medication-knowledge";
import { csvRows } from "./structured";

const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function barcodeStatus(value: string) {
  if (!value) return "missing" as const;
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(value))
    return "non_gtin" as const;
  const digits = [...value].map(Number),
    check = digits.pop()!;
  const total = digits
    .reverse()
    .reduce((n, d, i) => n + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (total % 10)) % 10 === check
    ? ("valid_gtin" as const)
    : ("invalid_checksum" as const);
}
const normalized = (v: string) =>
  v.normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");
const lang = (v: string): "ar" | "en" =>
  /[\u0600-\u06ff]/.test(v) ? "ar" : "en";
export type RowIssue = { row: number; productId: string; reasons: string[] };

/** Maps nonclinical source facts only. Input documents and verification claims are untrusted. */
export function prepareJordanCatalog(csv: string) {
  if (Buffer.byteLength(csv, "utf8") > 4_000_000)
    throw new Error("CSV exceeds bounded package size");
  const [headers, ...data] = csvRows(csv.replace(/^\uFEFF/, ""), 1000);
  const required = [
    "product_id",
    "barcode",
    "trade_name",
    "generic_name",
    "strength",
    "dosage_form",
    "package_size",
    "route",
    "manufacturer_or_agent_ar",
    "manufacturer_or_agent_en",
    "therapeutic_category",
    "atc_code",
    "public_price_jod",
    "hospital_price_jod",
    "price_source_year",
    "price_source_url",
    "jfda_list_source_url",
    "source_date",
    "last_checked",
    "verification_status",
    "clinical_source_url",
    "clinical_label_date",
  ];
  if (
    !headers ||
    new Set(headers).size !== headers.length ||
    required.some(k => !headers.includes(k))
  )
    throw new Error("Invalid catalog CSV headers");
  const records: KnowledgeRecord[] = [],
    rejected: RowIssue[] = [],
    warnings: RowIssue[] = [];
  const ids = new Set<string>(),
    identities = new Map<string, string>(),
    barcodes = new Map<string, string>();
  const potentialDuplicates: {
    productId: string;
    otherProductId: string;
    reason: string;
  }[] = [];
  data.forEach((values, index) => {
    const rowNumber = index + 2;
    if (values.length !== headers.length) {
      rejected.push({
        row: rowNumber,
        productId: "",
        reasons: ["column_count"],
      });
      return;
    }
    const original = Object.fromEntries(
      headers.map((key, i) => [key, values[i]])
    );
    const row = Object.fromEntries(
      headers.map(key => [key, original[key].trim()])
    );
    const reasons: string[] = [];
    if (ids.has(row.product_id)) reasons.push("duplicate_product_id");
    ids.add(row.product_id);
    if (
      !row.trade_name ||
      !row.generic_name ||
      !row.dosage_form ||
      !row.therapeutic_category
    )
      reasons.push("missing_identity_or_classification");
    if (row.barcode && !/^\d+$/.test(row.barcode))
      reasons.push("nondigit_barcode");
    const identity = [
      row.trade_name,
      row.generic_name,
      row.strength,
      row.dosage_form,
      row.package_size,
    ]
      .map(normalized)
      .join("|");
    const prior = identities.get(identity);
    if (prior)
      potentialDuplicates.push({
        productId: row.product_id,
        otherProductId: prior,
        reason: "same_name_ingredient_strength_form_package",
      });
    if (row.barcode && barcodes.has(row.barcode))
      potentialDuplicates.push({
        productId: row.product_id,
        otherProductId: barcodes.get(row.barcode)!,
        reason: "same_barcode",
      });
    // Do not merge ambiguous packages/agents just because their names match.
    identities.set(identity, row.product_id);
    if (row.barcode) barcodes.set(row.barcode, row.product_id);
    const status = barcodeStatus(row.barcode);
    const notes: string[] = [];
    if (status !== "valid_gtin") notes.push("barcode_" + status);
    if (!row.strength) notes.push("strength_missing");
    if (!row.atc_code) notes.push("atc_missing");
    else if (
      !/^[A-Z](?:\d{2}(?:[A-Z](?:[A-Z](?:\d{2})?)?)?)?$/.test(row.atc_code)
    )
      notes.push("atc_nonstandard");
    if (original.atc_code !== row.atc_code)
      notes.push("atc_whitespace_trimmed");
    try {
      const record = knowledgeRecordSchema.parse({
        externalId: row.product_id,
        termType: "JO_PACKAGE",
        sourceReference: row.price_source_url,
        names: [
          {
            name: row.trade_name,
            language: lang(row.trade_name),
            kind: "brand",
          },
          ...(row.generic_name === row.trade_name
            ? []
            : [
                {
                  name: row.generic_name,
                  language: lang(row.generic_name),
                  kind: "generic",
                },
              ]),
        ],
        ingredients: [
          {
            externalId:
              "package-generic-" +
              digest(normalized(row.generic_name)).slice(0, 40),
            name: row.generic_name,
            language: lang(row.generic_name),
            strength: row.strength || null,
          },
        ],
        facts: { dosageForm: row.dosage_form, route: row.route || null },
        labels: [],
        registrations: [],
        historicalCatalog: {
          datasetId: "jordan_medicines_1000",
          productId: row.product_id,
          barcode: row.barcode || null,
          barcodeStatus: status,
          atcCode: row.atc_code || null,
          therapeuticCategory: row.therapeutic_category,
          packageSize: row.package_size,
          supplierAr: row.manufacturer_or_agent_ar,
          supplierEn: row.manufacturer_or_agent_en,
          publicPriceHistoricalJod: row.public_price_jod || null,
          hospitalPriceHistoricalJod: row.hospital_price_jod || null,
          priceSourceYear: row.price_source_year,
          priceSourceUrl: row.price_source_url,
          listSourceUrl: row.jfda_list_source_url,
          sourceDate: row.source_date,
          lastChecked: row.last_checked,
          sourceClaim: row.verification_status,
          listMembershipClaim: row.source_list_membership ?? "",
          clinicalClaim: row.clinical_verification_status ?? "",
          prescriptionStatusClaim: row.prescription_status ?? "",
          availabilityStatusClaim: row.availability_status ?? "",
          clinicalSourceUrl: row.clinical_source_url || null,
          clinicalLabelDate: row.clinical_label_date || null,
          currentRegistration: "unverified",
          medicalReview: "unreviewed",
          reuseStatus: "pending",
          clinicalTextsExcluded: true,
          rowSha256: digest(original),
        },
      });
      if (!reasons.length) records.push(record);
    } catch {
      reasons.push("invalid_or_unsafe_source_field");
    }
    if (reasons.length)
      rejected.push({ row: rowNumber, productId: row.product_id, reasons });
    if (notes.length)
      warnings.push({
        row: rowNumber,
        productId: row.product_id,
        reasons: notes,
      });
  });
  return {
    sourceRows: data.length,
    records,
    rejected,
    warnings,
    potentialDuplicates,
    excludedFields: headers.filter(k =>
      /^(indication_|usage_|standard_dose_|warnings_)/.test(k)
    ),
    note: "Source claims are not independent verification; clinical/derived Arabic text excluded; package facts only, no marketplace writes",
  };
}
