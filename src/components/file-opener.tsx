import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { FileUp, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OpenedPdf } from "@/types";

interface FileOpenerProps {
  onOpen: (pdf: OpenedPdf) => void;
  busy?: boolean;
}

export function FileOpener({ onOpen, busy }: FileOpenerProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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
        // Browser / non-Tauri fallback uses the hidden file input.
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

  const isTauriRuntime = () =>
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  const browse = async () => {
    setError("");
    if (!isTauriRuntime()) {
      inputRef.current?.click();
      return;
    }
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (typeof selected === "string") {
        await openFromPath(selected);
      }
    } catch {
      inputRef.current?.click();
    }
  };

  const onInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF file.");
      return;
    }
    const data = new Uint8Array(await file.arrayBuffer());
    onOpen({ path: file.name, name: file.name, data });
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <div
        className={cn(
          "relative flex min-h-72 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed px-8 py-12 text-center transition",
          dragActive
            ? "border-primary bg-primary/8 scale-[1.01]"
            : "border-muted-foreground/30 bg-card hover:border-primary/50 hover:bg-muted/30",
        )}
        role="button"
        tabIndex={0}
        onClick={() => void browse()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") void browse();
        }}
      >
        <FileUp
          className={cn(
            "mb-4 size-11 stroke-[1.25]",
            dragActive ? "text-primary" : "text-muted-foreground/60",
          )}
        />
        <h2 className="text-lg font-semibold">
          {dragActive ? "Release to open" : "Drop a bank or M-PESA statement"}
        </h2>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          Preview the PDF, draw table regions, then export CSV or Excel. Files stay on this device.
        </p>
        {!dragActive && (
          <Button className="mt-6" disabled={busy} onClick={() => void browse()}>
            Browse PDF
          </Button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(event) => void onInputChange(event)}
      />
      {error && (
        <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Shield className="size-3.5" />
        100% local — Tabula runs on your machine
      </p>
    </div>
  );
}
