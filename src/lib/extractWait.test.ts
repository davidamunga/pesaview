import { describe, expect, it } from "vitest";
import {
  formatElapsed,
  readingDetail,
  readingHeadline,
  readingHint,
  readingRatio,
} from "./extractWait";

describe("extract wait copy", () => {
  it("names the boxes being read", () => {
    expect(readingHeadline(1)).toBe("Reading 1 box");
    expect(readingHeadline(396)).toBe("Reading 396 boxes");
  });

  it("names the current page batch when Tabula reports it", () => {
    expect(
      readingDetail({ done: 0, total: 2, pageFrom: 1, pageTo: 200 }, 396),
    ).toBe("Pages 1–200 of 396");
    expect(
      readingDetail({ done: 1, total: 2, pageFrom: 201, pageTo: 396 }, 396),
    ).toBe("Pages 201–396 of 396");
  });

  it("warns that a long statement will take a few minutes", () => {
    expect(readingHint(396)).toContain("few minutes");
    expect(readingHint(2)).toContain("usually quick");
  });

  it("keeps a single batch as an indeterminate wait", () => {
    expect(readingRatio({ done: 0, total: 1, pageFrom: 1, pageTo: 8 })).toBeNull();
    expect(readingRatio({ done: 0, total: 2, pageFrom: 1, pageTo: 200 })).toBeCloseTo(0.14);
  });

  it("stays quiet for the first seconds, then counts up", () => {
    expect(formatElapsed(3_000)).toBe("");
    expect(formatElapsed(12_000)).toBe("12 seconds so far");
    expect(formatElapsed(65_000)).toBe("1 min 5s so far");
  });
});
