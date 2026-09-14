import { describe, expect, it } from "vitest";
import { tabulaTimeoutMs } from "./tabulaTimeout";

describe("tabulaTimeoutMs", () => {
  it("keeps a short extract at 90 seconds", () => {
    expect(tabulaTimeoutMs("extract", 1)).toBe(90_000);
    expect(tabulaTimeoutMs("extract", 10)).toBe(90_000 + 9 * 3_000);
  });

  it("gives a decade statement up to an hour, not 15 minutes", () => {
    expect(tabulaTimeoutMs("extract", 396)).toBe(90_000 + 395 * 3_000);
    expect(tabulaTimeoutMs("extract", 2_000)).toBe(60 * 60_000);
    expect(tabulaTimeoutMs("extract", 5_000)).toBe(60 * 60_000);
  });

  it("keeps a short guess at two minutes", () => {
    expect(tabulaTimeoutMs("guess", 1)).toBe(120_000);
    expect(tabulaTimeoutMs("guess", 8)).toBe(120_000);
  });
});
