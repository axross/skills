import { readFile, readdir } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { repoPath } from "../helpers/run.mjs";

const PIN_WITH_RELEASE = /^[\w.-]+\/[\w./-]+@[a-f0-9]{40}\s+#\s+v\d+\.\d+\.\d+\S*$/;

describe("CI action pins", () => {
  it("selects remote repository actions by full SHA with a release label", async () => {
    const files = (await readdir(repoPath(".github/workflows"))).filter((file) => /\.ya?ml$/.test(file));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const yaml = await readFile(repoPath(".github/workflows", file), "utf8");
      const uses = [...yaml.matchAll(/^\s*(?:-\s+)?uses:\s*(.+)$/gm)];
      for (const [, value] of uses) {
        if (value.startsWith("./")) continue;
        expect(value, `${file}: ${value}`).toMatch(PIN_WITH_RELEASE);
      }
    }
  });

  it.each([
    "actions/checkout@v4 # v4.4.0",
    "anthropics/claude-code-action@main # v1.0.244",
    "actions/checkout@11d5960 # v4.4.0",
    "actions/checkout@11d5960a326750d5838078e36cf38b85af677262",
  ])("rejects an unpinned or unlabeled reference: %s", (value) => {
    expect(value).not.toMatch(PIN_WITH_RELEASE);
  });
});
