import { invoke } from "@tauri-apps/api/core";
import { detectTransactionAreas } from "@/lib/detectTables";
import { tablesFromTabulaJson } from "@/lib/tabulaJson";
import type { ExtractOptions, ExtractedTable, TableArea } from "@/types";

const EXTRACT_TIMEOUT_MS = 90_000;

export class TabulaService {
  static isPasswordError(message: string | undefined): boolean {
    if (!message) return false;
    const lower = message.toLowerCase();
    return (
      lower.includes("password") ||
      lower.includes("encrypted") ||
      lower.includes("decrypt") ||
      lower.includes("protected")
    );
  }

  static async extractTables(
    pdfPath: string,
    areas: TableArea[],
    password?: string,
    options: ExtractOptions = {},
  ): Promise<ExtractedTable[]> {
    const raw = await withTimeout(
      invoke<string>("extract_tables", {
        pdfPath,
        password: password || null,
        areas,
      }),
      EXTRACT_TIMEOUT_MS,
    );
    return tablesFromTabulaJson(raw, options);
  }

  static async guessTables(
    pdfPath: string,
    password?: string,
    pages = "all",
  ): Promise<{ areas: TableArea[]; raw: string }> {
    const raw = await withTimeout(
      invoke<string>("guess_tables", {
        pdfPath,
        password: password || null,
        pages,
      }),
      EXTRACT_TIMEOUT_MS,
    );
    return { areas: detectTransactionAreas(raw), raw };
  }

  static async cancel(): Promise<void> {
    try {
      await invoke("cancel_extraction");
    } catch {
      // Best-effort cancel.
    }
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      void TabulaService.cancel();
      reject(new Error("Tabula timed out after 90 seconds"));
    }, ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        const message =
          typeof error === "string" ? error : error?.message || String(error);
        reject(new Error(message));
      },
    );
  });
}
