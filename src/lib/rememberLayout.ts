import { applyTemplateArea } from "@/lib/coordinates";
import type { PageMetrics, Selection, StatementTemplate, TemplateArea } from "@/types";

const KNOWN: { name: string; match: string[] }[] = [
  { name: "NCBA Loop", match: ["ncba", "loop"] },
  { name: "NCBA", match: ["ncba"] },
  { name: "M-PESA statement", match: ["receipt no", "paid in"] },
  { name: "Equity ledger", match: ["particulars", "money out"] },
  { name: "KCB", match: ["kcb"] },
  { name: "Co-op Bank", match: ["co-operative"] },
  { name: "Absa", match: ["absa"] },
  { name: "Stanbic", match: ["stanbic"] },
];

const HEADERS = [
  "value date",
  "transaction type",
  "particulars",
  "narration",
  "paid in",
  "money out",
];

export function suggestLayout(sample: string, fileName = ""): { name: string; match: string[] } {
  const text = `${sample}\n${fileName}`.toLowerCase();
  const known = KNOWN.find((item) => item.match.every((token) => text.includes(token)));
  if (known) return known;

  const match = HEADERS.filter((header) => text.includes(header)).slice(0, 2);
  return { name: "Saved layout", match };
}

export function rememberCopy(name: string): string {
  if (!name || name === "Saved layout") {
    return "Remember this layout for the next statement?";
  }
  return `Remember this layout for the next ${name} statement?`;
}

function normalizeArea(
  selection: Selection,
  metrics: { pdfWidth: number; pdfHeight: number },
): TemplateArea {
  const width = metrics.pdfWidth || 1;
  const height = metrics.pdfHeight || 1;
  return {
    page: selection.page,
    top: selection.top / height,
    left: selection.left / width,
    bottom: selection.bottom / height,
    right: selection.right / width,
    method: selection.method,
  };
}

/** Page 1 keeps its letterhead box. Page 0 is every other page. */
export function rememberedAreas(
  selections: Selection[],
  fallback: { pdfWidth: number; pdfHeight: number },
  metricsByPage: Record<number, { pdfWidth: number; pdfHeight: number }> = {},
): TemplateArea[] {
  const normalized = selections.map((selection) =>
    normalizeArea(selection, metricsByPage[selection.page] ?? fallback),
  );
  if (normalized.length === 0) return [];
  const firstPage = normalized.filter((area) => area.page === 1);
  const continuation = normalized.find((area) => area.page !== 1) ?? firstPage[0] ?? normalized[0];
  return [...firstPage, { ...continuation, page: 0 }];
}

export function stampSelectionsToEmptyPages(
  selections: Selection[],
  includedPages: number[],
  metricsByPage: Record<number, PageMetrics>,
  fallback?: PageMetrics,
): Selection[] {
  if (selections.length === 0) return selections;
  const pagesWithBoxes = new Set(selections.map((selection) => selection.page));
  if (pagesWithBoxes.size !== 1) return selections;
  const sourceMetrics = metricsByPage[selections[0].page] ?? fallback;
  if (!sourceMetrics) return selections;

  const extras: Selection[] = [];
  for (const page of includedPages) {
    if (pagesWithBoxes.has(page)) continue;
    const metrics = metricsByPage[page] ?? fallback ?? sourceMetrics;
    for (const selection of selections) {
      extras.push(
        applyTemplateArea(
          {
            page: 0,
            top: selection.top / sourceMetrics.pdfHeight,
            left: selection.left / sourceMetrics.pdfWidth,
            bottom: selection.bottom / sourceMetrics.pdfHeight,
            right: selection.right / sourceMetrics.pdfWidth,
            method: selection.method,
          },
          page,
          metrics,
          { normalized: true },
        ),
      );
    }
  }
  return extras.length > 0 ? [...selections, ...extras] : selections;
}

export type AutodetectPlan =
  | { kind: "found"; status: string }
  | { kind: "apply-match"; template: StatementTemplate; status: string }
  | { kind: "miss"; status: string };

export function planAutodetect(
  foundCount: number,
  matched: StatementTemplate | undefined,
): AutodetectPlan {
  if (foundCount > 0) {
    const regions = `${foundCount} table region${foundCount === 1 ? "" : "s"}`;
    return {
      kind: "found",
      status: matched
        ? `Found ${regions}. Using “${matched.name}” cleanup.`
        : `Found ${regions}.`,
    };
  }
  if (matched) {
    return {
      kind: "apply-match",
      template: matched,
      status: `Using “${matched.name}”. Adjust the boxes if the table looks off.`,
    };
  }
  return {
    kind: "miss",
    status: "This layout isn’t in the library. Draw a box around the transaction rows.",
  };
}
