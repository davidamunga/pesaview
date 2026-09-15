import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { detectTransactionAreas } from "@/lib/detectTables";
import type { ExtractProgress } from "@/lib/extractWait";
import { GUESS_PAGE_LIMIT } from "@/lib/rememberLayout";
import { tablesFromTabulaJson } from "@/lib/tabulaJson";
import { tabulaTimeoutMs } from "@/lib/tabulaTimeout";
import type { ExtractOptions, ExtractedTable, TableArea } from "@/types";

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
    onProgress?: (progress: ExtractProgress) => void,
  ): Promise<ExtractedTable[]> {
    const stop = onProgress ? await listenExtractProgress(onProgress) : undefined;
    try {
      const raw = await withTimeout(
        invoke<string>("extract_tables", {
          pdfPath,
          password: password || null,
          areas,
        }),
        tabulaTimeoutMs("extract", areas.length),
      );
      return tablesFromTabulaJson(raw, options);
    } finally {
      stop?.();
    }
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
      tabulaTimeoutMs("guess", guessWorkItems(pages)),
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

async function listenExtractProgress(
  onProgress: (progress: ExtractProgress) => void,
): Promise<() => void> {
  try {
    return await listen<ExtractProgress>("extract-progress", (event) => {
      onProgress(event.payload);
    });
  } catch {
    return () => undefined;
  }
}

function guessWorkItems(pages: string): number {
  const trimmed = pages.trim();
  if (!trimmed || trimmed.toLowerCase() === "all") return GUESS_PAGE_LIMIT;
  let count = 0;
  for (const part of trimmed.split(",")) {
    const piece = part.trim();
    if (!piece) continue;
    const dash = piece.indexOf("-");
    if (dash > 0) {
      const from = Number(piece.slice(0, dash));
      const to = Number(piece.slice(dash + 1));
      if (Number.isFinite(from) && Number.isFinite(to)) {
        count += Math.abs(to - from) + 1;
        continue;
      }
    }
    count += 1;
  }
  return Math.max(1, count);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const seconds = Math.round(ms / 1000);
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      void TabulaService.cancel();
      reject(new Error(`Tabula timed out after ${seconds} seconds`));
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
