import { describe, expect, it } from "vitest";
import { matchTemplate } from "./matchTemplate";
import type { StatementTemplate } from "@/types";

const equity: StatementTemplate = {
  id: "equity-ledger",
  name: "Equity ledger",
  source: "bundled",
  normalized: true,
  areas: [],
  match: ["particulars", "money out", "money in"],
};

const mpesa: StatementTemplate = {
  id: "mpesa",
  name: "M-PESA statement",
  source: "bundled",
  normalized: true,
  areas: [],
  match: ["receipt no", "completion", "paid in"],
};

describe("matchTemplate", () => {
  it("requires every match token", () => {
    const sample = "Date Value Particulars Money Out Money In Balance";
    expect(matchTemplate(sample, [equity, mpesa])?.id).toBe("equity-ledger");
    expect(matchTemplate("Receipt No Completion Time Paid In", [equity, mpesa])?.id).toBe("mpesa");
    expect(matchTemplate("random letterhead", [equity, mpesa])).toBeUndefined();
  });
});
