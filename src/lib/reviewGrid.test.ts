import { describe, expect, it } from "vitest";
import {
  applyReviewEdits,
  correctionsFromEdits,
  editKey,
  projectReview,
  reviewToTables,
  tablesToReview,
} from "./reviewGrid";

const tables = [
  {
    page: 1,
    columns: ["Date", "Details"],
    rows: [
      ["02-11-2024", "M-Pesa"],
      ["03-11-2024", "Visa"],
    ],
  },
];

describe("reviewGrid", () => {
  it("flattens tables and records cell corrections", () => {
    const { columns, rows } = tablesToReview(tables);
    const key = editKey(rows[1].id, 1);
    const edited = applyReviewEdits(rows, { [key]: "Visa International" });
    expect(edited[1].cells[1]).toBe("Visa International");
    expect(correctionsFromEdits(rows, columns, { [key]: "Visa International" })).toEqual([
      {
        page: 1,
        row: 2,
        column: "Details",
        oldValue: "Visa",
        newValue: "Visa International",
      },
    ]);
    expect(reviewToTables(columns, edited)[0].rows[1][1]).toBe("Visa International");
  });

  it("renames and drops columns for export", () => {
    const { rows } = tablesToReview(tables);
    const renamed = ["Txn date", "Details"];
    const projected = projectReview(renamed, rows, new Set([1]));
    expect(projected.columns).toEqual(["Txn date"]);
    expect(projected.rows[0].cells).toEqual(["02-11-2024"]);
    expect(correctionsFromEdits(rows, renamed, { [editKey(rows[0].id, 1)]: "x" }, new Set([1]))).toEqual(
      [],
    );
  });
});
