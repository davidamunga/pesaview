import type { PageMetrics } from "@/types";

/** pdf.js `page.view` is [xMin, yMin, xMax, yMax] in PDF points. */
export function metricsFromView(view: readonly number[]): PageMetrics {
  const pdfWidth = Math.abs((view[2] ?? 0) - (view[0] ?? 0));
  const pdfHeight = Math.abs((view[3] ?? 0) - (view[1] ?? 0));
  return {
    pdfWidth,
    pdfHeight,
    renderWidth: pdfWidth,
    renderHeight: pdfHeight,
  };
}
