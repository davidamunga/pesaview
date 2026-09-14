import { describe, expect, it } from "vitest";
import { pdfPathsFromDrop, pickedFromPath } from "./pickPdf";

describe("pdfPathsFromDrop", () => {
  it("keeps every pdf and ignores other files", () => {
    expect(
      pdfPathsFromDrop([
        "/docs/Jan.pdf",
        "/docs/notes.txt",
        "/docs/Feb.PDF",
        "/docs/folder",
      ]),
    ).toEqual(["/docs/Jan.pdf", "/docs/Feb.PDF"]);
  });
});

describe("pickedFromPath", () => {
  it("uses the last path segment as the name", () => {
    expect(pickedFromPath("/Users/me/Equity ledger.pdf")).toEqual({
      path: "/Users/me/Equity ledger.pdf",
      name: "Equity ledger.pdf",
    });
  });
});
