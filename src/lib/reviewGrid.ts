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
): CellCorrection[] {
  const byId = new Map(original.map((row) => [row.id, row]));
  const corrections: CellCorrection[] = [];
  for (const [key, next] of Object.entries(edits)) {
    const split = key.lastIndexOf(":");
    const rowId = key.slice(0, split);
    const column = Number(key.slice(split + 1));
    const row = byId.get(rowId);
    if (!row || Number.isNaN(column) || removed.has(column)) continue;
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
): { columns: string[]; rows: ReviewRow[] } {
  const keep = columns.map((_, index) => index).filter((index) => !removed.has(index));
  return {
    columns: keep.map((index) => columns[index]),
    rows: rows.map((row) => ({
      ...row,
      cells: keep.map((index) => row.cells[index] ?? ""),
    })),
  };
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
