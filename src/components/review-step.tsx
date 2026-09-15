import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  applyReviewEdits,
  columnShift,
  columnSuspects,
  correctionsFromEdits,
  droppedRowLabel,
  editKey,
  isDateColumn,
  isMoneyColumn,
  isNarrativeColumn,
  projectReview,
  reviewToTables,
  rowMatchesQuery,
  tablesToReview,
  type CellKind,
  type ColumnMismatch,
  type ColumnSuspect,
} from "@/lib/reviewGrid";
import { windowedRange } from "@/lib/windowedRows";
import {
  formatElapsed,
  readingDetail,
  readingHeadline,
  readingHint,
  readingRatio,
  type ExtractProgress,
} from "@/lib/extractWait";
import { exportCsv, exportXlsx } from "@/services/exportService";
import type { ExtractedTable, ReviewRow } from "@/types";
import { cn } from "@/lib/utils";

const apple =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
const findShortcut = apple ? "⌘F" : "Ctrl+F";

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, ReviewRow>();

const editedMark = "bg-amber-200/80 dark:bg-amber-400/25";

type HeaderRole = "page" | "date" | "narrative" | "money" | "plain";

function headerRole(id: string, names: string[]): HeaderRole | "drop" {
  if (id === "drop") return "drop";
  if (id === "page") return "page";
  const name = names[Number(id.slice(1))] ?? "";
  if (isDateColumn(name)) return "date";
  if (isMoneyColumn(name)) return "money";
  if (isNarrativeColumn(name)) return "narrative";
  return "plain";
}

function roleClass(role: HeaderRole | "drop", grow: boolean): string {
  if (role === "drop") return "ledger-drop";
  if (role === "page") return "ledger-page";
  if (role === "date") return "ledger-date";
  if (role === "money") return "ledger-money";
  if (grow) return "ledger-grow";
  return "ledger-plain";
}

interface ReviewEditContextValue {
  names: string[];
  sourceNames: string[];
  edits: Record<string, string>;
  original: ReviewRow[];
  visibleCount: number;
  suspects: ColumnSuspect[];
  mismatches: ColumnMismatch[];
  rename: (index: number, next: string) => void;
  remove: (index: number) => void;
  dropRow: (id: string) => void;
  editCell: (rowId: string, index: number, next: string) => void;
}

const ReviewEditContext = createContext<ReviewEditContextValue | null>(null);

function useReviewEdit() {
  const context = useContext(ReviewEditContext);
  if (!context) {
    throw new Error("Review editors must render inside ReviewStep");
  }
  return context;
}

function kindCopy(kind: CellKind): string {
  if (kind === "status") return "status words";
  if (kind === "narrative") return "details";
  if (kind === "datetime") return "dates or times";
  if (kind === "money") return "amounts";
  return "receipts";
}

function ColumnHeader({ index }: { index: number }) {
  const { names, sourceNames, visibleCount, suspects, mismatches, rename, remove } = useReviewEdit();
  const label = names[index] || `Column ${index + 1}`;
  const renamed = label !== (sourceNames[index] || `Column ${index + 1}`);
  const suspect = suspects.find((item) => item.index === index);
  const mismatch = mismatches.find((item) => item.index === index);
  const money = isMoneyColumn(label);
  const lastColumn = visibleCount <= 1;
  const note = mismatch
    ? `Looks like ${kindCopy(mismatch.found)}`
    : suspect
      ? lastColumn
        ? `${suspect.reason} · keep one`
        : suspect.reason
      : null;

  return (
    <div className="group/header flex min-w-0 flex-col gap-0.5">
      <div className="flex items-center gap-1">
        <input
          className={cn(
            "ledger-title h-7 min-w-0 flex-1 border-b border-transparent bg-transparent px-0.5 text-foreground outline-none",
            "hover:border-current/25 focus-visible:border-current",
            money && "text-right tabular-nums",
            renamed && editedMark,
            (suspect || mismatch) && "border-current/35",
          )}
          value={label}
          aria-label={`Column name ${index + 1}`}
          aria-describedby={note ? `suspect-${index}` : undefined}
          onChange={(event) => rename(index, event.target.value)}
        />
        <button
          type="button"
          aria-label={`Remove ${label}`}
          title={lastColumn ? "Keep at least one column" : `Remove ${label}`}
          disabled={lastColumn}
          className={cn(
            "inline-flex size-8 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none",
            "opacity-50 hover:bg-muted hover:text-foreground hover:opacity-100",
            "focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring",
            "group-hover/header:opacity-100 pointer-coarse:size-11 pointer-coarse:opacity-80",
            (suspect || mismatch) && !lastColumn && "opacity-100",
            lastColumn && "opacity-40",
          )}
          onClick={() => remove(index)}
        >
          <X className="size-3" />
        </button>
      </div>
      {note && (
        <p id={`suspect-${index}`} className="ledger-suspect">
          {note}
        </p>
      )}
    </div>
  );
}

