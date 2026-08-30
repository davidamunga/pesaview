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
      <div className="mx-auto flex w-full max-w-lg flex-col gap-3">
        <div className="rounded-xl border bg-card px-5 py-6">
          <HeadingTag
            ref={headingRef}
            tabIndex={headingRef ? -1 : undefined}
            className="text-base font-semibold outline-none"
          >
            This statement
          </HeadingTag>
          <p className="mt-2 truncate text-sm" title={currentFile.name}>
            {currentFile.name}
          </p>
          {currentFile.pageCount ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {currentFile.pageCount} {currentFile.pageCount === 1 ? "page" : "pages"}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button disabled={busy} onClick={onKeepFile}>
              Continue with this file
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => void browse()}>
              Replace PDF…
            </Button>
          </div>
        </div>
        {error && (
          <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-3">
      <div
        role="button"
        tabIndex={0}
        aria-label="Drop a PDF statement or browse to open one"
        className={cn(
          "relative flex min-h-52 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed px-6 py-8 text-center transition outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          dragActive
            ? "border-primary bg-primary/8"
            : "border-muted-foreground/30 bg-card hover:border-primary/50 hover:bg-muted/30",
        )}
        onClick={() => void browse()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            void browse();
          }
        }}
      >
        <HeadingTag
          ref={headingRef}
          tabIndex={headingRef ? -1 : undefined}
          className="text-base font-semibold outline-none"
        >
          {dragActive ? "Release to open" : "Drop a bank or M-PESA statement"}
        </HeadingTag>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          Then mark the transaction table, review the rows, and export CSV or Excel. The file stays
          on this device.
        </p>
        {!dragActive && (
          <Button
            className="mt-4"
            size="sm"
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation();
              void browse();
            }}
          >
            Browse PDF
          </Button>
        )}
      </div>
      {error && (
        <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
