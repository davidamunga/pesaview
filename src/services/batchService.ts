import { invoke } from "@tauri-apps/api/core";
import { join, tempDir } from "@tauri-apps/api/path";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import {
  nextOutputName,
  planBatchJob,
  selectionsFromTemplate,
  statementStem,
  type BatchJobStatus,
  type ExportFormat,
} from "@/lib/batchJob";
import { pdfPageMetrics } from "@/lib/pdfPageMetrics";
import { guessPageSpec, stampSelectionsToEmptyPages } from "@/lib/rememberLayout";
import { createId } from "@/lib/utils";
import { writeCsv, writeXlsx } from "@/services/exportService";
import { TabulaService } from "@/services/tabulaService";
import type { StatementTemplate, TableArea } from "@/types";

export interface RunBatchJobInput {
  path: string;
  name: string;
  password?: string;
  templates: StatementTemplate[];
  format: ExportFormat;
  outputDir: string;
  takenNames: Set<string>;
  signal?: AbortSignal;
  onStatus?: (status: BatchJobStatus) => void;
}

export type RunBatchJobResult =
  | { status: "saved"; outputPath: string; templateName?: string }
  | { status: "needs-password"; error?: string }
  | { status: "no-layout" }
  | { status: "error"; error: string };

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    const error = new Error("Batch cancelled");
    error.name = "AbortError";
    throw error;
  }
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

async function uniqueDest(
  outputDir: string,
  stem: string,
  format: ExportFormat,
  taken: Set<string>,
): Promise<{ name: string; path: string }> {
  let name = nextOutputName(stem, format, taken);
  let dest = await join(outputDir, name);
  while (await invoke<boolean>("path_exists", { path: dest })) {
    taken.add(name.toLowerCase());
    name = nextOutputName(stem, format, taken);
    dest = await join(outputDir, name);
  }
  taken.add(name.toLowerCase());
  return { name, path: dest };
}

async function persistWorkingPdf(path: string): Promise<string> {
  const data = await readFile(path);
  const dir = await tempDir();
  const dest = await join(dir, `pesaview-batch-${Date.now()}.pdf`);
  await writeFile(dest, data);
  return dest;
}

export async function runBatchJob(input: RunBatchJobInput): Promise<RunBatchJobResult> {
  try {
    throwIfAborted(input.signal);
    input.onStatus?.("finding");
    let workingPath = input.path;
    try {
      workingPath = await persistWorkingPdf(input.path);
    } catch {
      workingPath = input.path;
    }
    const { areas, raw } = await TabulaService.guessTables(
      workingPath,
      input.password,
      guessPageSpec(),
    );
    throwIfAborted(input.signal);

    const plan = planBatchJob(areas, raw, input.templates);
    if (plan.kind === "miss") return { status: "no-layout" };

    const template = plan.kind === "found" ? plan.template : plan.template;
    let extractAreas: TableArea[] = [];

    if (plan.kind === "apply-match" || plan.kind === "found") {
      const data = await readFile(input.path);
      const { pageCount, metrics } = await pdfPageMetrics(data, input.password);
      const fallback = metrics[1] ?? Object.values(metrics)[0];
      const included = Array.from({ length: pageCount }, (_, i) => i + 1);
      if (plan.kind === "apply-match") {
        const selections = selectionsFromTemplate(plan.template, pageCount, metrics);
        if (selections.length === 0) {
          return { status: "error", error: "Could not apply the matched layout." };
        }
        extractAreas = selections.map(({ id: _id, ...area }) => area);
      } else {
        const stamped = stampSelectionsToEmptyPages(
          plan.areas.map((area) => ({ ...area, id: createId() })),
          included,
          metrics,
          fallback,
        );
        extractAreas = stamped.map(({ id: _id, ...area }) => area);
      }
    }

    input.onStatus?.("extracting");
    throwIfAborted(input.signal);
    const tables = await TabulaService.extractTables(workingPath, extractAreas, input.password, {
      skipRows: template?.skipRows,
      columns: template?.columns,
      mergeRows: template?.mergeRows,
    });
    throwIfAborted(input.signal);

    const dest = await uniqueDest(
      input.outputDir,
      statementStem(input.name),
      input.format,
      input.takenNames,
    );
    if (input.format === "csv") {
      await writeCsv(tables, dest.path);
    } else {
      await writeXlsx(tables, dest.path);
    }
    return { status: "saved", outputPath: dest.path, templateName: template?.name };
  } catch (error) {
    if (isAbort(error)) throw error;
    const message = error instanceof Error ? error.message : String(error);
    if (TabulaService.isPasswordError(message)) {
      return { status: "needs-password", error: message };
    }
    return { status: "error", error: message };
  }
}
