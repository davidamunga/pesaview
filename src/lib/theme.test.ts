import { describe, expect, it } from "vitest";
import { resolveTheme, WINDOW_CHROME } from "./theme";

describe("resolveTheme", () => {
  it("follows the system preference", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("honors an explicit choice", () => {
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
  });

  it("uses desk chrome for the native title bar", () => {
    expect(WINDOW_CHROME.light).toBe("#efeee9");
    expect(WINDOW_CHROME.dark).toBe("#1c211d");
  });
});
