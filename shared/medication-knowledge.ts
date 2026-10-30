import { z } from "zod";

const externalId = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9._:-]+$/);
const language = z.enum(["ar", "en"]);
const reference = z.string().trim().min(3).max(500);
const nullableFact = z.string().trim().min(1).max(500).nullable().default(null);
export const knowledgeFactsSchema = z
  .object({
    dosageForm: nullableFact,
    route: nullableFact,
    manufacturer: nullableFact,
    packageIdentifier: nullableFact,
    prescriptionStatus: z
      .enum(["prescription", "otc"])
      .nullable()
      .default(null),
    imageReference: z
      .string()
      .max(500)
      .refine(value => {
        try {
          const url = new URL(value);
          return url.protocol === "https:" && !url.username && !url.password;
        } catch {
          return false;
        }
      }, "Image references require a safe HTTPS URL")
      .nullable()
      .default(null),
    mediaRights: reference.nullable().default(null),
    publicationDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(value => {
        const parsed = new Date(`${value}T00:00:00Z`);
        return (
          Number.isFinite(parsed.getTime()) &&
          parsed.toISOString().slice(0, 10) === value
        );
      }, "Invalid publication date")
      .nullable()
      .default(null),
    sourceUpdatedAt: z.iso.datetime().nullable().default(null),
  })
  .strict()
  .refine(
    value => value.imageReference === null || value.mediaRights !== null,
    "Image references require explicit media rights provenance"
  );
export type KnowledgeFacts = z.output<typeof knowledgeFactsSchema>;
export const knowledgeRecordSchema = z
  .object({
    externalId,
    termType: z.string().max(12).default("manual"),
    facts: knowledgeFactsSchema.default(() => knowledgeFactsSchema.parse({})),
    names: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(500),
            language,
            kind: z.enum(["generic", "brand", "synonym"]),
          })
          .strict()
      )
      .min(1)
      .max(30),
    ingredients: z
      .array(
        z
          .object({
            externalId,
            name: z.string().trim().min(1).max(500),
            language,
            strength: z.string().max(120).nullable().default(null),
          })
          .strict()
      )
      .max(30)
      .default([]),
    registrations: z
      .array(
        z
          .object({
            country: z.string().regex(/^[A-Z]{2}$/),
            authority: z.string().trim().min(3).max(200),
            sourceReference: reference,
            registrationNumber: z.string().max(120).nullable().default(null),
            packageDescription: z.string().max(500).nullable().default(null),
            priceJod: z
              .string()
              .regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/)
              .nullable()
              .default(null),
            priceAsOf: z.iso.datetime().nullable().default(null),
            priceSourceReference: reference.nullable().default(null),
          })
          .strict()
          .refine(
            row =>
              row.priceJod === null ||
              (row.country === "JO" &&
                row.priceAsOf !== null &&
                row.priceSourceReference !== null),
            "A JOD price needs a Jordan source reference and timestamp"
          )
      )
      .max(20)
      .default([]),
    labels: z
      .array(
        z
          .object({
            section: z.enum([
              "indications",
              "dosage",
              "warnings",
              "side_effects",
              "contraindications",
              "description",
              "interactions",
            ]),
            language,
            content: z.string().trim().min(1).max(6000),
          })
          .strict()
      )
      .max(10)
      .default([]),
    sourceReference: reference,
  })
  .strict();
export type KnowledgeRecord = z.output<typeof knowledgeRecordSchema>;
export const publicKnowledgeSearchSchema = z
  .object({
    q: z.string().trim().max(100).default(""),
    country: z.enum(["JO", "international"]).default("JO"),
    limit: z.number().int().min(1).max(50).default(20),
  })
  .strict();
const permissionReference = reference;
const jsonFields = {
  format: z.literal("json"),
  permissionReference,
  records: z.array(knowledgeRecordSchema).min(1).max(10),
};
const csvFields = {
  format: z.literal("csv"),
  permissionReference,
  csv: z.string().min(1).max(100000),
};
export const structuredPreviewSchema = z.discriminatedUnion("format", [
  z.object(jsonFields).strict(),
  z.object(csvFields).strict(),
]);
export const structuredImportSchema = z.discriminatedUnion("format", [
  z.object({ ...jsonFields, requestId: z.uuid() }).strict(),
  z.object({ ...csvFields, requestId: z.uuid() }).strict(),
]);
export const rxNormImportSchema = z
  .object({
    requestId: z.uuid(),
    ids: z
      .array(z.string().regex(/^[1-9]\d{0,8}$/))
      .min(1)
      .max(10)
      .refine(ids => new Set(ids).size === ids.length),
  })
  .strict();
export const NLM_ATTRIBUTION =
  "This product uses publicly available data from the U.S. National Library of Medicine (NLM), National Institutes of Health, Department of Health and Human Services; NLM is not responsible for the product and does not endorse or recommend this or any other product.";
