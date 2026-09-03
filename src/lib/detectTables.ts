import type { TableArea } from "@/types";

export interface TabulaCell {
  text?: string;
  top?: number;
  left?: number;
  width?: number;
  height?: number;
}

export interface TabulaTable {
  page?: number;
  extraction_method?: string;
  top?: number;
  left?: number;
  width?: number;
  height?: number;
  data?: TabulaCell[][];
}

const MONTH = "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec";
const DATE = new RegExp(
  `^(?:\\d{1,2}[-/.]\\d{1,2}[-/.]\\d{2,4}|\\d{4}[-/.]\\d{1,2}[-/.]\\d{1,2}|\\d{1,2}[\\s-]+(?:${MONTH})[a-z]*\\.?[\\s-]+\\d{2,4})\\b`,
  "i",
);
const AMOUNT = /[\d,]+\.\d{2}/;
const HEADER =
  /date|value|particular|description|narration|details|debit|credit|withdraw|deposit|moneyin|moneyout|balance|amount|receipt|completion|paidin/;

function cellText(cell: TabulaCell): string {
  return (cell.text ?? "").replace(/\s+/g, " ").trim();
}

function isFooter(text: string): boolean {
  const value = text.toLowerCase();
  return (
    value.startsWith("note:") ||
    value.includes("page total") ||
    value.includes("grand total") ||
    value.includes("any omission") ||
    value.includes("disclaimer")
  );
}

function isHeader(text: string): boolean {
  return HEADER.test(text.toLowerCase().replace(/\s+/g, ""));
}

function right(cell: TabulaCell): number {
  return (cell.left ?? 0) + (cell.width ?? 0);
}

function bottom(cell: TabulaCell): number {
  return (cell.top ?? 0) + (cell.height ?? 0);
}

export function parseTabulaTables(raw: string): TabulaTable[] {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return [];
  const tables = JSON.parse(raw.slice(start, end + 1)) as TabulaTable[];
  return Array.isArray(tables) ? tables : [];
}

interface ScoredArea extends TableArea {
  score: number;
}

export function detectTransactionAreas(raw: string): TableArea[] {
  const byPage = new Map<number, ScoredArea[]>();

  parseTabulaTables(raw).forEach((table) => {
    const page = table.page && table.page > 0 ? table.page : 1;
    const area = areaFromTable(table, page);
    if (!area) return;
    const list = byPage.get(page) ?? [];
    list.push(area);
    byPage.set(page, list);
  });

  return [...byPage.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, areas]) => pickBest(areas));
}

function areaFromTable(table: TabulaTable, page: number): ScoredArea | null {
  const cells = (table.data ?? []).flat();
  const useful = cells.filter((cell) => {
    const text = cellText(cell);
    return text.length > 0 && !isFooter(text);
  });

  const dates = useful.filter((cell) => DATE.test(cellText(cell)));
  const amounts = useful.filter((cell) => AMOUNT.test(cellText(cell)));
  if (dates.length < 2 && !(dates.length >= 1 && amounts.length >= 2)) {
    return null;
  }

  const firstDateTop = Math.min(...dates.map((cell) => cell.top ?? 0));
  const headers = useful.filter((cell) => {
    if (!isHeader(cellText(cell))) return false;
    return (cell.top ?? 0) >= firstDateTop - 55;
  });
  const nearbyAmounts = amounts.filter((cell) => (cell.top ?? 0) >= firstDateTop - 45);

  const anchors = [...dates, ...headers, ...nearbyAmounts];
  const top = Math.max(0, Math.min(...anchors.map((cell) => cell.top ?? 0)) - 12);
  const left = Math.max(0, Math.min(...anchors.map((cell) => cell.left ?? 0)) - 10);
  const tableBottom = Math.max(...anchors.map((cell) => bottom(cell))) + 18;
  const tableRight = Math.max(...anchors.map((cell) => right(cell))) + 14;

  if (tableBottom - top < 40 || tableRight - left < 80) {
    return null;
  }

  return {
    page,
    top,
    left,
    bottom: tableBottom,
    right: tableRight,
    method: "stream",
    score: dates.length * 2 + nearbyAmounts.length,
  };
}

function pickBest(areas: ScoredArea[]): TableArea {
  const best = [...areas].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.bottom - b.top - (a.bottom - a.top);
  })[0];
  const { score: _score, ...area } = best;
  return area;
}
