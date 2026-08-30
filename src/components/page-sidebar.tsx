import { Page } from "react-pdf";
import { pdfToCss } from "@/lib/coordinates";
import { cn } from "@/lib/utils";
import type { PageMetrics, Selection } from "@/types";

interface PageSidebarProps {
  pageCount: number;
  currentPage: number;
  excludedPages: Set<number>;
  selections: Selection[];
  pageMetrics: Record<number, PageMetrics>;
  onSelect: (page: number) => void;
  onExclude: (page: number) => void;
}

export function PageSidebar({
  pageCount,
  currentPage,
  excludedPages,
  selections,
  pageMetrics,
  onSelect,
  onExclude,
}: PageSidebarProps) {
  const includedCount = pageCount - excludedPages.size;

  return (
    <aside className="flex h-full w-32 shrink-0 flex-col border-r bg-card">
      <div className="flex-1 space-y-2 overflow-y-auto p-1.5">
        {Array.from({ length: pageCount }, (_, index) => {
          const page = index + 1;
          const excluded = excludedPages.has(page);
          const pageSelections = selections.filter((selection) => selection.page === page);
          const metrics = pageMetrics[page];
          const lastIncluded = !excluded && includedCount <= 1;
          return (
            <div
              key={page}
              className={cn(
                "rounded-md border bg-card p-1 shadow-xs",
                currentPage === page
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-border",
                excluded && "opacity-40",
              )}
            >
              <button
                type="button"
                aria-label={`Page ${page}`}
                aria-current={currentPage === page ? "page" : undefined}
                className="block w-full rounded-[3px] text-left outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onSelect(page)}
              >
                <div className="relative overflow-hidden rounded-[3px] bg-muted">
                  <Page
                    pageNumber={page}
                    width={96}
                    renderAnnotationLayer={false}
                    renderTextLayer={false}
                  />
                  {metrics &&
                    pageSelections.map((selection) => {
                      const box = pdfToCss(selection, {
                        ...metrics,
                        renderWidth: 96,
                        renderHeight: (96 / metrics.pdfWidth) * metrics.pdfHeight,
                      });
                      return (
                        <span
                          key={selection.id}
                          className="selection-box pointer-events-none absolute"
                          style={{
                            left: box.x,
                            top: box.y,
                            width: box.width,
                            height: box.height,
                          }}
                        />
                      );
                    })}
                </div>
              </button>
              <div className="mt-1 flex items-center justify-between gap-1 px-0.5">
                <span className="text-xs text-muted-foreground">Page {page}</span>
                <button
                  type="button"
                  disabled={lastIncluded}
                  title={lastIncluded ? "Keep at least one page" : undefined}
                  className="min-h-8 min-w-11 px-1.5 text-xs text-muted-foreground underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:no-underline disabled:opacity-100 disabled:text-muted-foreground"
                  onClick={() => onExclude(page)}
                >
                  {excluded ? "Include" : lastIncluded ? "Keep one page" : "Skip page"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
