import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const changesetDir = dirname(fileURLToPath(import.meta.url));
const requireFromChangeset = createRequire(join(changesetDir, "config.json"));
const { formatReleaseLine } = requireFromChangeset("./changelog.cjs");
const config = JSON.parse(readFileSync(join(changesetDir, "config.json"), "utf8"));

describe("changeset changelog", () => {
  it("leads with the sentence and a PR, without thanks or a SHA", () => {
    const line = formatReleaseLine({
      firstLine: "Keep M-PESA receipt numbers in their own columns.",
      futureLines: [],
      pull: "[#10](https://github.com/davidamunga/pesaview/pull/10)",
      thanksUsers: [],
      githubServerUrl: "https://github.com",
    });

    expect(line).toBe(
      "\n\n- Keep M-PESA receipt numbers in their own columns. ([#10](https://github.com/davidamunga/pesaview/pull/10))",
    );
  });

  it("thanks only an author named in the changeset", () => {
    const line = formatReleaseLine({
      firstLine: "Fix the export quiet state.",
      futureLines: [],
      pull: "[#10](https://github.com/davidamunga/pesaview/pull/10)",
      thanksUsers: ["guest"],
      githubServerUrl: "https://github.com",
    });

    expect(line).toBe(
      "\n\n- Fix the export quiet state. ([#10](https://github.com/davidamunga/pesaview/pull/10)) Thanks [@guest](https://github.com/guest).",
    );
  });

  it("resolves the changelog module from .changeset, the way Changesets loads it", () => {
    expect(config.changelog[0]).toBe("./changelog.cjs");
    expect(requireFromChangeset.resolve(config.changelog[0])).toBe(
      join(changesetDir, "changelog.cjs"),
    );
  });
});
