import { useEffect, useRef, useState, type RefObject } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { readFile } from "@tauri-apps/plugin-fs";
import { Button } from "@/components/ui/button";
import { pickPdf, pickPdfs, pdfPathsFromDrop, pickedFromPath, type PickedPdf } from "@/lib/pickPdf";
import { cn, isTauri } from "@/lib/utils";
import type { OpenedPdf } from "@/types";

interface FileOpenerProps {
  onOpen: (pdf: OpenedPdf) => void;
  onBatch?: (picked: PickedPdf[]) => void;
  onBackToBatch?: () => void;
  busy?: boolean;
  currentFile?: { name: string; pageCount?: number };
  onKeepFile?: () => void;
  headingRef?: RefObject<HTMLHeadingElement | null>;
}

export function FileOpener({
  onOpen,
  onBatch,
  onBackToBatch,
  busy,
  currentFile,
  onKeepFile,
  headingRef,
}: FileOpenerProps) {
  const [dragActive, setDragActive] = useState(false);
  const [dragCount, setDragCount] = useState(0);
  const [error, setError] = useState("");
  const onOpenRef = useRef(onOpen);
  const onBatchRef = useRef(onBatch);
  onOpenRef.current = onOpen;
  onBatchRef.current = onBatch;

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setup = async () => {
      try {
        const webview = getCurrentWebview();
        unlisten = await webview.onDragDropEvent((event) => {
          if (event.payload.type === "enter") {
            setDragActive(true);
            setDragCount(pdfPathsFromDrop(event.payload.paths).length);
          } else if (event.payload.type === "over") {
            setDragActive(true);
          } else if (event.payload.type === "drop") {
            setDragActive(false);
            setDragCount(0);
            const pdfs = pdfPathsFromDrop(event.payload.paths);
            if (pdfs.length === 0) {
              setError("Drop a PDF statement to continue.");
              return;
            }
            if (pdfs.length > 1 && onBatchRef.current) {
              setError("");
              onBatchRef.current(pdfs.map(pickedFromPath));
              return;
            }
            void openFromPath(pdfs[0]);
          } else {
            setDragActive(false);
            setDragCount(0);
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
      const picked = pickedFromPath(path);
      onOpenRef.current({ ...picked, data });
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

  const browseSeveral = async () => {
    setError("");
    if (!isTauri() || !onBatch) {
      setError("Extracting several statements needs the desktop app.");
      return;
    }
    try {
      const picked = await pickPdfs();
      if (!picked || picked.length === 0) return;
      if (picked.length === 1) {
        void openFromPath(picked[0].path);
        return;
      }
      onBatch(picked);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not read those PDFs.");
    }
  };

  const HeadingTag = headingRef ? "h1" : "p";
  const dropHint =
    dragActive && dragCount > 1
      ? "Release to open these statements"
      : dragActive
        ? "Release to open"
        : "Drop a PDF here";

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
              {onBackToBatch ? (
                <Button variant="ghost" disabled={busy} onClick={onBackToBatch}>
                  Back to batch
                </Button>
              ) : null}
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
            <p className="text-lg leading-none font-medium">{dropHint}</p>
            {!dragActive ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  disabled={busy}
                  onClick={(event) => {
                    event.stopPropagation();
                    void browse();
                  }}
                >
                  Browse PDF
                </Button>
                {onBatch && isTauri() ? (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={(event) => {
                      event.stopPropagation();
                      void browseSeveral();
                    }}
                  >
                    Several statements…
                  </Button>
                ) : null}
              </div>
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
