import { applyTemplateArea } from "@/lib/coordinates";
import { matchTemplate } from "@/lib/matchTemplate";
import { planAutodetect } from "@/lib/rememberLayout";
import type { PageMetrics, Selection, StatementTemplate, TableArea } from "@/types";

export type ExportFormat = "csv" | "xlsx";

export type BatchJobStatus =
  | "waiting"
  | "finding"
  | "extracting"
  | "saved"
  | "needs-password"
  | "no-layout"
  | "error";

export interface BatchJob {
  id: string;
  path: string;
  name: string;
  password?: string;
  status: BatchJobStatus;
  error?: string;
  outputPath?: string;
  templateName?: string;
}

export type BatchPlan =
  | { kind: "found"; areas: TableArea[]; template?: StatementTemplate; status: string }
  | { kind: "apply-match"; template: StatementTemplate; status: string }
  | { kind: "miss"; status: string };

const UNSAFE_FILE = /[<>:"/\\|?*]/g;

export function statementStem(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() || "statement";
  const withoutExt = base.replace(/\.pdf$/i, "") || "statement";
  return withoutExt.replace(UNSAFE_FILE, "-").trim() || "statement";
}

export function nextOutputName(
  stem: string,
  format: ExportFormat,
  taken: ReadonlySet<string>,
): string {
  const ext = format;
  let candidate = `${stem}.${ext}`;
  let n = 2;
  while (taken.has(candidate.toLowerCase())) {
    candidate = `${stem}-${n}.${ext}`;
    n += 1;
  }
  return candidate;
}

export function planBatchJob(
  areas: TableArea[],
  raw: string,
  templates: StatementTemplate[],
): BatchPlan {
  const matched = matchTemplate(raw, templates);
  const plan = planAutodetect(areas.length, matched);
  if (plan.kind === "found") {
    return { kind: "found", areas, template: matched, status: plan.status };
  }
  if (plan.kind === "apply-match") {
    return { kind: "apply-match", template: plan.template, status: plan.status };
  }
  return { kind: "miss", status: plan.status };
}

export function selectionsFromTemplate(
  template: StatementTemplate,
  pageCount: number,
  metricsByPage: Record<number, PageMetrics>,
): Selection[] {
  const fallback = metricsByPage[1] ?? Object.values(metricsByPage)[0];
  if (!fallback || pageCount < 1) return [];
  const next: Selection[] = [];
  for (let page = 1; page <= pageCount; page += 1) {
    const metrics = metricsByPage[page] ?? fallback;
    const specific = template.areas.filter((area) => area.page === page);
    const pageAreas = specific.length > 0 ? specific : template.areas.filter((area) => area.page === 0);
    for (const area of pageAreas) {
      next.push(applyTemplateArea(area, page, metrics, { normalized: template.normalized }));
    }
  }
  return next;
}

export function jobsFromPicked(
  picked: { path: string; name: string }[],
  createId: (prefix?: string) => string,
): BatchJob[] {
  return picked.map((item) => ({
    id: createId("job"),
    path: item.path,
    name: item.name,
    status: "waiting" as const,
  }));
}
