// Exit-code and failure-message contract for check-skill.mjs.
//
// `audit-checklist.md` makes confirming a bundled script's documented exit codes
// a MUST, and this validator is the one the repository arms as a merge gate. The
// documented contract is: 0 when every checked skill passes (warnings alone do
// not fail a skill), 1 when any check fails, and 2 on a bad invocation or a path
// that holds no skill.

import assert from "node:assert/strict";
import { join } from "node:path";
import { describe, it } from "node:test";

import { writeSkill, tempDir } from "./helpers/fixtures.mjs";
import { SCRIPTS, runNodeScript } from "./helpers/run.mjs";

const check = (...args) => runNodeScript(SCRIPTS.checkSkill, args);

describe("check-skill.mjs", () => {
  describe("exit 0 — a passing skill", () => {
    it("passes a well-formed skill", async (t) => {
      const root = await tempDir(t);
      const dir = await writeSkill(root, "well-formed-skill");

      const result = check(dir);

      assert.equal(result.code, 0);
      assert.match(result.stdout, /^PASS {2}/m);
      assert.match(result.stdout, /All 1 skill\(s\) passed structural checks\./);
    });

    it("resolves a skill root into its immediate skill subdirectories", async (t) => {
      const root = await tempDir(t);
      await writeSkill(root, "first-skill");
      await writeSkill(root, "second-skill");

      const result = check(root);

      assert.equal(result.code, 0);
      assert.match(result.stdout, /All 2 skill\(s\) passed structural checks\./);
    });

    it("keeps a capability-framing warning advisory rather than fatal", async (t) => {
      const root = await tempDir(t);
      const dir = await writeSkill(root, "some-guidelines");

      const result = check(dir);

      assert.equal(result.code, 0, "a WARN must not change the exit code");
      assert.match(result.stdout, /^WARN/m);
      assert.match(result.stdout, /names the document, not the capability/);
    });

    it("warns on a document-voice description without failing", async (t) => {
      const root = await tempDir(t);
      const dir = await writeSkill(root, "document-voice-skill", {
        frontmatter: {
          description:
            "This skill describes a thing at length, opening in document voice so the advisory detector has something to catch.",
        },
      });

      const result = check(dir);

      assert.equal(result.code, 0);
      assert.match(result.stdout, /opens in document voice/);
    });
  });

  describe("exit 1 — each implemented failure class", () => {
    /**
     * Assert that a fixture fails with exit 1 and reports `expected`.
     * @param {string} dir
     * @param {RegExp} expected
     */
    const assertFailure = (dir, expected) => {
      const result = check(dir);
      assert.equal(result.code, 1, `expected exit 1, got ${result.code}`);
      assert.match(result.stdout, /^FAIL {2}/m);
      assert.match(result.stdout, expected);
      assert.match(
        result.stdout,
        /1 of 1 skill\(s\) failed structural checks\./,
      );
    };

    it("reports a missing frontmatter block", async (t) => {
      const root = await tempDir(t);
      const dir = await writeSkill(root, "no-frontmatter", {
        raw: "# Just a heading\n\nNo frontmatter at all.\n",
      });

      assertFailure(dir, /frontmatter: missing or unterminated leading/);
    });

    it("reports an unterminated frontmatter block", async (t) => {
      const root = await tempDir(t);
      const dir = await writeSkill(root, "unterminated-frontmatter", {
        raw: "---\nname: unterminated-frontmatter\ndescription: Never closed.\n",
      });

      assertFailure(dir, /frontmatter: missing or unterminated leading/);
    });

    it("reports a missing name", async (t) => {
      const root = await tempDir(t);
      const dir = await writeSkill(root, "nameless-skill", {
        frontmatter: { name: null },
      });

      assertFailure(dir, /frontmatter: `name` is missing\./);
    });

    it("reports a non-kebab-case name", async (t) => {
      const root = await tempDir(t);
      const dir = await writeSkill(root, "Not_Kebab");

      assertFailure(dir, /`name` "Not_Kebab" is not kebab-case/);
    });

    it("reports a name over the 64-character cap", async (t) => {
      const root = await tempDir(t);
      const longName = "a".repeat(65);
      const dir = await writeSkill(root, longName);

      assertFailure(dir, /frontmatter: `name` is 65 chars \(max 64\)\./);
    });

    it("reports a name that does not match its directory", async (t) => {
      const root = await tempDir(t);
      const dir = await writeSkill(root, "directory-name", {
        frontmatter: { name: "frontmatter-name" },
      });

      assertFailure(
        dir,
        /`name` "frontmatter-name" does not match directory "directory-name"/,
      );
    });

    it("reports a missing description", async (t) => {
      const root = await tempDir(t);
      const dir = await writeSkill(root, "no-description", {
        frontmatter: { description: null },
      });

      assertFailure(dir, /frontmatter: `description` is missing or empty\./);
    });

    it("reports a description over the 1024-character cap", async (t) => {
      const root = await tempDir(t);
      const dir = await writeSkill(root, "long-description", {
        frontmatter: { description: `The ability to ${"x".repeat(1010)}` },
      });

      assertFailure(dir, /frontmatter: `description` is 1025 chars \(max 1024\)\./);
    });

    it("reports description + when_to_use over the 1536-character cap", async (t) => {
      const root = await tempDir(t);
      const dir = await writeSkill(root, "long-combined", {
        frontmatter: {
          description: `The ability to ${"x".repeat(985)}`,
          when_to_use: `Apply when ${"y".repeat(589)}`,
        },
      });

      assertFailure(
        dir,
        /frontmatter: `description` \+ `when_to_use` is 1600 chars \(max 1536\)\./,
      );
    });

    it("reports a reference file that SKILL.md never links", async (t) => {
      const root = await tempDir(t);
      const dir = await writeSkill(root, "orphan-reference", {
        references: { "orphan.md": "# Orphan\n\nLinked from nowhere.\n" },
      });

      assertFailure(
        dir,
        /references: "references\/orphan\.md" is not linked from SKILL\.md \(orphan reference\)/,
      );
    });

    it("reports a routing bullet that opens with an RFC-2119 keyword", async (t) => {
      const root = await tempDir(t);
      const dir = await writeSkill(root, "normative-routing", {
        body: [
          "# Normative Routing",
          "",
          "## Some Topic",
          "",
          "See [topic.md](./references/topic.md) for:",
          "",
          "- MUST never appear in a routing bullet",
          "",
        ].join("\n"),
        references: { "topic.md": "# Topic\n\nDetail.\n" },
      });

      assertFailure(
        dir,
        /routing: section "Some Topic" has a routing bullet starting with an RFC-2119 keyword/,
      );
    });

    it("fails the run when one skill in a root fails and another passes", async (t) => {
      const root = await tempDir(t);
      await writeSkill(root, "healthy-skill");
      await writeSkill(root, "broken-skill", {
        frontmatter: { description: null },
      });

      const result = check(root);

      assert.equal(result.code, 1);
      assert.match(
        result.stdout,
        /1 of 2 skill\(s\) failed structural checks\./,
      );
    });
  });

  describe("exit 2 — bad invocation or no skill at the path", () => {
    it("exits 2 with usage when given no arguments", () => {
      const result = check();

      assert.equal(result.code, 2);
      assert.match(result.stderr, /Usage: check-skill\.mjs/);
    });

    it("exits 2 when a path is not a directory", async (t) => {
      const root = await tempDir(t);
      const dir = await writeSkill(root, "a-skill");

      const result = check(join(dir, "SKILL.md"));

      assert.equal(result.code, 2);
      assert.match(result.stderr, /Not a directory:/);
    });

    it("exits 2 when a directory holds no SKILL.md and no skill subdirectory", async (t) => {
      const root = await tempDir(t);

      const result = check(root);

      assert.equal(result.code, 2);
      assert.match(
        result.stderr,
        /No SKILL\.md in ".*" or its immediate subdirectories\./,
      );
    });
  });
});
