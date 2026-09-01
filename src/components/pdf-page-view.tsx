import { useState } from "react";
import { Page } from "react-pdf";
import { SelectionOverlay } from "@/components/selection-overlay";
import type { ExtractionMethod, PageMetrics, Selection } from "@/types";

interface PdfPageViewProps {
  pageNumber: number;
  width: number;
  selections: Selection[];
  defaultMethod: ExtractionMethod;
  onSelectionsChange: (selections: Selection[], options?: { commit?: boolean }) => void;
  onMetrics: (metrics: PageMetrics) => void;
}

export function PdfPageView({
  pageNumber,
  width,
  selections,
  defaultMethod,
  onSelectionsChange,
  onMetrics,
}: PdfPageViewProps) {
  const [metrics, setMetrics] = useState<PageMetrics | null>(null);

  return (
    <div className="relative inline-block bg-white shadow-md">
      <Page
        pageNumber={pageNumber}
        width={width}
        renderAnnotationLayer={false}
        renderTextLayer={false}
        onRenderSuccess={(page) => {
          const next = {
            renderWidth: page.width,
            renderHeight: page.height,
            pdfWidth: page.originalWidth,
            pdfHeight: page.originalHeight,
          };
          setMetrics(next);
          onMetrics(next);
        }}
      />
      {metrics && (
        <SelectionOverlay
          page={pageNumber}
          metrics={metrics}
          selections={selections}
          defaultMethod={defaultMethod}
          onChange={onSelectionsChange}
        />
      )}
    </div>
  );
}
