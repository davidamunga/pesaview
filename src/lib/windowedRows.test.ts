import { describe, expect, it } from "vitest";
import { WINDOW_ROW_HEIGHT, windowedRange } from "./windowedRows";

describe("windowedRange", () => {
  it("keeps a short ledger fully in view", () => {
    expect(windowedRange(20, 0, 400)).toEqual({
      start: 0,
      end: 20,
      padTop: 0,
      padBottom: 0,
    });
  });

  it("windows a decade of rows so Review does not mount every cell", () => {
    const range = windowedRange(12_000, 0, 480);
    expect(range.start).toBe(0);
    expect(range.end).toBeLessThan(120);
    expect(range.end + range.padBottom / WINDOW_ROW_HEIGHT).toBe(12_000);
  });
});
