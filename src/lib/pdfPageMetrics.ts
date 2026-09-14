import { pdfjs } from "react-pdf";
import { metricsFromView } from "@/lib/pdfMetrics";
import type { PageMetrics } from "@/types";

export async function pdfPageMetrics(
  data: Uint8Array,
  password?: string,
): Promise<{ pageCount: number; metrics: Record<number, PageMetrics> }> {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  const task = pdfjs.getDocument({
    data: copy,
    password: password?.trim() || undefined,
  });
  const doc = await task.promise;
  try {
    const metrics: Record<number, PageMetrics> = {};
    for (let page = 1; page <= doc.numPages; page += 1) {
      const pdfPage = await doc.getPage(page);
      metrics[page] = metricsFromView(pdfPage.view);
    }
    return { pageCount: doc.numPages, metrics };
  } finally {
    await doc.destroy();
  }
}
