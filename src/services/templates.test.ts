import { describe, expect, it } from "vitest";
import { bundledTemplates, parseTemplate, templateFromSelections } from "./templates";

describe("templates", () => {
  it("loads bundled example layouts from JSON", () => {
    const ids = bundledTemplates().map((template) => template.id);
    expect(ids).toEqual(expect.arrayContaining(["equity-ledger", "mpesa"]));
    expect(bundledTemplates().every((template) => template.source === "bundled")).toBe(true);
  });

  it("keeps the M-PESA page-1 box below the summary and continuation boxes above the first receipt", () => {
    const mpesa = bundledTemplates().find((template) => template.id === "mpesa");
    const page1 = mpesa?.areas.find((area) => area.page === 1);
    const rest = mpesa?.areas.find((area) => area.page === 0);
    expect(page1?.top).toBeGreaterThanOrEqual(0.42);
    expect(page1?.top).toBeLessThan(0.45);
    expect(rest?.top).toBeGreaterThan(0.04);
    expect(rest?.top).toBeLessThanOrEqual(0.07);
    expect(mpesa?.skipRows).toEqual(
      expect.arrayContaining(["Disclaimer", "Statement Verification"]),
    );
  });

  it("accepts a community JSON file without a bank kind", () => {
    const template = parseTemplate(
      {
        name: "KCB current account",
        normalized: true,
        match: ["narration"],
        skipRows: ["Page Total"],
        areas: [{ page: 0, top: 0.2, left: 0.04, bottom: 0.9, right: 0.96, method: "stream" }],
      },
      { id: "kcb-current", source: "bundled" },
    );
    expect(template?.id).toBe("kcb-current");
    expect(template?.areas[0].page).toBe(0);
    expect(template?.skipRows).toEqual(["Page Total"]);
  });

  it("saves page 1 and a page 0 copy from a single drawn box", () => {
    const template = templateFromSelections(
      "NCBA Loop",
      [
        {
          id: "a",
          page: 1,
          top: 158.4,
          left: 61.2,
          bottom: 712.8,
          right: 581.4,
          method: "stream",
        },
      ],
      { pdfWidth: 612, pdfHeight: 792 },
      { match: ["ncba", "loop"] },
    );
    expect(template.match).toEqual(["ncba", "loop"]);
    expect(template.areas.map((area) => area.page)).toEqual([1, 0]);
  });
});
