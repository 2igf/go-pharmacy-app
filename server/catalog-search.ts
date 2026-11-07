import { and, asc, desc, eq, or, sql, type SQLWrapper } from "drizzle-orm";
import { z } from "zod";
import { products } from "../drizzle/schema";
import { getDb } from "./db";

export const catalogBrowseInput = z.object({
  query: z.string().trim().max(100).default(""),
  category: z
    .enum([
      "all",
      "medications",
      "medical_supplies",
      "natural_products",
      "skincare",
      "baby_care",
      "pet_care",
    ])
    .default("all"),
  sort: z.enum(["name", "price_low", "price_high"]).default("name"),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).max(100000).default(0),
});

// Keep the same Arabic folds on the term and the stored fields. This affects
// discovery only; product names, prices and prescription restrictions stay intact.
const arabicMarks = "[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]";
const arabicFolds = [
  ["أ", "ا"],
  ["إ", "ا"],
  ["آ", "ا"],
  ["ٱ", "ا"],
  ["ؤ", "و"],
  ["ئ", "ي"],
  ["ى", "ي"],
] as const;

export function normalizeCatalogSearch(value: string) {
  let normalized = value
    .normalize("NFC")
    .toLowerCase()
    .replace(new RegExp(arabicMarks, "g"), "");
  for (const [from, to] of arabicFolds)
    normalized = normalized.replaceAll(from, to);
  return normalized.trim();
}

export function escapeCatalogLike(value: string) {
  // A fixed explicit escape also works when MySQL uses NO_BACKSLASH_ESCAPES.
  return value.replace(/[!%_]/g, "!$&");
}

function searchableField(field: SQLWrapper) {
  let expression = sql`LOWER(REGEXP_REPLACE(COALESCE(${field}, ''), ${arabicMarks}, ''))`;
  for (const [from, to] of arabicFolds)
    expression = sql`REPLACE(${expression}, ${from}, ${to})`;
  // Binary comparison after LOWER avoids collation rules widening literal input.
  return sql`CONVERT(${expression} USING utf8mb4) COLLATE utf8mb4_bin`;
}

export async function browseCatalog(input: z.infer<typeof catalogBrowseInput>) {
  const db = await getDb();
  const term = normalizeCatalogSearch(input.query);
  const pattern = `%${escapeCatalogLike(term)}%`;
  const where = and(
    eq(products.isActive, true),
    input.category === "all"
      ? undefined
      : eq(products.category, input.category),
    term
      ? or(
          ...[
            products.name,
            products.manufacturer,
            products.description,
            products.activeIngredient,
          ].map(
            field => sql`${searchableField(field)} LIKE ${pattern} ESCAPE '!'`
          )
        )
      : undefined
  );
  const order =
    input.sort === "price_low"
      ? asc(products.price)
      : input.sort === "price_high"
        ? desc(products.price)
        : asc(products.name);
  // Fetch one extra row to expose another page without a separate full count.
  // The id tie-breaker prevents duplicates/skipped rows for equal names/prices.
  const rows = await db
    .select()
    .from(products)
    .where(where)
    .orderBy(order, asc(products.id))
    .limit(input.limit + 1)
    .offset(input.offset);
  return {
    items: rows.slice(0, input.limit),
    hasMore: rows.length > input.limit,
  };
}
