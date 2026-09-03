import type { ExtractOptions, ExtractedTable } from "@/types";
import { parseTabulaTables, type TabulaCell, type TabulaTable } from "./detectTables";

const MASHED = /^([\d,]+\.\d{2})([\d,]+\.\d{2}.*)$/;
const DEFAULT_SKIP = ["page total", "grand total", "note:"];
const RULE_SUFFIX = /\s*[-–—_=]{3,}\s*$/;

export function splitMashedAmounts(text: string): string[] {
  const trimmed = text.replace(/\s+/g, " ").trim();
  const mashed = trimmed.match(MASHED);
  if (mashed) {
    return [mashed[1], mashed[2].replace(/\s+/g, " ")];
  }
  return [trimmed];
}

function cleanCellText(value: string): string {
  return value.replace(/\s+/g, " ").replace(RULE_SUFFIX, "").trim();
}

function cellText(cell: { text?: string } | string | null | undefined): string[] {
  if (cell == null) return [""];
  const raw = typeof cell === "string" ? cell : (cell.text ?? "");
  return splitMashedAmounts(cleanCellText(raw));
}

function looksLikeHeader(row: string[]): boolean {
  if (row.length === 0) return false;
  const nonempty = row.filter(Boolean);
  if (nonempty.length === 0) return false;
  const numeric = nonempty.filter((value) => /^-?[\d,.]+$/.test(value)).length;
  return numeric / nonempty.length < 0.5;
}

function isRuleRow(row: string[]): boolean {
  const line = row.join("").replace(/\s/g, "");
  return line.length >= 3 && /^[-–—_=]+$/.test(line);
}

function shouldSkip(row: string[], extra: string[] = []): boolean {
  if (isRuleRow(row)) return true;
  const line = row.join(" ").toLowerCase();
  return [...DEFAULT_SKIP, ...extra.map((value) => value.toLowerCase())].some((pattern) =>
    line.includes(pattern),
  );
}

const DATE =
  /(?:\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/;
const AMOUNT = /[\d,]+\.\d{2}/;
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

/** Cluster Tabula `left` edges into column bands. Nearby edges are the same column. */
export function clusterColumnLefts(lefts: number[]): number[] {
  if (lefts.length === 0) return [];
  const sorted = [...lefts].sort((a, b) => a - b);
  const span = sorted[sorted.length - 1] - sorted[0];
  if (span <= 40) return [sorted.reduce((sum, n) => sum + n, 0) / sorted.length];
  const gap = Math.max(20, span * 0.04);
  const clusters: number[][] = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i += 1) {
    const cluster = clusters[clusters.length - 1];
    if (sorted[i] - cluster[0] < gap) cluster.push(sorted[i]);
    else clusters.push([sorted[i]]);
  }
  return clusters.map((cluster) => cluster.reduce((sum, n) => sum + n, 0) / cluster.length);
}

/** Column whose left edge is the greatest band still to the left of `x`. */
export function bandIndex(x: number, bands: number[]): number {
  let index = 0;
  for (let i = 1; i < bands.length; i += 1) {
    if (x >= bands[i]) index = i;
    else break;
  }
  return index;
}

export function snapRowToBands(cells: { text: string; left: number }[], bands: number[]): string[] {
  const row = bands.map(() => "");
  for (const cell of cells) {
    const text = cleanCellText(cell.text);
    if (!text) continue;
    const index = bandIndex(cell.left, bands);
    row[index] = row[index] ? `${row[index]} ${text}` : text;
  }
  return row;
}

function splitMashedIntoHoles(row: string[]): string[] {
  const next = [...row];
  for (let i = 0; i < next.length; i += 1) {
    const parts = splitMashedAmounts(next[i]);
    if (parts.length < 2) continue;
    next[i] = parts[0];
    const dest = i + 1;
    if (dest < next.length && !next[dest].trim()) next[dest] = parts[1];
    else if (dest < next.length) next[dest] = next[dest] ? `${parts[1]} ${next[dest]}` : parts[1];
    else next[i] = `${parts[0]} ${parts[1]}`;
  }
  return next;
}

function collectLefts(tables: TabulaTable[]): number[] {
  const lefts: number[] = [];
  for (const table of tables) {
    for (const row of table.data ?? []) {
      for (const cell of row ?? []) {
        const text = (cell.text ?? "").trim();
        const width = cell.width ?? 0;
        if (!text && width < 8) continue;
        lefts.push(cell.left ?? 0);
      }
    }
  }
  return lefts;
}

function headerLeftsFromRow(row: (TabulaCell | string | null | undefined)[]): number[] | null {
  const cells = positioned(row).filter((cell) => cleanCellText(cell.text));
  if (cells.length < 3) return null;
  if (!looksLikeHeader(cells.map((cell) => cleanCellText(cell.text)))) return null;
  const lefts = [...new Set(cells.map((cell) => cell.left))].sort((a, b) => a - b);
  if (lefts.length < 3) return null;
  if (lefts[lefts.length - 1] - lefts[0] <= 40) return null;
  return lefts;
}

function bestHeaderLefts(tables: TabulaTable[]): number[] | null {
  let best: number[] | null = null;
  for (const table of tables) {
    for (const row of table.data ?? []) {
      const lefts = headerLeftsFromRow(row);
      if (!lefts) continue;
      if (!best || lefts.length > best.length) best = lefts;
    }
  }
  return best;
}

function hasUsableGeometry(lefts: number[]): boolean {
  if (lefts.length < 2) return false;
  return Math.max(...lefts) - Math.min(...lefts) > 40;
}

function positioned(row: (TabulaCell | string | null | undefined)[]): { text: string; left: number }[] {
  return (row ?? []).map((cell) => {
    if (cell == null || typeof cell === "string") {
      return { text: typeof cell === "string" ? cell : "", left: 0 };
    }
    return { text: cell.text ?? "", left: cell.left ?? 0 };
  });
}

function rowsFromTable(table: TabulaTable, bands: number[] | null): string[][] {
  return (table.data ?? []).map((row) => {
    if (bands) return splitMashedIntoHoles(snapRowToBands(positioned(row), bands));
    return (row ?? []).flatMap((cell) => cellText(cell));
  });
}

function finishTable(
  table: TabulaTable,
  rawRows: string[][],
  options: ExtractOptions,
): ExtractedTable | null {
  const nonempty = rawRows
    .filter((row) => row.some((cell) => cell.length > 0))
    .filter((row) => !shouldSkip(row, options.skipRows));
  if (nonempty.length === 0) return null;

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
  };
}

export function tablesFromTabulaJson(raw: string, options: ExtractOptions = {}): ExtractedTable[] {
  const tables = parseTabulaTables(raw);
  const headerBands = bestHeaderLefts(tables);
  const lefts = collectLefts(tables);
  const bands = headerBands ?? (hasUsableGeometry(lefts) ? clusterColumnLefts(lefts) : null);
  return tables
    .map((table) => finishTable(table, rowsFromTable(table, bands), options))
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
