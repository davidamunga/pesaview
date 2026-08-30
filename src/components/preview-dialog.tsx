import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { exportCsv, exportXlsx } from "@/services/exportService";
import { flattenTables } from "@/lib/tabulaJson";
import type { ExtractedTable } from "@/types";

interface PreviewDialogProps {
  open: boolean;
  tables: ExtractedTable[];
  fileName: string;
  onOpenChange: (open: boolean) => void;
}

export function PreviewDialog({ open, tables, fileName, onOpenChange }: PreviewDialogProps) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { columns, rows } = flattenTables(tables);
  const previewRows = rows.slice(0, 200);

  const save = async (kind: "csv" | "xlsx") => {
    setError("");
    setSaving(true);
    try {
      if (kind === "csv") {
        await exportCsv(tables, fileName);
      } else {
        await exportXlsx(tables, fileName);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.toLowerCase().includes("cancelled")) {
        setError(message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Extracted data</DialogTitle>
          <DialogDescription>
            {tables.length} table{tables.length === 1 ? "" : "s"} · {rows.length} rows
            {rows.length > previewRows.length ? ` (showing first ${previewRows.length})` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto px-6 pb-2">
          {columns.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No rows were extracted from the selected regions.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((column, index) => (
                    <TableHead key={`${column}-${index}`}>{column || `Column ${index + 1}`}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((row, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <TableCell key={cellIndex} className="max-w-72 truncate" title={cell}>
                        {cell}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        {error && <p className="px-6 text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={saving || rows.length === 0} onClick={() => void save("csv")}>
            Export CSV
          </Button>
          <Button disabled={saving || rows.length === 0} onClick={() => void save("xlsx")}>
            Export Excel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
