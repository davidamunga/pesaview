export type ExtractionMethod = "stream" | "lattice" | "guess";

export interface TableArea {
  page: number;
  top: number;
  left: number;
  bottom: number;
  right: number;
  method: ExtractionMethod;
}

export interface Selection extends TableArea {
  id: string;
}

export interface PageMetrics {
  renderWidth: number;
  renderHeight: number;
  pdfWidth: number;
  pdfHeight: number;
}

export interface CssRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExtractedTable {
  page: number;
  columns: string[];
  rows: string[][];
}

export interface ExtractOptions {
  skipRows?: string[];
  columns?: string[];
  /** Fold wrapped Tabula rows into the previous record. Default true. */
  mergeRows?: boolean;
}

export interface StatementTemplate {
  id: string;
  name: string;
  source: "bundled" | "saved";
  /** When true, area values are 0–1 fractions of the page. */
  normalized: boolean;
  /** page 0 means apply to every included page that has no page-specific area. */
  areas: TemplateArea[];
  /** Drop a row when its text contains any of these (case-insensitive). */
  skipRows?: string[];
  /** Replace Tabula headers when the column count matches. */
  columns?: string[];
  /** If every token appears in the extracted text, this template is suggested. */
  match?: string[];
  /** Set false to keep wrapped Tabula lines as separate rows. */
  mergeRows?: boolean;
}

export interface TemplateArea {
  page: number;
  top: number;
  left: number;
  bottom: number;
  right: number;
  method: ExtractionMethod;
  pageWidth?: number;
  pageHeight?: number;
}

export interface OpenedPdf {
  path: string;
  name: string;
  data: Uint8Array;
  password?: string;
}

export type WizardStep = "upload" | "select" | "review";

export interface ReviewRow {
  id: string;
  page: number;
  cells: string[];
}

export interface CellCorrection {
  page: number;
  row: number;
  column: string;
  oldValue: string;
  newValue: string;
}
