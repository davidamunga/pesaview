import type { ExtractOptions, ExtractedTable } from "@/types";
import { parseTabulaTables } from "./detectTables";

const MASHED = /^([\d,]+\.\d{2})(([\d,]+\.\d{2})\s*[CD]r)$/i;
const DEFAULT_SKIP = ["page total", "grand total", "note:"];

export function splitMashedAmounts(text: string): string[] {
  const trimmed = text.replace(/\s+/g, " ").trim();
  const mashed = trimmed.match(MASHED);
  if (mashed) {
    return [mashed[1], mashed[2].replace(/\s+/g, " ")];
  }
  return [trimmed];
}

function cellText(cell: { text?: string } | string | null | undefined): string[] {
  if (cell == null) return [""];
  const raw = typeof cell === "string" ? cell : (cell.text ?? "");
  return splitMashedAmounts(raw.trim());
}

function looksLikeHeader(row: string[]): boolean {
  if (row.length === 0) return false;
  const nonempty = row.filter(Boolean);
  if (nonempty.length === 0) return false;
  const numeric = nonempty.filter((value) => /^-?[\d,.]+$/.test(value)).length;
  return numeric / nonempty.length < 0.5;
}

function shouldSkip(row: string[], extra: string[] = []): boolean {
  const line = row.join(" ").toLowerCase();
  return [...DEFAULT_SKIP, ...extra.map((value) => value.toLowerCase())].some((pattern) =>
    line.includes(pattern),
  );
}

const DATE =
  /(?:\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/;
const AMOUNT = /^-?[\d,]+\.\d{2}(?:\s*[CD]r)?$/i;
const LEADING_ID = /^[A-Z]{1,5}[A-Z0-9]*\d[A-Z0-9]*$/i;

export function hasRowAnchor(row: string[]): boolean {
  if (row.some((cell) => DATE.test(cell) || AMOUNT.test(cell.trim()))) {
    return true;
  }
  const lead = row[0]?.trim() ?? "";
  return lead.length >= 8 && lead.length <= 14 && LEADING_ID.test(lead);
}

export function mergeContinuationRows(rows: string[][]): string[][] {
  const merged: string[][] = [];
  for (const row of rows) {
    if (merged.length > 0 && !hasRowAnchor(row) && row.some((cell) => cell.trim().length > 0)) {
      const previous = merged[merged.length - 1];
      for (let index = 0; index < row.length; index += 1) {
        const extra = row[index]?.trim();
        if (!extra) continue;
        const current = previous[index]?.trim() ?? "";
        previous[index] = current ? `${current} ${extra}` : extra;
      }
      continue;
    }
    merged.push([...row]);
  }
  return merged;
}

export function tablesFromTabulaJson(raw: string, options: ExtractOptions = {}): ExtractedTable[] {
  return parseTabulaTables(raw)
    .map((table) => {
      const rawRows = (table.data ?? []).map((row) => (row ?? []).flatMap((cell) => cellText(cell)));
      const nonempty = rawRows
        .filter((row) => row.some((cell) => cell.length > 0))
        .filter((row) => !shouldSkip(row, options.skipRows));
      if (nonempty.length === 0) {
        return null;
      }

      const header = looksLikeHeader(nonempty[0])
        ? nonempty[0]
        : nonempty[0].map((_, i) => `Column ${i + 1}`);
      const body = looksLikeHeader(nonempty[0]) ? nonempty.slice(1) : nonempty;
      const width = Math.max(header.length, ...body.map((row) => row.length), 1);
      const columns =
        options.columns && options.columns.length === width ? options.columns : padRow(header, width);
      const padded = body.map((row) => padRow(row, width));
      const rows = options.mergeRows === false ? padded : mergeContinuationRows(padded);

      return {
        page: table.page && table.page > 0 ? table.page : 1,
        columns,
        rows,
      } satisfies ExtractedTable;
    })
    .filter((table): table is ExtractedTable => table != null);
}

function padRow(row: string[], width: number): string[] {
  return Array.from({ length: width }, (_, i) => row[i] ?? "");
}

export function flattenTables(tables: ExtractedTable[]): { columns: string[]; rows: string[][] } {
  if (tables.length === 0) {
    return { columns: [], rows: [] };
  }
  if (tables.length === 1) {
    return { columns: tables[0].columns, rows: tables[0].rows };
  }

  const columns = tables[0].columns;
  const rows: string[][] = [];
  for (const table of tables) {
    if (rows.length > 0) {
      rows.push(columns.map(() => ""));
    }
    rows.push(...table.rows.map((row) => padRow(row, columns.length)));
  }
  return { columns, rows };
}
