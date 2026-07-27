// CommonMark fence parsing, shared by check-skill.mjs and check-links.sh.
//
// A fenced block opens with three or more backticks or tildes and closes only on
// a marker of the SAME character, at least as long, carrying no info string —
// which is what lets a longer fence contain shorter ones. Both scripts used to
// toggle on any fence-looking line, so an inner ```ts block inverted the state
// and exposed the enclosing block's content as body text.
//
// This repository relies on the CommonMark rule:
// skills/code-review/references/evidence-and-reporting.md wraps a ```ts diff
// inside a ````markdown block. Two of the cases below inject content into a copy
// of that real file, so the regression is anchored to the shape that actually
// occurs rather than only to a synthetic one.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { tempDir, writeFileIn, writeSkill } from "./helpers/fixtures.mjs";
import {
  SCRIPTS,
  repoPath,
  runNodeScript,
  runShellScript,
} from "./helpers/run.mjs";

const NESTED_FENCE_FILE = repoPath(
  "skills/code-review/references/evidence-and-reporting.md",
);

/**
 * Copy the real nested-fence reference, injecting `insertion` immediately after
 * the inner ```ts fence — i.e. inside both the outer ````markdown block and the
 * inner one. Under the correct rule neither script may see it.
 * @param {string} root
 * @param {string} insertion
 * @returns {Promise<string>} path of the written copy
 */
async function withInjectionInsideNestedFence(root, insertion) {
  const lines = (await readFile(NESTED_FENCE_FILE, "utf8")).split("\n");
  const outer = lines.findIndex((line) => line.startsWith("````"));
  assert.notEqual(outer, -1, "the reference must still open a ```` block");
  const inner = lines.findIndex(
    (line, index) => index > outer && /^```[a-z]/.test(line),
  );
  assert.notEqual(inner, -1, "the ```` block must still contain a ``` block");

  lines.splice(inner + 1, 0, insertion);
  return writeFileIn(root, "evidence-and-reporting.md", lines.join("\n"));
}

describe("CommonMark fence parsing", () => {
  describe("check-links.sh", () => {
    it("does not resolve a link nested inside a longer fence", async (t) => {
      const root = await tempDir(t);
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

      const result = runShellScript(SCRIPTS.checkLinks, [root]);

      assert.equal(result.code, 0, result.output);
    });

    it("does not resolve a link injected into the real nested-fence reference", async (t) => {
      const root = await tempDir(t);
      await withInjectionInsideNestedFence(
        root,
        "[example](./definitely-missing.md)",
      );

      const result = runShellScript(SCRIPTS.checkLinks, [root]);

      assert.equal(result.code, 0, result.output);
    });

    it("still resolves links that follow the nested block", async (t) => {
      const root = await tempDir(t);
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

      const result = runShellScript(SCRIPTS.checkLinks, [root]);

      assert.equal(result.code, 1, "a real link after the block must be checked");
      assert.match(result.stdout, /definitely-missing\.md/);
    });

    it("closes a fence only on a marker at least as long as the opener", async (t) => {
      const root = await tempDir(t);
      await writeFileIn(
        root,
        "tilde.md",
        [
          "~~~~",
          "~~~",
          "[example](./definitely-missing.md)",
          "~~~",
          "~~~~",
          "",
        ].join("\n"),
      );

      assert.equal(runShellScript(SCRIPTS.checkLinks, [root]).code, 0);
    });

    it("does not let a tilde fence close a backtick fence", async (t) => {
      const root = await tempDir(t);
      await writeFileIn(
        root,
        "mixed.md",
        ["```", "~~~", "[example](./definitely-missing.md)", "~~~", "```", ""].join(
          "\n",
        ),
      );

      assert.equal(runShellScript(SCRIPTS.checkLinks, [root]).code, 0);
    });

    it("reports the number of links checked, not only the file count", async (t) => {
      const root = await tempDir(t);
      await writeFileIn(root, "target.md", "# Target\n");
      await writeFileIn(
        root,
        "source.md",
        "[a](./target.md) and [b](./target.md)\n",
      );

      const result = runShellScript(SCRIPTS.checkLinks, [root]);

      assert.equal(result.code, 0);
      assert.match(result.stdout, /2 links across 2 Markdown files/);
    });

    it("warns when a fence is still open at end of file", async (t) => {
      const root = await tempDir(t);
      await writeFileIn(
        root,
        "unterminated.md",
        ["# Unterminated", "", "```ts", "const x = 1;", ""].join("\n"),
      );

      const result = runShellScript(SCRIPTS.checkLinks, [root]);

      assert.equal(result.code, 0, "an unterminated fence is legal CommonMark");
      assert.match(result.stderr, /unterminated fence/);
      assert.match(result.stderr, /unterminated\.md/);
    });

    it("emits no unterminated-fence warning over the repository's corpus", () => {
      const result = runShellScript(SCRIPTS.checkLinks, []);

      assert.equal(result.code, 0);
      assert.doesNotMatch(result.stderr, /unterminated fence/);
    });
  });

  describe("check-skill.mjs", () => {
    it("does not read a routing bullet nested inside a longer fence", async (t) => {
      const root = await tempDir(t);
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

      const result = runNodeScript(SCRIPTS.checkSkill, [dir]);

      assert.equal(result.code, 0, result.output);
    });

    it("still reads a routing bullet that follows the nested block", async (t) => {
      const root = await tempDir(t);
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

      const result = runNodeScript(SCRIPTS.checkSkill, [dir]);

      assert.equal(result.code, 1, "a real routing bullet must still be checked");
      assert.match(result.stdout, /RFC-2119 keyword/);
    });
  });
});
