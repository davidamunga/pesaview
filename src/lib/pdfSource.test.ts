import { describe, expect, it } from "vitest";
import { pdfDocumentFile } from "./pdfSource";

describe("pdfDocumentFile", () => {
  it("keeps an unlocked file as a stable url string", () => {
    expect(pdfDocumentFile("blob:preview")).toBe("blob:preview");
    expect(pdfDocumentFile("blob:preview", "  ")).toBe("blob:preview");
  });

  it("puts a trimmed password on the source so remounts still decrypt", () => {
    expect(pdfDocumentFile("blob:preview", " secret ")).toEqual({
      url: "blob:preview",
      password: "secret",
    });
  });

  it("returns null without a url", () => {
    expect(pdfDocumentFile(null, "secret")).toBe(null);
  });
});
