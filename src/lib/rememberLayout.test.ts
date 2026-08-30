import { describe, expect, it } from "vitest";
import type { Selection, StatementTemplate } from "@/types";
import {
  planAutodetect,
  rememberCopy,
  rememberedAreas,
  stampSelectionsToEmptyPages,
  suggestLayout,
} from "./rememberLayout";

const page = {
  renderWidth: 600,
  renderHeight: 800,
  pdfWidth: 612,
  pdfHeight: 792,
};

const box: Selection = {
  id: "a",
  page: 1,
  top: 158.4,
  left: 61.2,
  bottom: 712.8,
  right: 581.4,
  method: "stream",
};

const ncba: StatementTemplate = {
  id: "ncba-loop",
  name: "NCBA Loop",
  source: "saved",
  normalized: true,
  areas: [{ page: 0, top: 0.2, left: 0.1, bottom: 0.9, right: 0.95, method: "stream" }],
  match: ["ncba", "loop"],
};

describe("suggestLayout", () => {
  it("names NCBA Loop from statement text", () => {
    expect(suggestLayout("NCBA LOOP ACCOUNT STATEMENT Value Date")).toEqual({
      name: "NCBA Loop",
      match: ["ncba", "loop"],
    });
  });

  it("falls back to a generic name when nothing distinctive appears", () => {
    expect(suggestLayout("random cells", "7619116273_acc_statement.pdf")).toEqual({
      name: "Saved layout",
      match: [],
    });
  });
});

describe("rememberCopy", () => {
  it("uses the bank name when we have one", () => {
    expect(rememberCopy("NCBA Loop")).toBe(
      "Remember this layout for the next NCBA Loop statement?",
    );
    expect(rememberCopy("Saved layout")).toBe("Remember this layout for the next statement?");
  });
});

describe("rememberedAreas", () => {
  it("stores page 1 and a page 0 copy so later pages get a box", () => {
    const areas = rememberedAreas([box], page);
    expect(areas.map((area) => area.page)).toEqual([1, 0]);
    expect(areas[0].top).toBeCloseTo(0.2);
    expect(areas[0].left).toBeCloseTo(0.1);
    expect(areas[0].bottom).toBeCloseTo(0.9);
    expect(areas[0].right).toBeCloseTo(0.95);
    expect(areas[1]).toMatchObject({ page: 0, method: "stream" });
    expect(areas[1].top).toBeCloseTo(areas[0].top);
  });

  it("uses a later-page box as the page 0 fallback when pages differ", () => {
    const later: Selection = { ...box, id: "b", page: 2, top: 79.2 };
    const areas = rememberedAreas([box, later], page);
    const wildcard = areas.find((area) => area.page === 0);
    expect(wildcard?.top).toBeCloseTo(0.1);
    expect(areas.some((area) => area.page === 1)).toBe(true);
  });
});

describe("stampSelectionsToEmptyPages", () => {
  it("copies a first-page box onto other included pages", () => {
    const stamped = stampSelectionsToEmptyPages([box], [1, 2, 3], { 1: page }, page);
    expect(stamped.map((item) => item.page).sort((a, b) => a - b)).toEqual([1, 2, 3]);
    const page2 = stamped.find((item) => item.page === 2);
    expect(page2?.top).toBeCloseTo(box.top);
    expect(page2?.left).toBeCloseTo(box.left);
  });

  it("leaves boxes alone when more than one page already has one", () => {
    const existing = [box, { ...box, id: "b", page: 2 }];
    expect(stampSelectionsToEmptyPages(existing, [1, 2, 3], { 1: page }, page)).toEqual(existing);
  });
});

describe("planAutodetect", () => {
  it("applies a matching saved layout when detect finds nothing", () => {
    expect(planAutodetect(0, ncba)).toEqual({
      kind: "apply-match",
      template: ncba,
      status: "Using “NCBA Loop”. Adjust the boxes if the table looks off.",
    });
  });

  it("asks them to draw when detect and match both miss", () => {
    expect(planAutodetect(0, undefined)).toEqual({
      kind: "miss",
      status: "This layout isn’t in the library. Draw a box around the transaction rows.",
    });
  });

  it("keeps found regions and mentions cleanup when a template also matches", () => {
    expect(planAutodetect(2, ncba)).toEqual({
      kind: "found",
      status: "Found 2 table regions. Using “NCBA Loop” cleanup.",
    });
  });
});
