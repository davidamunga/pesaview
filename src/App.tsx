import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Document, pdfjs } from "react-pdf";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { tempDir, join } from "@tauri-apps/api/path";
import { writeFile } from "@tauri-apps/plugin-fs";
import { FileOpener } from "@/components/file-opener";
import { PageSidebar } from "@/components/page-sidebar";
import { PasswordPrompt } from "@/components/password-prompt";
import { PdfPageView } from "@/components/pdf-page-view";
import { ReviewStep } from "@/components/review-step";
import { SelectToolbar } from "@/components/select-toolbar";
import { UpdateChecker } from "@/components/update-checker";
import { WizardHeader } from "@/components/wizard-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { applyTemplateArea } from "@/lib/coordinates";
import { matchTemplate } from "@/lib/matchTemplate";
import { pickPdf } from "@/lib/pickPdf";
import {
  canRedo,
  canUndo,
  commitHistory,
  emptyHistory,
  present,
  redoHistory,
  selectionHistoryAction,
  undoHistory,
} from "@/lib/selectionHistory";
import {
  planAutodetect,
  rememberCopy,
  stampSelectionsToEmptyPages,
  suggestLayout,
} from "@/lib/rememberLayout";
import { cn, createId, isTauri } from "@/lib/utils";
import { TabulaService } from "@/services/tabulaService";
import {
  allTemplates,
  loadCustomTemplates,
  saveCustomTemplates,
  templateFromSelections,
} from "@/services/templates";
import type {
  ExtractionMethod,
  OpenedPdf,
  PageMetrics,
  Selection,
  StatementTemplate,
  TableArea,
  WizardStep,
} from "@/types";

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

