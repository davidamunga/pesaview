import { describe, expect, it } from "vitest";
import { flattenTables, tablesFromTabulaJson } from "./tabulaJson";

describe("tablesFromTabulaJson", () => {
  it("uses the first row as headers when it is not numeric", () => {
    const raw = JSON.stringify([
      {
        page: 1,
        data: [
          [{ text: "Date" }, { text: "Particulars" }, { text: "Money Out" }],
          [{ text: "02-11-2024" }, { text: "M-Pesa" }, { text: "500.00" }],
        ],
      },
    ]);
    const tables = tablesFromTabulaJson(raw);
    expect(tables).toHaveLength(1);
    expect(tables[0].columns).toEqual(["Date", "Particulars", "Money Out"]);
    expect(tables[0].rows[0][1]).toBe("M-Pesa");
  });

  it("ignores warning text around the JSON array", () => {
    const raw = `Feb 2024 warning\n[{"page":2,"data":[[{"text":"12.50"}]]}]\n`;
    const tables = tablesFromTabulaJson(raw);
    expect(tables[0].page).toBe(2);
    expect(tables[0].columns).toEqual(["Column 1"]);
  });

  it("flattens multiple tables with a spacer row", () => {
    const flat = flattenTables([
      { page: 1, columns: ["A", "B"], rows: [["1", "2"]] },
      { page: 2, columns: ["A", "B"], rows: [["3", "4"]] },
    ]);
    expect(flat.rows).toEqual([
      ["1", "2"],
      ["", ""],
      ["3", "4"],
    ]);
  });

  it("splits a stream-mashed amount and balance cell", () => {
    const raw = JSON.stringify([
      {
        page: 1,
        data: [
          [{ text: "Date" }, { text: "Amount" }, { text: "Balance" }],
          [{ text: "03-11-2025" }, { text: "1,335.46296,628.27 Cr" }],
        ],
      },
    ]);
    const tables = tablesFromTabulaJson(raw);
    expect(tables[0].rows[0]).toEqual(["03-11-2025", "1,335.46", "296,628.27 Cr"]);
  });

  it("drops total rows and applies template columns when the width matches", () => {
    const raw = JSON.stringify([
      {
        page: 1,
        data: [
          [{ text: "A" }, { text: "B" }],
          [{ text: "keep" }, { text: "1.00" }],
          [{ text: "Page Total:" }, { text: "9.00" }],
        ],
      },
    ]);
    const tables = tablesFromTabulaJson(raw, {
      skipRows: ["Page Total"],
      columns: ["Name", "Amount"],
    });
    expect(tables[0].columns).toEqual(["Name", "Amount"]);
    expect(tables[0].rows).toEqual([["keep", "1.00"]]);
  });

  it("folds wrapped description lines into the previous record", () => {
    const raw = JSON.stringify([
      {
        page: 1,
        data: [
          [
            { text: "Receipt No." },
            { text: "Completion Time" },
            { text: "Details" },
            { text: "Paid In" },
          ],
          [
            { text: "TIK0SOZPPS" },
            { text: "2025-09-20 19:11:38" },
            { text: "Customer Transfer to -" },
            { text: "500.00" },
          ],
          [{ text: "" }, { text: "" }, { text: "2547******833 DANIEL GATHONI" }, { text: "" }],
          [{ text: "" }, { text: "" }, { text: "Equity Bulk Account via API." }, { text: "" }],
          [
            { text: "TIK1OTHER" },
            { text: "2025-09-20 19:20:00" },
            { text: "Merchant Payment" },
            { text: "100.00" },
          ],
        ],
      },
    ]);
    const tables = tablesFromTabulaJson(raw);
    expect(tables[0].rows).toHaveLength(2);
    expect(tables[0].rows[0][2]).toBe(
      "Customer Transfer to - 2547******833 DANIEL GATHONI Equity Bulk Account via API.",
    );
    expect(tables[0].rows[1][0]).toBe("TIK1OTHER");
  });

  it("keeps amount-only rows and can disable merging", () => {
    const raw = JSON.stringify([
      {
        page: 1,
        data: [
          [{ text: "Date" }, { text: "Details" }, { text: "Balance" }],
          [{ text: "" }, { text: "Opening balance" }, { text: "30,018.95 Cr" }],
          [{ text: "" }, { text: "carried forward" }, { text: "" }],
        ],
      },
    ]);
    const merged = tablesFromTabulaJson(raw);
    expect(merged[0].rows).toEqual([["", "Opening balance carried forward", "30,018.95 Cr"]]);

    const split = tablesFromTabulaJson(raw, { mergeRows: false });
    expect(split[0].rows).toHaveLength(2);
  });
});
