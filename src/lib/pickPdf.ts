import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { isTauri } from "@/lib/utils";
import type { OpenedPdf } from "@/types";

export interface PickedPdf {
  path: string;
  name: string;
}

export function pdfPathsFromDrop(paths: string[]): string[] {
  return paths.filter((path) => path.toLowerCase().endsWith(".pdf"));
}

export function pickedFromPath(path: string): PickedPdf {
  return {
    path,
    name: path.split(/[\\/]/).pop() || "statement.pdf",
  };
}

function fromBrowserFile(file: File): Promise<OpenedPdf> {
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return Promise.reject(new Error("Please choose a PDF file."));
  }
  return file.arrayBuffer().then((buffer) => ({
    path: file.name,
    name: file.name,
    data: new Uint8Array(buffer),
  }));
}

function pickFromInput(): Promise<OpenedPdf | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      void fromBrowserFile(file).then(resolve, reject);
    });
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}

/** Native file picker first. Returns null if the user cancels. */
export async function pickPdf(): Promise<OpenedPdf | null> {
  if (isTauri()) {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (typeof selected !== "string") return null;
      const data = await readFile(selected);
      const name = selected.split(/[\\/]/).pop() || "statement.pdf";
      return { path: selected, name, data };
    } catch {
      return pickFromInput();
    }
  }
  return pickFromInput();
}

/** Native multi-file picker. Returns null if cancelled. Desktop only. */
export async function pickPdfs(): Promise<PickedPdf[] | null> {
  if (!isTauri()) return null;
  try {
    const selected = await open({
      multiple: true,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (selected == null) return null;
    const paths = Array.isArray(selected) ? selected : [selected];
    const pdfs = pdfPathsFromDrop(paths).map(pickedFromPath);
    return pdfs.length > 0 ? pdfs : null;
  } catch {
    return null;
  }
}

/** Output folder for batch exports. Returns null if cancelled. Desktop only. */
export async function pickDirectory(): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const selected = await open({ directory: true, multiple: false });
    return typeof selected === "string" ? selected : null;
  } catch {
    return null;
  }
}
