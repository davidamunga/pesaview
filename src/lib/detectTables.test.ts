import { describe, expect, it } from "vitest";
import { detectTransactionAreas } from "./detectTables";

describe("detectTransactionAreas", () => {
  it("tightens around the ledger and ignores letterhead cells", () => {
    const raw = JSON.stringify([
      {
        page: 1,
        data: [
          [{ text: "EQUITY BANK", top: 20, left: 40, width: 200, height: 20 }],
          [{ text: "P.O.BOX 9073-30100", top: 80, left: 40, width: 160, height: 10 }],
          [
            { text: "D ate Value", top: 330.6, left: 32, width: 90, height: 8 },
            { text: "Particulars", top: 330.6, left: 236, width: 120, height: 8 },
            { text: "Money Out Money In Balance", top: 330.6, left: 559, width: 340, height: 8 },
          ],
          [{ text: "297,963.73 Cr", top: 355.3, left: 864, width: 94, height: 5 }],
          [
            { text: "03-11-2025", top: 373.3, left: 36, width: 86, height: 5 },
            { text: "VISA-GOOGLE", top: 373.3, left: 259, width: 200, height: 5 },
            { text: "1,335.46", top: 373.3, left: 619, width: 60, height: 5 },
            { text: "296,628.27 Cr", top: 373.3, left: 864, width: 94, height: 5 },
          ],
          [
            { text: "05-11-2025", top: 409.3, left: 36, width: 86, height: 5 },
            { text: "VISA-TWILIO", top: 409.3, left: 259, width: 180, height: 5 },
            { text: "2,750.70", top: 409.3, left: 619, width: 60, height: 5 },
            { text: "293,261.94 Cr", top: 409.3, left: 864, width: 94, height: 5 },
          ],
          [{ text: "Note: Please verify", top: 1200, left: 36, width: 400, height: 10 }],
        ],
      },
    ]);

    const areas = detectTransactionAreas(raw);
    expect(areas).toHaveLength(1);
    expect(areas[0].page).toBe(1);
    expect(areas[0].method).toBe("stream");
    expect(areas[0].top).toBeGreaterThan(300);
    expect(areas[0].top).toBeLessThan(330);
    expect(areas[0].left).toBeLessThan(40);
    expect(areas[0].right).toBeGreaterThan(940);
    expect(areas[0].bottom).toBeGreaterThan(410);
    expect(areas[0].bottom).toBeLessThan(500);
  });

  it("returns one region per page and skips pages without a ledger", () => {
    const raw = JSON.stringify([
      {
        page: 1,
        data: [
          [
            { text: "03-11-2025", top: 200, left: 36, width: 80, height: 5 },
            { text: "02-11-2025", top: 220, left: 36, width: 80, height: 5 },
            { text: "10.00 Cr", top: 220, left: 800, width: 60, height: 5 },
          ],
        ],
      },
      {
        page: 2,
        data: [[{ text: "Cover letter only", top: 40, left: 40, width: 200, height: 10 }]],
      },
    ]);

    const areas = detectTransactionAreas(raw);
    expect(areas.map((area) => area.page)).toEqual([1]);
  });

  it("treats slash-separated dates as a ledger", () => {
    const raw = JSON.stringify([
      {
        page: 1,
        data: [
          [
            { text: "16/11/2024", top: 200, left: 40, width: 70, height: 8 },
            { text: "1,200.00", top: 200, left: 400, width: 50, height: 8 },
          ],
          [
            { text: "17/11/2024", top: 220, left: 40, width: 70, height: 8 },
            { text: "800.00", top: 220, left: 400, width: 50, height: 8 },
          ],
        ],
      },
    ]);
    const areas = detectTransactionAreas(raw);
    expect(areas).toHaveLength(1);
    expect(areas[0].top).toBeLessThan(200);
  });
});
