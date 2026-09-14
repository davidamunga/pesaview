import { invoke } from "@tauri-apps/api/core";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import type { CellCorrection, ExtractedTable } from "@/types";
import { flattenTables } from "@/lib/tabulaJson";

function csvBytes(tables: ExtractedTable[]): Uint8Array {
  const { columns, rows } = flattenTables(tables);
  const csv = Papa.unparse({
    fields: columns,
    data: rows,
  });
  return new TextEncoder().encode(`\uFEFF${csv}`);
}

async function xlsxBytes(
  tables: ExtractedTable[],
  corrections: CellCorrection[] = [],
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PesaView";

  if (tables.length === 0) {
    workbook.addWorksheet("Extracted");
  } else if (tables.length === 1) {
    addSheet(workbook, "Extracted", tables[0].columns, tables[0].rows);
  } else {
    addSheet(workbook, "Extracted", ...toFlat(tables));
    tables.forEach((table, index) => {
      addSheet(workbook, `Page ${table.page} (${index + 1})`, table.columns, table.rows);
    });
  }

  addSheet(workbook, "Corrections", ["Page", "Row", "Column", "Old", "New"], corrections.map((item) => [
    String(item.page),
    String(item.row),
    item.column,
    item.oldValue,
    item.newValue,
  ]));

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

export async function exportCsv(tables: ExtractedTable[], defaultName: string): Promise<string> {
  return invoke<string>("save_file", {
    content: csvBytes(tables),
    defaultFilename: defaultName.replace(/\.pdf$/i, "") + ".csv",
    fileType: "csv",
  });
}

export async function writeCsv(tables: ExtractedTable[], destPath: string): Promise<string> {
  return invoke<string>("write_file_at", {
    path: destPath,
    content: csvBytes(tables),
  });
}

export async function exportXlsx(
  tables: ExtractedTable[],
  defaultName: string,
  corrections: CellCorrection[] = [],
): Promise<string> {
  return invoke<string>("save_file", {
    content: await xlsxBytes(tables, corrections),
    defaultFilename: defaultName.replace(/\.pdf$/i, "") + ".xlsx",
    fileType: "xlsx",
  });
}

export async function writeXlsx(
  tables: ExtractedTable[],
  destPath: string,
  corrections: CellCorrection[] = [],
): Promise<string> {
  return invoke<string>("write_file_at", {
    path: destPath,
    content: await xlsxBytes(tables, corrections),
  });
}

function toFlat(tables: ExtractedTable[]): [string[], string[][]] {
  const flat = flattenTables(tables);
  return [flat.columns, flat.rows.filter((row) => row.some((cell) => cell.length > 0))];
}

function addSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  columns: string[],
  rows: string[][],
) {
  const sheet = workbook.addWorksheet(sanitizeSheetName(name));
  sheet.addRow(columns);
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) {
    sheet.addRow(row);
  }
  sheet.columns.forEach((column) => {
    column.width = 18;
  });
}

function sanitizeSheetName(name: string): string {
  return name.replace(/[\\/*?:[\]]/g, " ").slice(0, 31) || "Sheet";
}
