import { Page } from "react-pdf";
import { X } from "lucide-react";
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
  return (
    <aside className="flex h-full w-36 shrink-0 flex-col border-r bg-sidebar">
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {Array.from({ length: pageCount }, (_, index) => {
          const page = index + 1;
          const excluded = excludedPages.has(page);
          const pageSelections = selections.filter((selection) => selection.page === page);
          const metrics = pageMetrics[page];
          return (
            <button
              key={page}
              type="button"
              onClick={() => onSelect(page)}
              className={cn(
                "group relative w-full rounded-md border bg-white p-1 text-left shadow-xs transition",
                currentPage === page
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-border hover:border-primary/40",
                excluded && "opacity-40",
              )}
            >
              <span
                role="button"
                tabIndex={0}
                className="absolute top-1 left-1 z-10 flex size-4 items-center justify-center rounded-full bg-black/55 text-white"
                aria-label={excluded ? "Include page" : "Exclude page"}
                onClick={(event) => {
                  event.stopPropagation();
                  onExclude(page);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.stopPropagation();
                    onExclude(page);
                  }
                }}
              >
                <X className="size-2.5" />
              </span>
              <div className="relative overflow-hidden rounded-[3px] bg-muted">
                <Page
                  pageNumber={page}
                  width={112}
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                />
                {metrics &&
                  pageSelections.map((selection) => {
                    const box = pdfToCss(selection, {
                      ...metrics,
                      renderWidth: 112,
                      renderHeight: (112 / metrics.pdfWidth) * metrics.pdfHeight,
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
              <p className="mt-1 text-center text-[11px] text-muted-foreground">{page}</p>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
