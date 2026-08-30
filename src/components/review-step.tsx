import { createContext, useCallback, useContext, useEffect, useMemo, useState, type RefObject } from "react";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  applyReviewEdits,
  correctionsFromEdits,
  editKey,
  projectReview,
  reviewToTables,
  tablesToReview,
} from "@/lib/reviewGrid";
import { cn } from "@/lib/utils";
import { exportCsv, exportXlsx } from "@/services/exportService";
import type { ExtractedTable, ReviewRow } from "@/types";

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, ReviewRow>();

const editedMark = "rounded-sm bg-amber-200/80 dark:bg-amber-400/20";

interface ReviewEditContextValue {
  names: string[];
  sourceNames: string[];
  edits: Record<string, string>;
  original: ReviewRow[];
  visibleCount: number;
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
  const { names, sourceNames, visibleCount, rename, remove } = useReviewEdit();
  const label = names[index] || `Column ${index + 1}`;
  const renamed = label !== (sourceNames[index] || `Column ${index + 1}`);
  return (
    <div className="flex items-center gap-0.5">
      <input
        className={cn(
          "h-6 min-w-16 max-w-36 bg-transparent px-0.5 text-xs font-medium text-foreground outline-none",
          renamed && editedMark,
        )}
        value={label}
        aria-label={`Column name ${index + 1}`}
        onChange={(event) => rename(index, event.target.value)}
      />
      <button
        type="button"
        aria-label={`Remove ${label}`}
        title={visibleCount <= 1 ? "Keep at least one column" : `Remove ${label}`}
        disabled={visibleCount <= 1}
        className="inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
        onClick={() => remove(index)}
      >
        <X className="size-3" />
      </button>
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
  return (
    <input
      className={cn(
        "h-6 w-full min-w-28 bg-transparent px-0.5 text-xs text-foreground outline-none",
        dirty && editedMark,
      )}
      value={value}
      aria-label={`${label}, row ${rowIndex + 1}`}
      onChange={(event) => editCell(row.id, index, event.target.value)}
    />
  );
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
}: ReviewStepProps) {
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [columnNames, setColumnNames] = useState<string[]>([]);
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

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
  const hasRows = rows.length > 0;

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
          header: "Page",
          cell: (info) => info.getValue(),
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
        }${removed.size ? ` · ${removed.size} column${removed.size === 1 ? "" : "s"} removed` : ""}`
      : `No rows · ${boxSummary}`;
  const exportHint = hasRows
    ? undefined
    : loading
      ? "Wait for rows before export."
      : "Adjust the boxes, then export.";

  const editValue: ReviewEditContextValue = {
    names,
    sourceNames,
    edits,
    original,
    visibleCount: visible.length,
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
        {hasRows && (
          <p className="max-w-xl border-b bg-card px-2.5 py-1.5 text-xs text-muted-foreground">
            Rename or drop a column. Amber is yours. Excel includes a Corrections sheet.
          </p>
        )}
        <div className="min-h-0 flex-1 overflow-auto p-2">
          <div aria-live="polite">
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
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((group) => (
                  <TableRow key={group.id}>
                    {group.headers.map((header) => (
                      <TableHead key={header.id} className="h-8 whitespace-nowrap px-1.5">
                        {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getAllCells().map((cell) => (
                      <TableCell key={cell.id} className="p-1 align-top whitespace-normal">
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {saveError && <p className="mt-2 text-sm text-destructive">{saveError}</p>}
        </div>
      </main>
    </ReviewEditContext.Provider>
  );
}
