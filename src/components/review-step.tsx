import { createContext, useCallback, useContext, useEffect, useMemo, useState, type RefObject } from "react";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  applyReviewEdits,
  columnSuspects,
  correctionsFromEdits,
  editKey,
  isDateColumn,
  isMoneyColumn,
  isNarrativeColumn,
  projectReview,
  reviewToTables,
  tablesToReview,
  type ColumnSuspect,
} from "@/lib/reviewGrid";
import { cn } from "@/lib/utils";
import { exportCsv, exportXlsx } from "@/services/exportService";
import type { ExtractedTable, ReviewRow } from "@/types";

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, ReviewRow>();

const editedMark = "bg-amber-200/80 dark:bg-amber-400/25";

type HeaderRole = "page" | "date" | "narrative" | "money" | "plain";

function headerRole(id: string, names: string[]): HeaderRole {
  if (id === "page") return "page";
  const name = names[Number(id.slice(1))] ?? "";
  if (isDateColumn(name)) return "date";
  if (isMoneyColumn(name)) return "money";
  if (isNarrativeColumn(name)) return "narrative";
  return "plain";
}

function roleClass(role: HeaderRole, grow: boolean): string {
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
  rename: (index: number, next: string) => void;
  remove: (index: number) => void;
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

function ColumnHeader({ index }: { index: number }) {
  const { names, sourceNames, visibleCount, suspects, rename, remove } = useReviewEdit();
  const label = names[index] || `Column ${index + 1}`;
  const renamed = label !== (sourceNames[index] || `Column ${index + 1}`);
  const suspect = suspects.find((item) => item.index === index);
  const money = isMoneyColumn(label);
  const lastColumn = visibleCount <= 1;

  return (
    <div className="group/header flex min-w-0 flex-col gap-0.5">
      <div className="flex items-center gap-1">
        <input
          className={cn(
            "ledger-title h-7 min-w-0 flex-1 border-b border-transparent bg-transparent px-0.5 text-foreground outline-none",
            "hover:border-current/25 focus-visible:border-current",
            money && "text-right tabular-nums",
            renamed && editedMark,
            suspect && "border-amber-700/60 dark:border-amber-400/50",
          )}
          value={label}
          aria-label={`Column name ${index + 1}`}
          aria-describedby={suspect ? `suspect-${index}` : undefined}
          onChange={(event) => rename(index, event.target.value)}
        />
        <button
          type="button"
          aria-label={`Remove ${label}`}
          title={lastColumn ? "Keep at least one column" : `Remove ${label}`}
          disabled={lastColumn}
          className={cn(
            "inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none",
            "opacity-0 hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring",
            "group-hover/header:opacity-100 pointer-coarse:opacity-70",
            suspect && !lastColumn && "opacity-100",
            lastColumn && "opacity-40",
          )}
          onClick={() => remove(index)}
        >
          <X className="size-3" />
        </button>
      </div>
      {suspect && (
        <button
          type="button"
          id={`suspect-${index}`}
          disabled={lastColumn}
          className="w-fit text-left text-[11px] leading-tight text-amber-800 underline-offset-2 hover:underline disabled:no-underline disabled:opacity-60 dark:text-amber-400/90"
          onClick={() => remove(index)}
        >
          {lastColumn ? `${suspect.reason} · keep one` : `${suspect.reason} — drop`}
        </button>
      )}
    </div>
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
    "w-full bg-transparent px-0.5 text-foreground outline-none",
    "focus-visible:bg-black/4 dark:focus-visible:bg-white/6",
    narrative ? "ledger-narrative-input" : "h-8 text-[13px] leading-5",
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

export function ReviewStep({
  tables,
  fileName,
  loading,
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
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [layoutName, setLayoutName] = useState(suggestedLayoutName);
  const [rememberDismissed, setRememberDismissed] = useState(false);

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
    setEdits({});
    // Reset when the extracted header set changes, not on array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey]);

  const names = columnNames.length === sourceNames.length ? columnNames : sourceNames;
  const visible = useMemo(
    () => names.map((_, index) => index).filter((index) => !removed.has(index)),
    [names, removed],
  );
  const rows = useMemo(() => applyReviewEdits(original, edits), [original, edits]);
  const corrections = useMemo(
    () => correctionsFromEdits(original, names, edits, removed),
    [original, names, edits, removed],
  );
  const suspects = useMemo(() => columnSuspects(names, rows), [names, rows]);
  const dropped = useMemo(
    () => [...removed].sort((a, b) => a - b),
    [removed],
  );
  const hasRows = rows.length > 0;
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
    data: rows,
  });

  const save = async (kind: "csv" | "xlsx") => {
    setSaveError("");
    setSaving(true);
    try {
      const projected = projectReview(names, rows, removed);
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

  const boxSummary = `${boxCount || tables.length} box${
    (boxCount || tables.length) === 1 ? "" : "es"
  }${templateName ? ` · ${templateName}` : ""}`;
  const status = loading
    ? `Reading ${boxSummary}…`
    : hasRows
      ? `${rows.length} rows · ${boxSummary}${
          corrections.length ? ` · ${corrections.length} corrected` : ""
        }`
      : `No rows · ${boxSummary}`;
  const exportHint = hasRows
    ? undefined
    : loading
      ? "Wait for rows before export."
      : "Adjust the boxes, then export.";
  const showHelper = hasRows && dropped.length === 0 && suspects.length === 0;
  const showRemember = Boolean(canRemember && onRememberLayout && hasRows && !rememberDismissed);

  const editValue: ReviewEditContextValue = {
    names,
    sourceNames,
    edits,
    original,
    visibleCount: visible.length,
    suspects,
    rename,
    remove,
    editCell,
  };

  return (
    <ReviewEditContext.Provider value={editValue}>
      <main className="flex min-h-0 flex-1 flex-col bg-background">
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-card px-2.5 py-1.5">
          <h1 ref={headingRef} tabIndex={-1} className="text-sm font-semibold outline-none">
            Review
          </h1>
          <Button variant={hasRows || loading ? "ghost" : undefined} size="xs" onClick={onBack}>
            Back to tables
          </Button>
          <Button variant="ghost" size="xs" onClick={onChangePdf}>
            Change PDF
          </Button>
          <p aria-live="polite" className="text-xs text-muted-foreground">
            {status}
          </p>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {exportHint && (
              <p id="export-hint" className="max-w-44 text-xs text-muted-foreground">
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
              Export CSV
            </Button>
            <Button
              size="xs"
              disabled={!hasRows || saving}
              aria-describedby={exportHint ? "export-hint" : undefined}
              onClick={() => void save("xlsx")}
            >
              Export Excel
            </Button>
          </div>
        </div>
        {showRemember && (
          <form
            className="flex flex-wrap items-center gap-2 border-b bg-card px-2.5 py-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              const next = layoutName.trim();
              if (!next) return;
              onRememberLayout?.({
                name: next,
                columns: projectReview(names, rows, removed).columns,
              });
              setRememberDismissed(true);
            }}
          >
            <p className="text-xs text-muted-foreground">{rememberPrompt}</p>
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
        {dropped.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-b bg-card px-2.5 py-1.5">
            <p className="text-xs text-muted-foreground">Dropped</p>
            {dropped.map((index) => {
              const label = names[index] || sourceNames[index] || `Column ${index + 1}`;
              return (
                <button
                  key={index}
                  type="button"
                  className="rounded-md border px-2 py-0.5 text-xs text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => restore(index)}
                >
                  {label}
                  <span className="text-muted-foreground"> · Restore</span>
                </button>
              );
            })}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-auto">
          <div aria-live="polite" className="px-4 pt-3 empty:hidden">
            {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
            {loading && <p className="text-sm text-muted-foreground">Reading the selected tables…</p>}
            {!loading && !canExtract && (
              <p className="text-sm text-muted-foreground">
                Extraction runs in the desktop app. Boxes are saved — open this window from PesaView
                to read them.
              </p>
            )}
            {!loading && canExtract && !hasRows && !error && (
              <p className="text-sm text-muted-foreground">
                No rows came out of those boxes. Go back and adjust them.
              </p>
            )}
          </div>
          {hasRows && (
            <div className="ledger-sheet">
              {showHelper && (
                <p className="ledger-caption">Type a header to rename it. Amber is yours.</p>
              )}
              <Table className="ledger" containerClassName="overflow-visible">
                <TableHeader>
                  {table.getHeaderGroups().map((group) => (
                    <TableRow key={group.id} className="border-0 hover:bg-transparent">
                      {group.headers.map((header) => {
                        const role = headerRole(header.id, names);
                        const grow = header.id === growHeaderId;
                        return (
                          <TableHead
                            key={header.id}
                            className={cn(
                              "h-auto min-w-0 px-2.5 py-2 align-bottom whitespace-normal text-foreground",
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
                  {table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} className="border-0 hover:bg-transparent">
                      {row.getAllCells().map((cell) => {
                        const role = headerRole(cell.column.id, names);
                        const grow = cell.column.id === growHeaderId;
                        return (
                          <TableCell
                            key={cell.id}
                            className={cn(
                              "min-w-0 px-2.5 py-2 align-top leading-normal whitespace-normal",
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
                </TableBody>
              </Table>
            </div>
          )}
          {saveError && <p className="mt-2 text-sm text-destructive">{saveError}</p>}
        </div>
      </main>
    </ReviewEditContext.Provider>
  );
}
