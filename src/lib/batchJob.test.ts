import { describe, expect, it } from "vitest";
import { applyTemplateArea } from "./coordinates";
import { metricsFromView } from "./pdfMetrics";
import type { StatementTemplate, TableArea } from "@/types";
import { nextOutputName, planBatchJob, selectionsFromTemplate, statementStem } from "./batchJob";

const equity: StatementTemplate = {
  id: "equity-ledger",
  name: "Equity ledger",
  source: "bundled",
  normalized: true,
  areas: [
    { page: 1, top: 0.24, left: 0.025, bottom: 0.95, right: 0.98, method: "stream" },
    { page: 0, top: 0.12, left: 0.025, bottom: 0.95, right: 0.98, method: "stream" },
  ],
  match: ["particulars", "money out", "money in"],
  columns: ["Date / Value", "Particulars", "Money Out", "Money In", "Balance"],
};

const box: TableArea = {
  page: 1,
  top: 100,
  left: 20,
  bottom: 700,
  right: 580,
  method: "stream",
};

describe("statementStem", () => {
  it("strips the pdf suffix and a folder prefix", () => {
    expect(statementStem("/tmp/Jan-statement.PDF")).toBe("Jan-statement");
    expect(statementStem("plain")).toBe("plain");
  });

  it("replaces characters that cannot be a file name", () => {
    expect(statementStem("Q1:final?.pdf")).toBe("Q1-final-");
  });
});

describe("nextOutputName", () => {
  it("uses the stem until that name is taken, then -2", () => {
    const taken = new Set<string>();
    expect(nextOutputName("Jan", "csv", taken)).toBe("Jan.csv");
    taken.add("jan.csv");
    expect(nextOutputName("Jan", "csv", taken)).toBe("Jan-2.csv");
    taken.add("jan-2.csv");
    expect(nextOutputName("Jan", "xlsx", taken)).toBe("Jan.xlsx");
  });
});

describe("planBatchJob", () => {
  it("applies the remembered layout to every page when the statement matches", () => {
    const plan = planBatchJob([box], "Particulars Money Out Money In", [equity]);
    expect(plan.kind).toBe("apply-match");
    if (plan.kind === "apply-match") {
      expect(plan.template.id).toBe("equity-ledger");
      expect(plan.status).toContain("every page");
    }
  });

  it("applies a matching template when detect finds nothing", () => {
    const plan = planBatchJob([], "Particulars Money Out Money In", [equity]);
    expect(plan.kind).toBe("apply-match");
    if (plan.kind === "apply-match") {
      expect(plan.template.id).toBe("equity-ledger");
    }
  });

  it("keeps found boxes when no template matches", () => {
    const plan = planBatchJob([box], "letterhead only", [equity]);
    expect(plan).toEqual({
      kind: "found",
      areas: [box],
      status: "Found 1 table region.",
    });
  });

  it("misses when detect and match both fail", () => {
    expect(planBatchJob([], "letterhead only", [equity])).toEqual({
      kind: "miss",
      status: "This layout isn’t in the library. Draw a box around the transaction rows.",
    });
  });
});

describe("selectionsFromTemplate", () => {
  it("uses the page 1 box then the page 0 continuation", () => {
    const metrics = metricsFromView([0, 0, 612, 792]);
    const selections = selectionsFromTemplate(equity, 3, { 1: metrics, 2: metrics, 3: metrics });
    expect(selections.map((item) => item.page)).toEqual([1, 2, 3]);
    expect(selections[0].top).toBeCloseTo(0.24 * 792);
    expect(selections[1].top).toBeCloseTo(0.12 * 792);
    expect(selections[2].top).toBeCloseTo(0.12 * 792);
  });
});

describe("metricsFromView", () => {
  it("maps a pdf.js page view onto applyTemplateArea", () => {
    const metrics = metricsFromView([0, 0, 612, 792]);
    expect(metrics).toEqual({
      pdfWidth: 612,
      pdfHeight: 792,
      renderWidth: 612,
      renderHeight: 792,
    });
    const selection = applyTemplateArea(equity.areas[0], 1, metrics, { normalized: true });
    expect(selection.top).toBeCloseTo(0.24 * 792);
    expect(selection.right).toBeCloseTo(0.98 * 612);
  });
});