function RowDropButton({ row, rowIndex }: { row: ReviewRow; rowIndex: number }) {
  const { dropRow } = useReviewEdit();
  return (
    <button
      type="button"
      aria-label={`Drop row ${rowIndex + 1}`}
      title="Drop this row"
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-sm text-muted-foreground outline-none",
        "opacity-50 hover:bg-muted hover:text-foreground hover:opacity-100",
        "focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring",
        "group-hover/row:opacity-100 group-focus-within/row:opacity-100",
        "pointer-coarse:size-11 pointer-coarse:opacity-80",
      )}
      onClick={() => dropRow(row.id)}
    >
      <X className="size-3" />
    </button>
  );
}

function CellEditor({
  row,
  index,
  rowIndex,
  value,
}: {
  row: ReviewRow;
  index: number;
  rowIndex: number;
  value: string;
}) {
  const { names, edits, original, editCell } = useReviewEdit();
  const key = editKey(row.id, index);
  const label = names[index] || `Column ${index + 1}`;
  const source = original.find((item) => item.id === row.id)?.cells[index] ?? "";
  const dirty = key in edits && edits[key] !== source;
  const money = isMoneyColumn(label);
  const narrative = isNarrativeColumn(label);
  const empty = value.trim() === "";
  const fieldClass = cn(
    "w-full min-w-0 bg-transparent px-0.5 text-foreground outline-none",
    "focus-visible:bg-black/4 dark:focus-visible:bg-white/6",
    narrative ? "ledger-narrative-input" : "h-8 overflow-hidden text-[13px] leading-5 whitespace-nowrap",
    money && "ledger-amount text-right tracking-tight",
    money && empty && "text-current/35",
    dirty && `rounded-sm ${editedMark}`,
  );
  const fieldProps = {
    className: fieldClass,
    value,
    "aria-label": `${label}, row ${rowIndex + 1}`,
    onChange: (event: { target: { value: string } }) => editCell(row.id, index, event.target.value),
  };
  if (narrative) {
    return <textarea rows={1} {...fieldProps} />;
  }
  return <input {...fieldProps} />;
}

interface ReviewStepProps {
  tables: ExtractedTable[];
  fileName: string;
  loading?: boolean;
  extractProgress?: ExtractProgress | null;
  error?: string;
  canExtract: boolean;
  templateName?: string;
  boxCount?: number;
  headingRef?: RefObject<HTMLHeadingElement | null>;
  onBack: () => void;
  onChangePdf: () => void;
  canRemember?: boolean;
  suggestedLayoutName?: string;
  rememberPrompt?: string;
  onRememberLayout?: (payload: { name: string; columns: string[] }) => void;
}

