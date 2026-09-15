import { describe, expect, it } from "vitest";
import {
  applyReviewEdits,
  columnShift,
  columnSuspects,
  classifyCell,
  correctionsFromEdits,
  droppedRowLabel,
  editKey,
  isDateColumn,
  isMoneyColumn,
  isNarrativeColumn,
  projectReview,
  reviewToTables,
  rowMatchesQuery,
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

  it("drops rows from the projected export", () => {
    const { columns, rows } = tablesToReview(tables);
    const projected = projectReview(columns, rows, new Set(), new Set([rows[0].id]));
    expect(projected.rows).toHaveLength(1);
    expect(projected.rows[0].cells).toEqual(["03-11-2024", "Visa"]);
    expect(
      correctionsFromEdits(
        rows,
        columns,
        { [editKey(rows[0].id, 1)]: "ignored" },
        new Set(),
        new Set([rows[0].id]),
      ),
    ).toEqual([]);
  });

  it("stamps unnamed, empty, and smashed headers", () => {
    const rows = [
      { id: "1", page: 1, cells: ["03-11-2025", "", "VISA", "100", ""] },
      { id: "2", page: 1, cells: ["04-11-2025", "02-11", "FEE", "20", ""] },
      { id: "3", page: 1, cells: ["05-11-2025", "", "RENT", "50", ""] },
      { id: "4", page: 1, cells: ["06-11-2025", "", "TAX", "10", ""] },
      { id: "5", page: 1, cells: ["07-11-2025", "", "PAY", "5", ""] },
    ];
    const suspects = columnSuspects(
      ["D ate Value", "Column 2", "Particulars", "Money Out", "Money In"],
      rows,
    );
    expect(suspects).toEqual([
      { index: 0, kind: "joined", reason: "Looks joined" },
      { index: 1, kind: "unnamed", reason: "Unnamed" },
      { index: 4, kind: "empty", reason: "Mostly empty" },
    ]);
  });

  it("treats money-in/out as amount columns, not Value Date", () => {
    expect(isMoneyColumn("Money Out")).toBe(true);
    expect(isMoneyColumn("Money In")).toBe(true);
    expect(isMoneyColumn("Balance")).toBe(true);
    expect(isMoneyColumn("Value")).toBe(false);
    expect(isMoneyColumn("Date")).toBe(false);
    expect(isNarrativeColumn("Particulars")).toBe(true);
    expect(isNarrativeColumn("Transaction Type & Details")).toBe(true);
    expect(isNarrativeColumn("Money Out")).toBe(false);
    expect(isDateColumn("Date")).toBe(true);
    expect(isDateColumn("Value Date")).toBe(true);
    expect(isDateColumn("Debit")).toBe(false);
  });

  it("flags an M-PESA extract whose headers have slipped one column", () => {
    const rows = [
      {
        id: "1",
        page: 3,
        cells: [
          "UGIL8BTU6U 2026-07-18 11:32",
          "Customer Transfer Fuliza M-Pesa",
          "Completed",
          "",
          "0.00",
          "50.00",
          "0.00",
        ],
      },
      {
        id: "2",
        page: 3,
        cells: [
          "UGHL8BS0VF 2026-07-17 19:01",
          "Customer Send Money to Micro",
          "Completed",
          "",
          "0.00",
          "70.00",
          "0.00",
        ],
      },
      {
        id: "3",
        page: 3,
        cells: [
          "UGHL8BS3HH 2026-07-17 15:44",
          "OverDraft of Credit Party",
          "Completed",
          "",
          "50.00",
          "0.00",
          "50.00",
        ],
      },
    ];
    const shift = columnShift(
      ["Receipt No.", "Completion Time", "Details", "Transaction Status", "Paid In", "Withdrawn", "Balance"],
      rows,
    );
    expect(shift.shifted).toBe(true);
    expect(shift.mismatches.map((item) => item.index)).toEqual([1, 2]);
    expect(classifyCell("Completed")).toBe("status");
    expect(classifyCell("UGIL8BTU6U 2026-07-18 11:32")).toBe("receipt");
  });

  it("does not flag a grid whose headers match the cells", () => {
    const rows = [
      { id: "1", page: 1, cells: ["UGLL809YEK", "2026-07-21 15:41:59", "Merchant Payment", "Completed", "0.00"] },
      { id: "2", page: 1, cells: ["UGLL808J0X", "2026-07-21 09:33:35", "Customer Send Money", "Completed", "50.00"] },
      { id: "3", page: 1, cells: ["NA8027AH68", "2019-01-08 17:51:09", "M-Shwari Withdraw", "Completed", "800.00"] },
    ];
    expect(
      columnShift(["Receipt No.", "Completion Time", "Details", "Transaction Status", "Paid In"], rows)
        .shifted,
    ).toBe(false);
  });

  it("finds a row by page, story, or amount without commas", () => {
    const row = { id: "1", page: 3, cells: ["03-11-2025", "VISA-TWILIO INC", "1,335.46"] };
    expect(rowMatchesQuery(row, "")).toBe(true);
    expect(rowMatchesQuery(row, "  ")).toBe(true);
    expect(rowMatchesQuery(row, "twilio")).toBe(true);
    expect(rowMatchesQuery(row, "1335")).toBe(true);
    expect(rowMatchesQuery(row, "3")).toBe(true);
    expect(rowMatchesQuery(row, "GOOG")).toBe(false);
  });

  it("labels a dropped row from date and particulars", () => {
    expect(
      droppedRowLabel(
        { id: "1", page: 2, cells: ["03-11-2024", "Visa International Nairobi"] },
        ["Date", "Particulars"],
      ),
    ).toBe("03-11-2024 · Visa International Nairobi");
  });
});
