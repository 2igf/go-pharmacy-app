import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  knowledgeRecordSchema,
  rxNormImportSchema,
  type KnowledgeRecord,
} from "../../shared/medication-knowledge";

const concept = z.object({
  rxcui: z.string().regex(/^[1-9]\d{0,8}$/),
  name: z.string().min(1).max(500),
  tty: z.string(),
  language: z.literal("ENG"),
  suppress: z.literal("N"),
  synonym: z.string().max(500).optional(),
});
const types = [
  "IN",
  "PIN",
  "MIN",
  "BN",
  "SCD",
  "SBD",
  "SCDF",
  "SBDF",
  "SCDC",
  "SBDC",
];
export function normalizeRxNorm(
  id: string,
  propertiesValue: unknown,
  relatedValue: unknown,
  attributesValue?: unknown,
  formsValue?: unknown
): KnowledgeRecord {
  const properties = z
    .object({ properties: concept })
    .parse(propertiesValue).properties;
  if (properties.rxcui !== id || !types.includes(properties.tty))
    throw new Error("Unsupported RxNorm concept");
  const related = z
    .object({
      relatedGroup: z
        .object({
          conceptGroup: z
            .array(
              z.object({
                tty: z.string(),
                conceptProperties: z.array(concept).max(100).optional(),
              })
            )
            .max(20)
            .optional(),
        })
        .optional(),
    })
    .parse(relatedValue);
  const concepts =
    related.relatedGroup?.conceptGroup?.flatMap(
      group => group.conceptProperties ?? []
    ) ?? [];
  const ingredients =
    properties.tty === "IN"
      ? [properties]
      : concepts.filter(item => item.tty === "IN");
  const branded = properties.tty.startsWith("SB") || properties.tty === "BN";
  const attributes = attributesValue === undefined ? [] : z.object({propConceptGroup:z.object({propConcept:z.array(z.object({propCategory:z.string(),propName:z.string(),propValue:z.string().max(500)})).max(100)}).optional()}).parse(attributesValue).propConceptGroup?.propConcept ?? [];
  const strengths = attributes.filter(p => p.propCategory === "ATTRIBUTES" && p.propName === "AVAILABLE_STRENGTH").map(p => p.propValue);
  const forms = formsValue === undefined ? [] : z.object({relatedGroup:z.object({conceptGroup:z.array(z.object({tty:z.string(),conceptProperties:z.array(concept).max(30).optional()})).optional()}).optional()}).parse(formsValue).relatedGroup?.conceptGroup?.flatMap(g=>g.tty === "DF" ? g.conceptProperties ?? [] : []) ?? [];
  const names: KnowledgeRecord["names"] = [
    {
      name: properties.name,
      language: "en",
      kind: branded ? "brand" : "generic",
    },
  ];
  if (properties.synonym && properties.synonym !== properties.name)
    names.push({ name: properties.synonym, language: "en", kind: "synonym" });
  // Related brand concepts remain explicitly sourced brand names; no string parsing or inferred translation.
  for (const item of concepts.filter(item => item.tty === "BN"))
    if (!names.some(name => name.name === item.name))
      names.push({ name: item.name, language: "en", kind: "brand" });
  return knowledgeRecordSchema.parse({
    externalId: id,
    termType: properties.tty,
    facts: { dosageForm: forms.length === 1 ? forms[0].name : null },
    names,
    ingredients: [
      ...new Map(
        ingredients.map(item => [
          item.rxcui,
          {
            externalId: item.rxcui,
            name: item.name,
            language: "en",
            strength: ingredients.length === 1 && strengths.length === 1 ? strengths[0] : null,
          },
        ])
      ).values(),
    ],
    registrations: [],
    labels: [],
    sourceReference: `https://rxnav.nlm.nih.gov/REST/rxcui/${id}/properties.json`,
  });
}
const cache = new Map<string, { expires: number; value: unknown }>();
let queue: Promise<unknown> = Promise.resolve();
let lastRequest = 0;
export function clearRxNormCache() {
  cache.clear();
}
async function fetchJson(path: string): Promise<unknown> {
  if (
    !/^(?:version\.json|rxcui\/[1-9]\d{0,8}\/(?:properties\.json|related\.json\?tty=(?:IN\+BN|DF)|allProperties\.json\?prop=attributes))$/.test(
      path
    )
  )
    throw new Error("Invalid RxNorm path");
  const cached = cache.get(path);
  if (cached && cached.expires > Date.now()) return cached.value;
  const request = queue.then(async () => {
    const cachedAgain = cache.get(path);
    if (cachedAgain && cachedAgain.expires > Date.now())
      return cachedAgain.value;
    await new Promise(resolve =>
      setTimeout(resolve, Math.max(0, 100 - (Date.now() - lastRequest)))
    );
    lastRequest = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(`https://rxnav.nlm.nih.gov/REST/${path}`, {
        redirect: "error",
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (
        !response.ok ||
        !response.headers.get("content-type")?.includes("application/json")
      )
        throw new Error("RxNorm response unavailable");
      if (
        Number(response.headers.get("content-length") ?? 0) > 512000 ||
        !response.body
      )
        throw new Error("RxNorm response too large");
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > 512000) {
          await reader.cancel();
          throw new Error("RxNorm response too large");
        }
        chunks.push(part.value);
      }
      const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (cache.size >= 200) cache.delete(cache.keys().next().value!);
      cache.set(path, { expires: Date.now() + 12 * 3600000, value: data });
      return data;
    } finally {
      clearTimeout(timer);
    }
  });
  queue = request.catch(() => undefined);
  return request;
}
export async function fetchRxNormRecords(ids: string[]) {
  rxNormImportSchema.shape.ids.parse(ids);
  try {
    const version = z
      .object({ version: z.string().min(1).max(128) })
      .parse(await fetchJson("version.json")).version;
    const records: KnowledgeRecord[] = [];
    for (const id of ids) {
      const properties = await fetchJson(`rxcui/${id}/properties.json`);
      const parsed = z
        .object({ properties: concept })
        .parse(properties).properties;
      const related =
        parsed.tty === "IN"
          ? {}
          : await fetchJson(`rxcui/${id}/related.json?tty=IN+BN`);
      const product = ["SCD", "SBD"].includes(parsed.tty);
      const attributes = product ? await fetchJson(`rxcui/${id}/allProperties.json?prop=attributes`) : undefined;
      const forms = product ? await fetchJson(`rxcui/${id}/related.json?tty=DF`) : undefined;
      records.push(normalizeRxNorm(id, properties, related, attributes, forms));
    }
    return { sourceVersion: version, records };
  } catch {
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message:
        "RxNorm import unavailable or upstream data invalid. No records were imported.",
    });
  }
}
