import { cp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, it } from "vitest";

import { tempDir } from "../helpers/fixtures.mjs";
import { repoPath, runScript } from "../helpers/run.mjs";

const skill = "skills/living-project-documentation";
const indexBookmarks = [
  "documentation",
  "specifications",
  "conventions",
  "operations",
].map((heading) => `index.md#${heading}`);

it.each([
  [`${skill}/assets/docs-example`, indexBookmarks],
  [
    "docs",
    [
      ...indexBookmarks,
      "specs/skill-evaluation.md#explicit-treatment-comparison",
      "operations/evaluation-dispatch.md#the-declared-scenario-set",
    ],
  ],
])(
  "preserves published bookmarks in the standalone %s bundle",
  async (source, bookmarks) => {
    const bundle = join(await tempDir(), "bundle");
    await cp(repoPath(source), bundle, { recursive: true });
    // A consumer can still hold these URLs even when the bundle no longer links to them.
    await writeFile(
      join(bundle, "reader.md"),
      bookmarks.map((url) => `[Bookmark](${url})`).join("\n\n"),
    );
    expect(
      runScript(`${skill}/scripts/check-references.mjs`, [bundle]),
    ).toPassCleanly();
  },
);
