import { appDataDir, join } from "@tauri-apps/api/path";
import { exists, mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { rememberedAreas } from "@/lib/rememberLayout";
import type { ExtractionMethod, Selection, StatementTemplate, TemplateArea } from "@/types";
import { createId } from "@/lib/utils";

const bundledModules = import.meta.glob("../../templates/*.json", {
  eager: true,
  import: "default",
}) as Record<string, Partial<StatementTemplate>>;

function asMethod(value: unknown): ExtractionMethod {
  return value === "lattice" || value === "guess" ? value : "stream";
}

function asAreas(value: unknown): TemplateArea[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((area) => area && typeof area === "object")
    .map((area) => {
      const item = area as Record<string, unknown>;
      return {
        page: Number(item.page) || 0,
        top: Number(item.top) || 0,
        left: Number(item.left) || 0,
        bottom: Number(item.bottom) || 0,
        right: Number(item.right) || 0,
        method: asMethod(item.method),
        pageWidth: typeof item.pageWidth === "number" ? item.pageWidth : undefined,
        pageHeight: typeof item.pageHeight === "number" ? item.pageHeight : undefined,
      };
    });
}

function asStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return items.length > 0 ? items : undefined;
}

export function parseTemplate(value: unknown, fallback: { id: string; source: StatementTemplate["source"] }): StatementTemplate | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const areas = asAreas(raw.areas);
  if (areas.length === 0 || typeof raw.name !== "string" || !raw.name.trim()) {
    return null;
  }
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : fallback.id,
    name: raw.name.trim(),
    source: fallback.source,
    normalized: raw.normalized !== false,
    areas,
    skipRows: asStringList(raw.skipRows),
    columns: asStringList(raw.columns),
    match: asStringList(raw.match),
    mergeRows: raw.mergeRows === false ? false : raw.mergeRows === true ? true : undefined,
  };
}

export function bundledTemplates(): StatementTemplate[] {
  return Object.entries(bundledModules)
    .map(([path, data]) => {
      const file = path.split("/").pop()?.replace(/\.json$/, "") ?? "template";
      return parseTemplate(data, { id: file, source: "bundled" });
    })
    .filter((template): template is StatementTemplate => template != null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function templatesPath(): Promise<string> {
  const dir = await appDataDir();
  await mkdir(dir, { recursive: true });
  return join(dir, "templates.json");
}

export async function loadCustomTemplates(): Promise<StatementTemplate[]> {
  try {
    const path = await templatesPath();
    if (!(await exists(path))) return [];
    const raw = JSON.parse(await readTextFile(path)) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item, index) => parseTemplate(item, { id: `saved-${index}`, source: "saved" }))
      .filter((template): template is StatementTemplate => template != null);
  } catch {
    return [];
  }
}

export async function saveCustomTemplates(templates: StatementTemplate[]): Promise<void> {
  const path = await templatesPath();
  await writeTextFile(path, JSON.stringify(templates, null, 2));
}

export function allTemplates(custom: StatementTemplate[]): StatementTemplate[] {
  return [...bundledTemplates(), ...custom];
}

export function templateFromSelections(
  name: string,
  selections: Selection[],
  pageMetrics: { pdfWidth: number; pdfHeight: number },
  extras?: Pick<StatementTemplate, "skipRows" | "columns" | "match" | "mergeRows">,
  metricsByPage?: Record<number, { pdfWidth: number; pdfHeight: number }>,
): StatementTemplate {
  return {
    id: createId("tpl"),
    name,
    source: "saved",
    normalized: true,
    skipRows: extras?.skipRows,
    columns: extras?.columns,
    match: extras?.match,
    mergeRows: extras?.mergeRows,
    areas: rememberedAreas(selections, pageMetrics, metricsByPage),
  };
}
