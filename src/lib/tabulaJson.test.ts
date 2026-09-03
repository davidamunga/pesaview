import { describe, expect, it } from "vitest";
import {
  clusterColumnLefts,
  flattenTables,
  snapRowToBands,
  tablesFromTabulaJson,
} from "./tabulaJson";

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
          [{ text: "03-11-2025" }, { text: "1,335.46296,628.27" }],
        ],
      },
    ]);
    const tables = tablesFromTabulaJson(raw);
    expect(tables[0].rows[0]).toEqual(["03-11-2025", "1,335.46", "296,628.27"]);
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

  it("clusters nearby left edges and snaps empty holes instead of drifting", () => {
    expect(clusterColumnLefts([36, 38, 259, 261, 619, 740, 864])).toHaveLength(5);
    expect(
      snapRowToBands(
        [
          { text: "01-08-2026", left: 36 },
          { text: "VISA-GOOGLE", left: 259 },
          { text: "499.00", left: 619 },
          { text: "204,230.21 Cr", left: 864 },
        ],
        [36, 259, 619, 740, 864],
      ),
    ).toEqual(["01-08-2026", "VISA-GOOGLE", "499.00", "", "204,230.21 Cr"]);
  });

  it("keeps right-aligned amounts in the header column they sit under", () => {
    const edges = [32, 236, 559, 692, 837];
    expect(
      snapRowToBands(
        [
          { text: "01-08-2026", left: 36 },
          { text: "SMS CHARGE", left: 259 },
          { text: "51.51", left: 641 },
          { text: "200,178.70 Cr", left: 864 },
        ],
        edges,
      ),
    ).toEqual(["01-08-2026", "SMS CHARGE", "51.51", "", "200,178.70 Cr"]);
    expect(
      snapRowToBands(
        [
          { text: "25-07-2026", left: 36 },
          { text: "Credit", left: 259 },
          { text: "20,000.00", left: 734 },
          { text: "21,426.05 Cr", left: 871 },
        ],
        edges,
      ),
    ).toEqual(["25-07-2026", "Credit", "", "20,000.00", "21,426.05 Cr"]);
    expect(
      snapRowToBands(
        [
          { text: "13-07-2026", left: 36 },
          { text: "11-07", left: 194 },
          { text: "Transfer", left: 259 },
          { text: "6,000.00", left: 619 },
          { text: "81,161.28 Cr", left: 871 },
        ],
        edges,
      ),
    ).toEqual(["13-07-2026 11-07", "Transfer", "6,000.00", "", "81,161.28 Cr"]);
  });

  it("keeps Money In empty when stream omits it, using x-position across pages", () => {
    const raw = JSON.stringify([
      {
        page: 1,
        data: [
          [
            { text: "Date", left: 36, width: 80 },
            { text: "Particulars", left: 259, width: 120 },
            { text: "Money Out", left: 619, width: 60 },
            { text: "Money In", left: 740, width: 60 },
            { text: "Balance", left: 864, width: 90 },
          ],
          [
            { text: "03-11-2025", left: 36, width: 86 },
            { text: "Salary", left: 259, width: 180 },
            { text: "50,000.00", left: 740, width: 70 },
            { text: "343,877.57 Cr", left: 864, width: 94 },
          ],
        ],
      },
      {
        page: 4,
        data: [
          [
            { text: "Date", left: 36, width: 80 },
            { text: "Particulars", left: 259, width: 120 },
            { text: "Money Out", left: 619, width: 60 },
            { text: "Money In", left: 740, width: 60 },
            { text: "Balance", left: 864, width: 90 },
          ],
          [
            { text: "01-08-2026", left: 36, width: 86 },
            { text: "VISA-GOOGLE *YouTubePre", left: 259, width: 200 },
            { text: "499.00", left: 619, width: 60 },
            { text: "204,230.21 Cr", left: 864, width: 94 },
          ],
          [
            { text: "01-08-2026 ----------------", left: 36, width: 200 },
            { text: "TRANSACTION + SMS CHARGE", left: 259, width: 200 },
            { text: "40.01", left: 619, width: 50 },
            { text: "195,522.20 Cr", left: 864, width: 94 },
          ],
          [{ text: "----------------", left: 36, width: 900 }],
          [
            { text: "Page Total:", left: 36, width: 80 },
            { text: "9,207.01", left: 619, width: 60 },
          ],
        ],
      },
    ]);
    const tables = tablesFromTabulaJson(raw, {
      skipRows: ["Page Total"],
      columns: ["Date", "Particulars", "Money Out", "Money In", "Balance"],
    });
    expect(tables).toHaveLength(2);
    expect(tables[0].columns).toEqual(["Date", "Particulars", "Money Out", "Money In", "Balance"]);
    expect(tables[0].rows[0]).toEqual(["03-11-2025", "Salary", "", "50,000.00", "343,877.57 Cr"]);
    expect(tables[1].rows[0]).toEqual([
      "01-08-2026",
      "VISA-GOOGLE *YouTubePre",
      "499.00",
      "",
      "204,230.21 Cr",
    ]);
    expect(tables[1].rows[1][0]).toBe("01-08-2026");
    expect(tables[1].rows[1][1]).toBe("TRANSACTION + SMS CHARGE");
    expect(tables[1].rows.some((row) => row.join("").includes("---"))).toBe(false);
  });
});
