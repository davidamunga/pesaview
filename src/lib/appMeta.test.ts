import { describe, expect, it } from "vitest";
import { formatAppVersion } from "./appMeta";

describe("formatAppVersion", () => {
  it("prefixes a bare semver", () => {
    expect(formatAppVersion("0.3.0")).toBe("v0.3.0");
  });

  it("leaves an existing v prefix", () => {
    expect(formatAppVersion("v0.3.0")).toBe("v0.3.0");
  });
});
