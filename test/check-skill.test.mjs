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

    it("accepts a fenced demonstration between a heading and its guidelines", async (t) => {
      const root = await tempDir(t);
      const dir = await writeSkill(root, "fenced-demonstration", {
        body: [
          "# Fenced Demonstration",
          "",
          "Prose for the fixture.",
          "",
          "## Overall Format",
          "",
          "```",
          "type(scope): description",
          "```",
          "",
          "**Guidelines:**",
          "",
          "- MUST count the fenced block above as the section's demonstration.",
          "",
        ].join("\n"),
      });

      const result = check(dir);

      assert.equal(result.code, 0, result.output);
      assert.doesNotMatch(result.stdout, /^\s+- section:/m);
    });

    it("exempts a nested bullet from the RFC-2119 requirement", async (t) => {
      const root = await tempDir(t);
      const dir = await writeSkill(root, "nested-bullets", {
        body: [
          "# Nested Bullets",
          "",
          "Prose for the fixture.",
          "",
          "**Guidelines:**",
          "",
          "- MUST limit the legal cases to these two:",
          "  - **The first case**, which is a definition rather than a rule.",
          "  - **The second case**, likewise.",
          "",
        ].join("\n"),
      });

      const result = check(dir);

      assert.equal(result.code, 0, result.output);
      assert.doesNotMatch(result.stdout, /^\s+- guidelines:/m);
    });

    it("resolves anchor fragments the way GitHub slugs headings", async (t) => {
      const root = await tempDir(t);
      const dir = await writeSkill(root, "slug-rules", {
        body: [
          "# Slug Rules",
          "",
          "See [em dash](#phase-1--plan), [double space](#double--space),",
          "[punctuation](#dont-panic-really), and [the second one](#repeat-heading-1).",
          "",
          "## Phase 1 — Plan",
          "",
          "An em dash is deleted and both flanking spaces become hyphens.",
          "",
          "## Double  Space",
          "",
          "Consecutive spaces are not collapsed.",
          "",
          "## Don't Panic, Really!",
          "",
          "Punctuation is deleted rather than replaced.",
          "",
          "## Repeat Heading",
          "",
          "The first of two identical headings keeps the bare slug.",
          "",
          "## Repeat Heading",
          "",
          "The second takes GitHub's numeric suffix.",
          "",
        ].join("\n"),
      });

      const result = check(dir);

      assert.equal(result.code, 0, result.output);
      assert.doesNotMatch(result.stdout, /^\s+- anchors:/m);
    });

    it("resolves anchors in a CRLF-encoded document", async (t) => {
      const root = await tempDir(t);
      // Written with Windows line endings: the anchor target is read straight
      // off disk, so without normalization every heading keeps a trailing \r,
      // matches no heading pattern, and every anchor into the file reads broken.
      const dir = await writeSkill(root, "crlf-skill", {
        raw: [
          "---",
          "name: crlf-skill",
          "description: The ability to stand in for a skill authored with Windows line endings.",
          "when_to_use: Apply only inside the validator test suite.",
          "---",
          "",
          "# CRLF Skill",
          "",
          "See [the section below](#real-section).",
          "",
          "## Real Section",
          "",
          "Prose for the fixture.",
          "",
        ].join("\r\n"),
      });

      const result = check(dir);

      assert.equal(result.code, 0, result.output);
      assert.doesNotMatch(result.stdout, /^\s+- anchors:/m);
    });

    it("leaves a fragment on an unresolvable target to the link checker", async (t) => {
      const root = await tempDir(t);
      const dir = await writeSkill(root, "missing-anchor-target", {
        body: [
          "# Missing Anchor Target",
          "",
          "See [a file that is not there](./references/missing.md#anything).",
          "",
        ].join("\n"),
      });

      const result = check(dir);

      assert.equal(result.code, 0, result.output);
      assert.doesNotMatch(result.stdout, /^\s+- anchors:/m);
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

    it("reports a section heading that abuts its guidelines block", async (t) => {
      const root = await tempDir(t);
      // Written raw so the reported line is unambiguous: the `##` heading sits at
      // file line 11, which only resolves if the frontmatter offset is applied.
      const dir = await writeSkill(root, "abutting-section", {
        raw: [
          "---",
          "name: abutting-section",
          "description: The ability to stand in for a section that states rules before demonstrating them.",
          "when_to_use: Apply only inside the validator test suite.",
          "---",
          "",
          "# Abutting Section",
          "",
          "Prose for the fixture.",
          "",
          "## What Belongs Here",
          "",
          "**Guidelines:**",
          "",
          "- MUST demonstrate the topic before listing requirements.",
          "",
        ].join("\n"),
      });

      assertFailure(
        dir,
        /section: "What Belongs Here" \(SKILL\.md:11\) lists requirements/,
      );
    });

    it("reports an abutting section inside a reference file", async (t) => {
      const root = await tempDir(t);
      const dir = await writeSkill(root, "reference-scanned", {
        body: [
          "# Reference Scanned",
          "",
          "Prose for the fixture.",
          "",
          "See [detail.md](./references/detail.md) for:",
          "",
          "- the detail this skill routes to",
          "",
        ].join("\n"),
        references: {
          "detail.md": [
            "# Detail",
            "",
            "## Abutting Section",
            "",
            "**Guidelines:**",
            "",
            "- MUST be reported against a skill-relative path.",
            "",
          ].join("\n"),
        },
      });

      assertFailure(
        dir,
        /section: "Abutting Section" \(references\/detail\.md:3\) lists requirements/,
      );
    });

    it("reports a guidelines bullet that opens with no RFC-2119 keyword", async (t) => {
      const root = await tempDir(t);
      const dir = await writeSkill(root, "unmarked-guideline", {
        body: [
          "# Unmarked Guideline",
          "",
          "Prose for the fixture.",
          "",
          "**Guidelines:**",
          "",
          "- MUST open every rule with a keyword.",
          "- When used inside a broader workflow, follow that workflow's conventions.",
          "",
        ].join("\n"),
      });

      assertFailure(
        dir,
        /guidelines: SKILL\.md:\d+ bullet does not open with an RFC-2119 keyword: "When used inside/,
      );
    });

    it("keeps checking bullets after a blank line inside a guidelines block", async (t) => {
      const root = await tempDir(t);
      // A loose list: the trailing bullet is only reachable if a blank line does
      // NOT end the block. `software-development` carries this shape today.
      const dir = await writeSkill(root, "loose-guidelines-list", {
        body: [
          "# Loose Guidelines List",
          "",
          "Prose for the fixture.",
          "",
          "**Guidelines:**",
          "",
          "- MUST run the steps in order:",
          "  1. Format.",
          "  2. Lint.",
          "",
          "- This trailing bullet is still inside the block.",
          "",
        ].join("\n"),
      });

      assertFailure(
        dir,
        /guidelines: SKILL\.md:\d+ bullet does not open with an RFC-2119 keyword: "This trailing bullet/,
      );
    });

    it("reports a relative link that escapes the skill directory", async (t) => {
      const root = await tempDir(t);
      const dir = await writeSkill(root, "escaping-link", {
        body: [
          "# Escaping Link",
          "",
          "Prose pointing at [another skill](../other-skill/SKILL.md).",
          "",
          "**Guidelines:**",
          "",
          "- MUST reference a sibling skill by topic rather than by path.",
          "",
        ].join("\n"),
      });

      assertFailure(
        dir,
        /links: SKILL\.md:\d+ relative link "\.\.\/other-skill\/SKILL\.md" resolves outside the skill directory/,
      );
    });

    it("reports a heading-anchor fragment that resolves to no heading", async (t) => {
      const root = await tempDir(t);
      const dir = await writeSkill(root, "broken-anchor", {
        body: [
          "# Broken Anchor",
          "",
          "Prose linking to [a heading that moved](#no-such-heading).",
          "",
          "## Real Heading",
          "",
          "Prose for the fixture.",
          "",
        ].join("\n"),
      });

      assertFailure(
        dir,
        /anchors: SKILL\.md:\d+ link "#no-such-heading" resolves to no heading in SKILL\.md/,
      );
    });

    it("reports an escaping link inside a reference file", async (t) => {
      const root = await tempDir(t);
      const dir = await writeSkill(root, "escaping-reference-link", {
        body: [
          "# Escaping Reference Link",
          "",
          "Prose for the fixture.",
          "",
          "See [detail.md](./references/detail.md) for:",
          "",
          "- the detail this skill routes to",
          "",
        ].join("\n"),
        references: {
          "detail.md": [
            "# Detail",
            "",
            "A sibling reference stays inside: [theming.md](./theming.md).",
            "",
            "So does the parent: [SKILL.md](../SKILL.md).",
            "",
            "Another skill does not: [other](../../other-skill/SKILL.md).",
            "",
          ].join("\n"),
        },
      });

      const result = check(dir);

      assert.equal(result.code, 1, result.output);
      assert.match(
        result.stdout,
        /links: references\/detail\.md:7 relative link "\.\.\/\.\.\/other-skill\/SKILL\.md" resolves outside the skill directory/,
      );
      // A reference reaching up to its own SKILL.md is the common legitimate
      // shape; escaping is measured from the skill directory, not the file's.
      assert.doesNotMatch(result.stdout, /theming\.md" resolves outside/);
      assert.doesNotMatch(result.stdout, /"\.\.\/SKILL\.md" resolves outside/);
    });

    it("reports a broken anchor inside a reference file", async (t) => {
      const root = await tempDir(t);
      const dir = await writeSkill(root, "broken-reference-anchor", {
        body: [
          "# Broken Reference Anchor",
          "",
          "Cross-file: [good](./references/detail.md#real-section) and",
          "[bad](./references/detail.md#missing-section).",
          "",
          "See [detail.md](./references/detail.md) for:",
          "",
          "- the detail this skill routes to",
          "",
        ].join("\n"),
        references: {
          "detail.md": [
            "# Detail",
            "",
            "A same-file anchor that resolves: [here](#real-section).",
            "",
            "One that does not: [gone](#removed-section).",
            "",
            "## Real Section",
            "",
            "Prose for the fixture.",
            "",
          ].join("\n"),
        },
      });

      const result = check(dir);

      assert.equal(result.code, 1, result.output);
      // Same-file fragment inside a reference…
      assert.match(
        result.stdout,
        /anchors: references\/detail\.md:5 link "#removed-section" resolves to no heading in references\/detail\.md/,
      );
      // …and a cross-file fragment naming the target by skill-relative path.
      assert.match(
        result.stdout,
        /anchors: SKILL\.md:\d+ link "\.\/references\/detail\.md#missing-section" resolves to no heading in references\/detail\.md/,
      );
      assert.doesNotMatch(result.stdout, /#real-section" resolves to no heading/);
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

  describe("duplicate copies of one skill", () => {
    it("reports an identical copy once, under the path given first", async (t) => {
      const source = await tempDir(t);
      const installed = await tempDir(t);
      await writeSkill(source, "shared-skill");
      await writeSkill(installed, "shared-skill");

      const result = check(source, installed);

      assert.equal(result.code, 0, result.output);
      assert.match(result.stdout, /All 1 skill\(s\) passed structural checks\./);
      assert.match(result.stdout, /1 duplicate path\(s\) collapsed/);
      assert.match(result.stdout, /fix the reported path, not the copy/);
      assert.match(
        result.stdout,
        new RegExp(`PASS {2}${source}/shared-skill {2}\\(= ${installed}/shared-skill\\)`),
      );
    });

    it("collapses a shared failure once rather than twice", async (t) => {
      const source = await tempDir(t);
      const installed = await tempDir(t);
      const broken = { frontmatter: { description: null } };
      await writeSkill(source, "shared-skill", broken);
      await writeSkill(installed, "shared-skill", broken);

      const result = check(source, installed);

      assert.equal(result.code, 1);
      assert.match(
        result.stdout,
        /1 of 1 skill\(s\) failed structural checks\./,
      );
      assert.equal(result.stdout.match(/^FAIL {2}/gm).length, 1);
    });

    it("reports both copies separately when their verdicts diverge", async (t) => {
      const source = await tempDir(t);
      const installed = await tempDir(t);
      await writeSkill(source, "shared-skill");
      await writeSkill(installed, "shared-skill", {
        frontmatter: { description: null },
      });

      const result = check(source, installed);

      assert.equal(result.code, 1);
      assert.match(
        result.stdout,
        /1 of 2 skill\(s\) failed structural checks\./,
      );
      assert.doesNotMatch(result.stdout, /duplicate path\(s\) collapsed/);
    });

    it("leaves single-root output unchanged", async (t) => {
      const root = await tempDir(t);
      await writeSkill(root, "only-skill");

      const result = check(root);

      assert.equal(result.code, 0);
      assert.doesNotMatch(result.stdout, /duplicate path\(s\) collapsed/);
      assert.doesNotMatch(result.stdout, /\(= /);
    });
  });

  describe("--require-claude-code-fields", () => {
    // The default host-agnostic behaviour is the contract the script header
    // states; the flag is what this repository opts into.
    it("passes a skill carrying neither discovery field when the flag is absent", async (t) => {
      const root = await tempDir(t);
      const dir = await writeSkill(root, "host-agnostic-skill", {
        frontmatter: { when_to_use: null },
      });

      const result = check(dir);

      assert.equal(result.code, 0, result.output);
      assert.doesNotMatch(result.stdout, /`when_to_use` is missing/);
      assert.doesNotMatch(result.stdout, /`user-invocable` is missing/);
    });

    it("reports a missing when_to_use under the flag", async (t) => {
      const root = await tempDir(t);
      const dir = await writeSkill(root, "no-when-to-use", {
        frontmatter: { when_to_use: null, "user-invocable": "false" },
      });

      const result = check("--require-claude-code-fields", dir);

      assert.equal(result.code, 1, result.output);
      assert.match(result.stdout, /frontmatter: `when_to_use` is missing\./);
      assert.doesNotMatch(result.stdout, /`user-invocable` is missing/);
    });

    it("reports a missing user-invocable under the flag", async (t) => {
      const root = await tempDir(t);
      const dir = await writeSkill(root, "no-user-invocable");

      const result = check(dir, "--require-claude-code-fields");

      assert.equal(result.code, 1, result.output);
      assert.match(result.stdout, /frontmatter: `user-invocable` is missing\./);
      assert.doesNotMatch(result.stdout, /`when_to_use` is missing/);
    });

    it("passes a skill carrying both fields under the flag", async (t) => {
      const root = await tempDir(t);
      const dir = await writeSkill(root, "fully-declared-skill", {
        frontmatter: { "user-invocable": "false" },
      });

      const result = check("--require-claude-code-fields", dir);

      assert.equal(result.code, 0, result.output);
    });
  });

  describe("advisory warnings — reported, never fatal", () => {
    /**
     * Assert that a fixture raises `expected` as a WARN and still exits 0.
     * Every case in this block asserts the exit code, because the whole point
     * of the advisory tier is that none of it can fail a build.
     * @param {string} dir
     * @param {RegExp} expected
     */
    const assertWarning = (dir, expected) => {
      const result = check(dir);
      assert.equal(result.code, 0, `a WARN must not fail the run\n${result.output}`);
      assert.match(result.stdout, /^WARN/m);
      assert.match(result.stdout, expected);
    };

    /** A SKILL.md of exactly `bytes` UTF-8 bytes, padded with single-byte prose. */
    const skillOfBytes = (dirName, bytes) => {
      const head = `---\nname: ${dirName}\ndescription: ${"A".repeat(160)}\n---\n\n# Padded\n\nPad:\n\n`;
      return head + "x".repeat(bytes - Buffer.byteLength(head, "utf8"));
    };

    describe("size — the SKILL.md token budget", () => {
      it("stays silent at exactly the trip point", async (t) => {
        const root = await tempDir(t);
        const raw = skillOfBytes("at-the-budget", 23800);
        assert.equal(Buffer.byteLength(raw, "utf8"), 23800);
        const dir = await writeSkill(root, "at-the-budget", { raw });

        const result = check(dir);

        assert.equal(result.code, 0, result.output);
        assert.doesNotMatch(result.stdout, /size:/);
      });

      it("warns one byte over the trip point, naming the raw byte count", async (t) => {
        const root = await tempDir(t);
        const raw = skillOfBytes("over-the-budget", 23801);
        assert.equal(Buffer.byteLength(raw, "utf8"), 23801);
        const dir = await writeSkill(root, "over-the-budget", { raw });

        assertWarning(dir, /size: SKILL\.md is 23801 bytes, ~5000 estimated tokens/);
      });

      it("measures UTF-8 bytes, not UTF-16 string length", async (t) => {
        const root = await tempDir(t);
        // One em dash is three bytes but one UTF-16 unit, so this file is 23,799
        // units — under the threshold by `String.length` — and 23,801 bytes,
        // over it. The narrowest margin that can tell the two units apart.
        const raw = `${skillOfBytes("multi-byte-budget", 23798)}—`;
        assert.equal(raw.length, 23799, "under the threshold by String.length");
        assert.equal(Buffer.byteLength(raw, "utf8"), 23801, "over it by byte length");
        const dir = await writeSkill(root, "multi-byte-budget", { raw });

        assertWarning(dir, /size: SKILL\.md is 23801 bytes, ~5000 estimated tokens/);
      });
    });

    describe("length — the section guideline-bullet ceiling", () => {
      /** A skill body whose one section carries `count` guideline bullets. */
      const withBullets = (count) =>
        [
          "# Bulleted",
          "",
          "Prose for the fixture.",
          "",
          "## Counted Section",
          "",
          "Rationale for the section, so the intro check stays quiet.",
          "",
          "**Guidelines:**",
          "",
          ...Array.from({ length: count }, (_, i) => `- MUST hold rule number ${i + 1}.`),
          "",
        ].join("\n");

      it("stays silent at seven bullets", async (t) => {
        const root = await tempDir(t);
        const dir = await writeSkill(root, "seven-bullets", { body: withBullets(7) });

        const result = check(dir);

        assert.equal(result.code, 0, result.output);
        assert.doesNotMatch(result.stdout, /length:/);
      });

      it("warns that eight bullets approach the ceiling", async (t) => {
        const root = await tempDir(t);
        const dir = await writeSkill(root, "eight-bullets", { body: withBullets(8) });

        assertWarning(
          dir,
          /length: "Counted Section" \(SKILL\.md:\d+\) has 8 guideline bullets — approaching the ceiling of ten/,
        );
      });

      it("warns above ten, naming the rule's stated-exception escape hatch", async (t) => {
        const root = await tempDir(t);
        const dir = await writeSkill(root, "eleven-bullets", { body: withBullets(11) });

        assertWarning(
          dir,
          /length: "Counted Section" \(SKILL\.md:\d+\) has 11 guideline bullets — over the ceiling of ten; split it or state why the exception is necessary\./,
        );
      });

      it("counts a nested subsection independently of its parent", async (t) => {
        const root = await tempDir(t);
        const dir = await writeSkill(root, "nested-sections", {
          body: [
            "# Nested Sections",
            "",
            "Prose for the fixture.",
            "",
            "## Parent Section",
            "",
            "Rationale for the parent.",
            "",
            "**Guidelines:**",
            "",
            ...Array.from({ length: 6 }, (_, i) => `- MUST hold parent rule ${i + 1}.`),
            "",
            "### Child Section",
            "",
            "Rationale for the child.",
            "",
            "**Guidelines:**",
            "",
            ...Array.from({ length: 6 }, (_, i) => `- MUST hold child rule ${i + 1}.`),
            "",
          ].join("\n"),
        });

        const result = check(dir);

        assert.equal(result.code, 0, result.output);
        // Twelve bullets in the section span, but six under each heading.
        assert.doesNotMatch(result.stdout, /length:/);
      });
    });

    describe("placement — an RFC-2119 bullet outside any guidelines block", () => {
      const looseBullets = [
        "- MUST cap the loop at eight rounds.",
        "",
        "- MUST end the turn whenever waiting on a human.",
      ];

      it("warns when the bullets sit under a heading with no label", async (t) => {
        const root = await tempDir(t);
        const dir = await writeSkill(root, "unlabelled-rules", {
          body: [
            "# Unlabelled Rules",
            "",
            "Prose for the fixture.",
            "",
            "## Termination",
            "",
            ...looseBullets,
            "",
          ].join("\n"),
        });

        assertWarning(
          dir,
          /placement: SKILL\.md:\d+ RFC-2119 bullet sits outside any `\*\*Guidelines:\*\*` block/,
        );
      });

      it("stays silent on the same bullets under a label, across a blank line", async (t) => {
        const root = await tempDir(t);
        const dir = await writeSkill(root, "labelled-rules", {
          body: [
            "# Labelled Rules",
            "",
            "Prose for the fixture.",
            "",
            "## Termination",
            "",
            "Rationale for the section.",
            "",
            "**Guidelines:**",
            "",
            ...looseBullets,
            "",
          ].join("\n"),
        });

        const result = check(dir);

        assert.equal(result.code, 0, result.output);
        assert.doesNotMatch(result.stdout, /placement:/);
      });

      it("warns on bullets an unindented fence separated from their label", async (t) => {
        const root = await tempDir(t);
        const dir = await writeSkill(root, "fence-split-block", {
          body: [
            "# Fence Split Block",
            "",
            "Prose for the fixture.",
            "",
            "## Logger Setup",
            "",
            "Rationale for the section.",
            "",
            "**Guidelines:**",
            "",
            "- MUST derive loggers from the shared root logger, like this:",
            "",
            "```ts",
            "const logger = rootLogger.child({ module: 'x' });",
            "```",
            "",
            "- SHOULD choose an identifier that conveys the module's concern.",
            "",
          ].join("\n"),
        });

        assertWarning(dir, /placement: SKILL\.md:\d+ RFC-2119 bullet sits outside/);
      });

      it("stays silent once that fence is nested under its bullet", async (t) => {
        const root = await tempDir(t);
        const dir = await writeSkill(root, "fence-nested-block", {
          body: [
            "# Fence Nested Block",
            "",
            "Prose for the fixture.",
            "",
            "## Logger Setup",
            "",
            "Rationale for the section.",
            "",
            "**Guidelines:**",
            "",
            "- MUST derive loggers from the shared root logger, like this:",
            "",
            "  ```ts",
            "  const logger = rootLogger.child({ module: 'x' });",
            "  ```",
            "",
            "- SHOULD choose an identifier that conveys the module's concern.",
            "",
          ].join("\n"),
        });

        const result = check(dir);

        assert.equal(result.code, 0, result.output);
        assert.doesNotMatch(result.stdout, /placement:/);
      });
    });

    describe("labels and fences — stale document style", () => {
      it("warns on a plain Guidelines label", async (t) => {
        const root = await tempDir(t);
        const dir = await writeSkill(root, "plain-label", {
          body: ["# Plain Label", "", "Prose for the fixture.", "", "Guidelines:", "", "- MUST be labelled in bold.", ""].join("\n"),
        });

        assertWarning(dir, /labels: SKILL\.md:\d+ plain "Guidelines:" label/);
      });

      it("warns on a plain Example label", async (t) => {
        const root = await tempDir(t);
        const dir = await writeSkill(root, "plain-example-label", {
          body: ["# Plain Example Label", "", "Prose for the fixture.", "", "Example:", "", "> A short prose example.", ""].join("\n"),
        });

        assertWarning(dir, /labels: SKILL\.md:\d+ plain "Example:" label/);
      });

      it("warns on a fenced text block, as a separate finding", async (t) => {
        const root = await tempDir(t);
        const dir = await writeSkill(root, "text-fence", {
          body: ["# Text Fence", "", "Prose for the fixture.", "", "```text", "Too broad: use for code.", "```", ""].join("\n"),
        });

        assertWarning(dir, /fences: SKILL\.md:\d+ fenced `text` block/);
      });
    });

    describe("hedging — a hedge immediately after the keyword", () => {
      it("warns on an adverbial hedge", async (t) => {
        const root = await tempDir(t);
        const dir = await writeSkill(root, "hedged-rule", {
          body: [
            "# Hedged Rule",
            "",
            "Prose for the fixture.",
            "",
            "**Guidelines:**",
            "",
            "- SHOULD generally prefer the shared helper over a local one.",
            "",
          ].join("\n"),
        });

        assertWarning(dir, /hedging: SKILL\.md:\d+ "SHOULD" is followed by the hedge "generally"/);
      });

      it("stays silent on a volitional verb, which is the action, not a hedge", async (t) => {
        const root = await tempDir(t);
        const dir = await writeSkill(root, "volitional-verb", {
          body: [
            "# Volitional Verb",
            "",
            "Prose for the fixture.",
            "",
            "**Guidelines:**",
            "",
            "- MUST NOT attempt a container-query unit in a `:root` token.",
            "",
          ].join("\n"),
        });

        const result = check(dir);

        assert.equal(result.code, 0, result.output);
        assert.doesNotMatch(result.stdout, /hedging:/);
      });
    });

    it("reports warnings from a reference file by its skill-relative path", async (t) => {
      const root = await tempDir(t);
      const dir = await writeSkill(root, "warned-reference", {
        body: [
          "# Warned Reference",
          "",
          "Prose for the fixture.",
          "",
          "## Topic",
          "",
          "See [topic.md](./references/topic.md) for:",
          "",
          "- the topic's rules",
          "",
        ].join("\n"),
        references: {
          "topic.md": ["# Topic", "", "Prose.", "", "## Rules", "", "- MUST be labelled to stay silent.", ""].join("\n"),
        },
      });

      assertWarning(dir, /placement: references\/topic\.md:\d+ RFC-2119 bullet sits outside/);
    });

    it("keeps exit 0 with every advisory check firing at once", async (t) => {
      const root = await tempDir(t);
      const dir = await writeSkill(root, "every-warning", {
        raw:
          [
            "---",
            "name: every-warning",
            `description: ${"A".repeat(160)}`,
            "---",
            "",
            "# Every Warning",
            "",
            "Prose for the fixture.",
            "",
            "## Unlabelled",
            "",
            "- MUST trip the placement warning.",
            "",
            "## Hedged",
            "",
            "Rationale.",
            "",
            "**Guidelines:**",
            "",
            "- SHOULD usually trip the hedging warning.",
            ...Array.from({ length: 10 }, (_, i) => `- MUST trip the length warning (${i + 1}).`),
            "",
            "Guidelines:",
            "",
            "```text",
            "A stale fence.",
            "```",
            "",
          ].join("\n") + "x".repeat(24000),
      });

      const result = check(dir);

      assert.equal(result.code, 0, `no combination of warnings may fail\n${result.output}`);
      for (const prefix of [/size:/, /length:/, /placement:/, /labels:/, /fences:/, /hedging:/]) {
        assert.match(result.stdout, prefix);
      }
      assert.match(result.stdout, /raised advisory warnings \(they do not affect the exit code\)/);
    });

    it("keeps the real skill roots at exit 0 with every check enabled", () => {
      const result = check("--require-claude-code-fields", "skills", ".claude/skills");

      assert.equal(result.code, 0, result.output);
      assert.match(result.stdout, /All 18 skill\(s\) passed structural checks\./);
    });
  });

  describe("exit 2 — bad invocation or no skill at the path", () => {
    it("exits 2 with usage when given no arguments", () => {
      const result = check();

      assert.equal(result.code, 2);
      assert.match(result.stderr, /Usage: check-skill\.mjs/);
    });

    it("exits 2 on an unrecognized option", async (t) => {
      const root = await tempDir(t);
      const dir = await writeSkill(root, "a-skill");

      const result = check("--no-such-option", dir);

      assert.equal(result.code, 2);
      assert.match(result.stderr, /Unknown option "--no-such-option"/);
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
