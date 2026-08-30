import { useEffect, useMemo, useRef, useState } from "react";
import { Document, pdfjs } from "react-pdf";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { tempDir, join } from "@tauri-apps/api/path";
import { writeFile } from "@tauri-apps/plugin-fs";
import { FileOpener } from "@/components/file-opener";
import { PageSidebar } from "@/components/page-sidebar";
import { PasswordPrompt } from "@/components/password-prompt";
import { PdfPageView } from "@/components/pdf-page-view";
import { PreviewDialog } from "@/components/preview-dialog";
import { WorkspaceToolbar } from "@/components/workspace-toolbar";
import { applyTemplateArea } from "@/lib/coordinates";
import { matchTemplate } from "@/lib/matchTemplate";
import { createId } from "@/lib/utils";
import { TabulaService } from "@/services/tabulaService";
import {
  allTemplates,
  loadCustomTemplates,
  saveCustomTemplates,
  templateFromSelections,
} from "@/services/templates";
import type {
  AppScreen,
  ExtractionMethod,
  ExtractedTable,
  OpenedPdf,
  PageMetrics,
  Selection,
  StatementTemplate,
} from "@/types";

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

export default function App() {
  const [screen, setScreen] = useState<AppScreen>("open");
  const [pdf, setPdf] = useState<OpenedPdf | null>(null);
  const [workingPath, setWorkingPath] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [excludedPages, setExcludedPages] = useState<Set<number>>(new Set());
  const [pageMetrics, setPageMetrics] = useState<Record<number, PageMetrics>>({});
  const [method, setMethod] = useState<ExtractionMethod>("stream");
  const [needPassword, setNeedPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [tables, setTables] = useState<ExtractedTable[]>([]);
  const [customTemplates, setCustomTemplates] = useState<StatementTemplate[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<StatementTemplate | null>(null);
  const [viewerWidth, setViewerWidth] = useState(720);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const passwordCallback = useRef<((password: string) => void) | null>(null);
  const autodetectedFor = useRef<string | null>(null);

  const templates = useMemo(() => allTemplates(customTemplates), [customTemplates]);

  useEffect(() => {
    void loadCustomTemplates().then(setCustomTemplates);
  }, []);

  useEffect(() => {
    if (!pdf) {
      setPdfUrl(null);
      return;
    }
    const copy = new ArrayBuffer(pdf.data.byteLength);
    new Uint8Array(copy).set(pdf.data);
    const url = URL.createObjectURL(new Blob([copy], { type: "application/pdf" }));
    setPdfUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pdf]);

  useEffect(() => {
    const node = viewerRef.current;
    if (!node) return;
    const update = () => setViewerWidth(Math.max(360, node.clientWidth - 48));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [screen]);

  const reset = () => {
    setScreen("open");
    setPdf(null);
    setWorkingPath(null);
    setPageCount(0);
    setCurrentPage(1);
    setSelections([]);
    setExcludedPages(new Set());
    setPageMetrics({});
    setNeedPassword(false);
    setPasswordError("");
    setBusy(false);
    setStatus("");
    setPreviewOpen(false);
    setTables([]);
    setActiveTemplate(null);
    passwordCallback.current = null;
    autodetectedFor.current = null;
  };

  const persistTempPdf = async (next: OpenedPdf) => {
    if (typeof window !== "undefined" && !("__TAURI_INTERNALS__" in window)) {
      setWorkingPath(next.path);
      return next.path;
    }
    const dir = await tempDir();
    const path = await join(dir, `pesaview-${Date.now()}.pdf`);
    await writeFile(path, next.data);
    setWorkingPath(path);
    return path;
  };

  const handleOpen = async (next: OpenedPdf) => {
    setPdf(next);
    setNeedPassword(false);
    setPasswordError("");
    setScreen("workspace");
    try {
      await persistTempPdf(next);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  };

  const includedPages = () =>
    Array.from({ length: pageCount }, (_, i) => i + 1).filter((page) => !excludedPages.has(page));

  const applyTemplate = (template: StatementTemplate) => {
    const fallback = pageMetrics[currentPage];
    if (!fallback) {
      setStatus("Wait for the page to finish rendering, then apply the template again.");
      return;
    }
    const next: Selection[] = [];
    for (const page of includedPages()) {
      const metrics = pageMetrics[page] ?? fallback;
      const specific = template.areas.filter((area) => area.page === page);
      const areas = specific.length > 0 ? specific : template.areas.filter((area) => area.page === 0);
      for (const area of areas) {
        next.push(applyTemplateArea(area, page, metrics, { normalized: template.normalized }));
      }
    }
    setSelections(next);
    setActiveTemplate(template);
    setStatus(`Applied “${template.name}”. Adjust the boxes if needed.`);
  };

  const saveTemplate = async (name: string) => {
    const metrics = pageMetrics[currentPage];
    if (!metrics || selections.length === 0) return;
    const template = templateFromSelections(name, selections, metrics, {
      skipRows: activeTemplate?.skipRows,
      columns: activeTemplate?.columns,
      match: activeTemplate?.match,
      mergeRows: activeTemplate?.mergeRows,
    });
    const next = [...customTemplates, template];
    setCustomTemplates(next);
    await saveCustomTemplates(next);
    setStatus(`Saved template “${name}”.`);
  };

  const autodetect = async () => {
    if (!workingPath) return;
    if (typeof window !== "undefined" && !("__TAURI_INTERNALS__" in window)) {
      setStatus("Autodetect needs the desktop app (pnpm tauri dev).");
      return;
    }
    setBusy(true);
    setStatus("Autodetecting tables…");
    try {
      const pages = pageCount > 0 ? includedPages().join(",") : "all";
      const { areas, raw } = await TabulaService.guessTables(workingPath, pdf?.password, pages);
      const next = areas
        .filter((area) => !excludedPages.has(area.page))
        .map((area) => ({
          ...area,
          id: createId(),
          method: "stream" as ExtractionMethod,
        }));
      const matched = matchTemplate(raw, templates);
      setMethod("stream");
      setSelections(next);
      setActiveTemplate(matched ?? null);
      const found = next.length
        ? `Found ${next.length} table region${next.length === 1 ? "" : "s"}.`
        : "No tables detected. Draw a box instead.";
      setStatus(matched ? `${found} Using “${matched.name}” cleanup.` : found);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (TabulaService.isPasswordError(message)) {
        setNeedPassword(true);
        setPasswordError("This PDF needs a password.");
      } else {
        setStatus(message);
      }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!workingPath || pageCount < 1) return;
    if (typeof window !== "undefined" && !("__TAURI_INTERNALS__" in window)) return;
    if (autodetectedFor.current === workingPath) return;
    autodetectedFor.current = workingPath;
    void autodetect();
  }, [workingPath, pageCount]);

  const preview = async () => {
    if (!workingPath) return;
    const areas = selections
      .filter((selection) => !excludedPages.has(selection.page))
      .map(({ id: _id, ...area }) => area);
    if (areas.length === 0) return;
    setBusy(true);
    setStatus("Extracting selected tables…");
    try {
      const extracted = await TabulaService.extractTables(workingPath, areas, pdf?.password, {
        skipRows: activeTemplate?.skipRows,
        columns: activeTemplate?.columns,
        mergeRows: activeTemplate?.mergeRows,
      });
      setTables(extracted);
      setPreviewOpen(true);
      setStatus("");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (TabulaService.isPasswordError(message)) {
        setNeedPassword(true);
        setPasswordError("This PDF needs a password.");
      } else {
        setStatus(message);
      }
    } finally {
      setBusy(false);
    }
  };

  const submitPassword = (password: string) => {
    passwordCallback.current?.(password);
    passwordCallback.current = null;
    setPdf((current) => (current ? { ...current, password } : current));
    setNeedPassword(false);
    setPasswordError("");
  };

  if (!pdf || screen === "open") {
    return (
      <div className="flex h-full flex-col">
        <header className="border-b bg-card px-6 py-4">
          <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground">PESAVIEW</p>
          <h1 className="text-2xl font-semibold tracking-tight">Extract statement tables</h1>
        </header>
        <main className="flex flex-1 items-center px-6">
          <FileOpener onOpen={(next) => void handleOpen(next)} busy={busy} />
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <WorkspaceToolbar
        fileName={pdf.name}
        selectionCount={selections.filter((selection) => !excludedPages.has(selection.page)).length}
        busy={busy}
        method={method}
        templates={templates}
        onMethodChange={setMethod}
        onApplyTemplate={applyTemplate}
        onSaveTemplate={(name) => void saveTemplate(name)}
        onClear={() => {
          setSelections([]);
          setActiveTemplate(null);
        }}
        onAutodetect={() => void autodetect()}
        onPreview={() => void preview()}
        onClose={reset}
      />

      <div className="relative flex min-h-0 flex-1">
        {!pdfUrl ? (
          <p className="p-6 text-sm text-muted-foreground">Preparing PDF…</p>
        ) : (
          <Document
            className="flex min-h-0 flex-1"
            file={pdfUrl}
            loading={<p className="p-6 text-sm text-muted-foreground">Rendering statement…</p>}
            onLoadSuccess={(doc) => {
              setPageCount(doc.numPages);
              setCurrentPage(1);
            }}
            onPassword={(callback) => {
              passwordCallback.current = callback;
              setNeedPassword(true);
            }}
            onLoadError={(error) => {
              if (TabulaService.isPasswordError(error.message)) {
                setNeedPassword(true);
                setPasswordError("Incorrect or missing password.");
              } else {
                setStatus(error.message);
              }
            }}
          >
            <PageSidebar
              pageCount={pageCount}
              currentPage={currentPage}
              excludedPages={excludedPages}
              selections={selections}
              pageMetrics={pageMetrics}
              onSelect={setCurrentPage}
              onExclude={(page) => {
                setExcludedPages((current) => {
                  const next = new Set(current);
                  if (next.has(page)) next.delete(page);
                  else next.add(page);
                  return next;
                });
              }}
            />
            <div ref={viewerRef} className="min-w-0 flex-1 overflow-auto bg-[oklch(90%_0.01_247)]">
              <div className="flex justify-center p-6">
                {pageCount > 0 && (
                  <PdfPageView
                    pageNumber={currentPage}
                    width={viewerWidth}
                    selections={selections}
                    defaultMethod={method}
                    onSelectionsChange={setSelections}
                    onMetrics={(metrics) =>
                      setPageMetrics((current) => ({ ...current, [currentPage]: metrics }))
                    }
                  />
                )}
              </div>
            </div>
          </Document>
        )}
        {needPassword && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/85 p-6 backdrop-blur-sm">
            <PasswordPrompt
              fileName={pdf.name}
              error={passwordError}
              busy={busy}
              onSubmit={submitPassword}
              onCancel={reset}
            />
          </div>
        )}
      </div>

      {status && (
        <div className="border-t bg-card px-4 py-2 text-sm text-muted-foreground">{status}</div>
      )}

      <PreviewDialog
        open={previewOpen}
        tables={tables}
        fileName={pdf.name}
        onOpenChange={setPreviewOpen}
      />
    </div>
  );
}