function LedgerWait({
  boxCount,
  progress,
}: {
  boxCount: number;
  progress: ExtractProgress | null;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const id = window.setInterval(() => setElapsed(Date.now() - started), 1000);
    return () => window.clearInterval(id);
  }, []);
  const ratio = readingRatio(progress);
  const elapsedLabel = formatElapsed(elapsed);
  const columns = [
    { key: "page", className: "ledger-page", align: "left" as const, header: 0.55, pattern: [0.4, 0.38, 0.42, 0.36] },
    { key: "date", className: "ledger-date", align: "left" as const, header: 0.62, pattern: [0.7, 0.66, 0.72, 0.64] },
    { key: "details", className: "ledger-grow", align: "left" as const, header: 0.28, pattern: [0.82, 0.58, 0.74, 0.9, 0.46, 0.68] },
    { key: "in", className: "ledger-money", align: "right" as const, header: 0.5, pattern: [0.48, 0.22, 0.4, 0.18] },
    { key: "out", className: "ledger-money", align: "right" as const, header: 0.58, pattern: [0.36, 0.5, 0.28, 0.46] },
  ];
  const rowCount = 16;

  return (
    <div className="ledger-sheet ledger-wait" role="status" aria-live="polite">
      <div className="ledger-wait-meta">
        <div className="ledger-wait-copy">
          <strong>{readingHeadline(boxCount)}</strong>
          <p>{readingDetail(progress, boxCount)}</p>
          <p>{readingHint(boxCount)}</p>
        </div>
        {elapsedLabel ? <p className="ledger-wait-elapsed">{elapsedLabel}</p> : null}
      </div>
      <div
        className="ledger-wait-rule"
        data-indeterminate={ratio == null ? "true" : undefined}
        aria-hidden
      >
        <span style={ratio == null ? undefined : { width: `${Math.round(ratio * 100)}%` }} />
      </div>
      <div className="ledger-scroll" aria-hidden>
        <Table className="ledger ledger-wait-ink w-max min-w-full" containerClassName="overflow-visible w-max min-w-full">
          <TableHeader>
            <TableRow className="border-0 hover:bg-transparent">
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn("h-auto py-2 align-bottom", column.className, column.align === "right" && "text-right")}
                >
                  <span className="ledger-ghost" style={{ width: `${column.header * 100}%`, marginLeft: column.align === "right" ? "auto" : undefined }} />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rowCount }, (_, row) => (
              <TableRow key={row} data-alt={row % 2 === 1 ? "true" : undefined} className="border-0 hover:bg-transparent">
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={cn("py-2.5", column.className, column.align === "right" && "text-right")}
                  >
                    <span
                      className="ledger-ghost"
                      style={{
                        width: `${column.pattern[row % column.pattern.length] * 100}%`,
                        marginLeft: column.align === "right" ? "auto" : undefined,
                        animationDelay: `${row * 80}ms`,
                      }}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function ReviewStep({
  tables,
  fileName,
  loading,
  extractProgress = null,
  error,
  canExtract,
  templateName,
  boxCount = 0,
  headingRef,
  onBack,
  onChangePdf,
  canRemember,
  suggestedLayoutName = "",
  rememberPrompt = "Remember this layout for the next statement?",
  onRememberLayout,
}: ReviewStepProps) {
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [columnNames, setColumnNames] = useState<string[]>([]);
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const [removedRows, setRemovedRows] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [layoutName, setLayoutName] = useState(suggestedLayoutName);
  const [rememberDismissed, setRememberDismissed] = useState(false);
  const [gridChecked, setGridChecked] = useState(false);
  const findRef = useRef<HTMLInputElement>(null);
  const ledgerRef = useRef<HTMLDivElement>(null);
  const [windowView, setWindowView] = useState({ top: 0, height: 480 });

  useEffect(() => {
    setLayoutName(suggestedLayoutName);
  }, [suggestedLayoutName]);

  const extracted = useMemo(() => tablesToReview(tables), [tables]);
  const original = extracted.rows;
  const sourceNames = extracted.columns;
  const sourceKey = sourceNames.join("\0");

  useEffect(() => {
    setColumnNames(sourceNames);
    setRemoved(new Set());
    setRemovedRows(new Set());
    setEdits({});
    setQuery("");
    setGridChecked(false);
    // Reset when the extracted header set changes, not on array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey]);

  const names = columnNames.length === sourceNames.length ? columnNames : sourceNames;
  const visible = useMemo(
    () => names.map((_, index) => index).filter((index) => !removed.has(index)),
    [names, removed],
  );
  const rows = useMemo(() => applyReviewEdits(original, edits), [original, edits]);
  const visibleRows = useMemo(
    () => rows.filter((row) => !removedRows.has(row.id)),
    [rows, removedRows],
  );
  const finding = query.trim().length > 0;
  const listedRows = useMemo(
    () => (finding ? visibleRows.filter((row) => rowMatchesQuery(row, query)) : visibleRows),
    [visibleRows, query, finding],
  );
  const corrections = useMemo(
    () => correctionsFromEdits(original, names, edits, removed, removedRows),
    [original, names, edits, removed, removedRows],
  );
  const suspects = useMemo(() => columnSuspects(names, visibleRows), [names, visibleRows]);
  const shift = useMemo(() => columnShift(names, visibleRows), [names, visibleRows]);
  const dropped = useMemo(
    () => [...removed].sort((a, b) => a - b),
    [removed],
  );
  const droppedRowItems = useMemo(
    () => original.filter((row) => removedRows.has(row.id)),
    [original, removedRows],
  );
  const hasRows = visibleRows.length > 0;
  const hasListed = listedRows.length > 0;

  const syncLedgerWindow = useCallback(() => {
    const el = ledgerRef.current;
    if (!el) return;
    setWindowView({ top: el.scrollTop, height: el.clientHeight });
  }, []);

  useEffect(() => {
    if (!hasListed) return;
    const el = ledgerRef.current;
    if (!el) return;
    syncLedgerWindow();
    const observer = new ResizeObserver(() => syncLedgerWindow());
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasListed, listedRows.length, syncLedgerWindow]);

  const windowed = useMemo(
    () => windowedRange(listedRows.length, windowView.top, windowView.height),
    [listedRows.length, windowView.top, windowView.height],
  );

  useEffect(() => {
    if (!hasRows) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.shiftKey) return;
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "f") return;
      event.preventDefault();
      findRef.current?.focus();
      findRef.current?.select();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasRows]);
  const growHeaderId = useMemo(() => {
    const ids = visible.map((index) => `c${index}`);
    return (
      ids.find((id) => headerRole(id, names) === "narrative") ??
      ids.find((id) => headerRole(id, names) === "plain") ??
      ids[0] ??
      ""
    );
  }, [visible, names]);

  const rename = useCallback((index: number, next: string) => {
    setColumnNames((current) => {
      const copy = current.length ? [...current] : [...sourceNames];
      copy[index] = next;
      return copy;
    });
  }, [sourceNames]);

  const remove = useCallback((index: number) => {
    setRemoved((current) => new Set(current).add(index));
  }, []);

  const restore = useCallback((index: number) => {
    setRemoved((current) => {
      const next = new Set(current);
      next.delete(index);
      return next;
    });
  }, []);

  const dropRow = useCallback((id: string) => {
    setRemovedRows((current) => new Set(current).add(id));
  }, []);

  const restoreRow = useCallback((id: string) => {
    setRemovedRows((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }, []);

  const editCell = useCallback(
    (rowId: string, index: number, next: string) => {
      setEdits((current) => {
        const source = original.find((item) => item.id === rowId)?.cells[index] ?? "";
        const copy = { ...current };
        const key = editKey(rowId, index);
        if (next === source) delete copy[key];
        else copy[key] = next;
        return copy;
      });
    },
    [original],
  );

  const columns = useMemo(
    () =>
      helper.columns([
        helper.display({
          id: "drop",
          header: () => <span className="sr-only">Drop row</span>,
          cell: (info) => <RowDropButton row={info.row.original} rowIndex={info.row.index} />,
        }),
        helper.accessor("page", {
          header: () => <span className="ledger-folio-label">Page</span>,
          cell: (info) => <span className="ledger-folio">{info.getValue()}</span>,
        }),
        ...visible.map((index) =>
          helper.accessor((row) => row.cells[index] ?? "", {
            id: `c${index}`,
            header: () => <ColumnHeader index={index} />,
            cell: (info) => (
              <CellEditor
                row={info.row.original}
                index={index}
                rowIndex={info.row.index}
                value={info.getValue()}
              />
            ),
          }),
        ),
      ]),
    [visible],
  );

  const table = useTable({
    features,
    columns,
    data: listedRows,
  });

  const save = async (kind: "csv" | "xlsx") => {
    setSaveError("");
    setSaving(true);
    try {
      const projected = projectReview(names, rows, removed, removedRows);
      const nextTables = reviewToTables(projected.columns, projected.rows);
      if (kind === "csv") {
        await exportCsv(nextTables, fileName);
      } else {
        await exportXlsx(nextTables, fileName, corrections);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes("cancelled")) return;
      if (/invoke|tauri|plugin/i.test(message)) {
        setSaveError("Export needs the desktop app.");
        return;
      }
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  const pageSummary = `${new Set(visibleRows.map((row) => row.page)).size} page${
    new Set(visibleRows.map((row) => row.page)).size === 1 ? "" : "s"
  }`;
  const boxSummary = loading
    ? `${boxCount || tables.length} table${(boxCount || tables.length) === 1 ? "" : "s"}`
    : hasRows
      ? pageSummary
      : `${boxCount || tables.length} table${(boxCount || tables.length) === 1 ? "" : "s"}`;
  const fileSummary = `${boxSummary}${templateName ? ` · ${templateName}` : ""}`;
  const rowCount = finding
    ? `${listedRows.length} of ${visibleRows.length} rows`
    : `${visibleRows.length} rows`;
  const status = loading
    ? `Reading ${fileSummary}…`
    : hasRows
      ? `${rowCount} · ${fileSummary}${
          corrections.length ? ` · ${corrections.length} corrected` : ""
        }${removedRows.size ? ` · ${removedRows.size} dropped` : ""}`
      : `No rows · ${fileSummary}`;
  const exportReady = hasRows && (!shift.shifted || gridChecked);
  const exportHint = !hasRows
    ? loading
      ? "Wait for rows before export."
      : "Adjust the boxes, then export."
    : exportReady
      ? undefined
      : "These headers don’t match the cells yet. Check the grid, then export.";
  const showRemember = Boolean(canRemember && onRememberLayout && hasRows && !rememberDismissed);

  const editValue: ReviewEditContextValue = {
    names,
    sourceNames,
    edits,
    original,
    visibleCount: visible.length,
    suspects,
    mismatches: shift.mismatches,
    rename,
    remove,
    dropRow,
    editCell,
  };

  return (
    <ReviewEditContext.Provider value={editValue}>
      <main className="flex min-h-0 flex-1 flex-col bg-background" aria-busy={loading || undefined}>
        <div className="flex shrink-0 flex-nowrap items-center gap-3 overflow-x-auto bg-background px-3 py-1.5">
          <h1 ref={headingRef} tabIndex={-1} className="text-sm font-semibold outline-none">
            Review
          </h1>
          <Button variant={hasRows || loading ? "ghost" : undefined} size="xs" onClick={onBack}>
            Back to tables
          </Button>
          <Button variant="ghost" size="xs" onClick={onChangePdf}>
            Change PDF
          </Button>
          <p aria-live="polite" className="shrink-0 text-xs text-muted-foreground">
            {status}
          </p>
          <div className="ml-auto flex shrink-0 flex-nowrap items-center justify-end gap-2">
            {hasRows && (
              <Input
                ref={findRef}
                id="review-find"
                type="search"
                size="sm"
                className="w-40"
                value={query}
                placeholder="Find"
                autoComplete="off"
                spellCheck={false}
                aria-label="Find in rows"
                aria-keyshortcuts={findShortcut}
                aria-controls="review-ledger"
                title={`Find (${findShortcut})`}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Escape") return;
                  if (query) {
                    event.preventDefault();
                    setQuery("");
                    return;
                  }
                  event.currentTarget.blur();
                }}
              />
            )}
            {exportHint && (
              <p id="export-hint" className="sr-only">
                {exportHint}
              </p>
            )}
            <Button
              variant="outline"
              size="xs"
              disabled={!hasRows || saving}
              aria-describedby={exportHint ? "export-hint" : undefined}
              onClick={() => void save("csv")}
            >
              {saving ? "Exporting…" : "Export CSV"}
            </Button>
            <Button
              variant={exportReady ? undefined : "outline"}
              size="xs"
              disabled={!hasRows || saving}
              aria-describedby={exportHint ? "export-hint" : undefined}
              title={!exportReady && hasRows ? exportHint : undefined}
              onClick={() => void save("xlsx")}
            >
              {saving ? "Exporting…" : "Export Excel"}
            </Button>
          </div>
        </div>
        {showRemember && (
          <form
            className="flex shrink-0 flex-nowrap items-center gap-3 overflow-x-auto bg-background px-3 py-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              const next = layoutName.trim();
              if (!next) return;
              onRememberLayout?.({
                name: next,
                columns: projectReview(names, rows, removed, removedRows).columns,
              });
              setRememberDismissed(true);
            }}
          >
          <p className="shrink-0 text-xs text-muted-foreground">{rememberPrompt}</p>
            <Input
              id="remember-layout-name"
              size="sm"
              className="w-44"
              value={layoutName}
              aria-label="Layout name"
              onChange={(event) => setLayoutName(event.target.value)}
            />
            <Button size="xs" type="submit">
              Remember
            </Button>
            <Button size="xs" variant="ghost" type="button" onClick={() => setRememberDismissed(true)}>
              Not now
            </Button>
          </form>
        )}
        {(dropped.length > 0 || droppedRowItems.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5 bg-background px-3 py-1.5">
            <p className="text-xs text-muted-foreground">Dropped</p>
            {dropped.map((index) => {
              const label = names[index] || sourceNames[index] || `Column ${index + 1}`;
              return (
                <button
                  key={`col-${index}`}
                  type="button"
                  className="rounded-md border px-2 py-0.5 text-xs text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => restore(index)}
                >
                  {label}
                  <span className="text-muted-foreground"> · Restore</span>
                </button>
              );
            })}
            {droppedRowItems.map((row) => (
              <button
                key={row.id}
                type="button"
                className="rounded-md border px-2 py-0.5 text-xs text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => restoreRow(row.id)}
              >
                {droppedRowLabel(row, names)}
                <span className="text-muted-foreground"> · Restore</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div aria-live="polite" className="shrink-0 px-4 pt-3 empty:hidden">
            {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
            {!loading && !canExtract && (
              <p className="text-sm text-muted-foreground">
                Extraction runs in the desktop app. Boxes are saved — open this window from PesaView
                to read them.
              </p>
            )}
            {!loading && canExtract && !hasRows && !error && (
              <p className="text-sm text-muted-foreground">
                {droppedRowItems.length > 0
                  ? "Every row is dropped. Restore one above, or go back and adjust the boxes."
                  : "No rows came out of those boxes. Go back and adjust them."}
              </p>
            )}
            {saveError && <p className="mb-2 text-sm text-destructive">{saveError}</p>}
          </div>
          {loading && !hasRows && <LedgerWait boxCount={boxCount || tables.length} progress={extractProgress} />}
          {hasRows && (
            <div className="ledger-sheet">
              {shift.shifted && !gridChecked && (
                <div className="ledger-banner">
                  <p>
                    These headers don’t match the cells. Rename a header so it describes the
                    column, or go back and adjust the boxes.
                  </p>
                  <Button size="xs" variant="ghost" onClick={() => setGridChecked(true)}>
                    I’ll check the grid
                  </Button>
                </div>
              )}
              {hasRows && (!shift.shifted || gridChecked) && !finding && (
                <p className="ledger-caption">
                  Edited cells are marked in amber. × drops a row or column.
                </p>
              )}
              {finding && !hasListed && (
                <p className="ledger-caption">
                  No rows match that find.{" "}
                  <button
                    type="button"
                    className="text-foreground underline-offset-2 hover:underline"
                    onClick={() => {
                      setQuery("");
                      findRef.current?.focus();
                    }}
                  >
                    Clear
                  </button>
                </p>
              )}
              {hasListed && (
              <div
                className="ledger-scroll"
                id="review-ledger"
                ref={ledgerRef}
                onScroll={syncLedgerWindow}
              >
                <Table className="ledger w-max min-w-full" containerClassName="overflow-visible w-max min-w-full">
                  <TableHeader>
                    {table.getHeaderGroups().map((group) => (
                      <TableRow key={group.id} className="border-0 hover:bg-transparent">
                        {group.headers.map((header) => {
                          const role = headerRole(header.id, names);
                          const grow = header.id === growHeaderId;
                          const wrap = role === "narrative" || (grow && role === "plain");
                          return (
                            <TableHead
                              key={header.id}
                              className={cn(
                                "h-auto py-2 align-bottom text-foreground",
                                role === "drop" ? "px-1" : "px-2.5",
                                wrap ? "min-w-0 whitespace-normal" : "whitespace-nowrap",
                                roleClass(role, grow),
                                role === "money" && "text-right",
                              )}
                            >
                              {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                            </TableHead>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {windowed.padTop > 0 && (
                      <TableRow aria-hidden className="border-0 hover:bg-transparent">
                        <TableCell
                          colSpan={2 + visible.length}
                          className="p-0"
                          style={{ height: windowed.padTop, border: 0 }}
                        />
                      </TableRow>
                    )}
                    {table.getRowModel().rows.slice(windowed.start, windowed.end).map((row) => (
                      <TableRow
                        key={row.id}
                        data-alt={row.index % 2 === 1 ? "true" : undefined}
                        className="group/row border-0 hover:bg-transparent"
                      >
                        {row.getAllCells().map((cell) => {
                          const role = headerRole(cell.column.id, names);
                          const grow = cell.column.id === growHeaderId;
                          const wrap = role === "narrative" || (grow && role === "plain");
                          return (
                            <TableCell
                              key={cell.id}
                              className={cn(
                                "py-1.5 align-middle leading-normal",
                                role === "drop" ? "px-1" : "px-2.5",
                                wrap ? "min-w-0 whitespace-normal align-top" : "whitespace-nowrap",
                                roleClass(role, grow),
                                role === "money" && "text-right",
                              )}
                            >
                              <table.FlexRender cell={cell} />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                    {windowed.padBottom > 0 && (
                      <TableRow aria-hidden className="border-0 hover:bg-transparent">
                        <TableCell
                          colSpan={2 + visible.length}
                          className="p-0"
                          style={{ height: windowed.padBottom, border: 0 }}
                        />
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              )}
            </div>
          )}
        </div>
      </main>
    </ReviewEditContext.Provider>
  );
}
