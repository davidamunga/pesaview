import { useEffect, useState, type RefObject } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { readFile } from "@tauri-apps/plugin-fs";
import { Button } from "@/components/ui/button";
import { pickPdf } from "@/lib/pickPdf";
import { cn } from "@/lib/utils";
import type { OpenedPdf } from "@/types";

interface FileOpenerProps {
  onOpen: (pdf: OpenedPdf) => void;
  busy?: boolean;
  currentFile?: { name: string; pageCount?: number };
  onKeepFile?: () => void;
  headingRef?: RefObject<HTMLHeadingElement | null>;
}

export function FileOpener({
  onOpen,
  busy,
  currentFile,
  onKeepFile,
  headingRef,
}: FileOpenerProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setup = async () => {
      try {
        const webview = getCurrentWebview();
        unlisten = await webview.onDragDropEvent((event) => {
          if (event.payload.type === "over") {
            setDragActive(true);
          } else if (event.payload.type === "drop") {
            setDragActive(false);
            const pdfPath = event.payload.paths.find((path) =>
              path.toLowerCase().endsWith(".pdf"),
            );
            if (pdfPath) {
              void openFromPath(pdfPath);
            } else {
              setError("Drop a PDF statement to continue.");
            }
          } else {
            setDragActive(false);
          }
        });
      } catch {
        // Browser preview has no Tauri drag-drop events.
      }
    };

    void setup();
    return () => unlisten?.();
  }, []);

  const openFromPath = async (path: string) => {
    setError("");
    try {
      const data = await readFile(path);
      const name = path.split(/[\\/]/).pop() || "statement.pdf";
      onOpen({ path, name, data });
    } catch {
      setError("Could not read that PDF. Try Browse instead.");
    }
  };

  const browse = async () => {
    setError("");
    try {
      const next = await pickPdf();
      if (next) onOpen(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not read that PDF. Try Browse instead.");
    }
  };

  const HeadingTag = headingRef ? "h1" : "p";

  if (currentFile) {
    return (
      <div className="flex h-full w-full flex-col px-8 pt-6 pb-8">
        <div className="flex min-h-0 w-full flex-1 flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <HeadingTag
              ref={headingRef}
              tabIndex={headingRef ? -1 : undefined}
              className="text-xl leading-tight font-semibold tracking-tight outline-none"
            >
              This statement
            </HeadingTag>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Continue to mark the table, or replace the file.
            </p>
          </div>
          <div className="flex min-h-0 flex-1 flex-col justify-between rounded-md border border-border bg-muted/25 px-5 py-5">
            <div className="flex min-w-0 flex-col gap-1">
              <p className="truncate text-base font-medium" title={currentFile.name}>
                {currentFile.name}
              </p>
              {currentFile.pageCount ? (
                <p className="text-sm text-muted-foreground">
                  {currentFile.pageCount} {currentFile.pageCount === 1 ? "page" : "pages"}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-3 pt-6">
              <Button disabled={busy} onClick={onKeepFile}>
                Continue with this file
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => void browse()}>
                Replace PDF…
              </Button>
            </div>
          </div>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col px-8 pt-6 pb-8">
      <div className="flex min-h-0 w-full flex-1 flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <HeadingTag
            ref={headingRef}
            tabIndex={headingRef ? -1 : undefined}
            className="text-xl leading-tight font-semibold tracking-tight outline-none"
          >
            Open a statement
          </HeadingTag>
          <p className="max-w-[46ch] text-sm leading-relaxed text-muted-foreground">
            Mark the table on the page, review the grid, then export. The PDF stays on this
            computer.
          </p>
        </div>
        <div
          className={cn(
            "flex min-h-48 flex-1 cursor-pointer flex-col rounded-md border border-dashed transition",
            dragActive
              ? "border-primary bg-primary/10"
              : "border-foreground/22 bg-muted/30 hover:border-primary/55 hover:bg-muted/45",
          )}
          onClick={() => void browse()}
        >
          <div className="flex flex-1 flex-col items-start justify-center gap-4 px-6 py-8">
            <p className="text-lg leading-none font-medium">
              {dragActive ? "Release to open" : "Drop a PDF here"}
            </p>
            {!dragActive ? (
              <Button
                disabled={busy}
                onClick={(event) => {
                  event.stopPropagation();
                  void browse();
                }}
              >
                Browse PDF
              </Button>
            ) : null}
          </div>
          <p className="px-6 pb-4 text-sm text-muted-foreground">
            Password-protected files are fine. Nothing is uploaded.
          </p>
        </div>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}
      </div>
    </div>
  );
}
