import { TRPCError } from "@trpc/server";
import {
  knowledgeRecordSchema,
  structuredPreviewSchema,
} from "../../shared/medication-knowledge";

export function csvRows(text: string, maxRecords = 10): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let closedQuote = false;
  for (let i = 0; i < text.length; i++) {
    const character = text[i];
    if (closedQuote && ![",", "\n", "\r", " ", "\t"].includes(character))
      throw new Error("Invalid content after quoted CSV cell");
    if (character === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (quoted) {
        quoted = false;
        closedQuote = true;
      } else if (!cell && !closedQuote) quoted = true;
      else throw new Error("Malformed CSV quoting");
    } else if (!quoted && (character === "," || character === "\n")) {
      row.push(cell.replace(/\r$/, ""));
      cell = "";
      closedQuote = false;
      if (character === "\n") {
        rows.push(row);
        if (rows.length > maxRecords + 1)
          throw new Error("CSV row limit exceeded");
        row = [];
      }
    } else if (!closedQuote) cell += character;
  }
  if (quoted) throw new Error("Unclosed CSV quotation");
  row.push(cell.replace(/\r$/, ""));
  if (row.some(value => value.length)) rows.push(row);
  if (rows.length > maxRecords + 1) throw new Error("CSV row limit exceeded");
  return rows;
}
export function parseStructuredPayload(value: unknown) {
  try {
    const input = structuredPreviewSchema.parse(value);
    let records;
    if (input.format === "json") records = input.records;
    else {
      const [headers, ...rows] = csvRows(input.csv);
      const permitted = [
        "externalId",
        "name",
        "language",
        "kind",
        "sourceReference",
        "ingredientExternalId",
        "ingredientName",
        "country",
        "authority",
        "registrationNumber",
        "packageDescription",
        "priceJod",
        "priceAsOf",
        "priceSourceReference",
      ];
      if (
        !headers ||
        new Set(headers).size !== headers.length ||
        headers.some(header => !permitted.includes(header)) ||
        ["externalId", "name", "language", "kind", "sourceReference"].some(
          header => !headers.includes(header)
        )
      )
        throw new Error("Invalid CSV headers");
      records = rows.map(row => {
        if (row.length !== headers.length)
          throw new Error("Invalid CSV column count");
        const item = Object.fromEntries(
          headers.map((header, index) => [header, row[index].trim()])
        );
        return knowledgeRecordSchema.parse({
          externalId: item.externalId,
          sourceReference: item.sourceReference,
          names: [
            { name: item.name, language: item.language, kind: item.kind },
          ],
          ingredients:
            item.ingredientExternalId || item.ingredientName
              ? [
                  {
                    externalId: item.ingredientExternalId,
                    name: item.ingredientName,
                    language: item.language,
                    strength: null,
                  },
                ]
              : [],
          registrations: item.country
            ? [
                {
                  country: item.country,
                  authority: item.authority,
                  sourceReference: item.sourceReference,
                  registrationNumber: item.registrationNumber || null,
                  packageDescription: item.packageDescription || null,
                  priceJod: item.priceJod || null,
                  priceAsOf: item.priceAsOf || null,
                  priceSourceReference: item.priceSourceReference || null,
                },
              ]
            : [],
          labels: [],
        });
      });
    }
    if (
      !records.length ||
      new Set(records.map(row => row.externalId)).size !== records.length
    )
      throw new Error("Duplicate source identifiers");
    return records;
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Invalid structured import. Check fields, source references and permissions; maximum ten distinct records.",
    });
  }
}
