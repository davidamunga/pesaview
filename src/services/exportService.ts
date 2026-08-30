import { invoke } from "@tauri-apps/api/core";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import type { ExtractedTable } from "@/types";
import { flattenTables } from "@/lib/tabulaJson";

export async function exportCsv(tables: ExtractedTable[], defaultName: string): Promise<string> {
  const { columns, rows } = flattenTables(tables);
  const csv = Papa.unparse({
    fields: columns,
    data: rows,
  });
  const bytes = new TextEncoder().encode(`\uFEFF${csv}`);
  return invoke<string>("save_file", {
    content: bytes,
    defaultFilename: defaultName.replace(/\.pdf$/i, "") + ".csv",
    fileType: "csv",
  });
}

export async function exportXlsx(tables: ExtractedTable[], defaultName: string): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PesaView";

  if (tables.length === 0) {
    workbook.addWorksheet("Extracted");
  } else if (tables.length === 1) {
    addSheet(workbook, "Extracted", tables[0].columns, tables[0].rows);
  } else {
    tables.forEach((table, index) => {
      addSheet(workbook, `Page ${table.page} (${index + 1})`, table.columns, table.rows);
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = new Uint8Array(buffer);
  return invoke<string>("save_file", {
    content: bytes,
    defaultFilename: defaultName.replace(/\.pdf$/i, "") + ".xlsx",
    fileType: "xlsx",
  });
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
