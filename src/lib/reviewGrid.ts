import type { CellCorrection, ExtractedTable, ReviewRow } from "@/types";

function padRow(row: string[], width: number): string[] {
  return Array.from({ length: width }, (_, i) => row[i] ?? "");
}

export function tablesToReview(tables: ExtractedTable[]): { columns: string[]; rows: ReviewRow[] } {
  if (tables.length === 0) {
    return { columns: [], rows: [] };
  }
  const columns = tables[0].columns;
  const rows: ReviewRow[] = [];
  tables.forEach((table, tableIndex) => {
    table.rows.forEach((row, rowIndex) => {
      rows.push({
        id: `${table.page}-${tableIndex}-${rowIndex}`,
        page: table.page,
        cells: padRow(row, columns.length),
      });
    });
  });
  return { columns, rows };
}

export function applyReviewEdits(
  rows: ReviewRow[],
  edits: Record<string, string>,
): ReviewRow[] {
  return rows.map((row) => ({
    ...row,
    cells: row.cells.map((value, column) => edits[editKey(row.id, column)] ?? value),
  }));
}

export function editKey(rowId: string, column: number): string {
  return `${rowId}:${column}`;
}

export function correctionsFromEdits(
  original: ReviewRow[],
  columns: string[],
  edits: Record<string, string>,
  removed: ReadonlySet<number> = new Set(),
  removedRows: ReadonlySet<string> = new Set(),
): CellCorrection[] {
  const byId = new Map(original.map((row) => [row.id, row]));
  const corrections: CellCorrection[] = [];
  for (const [key, next] of Object.entries(edits)) {
    const split = key.lastIndexOf(":");
    const rowId = key.slice(0, split);
    const column = Number(key.slice(split + 1));
    const row = byId.get(rowId);
    if (!row || Number.isNaN(column) || removed.has(column) || removedRows.has(rowId)) continue;
    const previous = row.cells[column] ?? "";
    if (previous === next) continue;
    corrections.push({
      page: row.page,
      row: original.findIndex((item) => item.id === rowId) + 1,
      column: columns[column] || `Column ${column + 1}`,
      oldValue: previous,
      newValue: next,
    });
  }
  return corrections.sort((a, b) => a.row - b.row || a.column.localeCompare(b.column));
}

export function projectReview(
  columns: string[],
  rows: ReviewRow[],
  removed: ReadonlySet<number>,
  removedRows: ReadonlySet<string> = new Set(),
): { columns: string[]; rows: ReviewRow[] } {
  const keep = columns.map((_, index) => index).filter((index) => !removed.has(index));
  return {
    columns: keep.map((index) => columns[index]),
    rows: rows
      .filter((row) => !removedRows.has(row.id))
      .map((row) => ({
        ...row,
        cells: keep.map((index) => row.cells[index] ?? ""),
      })),
  };
}

/** Short restore chip for a dropped review row. */
export function droppedRowLabel(row: ReviewRow, names: string[]): string {
  const dateIdx = names.findIndex(isDateColumn);
  const narrIdx = names.findIndex(isNarrativeColumn);
  const date = dateIdx >= 0 ? row.cells[dateIdx]?.trim() : "";
  const story = (
    narrIdx >= 0 ? row.cells[narrIdx] : row.cells.find((cell) => cell.trim())
  )?.trim() ?? "";
  const short = story.length > 36 ? `${story.slice(0, 35)}…` : story;
  return [date, short].filter(Boolean).join(" · ") || `Page ${row.page}`;
}

export type ColumnSuspectKind = "unnamed" | "empty" | "joined";

export interface ColumnSuspect {
  index: number;
  kind: ColumnSuspectKind;
  reason: string;
}

const EMPTY_RATIO = 0.8;

function isBlank(value: string): boolean {
  return value.trim() === "";
}

function isUnnamed(name: string): boolean {
  const trimmed = name.trim();
  return trimmed === "" || /^column\s*\d+$/i.test(trimmed);
}

function looksJoined(name: string): boolean {
  const trimmed = name.trim();
  return /^[A-Za-z]\s+[a-z]/.test(trimmed) || /\s{2,}/.test(trimmed) || /[a-z][A-Z]/.test(trimmed);
}

/** One reason per column: unnamed, then mostly-empty, then smashed names. */
export function columnSuspects(columns: string[], rows: ReviewRow[]): ColumnSuspect[] {
  const total = rows.length;
  const suspects: ColumnSuspect[] = [];
  columns.forEach((name, index) => {
    if (isUnnamed(name)) {
      suspects.push({ index, kind: "unnamed", reason: "Unnamed" });
      return;
    }
    if (total > 0) {
      const empty = rows.filter((row) => isBlank(row.cells[index] ?? "")).length;
      if (empty / total >= EMPTY_RATIO) {
        suspects.push({ index, kind: "empty", reason: "Mostly empty" });
        return;
      }
    }
    if (looksJoined(name)) {
      suspects.push({ index, kind: "joined", reason: "Looks joined" });
    }
  });
  return suspects;
}

function findHaystack(value: string): string {
  return value.toLowerCase().replace(/,/g, "");
}

/** Case-insensitive substring match across page and cells. Commas in amounts are ignored. */
export function rowMatchesQuery(row: ReviewRow, query: string): boolean {
  const needle = findHaystack(query).trim();
  if (!needle) return true;
  if (findHaystack(String(row.page)).includes(needle)) return true;
  return row.cells.some((cell) => findHaystack(cell).includes(needle));
}

/** Ledger amount columns — not “Value Date”. */
export function isMoneyColumn(name: string): boolean {
  const n = name.trim().toLowerCase();
  return (
    /money\s*(in|out)/.test(n) ||
    /^(debit|credit|balance|amount|paid in|paid out|withdrawal|deposit)$/.test(n)
  );
}

/** The transaction story column — takes leftover width. */
export function isNarrativeColumn(name: string): boolean {
  return /particular|detail|narrat|descrip|memo|remark/i.test(name.trim());
}

export function isDateColumn(name: string): boolean {
  const n = name.trim().toLowerCase();
  return /^(value\s*)?date$/.test(n) || /txn date|transaction date|value date/.test(n);
}

export function reviewToTables(columns: string[], rows: ReviewRow[]): ExtractedTable[] {
  const byPage = new Map<number, string[][]>();
  for (const row of rows) {
    const list = byPage.get(row.page) ?? [];
    list.push(row.cells);
    byPage.set(row.page, list);
  }
  return [...byPage.entries()]
    .sort(([a], [b]) => a - b)
    .map(([page, pageRows]) => ({ page, columns, rows: pageRows }));
}
