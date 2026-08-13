// CommonMark fence parsing, as both CLIs apply it.
//
// a fenced block opens with three or more backticks or tildes and closes only on
// a marker of the same character, at least as long, carrying no info string —
// which is what lets a longer fence contain shorter ones. both scripts used to
// toggle on any fence-looking line, so an inner ```ts block inverted the state
// and exposed the enclosing block's content as body text.
//
// the rule now has a single implementation, in commonmark.mjs, which
// tests/unit/commonmark.test.mjs covers directly. these cases stay because the
// module being right is not the same claim as both CLIs reading it correctly:
// each script still decides what to do with the lines it is handed.
//
// this repository relies on the CommonMark rule:
// skills/code-review/references/evidence-and-reporting.md wraps a ```ts diff
// inside a ````markdown block. two of the cases below inject content into a copy
// of that real file, so the regression is anchored to the shape that actually
// occurs rather than only to a synthetic one.

import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { tempDir, writeFileIn, writeSkill } from "../helpers/fixtures.mjs";
import { SCRIPTS, repoPath, validator } from "../helpers/run.mjs";
import { gate } from "../repository/gates.mjs";

const checkLinks = validator(SCRIPTS.checkLinks);
const checkSkill = validator(SCRIPTS.checkSkillReferences);

const NESTED_FENCE_FILE = repoPath(
  "skills/code-review/references/evidence-and-reporting.md",
);

/**
 * copy the real nested-fence reference, injecting `insertion` immediately after
 * the inner ```ts fence — i.e. inside both the outer ````markdown block and the
 * inner one. under the correct rule neither script may see it.
 * @param {string} root
 * @param {string} insertion
 * @returns {Promise<string>} path of the written copy
 */
async function withInjectionInsideNestedFence(root, insertion) {
  const lines = (await readFile(NESTED_FENCE_FILE, "utf8")).split("\n");
  const outer = lines.findIndex((line) => line.startsWith("````"));
  expect(outer, "the reference must still open a ```` block").not.toBe(-1);
  const inner = lines.findIndex(
    (line, index) => index > outer && /^```[a-z]/.test(line),
  );
  expect(inner, "the ```` block must still contain a ``` block").not.toBe(-1);

  lines.splice(inner + 1, 0, insertion);
  return writeFileIn(root, "evidence-and-reporting.md", lines.join("\n"));
}

describe("CommonMark fence parsing", () => {
  describe("check-links.mjs", () => {
    it("does not resolve a link nested inside a longer fence", async () => {
      const root = await tempDir();
      await writeFileIn(
        root,
        "nested.md",
        [
          "# Nested",
          "",
          "````markdown",
          "```ts",
          "[example](./definitely-missing.md)",
          "```",
          "````",
          "",
        ].join("\n"),
      );

      expect(checkLinks(root)).toPassCleanly();
    });

    it("does not resolve a link injected into the real nested-fence reference", async () => {
      const root = await tempDir();
      await withInjectionInsideNestedFence(
        root,
        "[example](./definitely-missing.md)",
      );

      expect(checkLinks(root)).toPassCleanly();
    });

    it("still resolves links that follow the nested block", async () => {
      const root = await tempDir();
      await writeFileIn(
        root,
        "nested.md",
        [
          "# Nested",
          "",
          "````markdown",
          "```ts",
          "const x = 1;",
          "```",
          "````",
          "",
          "After the block: [gone](./definitely-missing.md)",
          "",
        ].join("\n"),
      );

      expect(
        checkLinks(root),
        "a real link after the block must be checked",
      ).toReportFailure(/definitely-missing\.md/);
    });

    it.each([
      {
        what: "closes a fence only on a marker at least as long as the opener",
        file: "tilde.md",
        lines: [
          "~~~~",
          "~~~",
          "[example](./definitely-missing.md)",
          "~~~",
          "~~~~",
          "",
        ],
      },
      {
        what: "does not let a tilde fence close a backtick fence",
        file: "mixed.md",
        lines: [
          "```",
          "~~~",
          "[example](./definitely-missing.md)",
          "~~~",
          "```",
          "",
        ],
      },
    ])("$what", async ({ file, lines }) => {
      const root = await tempDir();
      await writeFileIn(root, file, lines.join("\n"));

      expect(checkLinks(root)).toPassCleanly();
    });

    it("reports the number of links checked, not only the file count", async () => {
      const root = await tempDir();
      await writeFileIn(root, "target.md", "# Target\n");
      await writeFileIn(
        root,
        "source.md",
        "[a](./target.md) and [b](./target.md)\n",
      );

      const result = checkLinks(root);

      expect(result).toPassCleanly();
      expect(result.stdout).toMatch(/2 links across 2 Markdown files/);
    });

    it("warns when a fence is still open at end of file", async () => {
      const root = await tempDir();
      await writeFileIn(
        root,
        "unterminated.md",
        ["# Unterminated", "", "```ts", "const x = 1;", ""].join("\n"),
      );

      const result = checkLinks(root);

      expect(
        result,
        "an unterminated fence is legal CommonMark",
      ).toPassCleanly();
      expect(result.stderr).toMatch(/unterminated fence/);
      expect(result.stderr).toMatch(/unterminated\.md/);
    });

    it("emits no unterminated-fence warning over the repository's corpus", () => {
      // the links gate's own roster, not a bare no-argument sweep — see
      // check-links.test.mjs's equivalent case for why.
      const result = checkLinks(...gate("links").args);

      expect(result).toPassCleanly();
      expect(result.stderr).not.toMatch(/unterminated fence/);
    });
  });

  describe("check-skill-references.mjs", () => {
    it("does not read a routing bullet nested inside a longer fence", async () => {
      const root = await tempDir();
      const dir = await writeSkill(root, "nested-fence-skill", {
        body: [
          "# Nested Fence Skill",
          "",
          "## Some Topic",
          "",
          "See [topic.md](./references/topic.md) for:",
          "",
          "````markdown",
          "```ts",
          "- MUST never be read as a routing bullet",
          "```",
          "````",
          "",
        ].join("\n"),
        references: { "topic.md": "# Topic\n\nDetail.\n" },
      });

      expect(checkSkill(dir)).toPassCleanly();
    });

    it("still reads a routing bullet that follows the nested block", async () => {
      const root = await tempDir();
      const dir = await writeSkill(root, "after-fence-skill", {
        body: [
          "# After Fence Skill",
          "",
          "## Some Topic",
          "",
          "````markdown",
          "```ts",
          "const x = 1;",
          "```",
          "````",
          "",
          "See [topic.md](./references/topic.md) for:",
          "",
          "- MUST be read as a routing bullet",
          "",
        ].join("\n"),
        references: { "topic.md": "# Topic\n\nDetail.\n" },
      });

      expect(
        checkSkill(dir),
        "a real routing bullet must still be checked",
      ).toReportFailure(/RFC-2119 keyword/);
    });
  });
});