export default function App() {
  const [step, setStep] = useState<WizardStep>("upload");
  const [pdf, setPdf] = useState<OpenedPdf | null>(null);
  const [workingPath, setWorkingPath] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [boxHistory, setBoxHistory] = useState(emptyHistory);
  const [excludedPages, setExcludedPages] = useState<Set<number>>(new Set());
  const [pageMetrics, setPageMetrics] = useState<Record<number, PageMetrics>>({});
  const [method, setMethod] = useState<ExtractionMethod>("stream");
  const [needPassword, setNeedPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [customTemplates, setCustomTemplates] = useState<StatementTemplate[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<StatementTemplate | null>(null);
  const [detectSample, setDetectSample] = useState("");
  const [layoutRemembered, setLayoutRemembered] = useState(false);
  const [viewerWidth, setViewerWidth] = useState(720);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pendingPdf, setPendingPdf] = useState<OpenedPdf | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const passwordCallback = useRef<((password: string) => void) | null>(null);
  const autodetectedFor = useRef<string | null>(null);
  const pendingApply = useRef<StatementTemplate | null>(null);

  const templates = useMemo(() => allTemplates(customTemplates), [customTemplates]);
  const activeSelections = useMemo(
    () => selections.filter((selection) => !excludedPages.has(selection.page)),
    [selections, excludedPages],
  );
  const areas = useMemo<TableArea[]>(
    () => activeSelections.map(({ id: _id, ...area }) => area),
    [activeSelections],
  );
  const areaKey = JSON.stringify(areas);
  const canSelect = Boolean(pdf);
  const canReview = areas.length > 0;
  const canContinue = areas.length > 0 && !busy;
  const layoutSuggestion = useMemo(
    () => suggestLayout(detectSample, pdf?.name),
    [detectSample, pdf?.name],
  );

  useEffect(() => {
    void loadCustomTemplates().then(setCustomTemplates);
  }, []);

  useEffect(() => {
    stepHeadingRef.current?.focus();
  }, [step]);

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
    if (step !== "select") return;
    const node = viewerRef.current;
    if (!node) return;
    const update = () => setViewerWidth(Math.max(280, node.clientWidth - 24));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [step]);

  const clearWorkspace = () => {
    setPageCount(0);
    setCurrentPage(1);
    setSelections([]);
    setBoxHistory(emptyHistory());
    setExcludedPages(new Set());
    setPageMetrics({});
    setNeedPassword(false);
    setPasswordError("");
    setBusy(false);
    setStatus("");
    setActiveTemplate(null);
    setDetectSample("");
    setLayoutRemembered(false);
    passwordCallback.current = null;
    autodetectedFor.current = null;
    pendingApply.current = null;
  };

  const persistTempPdf = async (next: OpenedPdf) => {
    if (!isTauri()) {
      setWorkingPath(next.path);
      return next.path;
    }
    const dir = await tempDir();
    const path = await join(dir, `pesaview-${Date.now()}.pdf`);
    await writeFile(path, next.data);
    setWorkingPath(path);
    return path;
  };

  const openPdf = async (next: OpenedPdf) => {
    clearWorkspace();
    setPdf(next);
    setStep("select");
    try {
      await persistTempPdf(next);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  };

  const handleOpen = (next: OpenedPdf) => {
    if (pdf) {
      setPendingPdf(next);
      return;
    }
    void openPdf(next);
  };

  const changePdf = async () => {
    try {
      const next = await pickPdf();
      if (next) handleOpen(next);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  };

  const replaceBoxes = (next: Selection[], record = true) => {
    if (record) {
      setBoxHistory((history) => commitHistory(history, next));
    }
    setSelections(next);
  };

  const undoBoxes = useCallback(() => {
    setBoxHistory((history) => {
      if (!canUndo(history)) return history;
      const next = undoHistory(history);
      setSelections(present(next));
      return next;
    });
  }, []);

  const redoBoxes = useCallback(() => {
    setBoxHistory((history) => {
      if (!canRedo(history)) return history;
      const next = redoHistory(history);
      setSelections(present(next));
      return next;
    });
  }, []);

  useEffect(() => {
    if (step !== "select") return;
    const onKeyDown = (event: KeyboardEvent) => {
      const action = selectionHistoryAction(event);
      if (!action) return;
      event.preventDefault();
      if (action === "undo") undoBoxes();
      else redoBoxes();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [step, undoBoxes, redoBoxes]);

  const setExtractionMethod = (next: ExtractionMethod) => {
    setMethod(next);
    setSelections((current) => {
      const mapped = current.map((selection) => ({ ...selection, method: next }));
      setBoxHistory((history) => commitHistory(history, mapped));
      return mapped;
    });
    setStatus(
      next === "lattice"
        ? "Using ruled lines. Draw or adjust the box if columns still look off."
        : "Using flowing text.",
    );
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
      const pageAreas = specific.length > 0 ? specific : template.areas.filter((area) => area.page === 0);
      for (const area of pageAreas) {
        next.push(applyTemplateArea(area, page, metrics, { normalized: template.normalized }));
      }
    }
    replaceBoxes(next);
    setActiveTemplate(template);
    setStatus(`Applied “${template.name}”. Adjust the boxes if the table looks off.`);
  };

  const rememberLayout = async (name: string, extras?: { columns?: string[]; match?: string[] }) => {
    const metrics = pageMetrics[currentPage] ?? Object.values(pageMetrics)[0];
    if (!metrics || selections.length === 0) return;
    const suggestion = suggestLayout(detectSample, pdf?.name);
    const match = extras?.match ?? activeTemplate?.match ?? suggestion.match;
    const template = templateFromSelections(
      name,
      selections,
      metrics,
      {
        skipRows: activeTemplate?.skipRows,
        columns: extras?.columns ?? activeTemplate?.columns,
        match: match.length > 0 ? match : undefined,
        mergeRows: activeTemplate?.mergeRows,
      },
      pageMetrics,
    );
    const next = [...customTemplates, template];
    setCustomTemplates(next);
    await saveCustomTemplates(next);
    setActiveTemplate(template);
    setLayoutRemembered(true);
    setStatus(`Saved “${name}” for later statements with this layout.`);
  };

  const handleSelectionsChange = (next: Selection[], options?: { commit?: boolean }) => {
    const stamped = stampSelectionsToEmptyPages(
      next,
      includedPages(),
      pageMetrics,
      pageMetrics[currentPage],
    );
    replaceBoxes(stamped, options?.commit !== false);
    if (stamped.length > next.length) {
      setStatus("Using this box on the other pages. Continue to check the rows.");
    }
  };

  const autodetect = async () => {
    if (!workingPath || !isTauri()) return;
    setBusy(true);
    setStatus("Looking for transaction tables…");
    try {
      const pages = pageCount > 0 ? includedPages().join(",") : "all";
      const { areas: foundAreas, raw } = await TabulaService.guessTables(workingPath, pdf?.password, pages);
      const next = foundAreas
        .filter((area) => !excludedPages.has(area.page))
        .map((area) => ({
          ...area,
          id: createId(),
          method: "stream" as ExtractionMethod,
        }));
      const matched = matchTemplate(raw, templates);
      const plan = planAutodetect(next.length, matched);
      setMethod("stream");
      setDetectSample(raw);
      if (plan.kind === "found") {
        const stamped = stampSelectionsToEmptyPages(
          next,
          includedPages(),
          pageMetrics,
          pageMetrics[currentPage],
        );
        replaceBoxes(stamped);
        setActiveTemplate(matched ?? null);
        setStatus(
          stamped.length > next.length
            ? `${plan.status.replace(/\.$/, "")}. Using this box on the other pages.`
            : plan.status,
        );
        return;
      }
      if (plan.kind === "apply-match") {
        const fallback = pageMetrics[currentPage] ?? pageMetrics[1];
        if (fallback) {
          applyTemplate(plan.template);
        } else {
          pendingApply.current = plan.template;
          setActiveTemplate(plan.template);
          setStatus(plan.status);
        }
        return;
      }
      replaceBoxes([]);
      setActiveTemplate(null);
      setStatus(plan.status);
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
    if (!workingPath || pageCount < 1 || !isTauri()) return;
    if (autodetectedFor.current === workingPath) return;
    autodetectedFor.current = workingPath;
    void autodetect();
    // Autodetect once per opened file after the page count is known.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workingPath, pageCount]);

  useEffect(() => {
    const pending = pendingApply.current;
    if (!pending || pageCount < 1) return;
    const fallback = pageMetrics[currentPage] ?? pageMetrics[1];
    if (!fallback) return;
    pendingApply.current = null;
    applyTemplate(pending);
    // Apply a matched layout once the first page has metrics.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageMetrics, currentPage, pageCount]);

  const extractQuery = useQuery({
    queryKey: [
      "extract",
      workingPath,
      areaKey,
      pdf?.password ?? "",
      activeTemplate?.id ?? "",
      activeTemplate?.skipRows,
      activeTemplate?.columns,
      activeTemplate?.mergeRows,
    ],
    queryFn: () =>
      TabulaService.extractTables(workingPath!, areas, pdf?.password, {
        skipRows: activeTemplate?.skipRows,
        columns: activeTemplate?.columns,
        mergeRows: activeTemplate?.mergeRows,
      }),
    enabled: step === "review" && isTauri() && Boolean(workingPath) && areas.length > 0,
  });

  useEffect(() => {
    const message = extractQuery.error instanceof Error ? extractQuery.error.message : "";
    if (!message || !TabulaService.isPasswordError(message)) return;
    setNeedPassword(true);
    setPasswordError("This PDF needs a password.");
  }, [extractQuery.error]);

  const submitPassword = (password: string) => {
    passwordCallback.current?.(password);
    passwordCallback.current = null;
    setPdf((current) => (current ? { ...current, password } : current));
    setNeedPassword(false);
    setPasswordError("");
  };

  const cancelPassword = () => {
    passwordCallback.current = null;
    setNeedPassword(false);
    setPasswordError("");
    setStatus("This statement needs a password to preview or extract.");
  };

  const goStep = (next: WizardStep) => {
    if (next === "upload") {
      setStep("upload");
      return;
    }
    if (next === "select" && pdf) {
      setStep("select");
      return;
    }
    if (next === "review" && canReview) {
      setStep("review");
    }
  };

  const continueHint = busy
    ? "Wait until the tables are found."
    : selections.length > 0 && areas.length === 0
      ? "Include a page to continue."
      : "Draw a box around the transaction rows first.";

  const extractError =
    extractQuery.error instanceof Error
      ? TabulaService.isPasswordError(extractQuery.error.message)
        ? "Unlock the PDF to extract these tables."
        : extractQuery.error.message
      : undefined;

  return (
    <div className="relative flex h-full flex-col">
      <UpdateChecker autoCheck />
      <WizardHeader
        step={step}
        canSelect={canSelect}
        canReview={canReview}
        fileName={pdf?.name}
        onStep={goStep}
      />

      <div
        hidden={step !== "upload" && Boolean(pdf)}
        inert={step !== "upload" && Boolean(pdf) ? true : undefined}
        className={cn(
          "min-h-0 flex-1 flex-col",
          step === "upload" || !pdf ? "flex" : "hidden",
        )}
      >
        <FileOpener
          onOpen={handleOpen}
          busy={busy}
          currentFile={pdf ? { name: pdf.name, pageCount: pageCount || undefined } : undefined}
          onKeepFile={() => setStep("select")}
          headingRef={step === "upload" ? stepHeadingRef : undefined}
        />
      </div>

      {pdf && (
        <div
          hidden={step !== "select"}
          inert={step !== "select" ? true : undefined}
          className={cn("min-h-0 flex-1 flex-col", step === "select" ? "flex" : "hidden")}
        >
          <SelectToolbar
            headingRef={step === "select" ? stepHeadingRef : undefined}
            selectionCount={areas.length}
            busy={busy}
            canAutodetect={isTauri()}
            method={method}
            templates={templates}
            continueHint={continueHint}
            canContinue={canContinue}
            canUndo={canUndo(boxHistory)}
            canRedo={canRedo(boxHistory)}
            onUndo={undoBoxes}
            onRedo={redoBoxes}
            onMethodChange={setExtractionMethod}
            onApplyTemplate={applyTemplate}
            onSaveTemplate={(name) => void rememberLayout(name)}
            onClear={() => {
              replaceBoxes([]);
              setActiveTemplate(null);
              setStatus("");
            }}
            onAutodetect={() => void autodetect()}
            onContinue={() => setStep("review")}
            onChangePdf={() => void changePdf()}
          />

          <div className="relative flex min-h-0 flex-1">
            {!pdfUrl ? (
              <p className="p-3 text-sm text-muted-foreground">Preparing PDF…</p>
            ) : (
              <Document
                className="flex min-h-0 flex-1"
                file={pdfUrl}
                loading={<p className="p-3 text-sm text-muted-foreground">Rendering statement…</p>}
                onLoadSuccess={(doc) => {
                  setPageCount(doc.numPages);
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
                <div ref={viewerRef} className="relative min-w-0 flex-1 overflow-auto bg-background">
                  {selections.length === 0 && !busy && (
                    <p className="pointer-events-none absolute top-4 left-1/2 z-10 -translate-x-1/2 rounded-full border bg-card px-3 py-1.5 text-sm text-muted-foreground shadow-xs">
                      Drag a box around the transaction rows
                    </p>
                  )}
                  {selections.length > 0 && areas.length === 0 && (
                    <p className="pointer-events-none absolute top-4 left-1/2 z-10 -translate-x-1/2 rounded-full border bg-card px-3 py-1.5 text-sm text-muted-foreground shadow-xs">
                      Include a page to continue
                    </p>
                  )}
                  <div className="flex justify-center p-2">
                    {pageCount > 0 && (
                      <PdfPageView
                        pageNumber={currentPage}
                        width={viewerWidth}
                        selections={selections}
                        defaultMethod={method}
                        onSelectionsChange={handleSelectionsChange}
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
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/90 p-6">
                <PasswordPrompt
                  fileName={pdf.name}
                  error={passwordError}
                  busy={busy}
                  onSubmit={submitPassword}
                  onCancel={cancelPassword}
                />
              </div>
            )}
          </div>

          {status && (
            <div className="border-t bg-card px-2 py-1 text-xs text-muted-foreground">{status}</div>
          )}
        </div>
      )}

      {pdf && step === "review" && (
        <ReviewStep
          key={`${workingPath}-${areaKey}`}
          headingRef={stepHeadingRef}
          tables={extractQuery.data ?? []}
          fileName={pdf.name}
          loading={extractQuery.isFetching}
          error={extractError}
          canExtract={isTauri()}
          templateName={activeTemplate?.name}
          boxCount={areas.length}
          onBack={() => setStep("select")}
          onChangePdf={() => void changePdf()}
          canRemember={!activeTemplate && !layoutRemembered}
          suggestedLayoutName={layoutSuggestion.name}
          rememberPrompt={rememberCopy(layoutSuggestion.name)}
          onRememberLayout={(payload) => void rememberLayout(payload.name, { columns: payload.columns })}
        />
      )}

      {needPassword && step === "review" && pdf && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/90 p-6">
          <PasswordPrompt
            fileName={pdf.name}
            error={passwordError}
            busy={busy}
            onSubmit={submitPassword}
            onCancel={cancelPassword}
          />
        </div>
      )}

      <Dialog open={pendingPdf !== null} onOpenChange={(open) => !open && setPendingPdf(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Replace with {pendingPdf?.name}?</DialogTitle>
            <DialogDescription>
              Table boxes and any cell corrections will be cleared.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="destructive-outline"
              onClick={() => {
                const next = pendingPdf;
                setPendingPdf(null);
                if (next) void openPdf(next);
              }}
            >
              Replace PDF
            </Button>
            <Button onClick={() => setPendingPdf(null)}>Keep this file</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
