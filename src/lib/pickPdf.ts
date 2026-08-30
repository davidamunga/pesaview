import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { isTauri } from "@/lib/utils";
import type { OpenedPdf } from "@/types";

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
