import type {
  CssRect,
  ExtractionMethod,
  PageMetrics,
  Selection,
  TableArea,
  TemplateArea,
} from "@/types";
import { createId } from "@/lib/utils";

export function cssToPdf(rect: CssRect, page: PageMetrics): TableArea {
  const sx = page.pdfWidth / page.renderWidth;
  const sy = page.pdfHeight / page.renderHeight;
  const left = clamp(Math.min(rect.x, rect.x + rect.width) * sx, 0, page.pdfWidth);
  const top = clamp(Math.min(rect.y, rect.y + rect.height) * sy, 0, page.pdfHeight);
  const right = clamp(Math.max(rect.x, rect.x + rect.width) * sx, 0, page.pdfWidth);
  const bottom = clamp(Math.max(rect.y, rect.y + rect.height) * sy, 0, page.pdfHeight);
  return { page: 1, top, left, bottom, right, method: "stream" };
}

export function pdfToCss(area: Pick<TableArea, "top" | "left" | "bottom" | "right">, page: PageMetrics): CssRect {
  const sx = page.renderWidth / page.pdfWidth;
  const sy = page.renderHeight / page.pdfHeight;
  return {
    x: area.left * sx,
    y: area.top * sy,
    width: (area.right - area.left) * sx,
    height: (area.bottom - area.top) * sy,
  };
}

export function normalizeRect(startX: number, startY: number, endX: number, endY: number): CssRect {
  return {
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY),
  };
}

export function applyTemplateArea(
  area: TemplateArea,
  pageNumber: number,
  page: PageMetrics,
  options?: { normalized?: boolean; method?: ExtractionMethod },
): Selection {
  const method = options?.method ?? area.method;
  if (options?.normalized) {
    return {
      id: createId(),
      page: pageNumber,
      top: area.top * page.pdfHeight,
      left: area.left * page.pdfWidth,
      bottom: area.bottom * page.pdfHeight,
      right: area.right * page.pdfWidth,
      method,
    };
  }

  const refWidth = area.pageWidth && area.pageWidth > 0 ? area.pageWidth : page.pdfWidth;
  const refHeight = area.pageHeight && area.pageHeight > 0 ? area.pageHeight : page.pdfHeight;
  const sx = page.pdfWidth / refWidth;
  const sy = page.pdfHeight / refHeight;

  return {
    id: createId(),
    page: pageNumber,
    top: area.top * sy,
    left: area.left * sx,
    bottom: area.bottom * sy,
    right: area.right * sx,
    method,
  };
}

export type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export function moveRect(
  rect: CssRect,
  dx: number,
  dy: number,
  bounds: { width: number; height: number },
): CssRect {
  return {
    x: clamp(rect.x + dx, 0, Math.max(0, bounds.width - rect.width)),
    y: clamp(rect.y + dy, 0, Math.max(0, bounds.height - rect.height)),
    width: rect.width,
    height: rect.height,
  };
}

export function resizeRect(
  start: CssRect,
  handle: ResizeHandle,
  point: { x: number; y: number },
  bounds: { width: number; height: number },
  min = 8,
): CssRect {
  let left = start.x;
  let top = start.y;
  let right = start.x + start.width;
  let bottom = start.y + start.height;
  const x = clamp(point.x, 0, bounds.width);
  const y = clamp(point.y, 0, bounds.height);

  if (handle.includes("e")) right = x;
  if (handle.includes("w")) left = x;
  if (handle.includes("s")) bottom = y;
  if (handle.includes("n")) top = y;

  const next = normalizeRect(left, top, right, bottom);
  return next.width >= min && next.height >= min ? next : start;
}

export function selectionFromCss(
  rect: CssRect,
  page: PageMetrics,
  existing: Pick<Selection, "id" | "page" | "method">,
): Selection {
  const pdf = cssToPdf(rect, page);
  return {
    id: existing.id,
    page: existing.page,
    top: pdf.top,
    left: pdf.left,
    bottom: pdf.bottom,
    right: pdf.right,
    method: existing.method,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
