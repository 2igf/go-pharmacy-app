import { z } from "zod";
export const HISTORICAL_CATALOG_SOURCE = "jordan_package_2021" as const;
const sourceUrl = z
  .string()
  .url()
  .max(500)
  .refine(v => {
    const u = new URL(v);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      ["opendata.gov.jo", "dailymed.nlm.nih.gov"].includes(u.hostname)
    );
  });
const sourceDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(v => {
    const d = new Date(v + "T00:00:00Z");
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
  });
const historicalPrice = z
  .string()
  .regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/)
  .nullable();
export const historicalCatalogSchema = z
  .object({
    datasetId: z.literal("jordan_medicines_1000"),
    productId: z.string().regex(/^JO-MED-\d{4}$/),
    barcode: z
      .string()
      .regex(/^\d{1,32}$/)
      .nullable(),
    barcodeStatus: z.enum([
      "valid_gtin",
      "invalid_checksum",
      "non_gtin",
      "missing",
    ]),
    atcCode: z.string().max(32).nullable(),
    therapeuticCategory: z.string().min(1).max(500),
    packageSize: z.string().max(500),
    supplierAr: z.string().max(500),
    supplierEn: z.string().max(500),
    publicPriceHistoricalJod: historicalPrice,
    hospitalPriceHistoricalJod: historicalPrice,
    priceSourceYear: z.literal("2021"),
    priceSourceUrl: sourceUrl,
    listSourceUrl: sourceUrl,
    sourceDate,
    lastChecked: sourceDate,
    sourceClaim: z.string().max(500),
    listMembershipClaim: z.string().max(500).optional(),
    clinicalClaim: z.string().max(500).optional(),
    prescriptionStatusClaim: z.string().max(500).optional(),
    availabilityStatusClaim: z.string().max(500).optional(),
    clinicalSourceUrl: sourceUrl.nullable(),
    clinicalLabelDate: z.string().max(80).nullable(),
    currentRegistration: z.literal("unverified"),
    medicalReview: z.literal("unreviewed"),
    reuseStatus: z.literal("pending"),
    clinicalTextsExcluded: z.literal(true),
    rowSha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type HistoricalCatalog = z.infer<typeof historicalCatalogSchema>;
