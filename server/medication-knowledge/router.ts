import { z } from "zod";
import { desc } from "drizzle-orm";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import {
  publicKnowledgeSearchSchema,
  structuredPreviewSchema,
  structuredImportSchema,
  rxNormImportSchema,
} from "../../shared/medication-knowledge";
import { knowledgeImportBatches } from "../../drizzle/medication-knowledge";
import { getDb } from "../db";
import {
  applyKnowledgeImport,
  knowledgeDetail,
  requireKnowledgeAdmin,
  rollbackKnowledgeImport,
  searchKnowledge,
} from "./repository";
import { parseStructuredPayload } from "./structured";
import { fetchRxNormRecords } from "./rxnorm";

const knowledgeAdmin = adminProcedure.use(async ({ ctx, next }) => {
  await requireKnowledgeAdmin(await getDb(), ctx.user.id);
  return next({ ctx });
});
export const medicationKnowledgeRouter = router({
  search: publicProcedure
    .input(publicKnowledgeSearchSchema)
    .query(({ input }) => searchKnowledge(input)),
  detail: publicProcedure
    .input(
      z
        .object({
          id: z.number().int().positive(),
          language: z.enum(["ar", "en"]).default("ar"),
        })
        .strict()
    )
    .query(({ input }) => knowledgeDetail(input.id, input.language)),
  previewStructured: knowledgeAdmin
    .input(structuredPreviewSchema)
    .query(({ input }) => {
      const records = parseStructuredPayload(input);
      return {
        count: records.length,
        state: "draft" as const,
        records,
        permissionReference: input.permissionReference,
        warning:
          "Unreviewed draft only. No country registration, price or clinical publication is authorized by this preview.",
      };
    }),
  importStructured: knowledgeAdmin
    .input(structuredImportSchema)
    .mutation(({ ctx, input }) => {
      const { requestId, ...payload } = input;
      return applyKnowledgeImport(ctx.user.id, {
        requestId,
        sourceCode: "authorized_structured",
        sourceVersion: null,
        permissionReference: input.permissionReference,
        records: parseStructuredPayload(payload),
      });
    }),
  importRxNorm: knowledgeAdmin
    .input(rxNormImportSchema)
    .mutation(async ({ ctx, input }) => {
      const fetched = await fetchRxNormRecords(input.ids);
      return applyKnowledgeImport(ctx.user.id, {
        requestId: input.requestId,
        sourceCode: "rxnorm",
        permissionReference: null,
        ...fetched,
      });
    }),
  batches: knowledgeAdmin.query(async () => {
    const db = await getDb();
    return db
      .select({
        id: knowledgeImportBatches.id,
        sourceId: knowledgeImportBatches.sourceId,
        actorId: knowledgeImportBatches.actorId,
        sourceVersion: knowledgeImportBatches.sourceVersion,
        permissionReference: knowledgeImportBatches.permissionReference,
        status: knowledgeImportBatches.status,
        applied: knowledgeImportBatches.applied,
        skipped: knowledgeImportBatches.skipped,
        createdAt: knowledgeImportBatches.createdAt,
        rolledBackAt: knowledgeImportBatches.rolledBackAt,
        rolledBackBy: knowledgeImportBatches.rolledBackBy,
      })
      .from(knowledgeImportBatches)
      .orderBy(desc(knowledgeImportBatches.id))
      .limit(100);
  }),
  rollback: knowledgeAdmin
    .input(z.object({ batchId: z.number().int().positive() }).strict())
    .mutation(({ ctx, input }) =>
      rollbackKnowledgeImport(ctx.user.id, input.batchId)
    ),
});
