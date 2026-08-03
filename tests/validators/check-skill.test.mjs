// Exit-code and failure-message contract for check-skill.mjs.
//
// `audit-checklist.md` makes confirming a bundled script's documented exit codes
// a MUST, and this validator is the one the repository arms as a merge gate. The
// documented contract is: 0 when every checked skill passes (warnings alone do
// not fail a skill), 1 when any check fails, and 2 on a bad invocation or a path
// that holds no skill.
//
// Running the validator over THIS repository's own skill roots is a gate rather
// than a contract test, and lives in tests/repository/gate-runs.test.mjs, which
// takes its invocation from tests/repository/gates.mjs.

import { join } from "node:path";

import { mkdir, symlink } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { tempDir, writeSkill } from "../helpers/fixtures.mjs";
import { SCRIPTS, validator } from "../helpers/run.mjs";

const checkSkill = validator(SCRIPTS.checkSkill);

/**
 * Assert that a fixture fails with exit 1 and reports `expected`.
 *
 * The two framing assertions are soft: when a rule stops firing, the useful
 * signal is which of the three claims broke, and a hard assert on the first
 * hides the rest.
 * @param {string} dir
 * @param {RegExp} expected
 */
function expectFailure(dir, expected) {
  const result = checkSkill(dir);

  expect(result).toReportFailure(expected);
  expect.soft(result.stdout).toMatch(/^FAIL {2}/m);
  expect.soft(result.stdout).toMatch(/1 of 1 skill\(s\) failed structural checks\./);
}

/**
 * Assert that a fixture raises `expected` as a WARN and still exits 0. Every
 * case using this asserts the exit code, because the whole point of the
 * advisory tier is that none of it can fail a build.
 * @param {string} dir
 * @param {RegExp} expected
 */
function expectWarning(dir, expected) {
  const result = checkSkill(dir);

  expect(result, "a WARN must not fail the run").toPassCleanly();
  expect.soft(result.stdout).toMatch(/^WARN/m);
  expect(result.stdout).toMatch(expected);
}

describe("check-skill.mjs", () => {
  describe("exit 0 — a passing skill", () => {
    it("passes a well-formed skill", async () => {
      const root = await tempDir();
      const dir = await writeSkill(root, "well-formed-skill");

      const result = checkSkill(dir);

      expect(result).toPassCleanly();
      expect(result.stdout).toMatch(/^PASS {2}/m);
      expect(result.stdout).toMatch(/All 1 skill\(s\) passed structural checks\./);
    });

    it("resolves a skill root into its immediate skill subdirectories", async () => {
      const root = await tempDir();
      await writeSkill(root, "first-skill");
      await writeSkill(root, "second-skill");

      const result = checkSkill(root);

      expect(result).toPassCleanly();
      expect(result.stdout).toMatch(/All 2 skill\(s\) passed structural checks\./);
    });

    it("keeps a capability-framing warning advisory rather than fatal", async () => {
      const root = await tempDir();
      const dir = await writeSkill(root, "some-guidelines");

      const result = checkSkill(dir);

      expect(result, "a WARN must not change the exit code").toPassCleanly();
      expect(result.stdout).toMatch(/^WARN/m);
      expect(result.stdout).toMatch(/names the document, not the capability/);
    });

    it("warns on a document-voice description without failing", async () => {
      const root = await tempDir();
      const dir = await writeSkill(root, "document-voice-skill", {
        frontmatter: {
          description:
            "This skill describes a thing at length, opening in document voice so the advisory detector has something to catch.",
        },
      });

      const result = checkSkill(dir);

      expect(result).toPassCleanly();
      expect(result.stdout).toMatch(/opens in document voice/);
    });

    it("accepts a fenced demonstration between a heading and its guidelines", async () => {
      const root = await tempDir();
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

      const result = checkSkill(dir);

      expect(result).toPassCleanly();
      expect(result.stdout).not.toMatch(/^\s+- section:/m);
    });

    it("exempts a nested bullet from the RFC-2119 requirement", async () => {
      const root = await tempDir();
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

      const result = checkSkill(dir);

      expect(result).toPassCleanly();
      expect(result.stdout).not.toMatch(/^\s+- guidelines:/m);
    });

    it("resolves anchor fragments the way GitHub slugs headings", async () => {
      const root = await tempDir();
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

      const result = checkSkill(dir);

      expect(result).toPassCleanly();
      expect(result.stdout).not.toMatch(/^\s+- anchors:/m);
    });

    it("resolves anchors in a CRLF-encoded document", async () => {
      const root = await tempDir();
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

      const result = checkSkill(dir);

      expect(result).toPassCleanly();
      expect(result.stdout).not.toMatch(/^\s+- anchors:/m);
    });

    it("leaves a fragment on an unresolvable target to the link checker", async () => {
      const root = await tempDir();
      const dir = await writeSkill(root, "missing-anchor-target", {
        body: [
          "# Missing Anchor Target",
          "",
          "See [a file that is not there](./references/missing.md#anything).",
          "",
        ].join("\n"),
      });

      const result = checkSkill(dir);

      expect(result).toPassCleanly();
      expect(result.stdout).not.toMatch(/^\s+- anchors:/m);
    });
  });

  describe("exit 1 — each implemented failure class", () => {
    // Frontmatter and reference-linkage failures differ only in the fixture and
    // the message, so they are one table rather than ten near-identical blocks.
    it.each([
      {
        what: "a missing frontmatter block",
        dirName: "no-frontmatter",
        options: { raw: "# Just a heading\n\nNo frontmatter at all.\n" },
        reported: /frontmatter: missing or unterminated leading/,
      },
      {
        what: "an unterminated frontmatter block",
        dirName: "unterminated-frontmatter",
        options: {
          raw: "---\nname: unterminated-frontmatter\ndescription: Never closed.\n",
        },
        reported: /frontmatter: missing or unterminated leading/,
      },
      {
        what: "a missing name",
        dirName: "nameless-skill",
        options: { frontmatter: { name: null } },
        reported: /frontmatter: `name` is missing\./,
      },
      {
        what: "a non-kebab-case name",
        dirName: "Not_Kebab",
        options: {},
        reported: /`name` "Not_Kebab" is not kebab-case/,
      },
      {
        what: "a name over the 64-character cap",
        dirName: "a".repeat(65),
        options: {},
        reported: /frontmatter: `name` is 65 chars \(max 64\)\./,
      },
      {
        what: "a name that does not match its directory",
        dirName: "directory-name",
        options: { frontmatter: { name: "frontmatter-name" } },
        reported:
          /`name` "frontmatter-name" does not match directory "directory-name"/,
      },
      {
        what: "a missing description",
        dirName: "no-description",
        options: { frontmatter: { description: null } },
        reported: /frontmatter: `description` is missing or empty\./,
      },
      {
        what: "a description over the 1024-byte cap",
        dirName: "long-description",
        options: {
          frontmatter: { description: `The ability to ${"x".repeat(1010)}` },
        },
        reported: /frontmatter: `description` is 1025 bytes \(max 1024 bytes\)/,
      },
      {
        what: "a reference file that SKILL.md never links",
        dirName: "orphan-reference",
        options: {
          references: { "orphan.md": "# Orphan\n\nLinked from nowhere.\n" },
        },
        reported:
          /references: "references\/orphan\.md" is not linked from SKILL\.md \(orphan reference\)/,
      },
    ])("reports $what", async ({ dirName, options, reported }) => {
      const root = await tempDir();
      const dir = await writeSkill(root, dirName, options);

      expectFailure(dir, reported);
    });

    it("reports a routing bullet that opens with an RFC-2119 keyword", async () => {
      const root = await tempDir();
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

      expectFailure(
        dir,
        /routing: section "Some Topic" has a routing bullet starting with an RFC-2119 keyword/,
      );
    });

    it("reports a section heading that abuts its guidelines block", async () => {
      const root = await tempDir();
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

      expectFailure(
        dir,
        /section: "What Belongs Here" \(SKILL\.md:11\) lists requirements/,
      );
    });

    it("reports an abutting section inside a reference file", async () => {
      const root = await tempDir();
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

      expectFailure(
        dir,
        /section: "Abutting Section" \(references\/detail\.md:3\) lists requirements/,
      );
    });

    // Nothing but a heading ends a `**Guidelines:**` block: not a blank line,
    // not a fence, whether the fence follows the first bullet or stands before
    // it. Each fixture hides an unmarked bullet behind one of those, and the
    // bullet must still be read as a rule.
    it.each([
      {
        boundary: "a blank line",
        dirName: "loose-guidelines-list",
        // A loose list: the trailing bullet is only reachable if a blank line
        // does NOT end the block. `software-development` carries this shape.
        lines: [
          "- MUST run the steps in order:",
          "  1. Format.",
          "  2. Lint.",
          "",
          "- This trailing bullet is still inside the block.",
        ],
        reported: /keyword: "This trailing bullet/,
      },
      {
        boundary: "an unindented fence",
        dirName: "fenced-guidelines-list",
        // A fence is continuation, not a terminator: an illustrative code block
        // does not end a block's list of rules. `software-instrumentation`
        // carried this shape before #82 nested the fence under its bullet.
        lines: [
          "- MUST do the first thing, for example:",
          "",
          "```ts",
          "const x = 1;",
          "```",
          "",
          "- This bullet sits after an unindented fence and carries no keyword.",
        ],
        reported: /keyword: "This bullet sits after/,
      },
      {
        boundary: "a fence that opens the block",
        dirName: "fence-opened-guidelines",
        // A fence never changes block state, so one standing between the label
        // and the first bullet leaves the block open rather than closing it
        // before a single rule has been read.
        lines: [
          "```ts",
          "const shape = { rule: true };",
          "```",
          "",
          "- This first bullet follows the fence and carries no keyword.",
        ],
        reported: /keyword: "This first bullet follows/,
      },
    ])(
      "keeps checking bullets after $boundary inside a guidelines block",
      async ({ dirName, lines, reported }) => {
        const root = await tempDir();
        const dir = await writeSkill(root, dirName, {
          body: [
            `# ${dirName}`,
            "",
            "Prose for the fixture.",
            "",
            "**Guidelines:**",
            "",
            ...lines,
            "",
          ].join("\n"),
        });

        expectFailure(
          dir,
          new RegExp(
            `guidelines: SKILL\\.md:\\d+ bullet does not open with an RFC-2119 ${reported.source}`,
          ),
        );
      },
    );

    it("reports a guidelines bullet that opens with no RFC-2119 keyword", async () => {
      const root = await tempDir();
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

      expectFailure(
        dir,
        /guidelines: SKILL\.md:\d+ bullet does not open with an RFC-2119 keyword: "When used inside/,
      );
    });

    it("partitions a post-fence bullet between the guidelines check and the placement warning", async () => {
      const root = await tempDir();
      // The failure check and the `placement:` advisory share one block
      // boundary, so a bullet after a fence must be claimed by exactly one of
      // them — never both, and never neither. Here the keyword-bearing bullet
      // is inside the block and draws no warning, and the unmarked bullet in
      // the same position is inside the same block and fails.
      const dir = await writeSkill(root, "fence-partitioned-block", {
        body: [
          "# Fence Partitioned Block",
          "",
          "Prose for the fixture.",
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
          "- This unmarked bullet sits in the same post-fence position.",
          "",
        ].join("\n"),
      });

      const result = checkSkill(dir);

      expect(result).toReportFailure(
        /guidelines: SKILL\.md:\d+ bullet does not open with an RFC-2119 keyword: "This unmarked bullet/,
      );
      expect(result.stdout).not.toMatch(/placement:/);
    });

    it("reports a relative link that escapes the skill directory", async () => {
      const root = await tempDir();
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

      expectFailure(
        dir,
        /links: SKILL\.md:\d+ relative link "\.\.\/other-skill\/SKILL\.md" resolves outside the skill directory/,
      );
    });

    it("reports a heading-anchor fragment that resolves to no heading", async () => {
      const root = await tempDir();
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

      expectFailure(
        dir,
        /anchors: SKILL\.md:\d+ link "#no-such-heading" resolves to no heading in SKILL\.md/,
      );
    });

    it("reports an escaping link inside a reference file", async () => {
      const root = await tempDir();
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

      const result = checkSkill(dir);

      expect(result).toReportFailure(
        /links: references\/detail\.md:7 relative link "\.\.\/\.\.\/other-skill\/SKILL\.md" resolves outside the skill directory/,
      );
      // A reference reaching up to its own SKILL.md is the common legitimate
      // shape; escaping is measured from the skill directory, not the file's.
      expect.soft(result.stdout).not.toMatch(/theming\.md" resolves outside/);
      expect.soft(result.stdout).not.toMatch(/"\.\.\/SKILL\.md" resolves outside/);
    });

    it("reports a broken anchor inside a reference file", async () => {
      const root = await tempDir();
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

      const result = checkSkill(dir);

      expect(result).toExitWith(1);
      // Same-file fragment inside a reference…
      expect
        .soft(result.stdout)
        .toMatch(
          /anchors: references\/detail\.md:5 link "#removed-section" resolves to no heading in references\/detail\.md/,
        );
      // …and a cross-file fragment naming the target by skill-relative path.
      expect
        .soft(result.stdout)
        .toMatch(
          /anchors: SKILL\.md:\d+ link "\.\/references\/detail\.md#missing-section" resolves to no heading in references\/detail\.md/,
        );
      expect.soft(result.stdout).not.toMatch(/#real-section" resolves to no heading/);
    });

    it("fails the run when one skill in a root fails and another passes", async () => {
      const root = await tempDir();
      await writeSkill(root, "healthy-skill");
      await writeSkill(root, "broken-skill", {
        frontmatter: { description: null },
      });

      expect(checkSkill(root)).toReportFailure(
        /1 of 2 skill\(s\) failed structural checks\./,
      );
    });
  });

  describe("duplicate copies of one skill", () => {
    it("reports an identical copy once, under the path given first", async () => {
      const source = await tempDir();
      const installed = await tempDir();
      await writeSkill(source, "shared-skill");
      await writeSkill(installed, "shared-skill");

      const result = checkSkill(source, installed);

      expect(result).toPassCleanly();
      expect.soft(result.stdout).toMatch(/All 1 skill\(s\) passed structural checks\./);
      expect.soft(result.stdout).toMatch(/1 duplicate path\(s\) collapsed/);
      expect.soft(result.stdout).toMatch(/fix the reported path, not the copy/);
      expect
        .soft(result.stdout)
        .toMatch(
          new RegExp(
            `PASS {2}${source}/shared-skill {2}\\(= ${installed}/shared-skill\\)`,
          ),
        );
    });

    it("collapses a shared failure once rather than twice", async () => {
      const source = await tempDir();
      const installed = await tempDir();
      const broken = { frontmatter: { description: null } };
      await writeSkill(source, "shared-skill", broken);
      await writeSkill(installed, "shared-skill", broken);

      const result = checkSkill(source, installed);

      expect(result).toReportFailure(/1 of 1 skill\(s\) failed structural checks\./);
      expect(result.stdout.match(/^FAIL {2}/gm)).toHaveLength(1);
    });

    it("reports both copies separately when their verdicts diverge", async () => {
      const source = await tempDir();
      const installed = await tempDir();
      await writeSkill(source, "shared-skill");
      await writeSkill(installed, "shared-skill", {
        frontmatter: { description: null },
      });

      const result = checkSkill(source, installed);

      expect(result).toReportFailure(/1 of 2 skill\(s\) failed structural checks\./);
      expect(result.stdout).not.toMatch(/duplicate path\(s\) collapsed/);
    });

    it("leaves single-root output unchanged", async () => {
      const root = await tempDir();
      await writeSkill(root, "only-skill");

      const result = checkSkill(root);

      expect(result).toPassCleanly();
      expect.soft(result.stdout).not.toMatch(/duplicate path\(s\) collapsed/);
      expect.soft(result.stdout).not.toMatch(/\(= /);
    });
  });

  describe("a root whose entries are symlinks", () => {
    it("reports the real skill count instead of zero", async () => {
      const root = await tempDir();
      await writeSkill(`${root}/real`, "linked-skill");
      await mkdir(`${root}/mirror`, { recursive: true });
      await symlink("../real/linked-skill", `${root}/mirror/linked-skill`);

      const result = checkSkill(`${root}/mirror`);

      expect(
        result,
        "`Dirent.isDirectory()` is false for a symlink pointing at a directory, so filtering on it makes a symlinked root read as EMPTY — and an empty root prints `All 0 skill(s) passed`, which is indistinguishable from a real pass",
      ).toPassCleanly();
      expect(result.stdout).toMatch(/All 1 skill\(s\) passed/);
    });

    it("ignores a link that does not resolve rather than crashing", async () => {
      const root = await tempDir();
      await writeSkill(`${root}/mirror`, "real-skill");
      await symlink("../nowhere/gone", `${root}/mirror/dangling`);

      const result = checkSkill(`${root}/mirror`);

      expect(result).toPassCleanly();
      expect(result.stdout).toMatch(/All 1 skill\(s\) passed/);
    });
  });

  describe("host-specific frontmatter extensions", () => {
    it("neither requires nor rejects a Claude Code discovery field", async () => {
      const root = await tempDir();
      const dir = await writeSkill(root, "no-when-to-use", {
        frontmatter: { when_to_use: null },
      });

      const result = checkSkill(dir);

      expect(
        result,
        "`when_to_use` is a host extension, not part of the Agent Skills spec; a validator that demanded it would fail a correct skill on every host that ignores the field",
      ).toPassCleanly();
      expect.soft(result.stdout).not.toMatch(/`when_to_use`/);
    });

    it("rejects an unknown option rather than silently ignoring it", async () => {
      const root = await tempDir();
      const dir = await writeSkill(root, "unknown-option", {});

      const result = checkSkill("--require-claude-code-fields", dir);

      expect(
        result.code,
        "the flag was removed; accepting it silently would let a caller believe a check ran",
      ).toBe(2);
      expect.soft(result.stderr).toMatch(/Unknown option/);
    });
  });

  describe("advisory warnings — reported, never fatal", () => {
    /** A SKILL.md of exactly `bytes` UTF-8 bytes, padded with single-byte prose. */
    const skillOfBytes = (dirName, bytes) => {
      const head = `---\nname: ${dirName}\ndescription: ${"A".repeat(160)}\n---\n\n# Padded\n\nPad:\n\n`;
      return head + "x".repeat(bytes - Buffer.byteLength(head, "utf8"));
    };

    describe("size — the SKILL.md token budget", () => {
      it("stays silent at exactly the trip point", async () => {
        const root = await tempDir();
        const raw = skillOfBytes("at-the-budget", 23800);
        expect(Buffer.byteLength(raw, "utf8")).toBe(23800);
        const dir = await writeSkill(root, "at-the-budget", { raw });

        const result = checkSkill(dir);

        expect(result).toPassCleanly();
        expect(result.stdout).not.toMatch(/size:/);
      });

      it("warns one byte over the trip point, naming the raw byte count", async () => {
        const root = await tempDir();
        const raw = skillOfBytes("over-the-budget", 23801);
        expect(Buffer.byteLength(raw, "utf8")).toBe(23801);
        const dir = await writeSkill(root, "over-the-budget", { raw });

        expectWarning(dir, /size: SKILL\.md is 23801 bytes, ~5000 estimated tokens/);
      });

      it("measures UTF-8 bytes, not UTF-16 string length", async () => {
        const root = await tempDir();
        // One em dash is three bytes but one UTF-16 unit, so this file is 23,799
        // units — under the threshold by `String.length` — and 23,801 bytes,
        // over it. The narrowest margin that can tell the two units apart.
        const raw = `${skillOfBytes("multi-byte-budget", 23798)}—`;
        expect(raw.length, "under the threshold by String.length").toBe(23799);
        expect(Buffer.byteLength(raw, "utf8"), "over it by byte length").toBe(23801);
        const dir = await writeSkill(root, "multi-byte-budget", { raw });

        expectWarning(dir, /size: SKILL\.md is 23801 bytes, ~5000 estimated tokens/);
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

      it("stays silent at seven bullets", async () => {
        const root = await tempDir();
        const dir = await writeSkill(root, "seven-bullets", {
          body: withBullets(7),
        });

        const result = checkSkill(dir);

        expect(result).toPassCleanly();
        expect(result.stdout).not.toMatch(/length:/);
      });

      it.each([
        {
          count: 8,
          dirName: "eight-bullets",
          reported:
            /length: "Counted Section" \(SKILL\.md:\d+\) has 8 guideline bullets — approaching the ceiling of ten/,
        },
        {
          count: 11,
          dirName: "eleven-bullets",
          reported:
            /length: "Counted Section" \(SKILL\.md:\d+\) has 11 guideline bullets — over the ceiling of ten; split it or state why the exception is necessary\./,
        },
      ])("warns at $count bullets", async ({ count, dirName, reported }) => {
        const root = await tempDir();
        const dir = await writeSkill(root, dirName, { body: withBullets(count) });

        expectWarning(dir, reported);
      });

      it("counts a nested subsection independently of its parent", async () => {
        const root = await tempDir();
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

        const result = checkSkill(dir);

        expect(result).toPassCleanly();
        // Twelve bullets in the section span, but six under each heading.
        expect(result.stdout).not.toMatch(/length:/);
      });
    });

    describe("placement — an RFC-2119 bullet outside any guidelines block", () => {
      const looseBullets = [
        "- MUST cap the loop at eight rounds.",
        "",
        "- MUST end the turn whenever waiting on a human.",
      ];

      it("warns when the bullets sit under a heading with no label", async () => {
        const root = await tempDir();
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

        expectWarning(
          dir,
          /placement: SKILL\.md:\d+ RFC-2119 bullet sits outside any `\*\*Guidelines:\*\*` block/,
        );
      });

      // Three positions that must NOT warn, for three different reasons: the
      // bullets are labelled; a fence does not end the block that contains
      // them; and an indented fence never ended a block at all.
      it.each([
        {
          position: "under a label, across a blank line",
          dirName: "labelled-rules",
          lines: ["**Guidelines:**", "", ...looseBullets],
        },
        {
          position: "after an unindented fence inside the block",
          dirName: "fence-spanned-block",
          lines: [
            "**Guidelines:**",
            "",
            "- MUST derive loggers from the shared root logger, like this:",
            "",
            "```ts",
            "const logger = rootLogger.child({ module: 'x' });",
            "```",
            "",
            "- SHOULD choose an identifier that conveys the module's concern.",
          ],
        },
        {
          position: "after a fence nested under its own bullet",
          dirName: "fence-nested-block",
          lines: [
            "**Guidelines:**",
            "",
            "- MUST derive loggers from the shared root logger, like this:",
            "",
            "  ```ts",
            "  const logger = rootLogger.child({ module: 'x' });",
            "  ```",
            "",
            "- SHOULD choose an identifier that conveys the module's concern.",
          ],
        },
      ])("stays silent on a bullet $position", async ({ dirName, lines }) => {
        const root = await tempDir();
        const dir = await writeSkill(root, dirName, {
          body: [
            `# ${dirName}`,
            "",
            "Prose for the fixture.",
            "",
            "## Logger Setup",
            "",
            "Rationale for the section.",
            "",
            ...lines,
            "",
          ].join("\n"),
        });

        const result = checkSkill(dir);

        expect(result).toPassCleanly();
        expect(result.stdout).not.toMatch(/placement:/);
      });
    });

    describe("labels and fences — stale document style", () => {
      it.each([
        {
          what: "a plain Guidelines label",
          dirName: "plain-label",
          lines: ["Guidelines:", "", "- MUST be labelled in bold."],
          reported: /labels: SKILL\.md:\d+ plain "Guidelines:" label/,
        },
        {
          what: "a plain Example label",
          dirName: "plain-example-label",
          lines: ["Example:", "", "> A short prose example."],
          reported: /labels: SKILL\.md:\d+ plain "Example:" label/,
        },
        {
          what: "a fenced text block, as a separate finding",
          dirName: "text-fence",
          lines: ["```text", "Too broad: use for code.", "```"],
          reported: /fences: SKILL\.md:\d+ fenced `text` block/,
        },
      ])("warns on $what", async ({ dirName, lines, reported }) => {
        const root = await tempDir();
        const dir = await writeSkill(root, dirName, {
          body: [
            `# ${dirName}`,
            "",
            "Prose for the fixture.",
            "",
            ...lines,
            "",
          ].join("\n"),
        });

        expectWarning(dir, reported);
      });
    });

    describe("hedging — a hedge immediately after the keyword", () => {
      it("warns on an adverbial hedge", async () => {
        const root = await tempDir();
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

        expectWarning(
          dir,
          /hedging: SKILL\.md:\d+ "SHOULD" is followed by the hedge "generally"/,
        );
      });

      it("stays silent on a volitional verb, which is the action, not a hedge", async () => {
        const root = await tempDir();
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

        const result = checkSkill(dir);

        expect(result).toPassCleanly();
        expect(result.stdout).not.toMatch(/hedging:/);
      });
    });

    describe("citation — a version claim with nothing to check it against", () => {
      /** A skill whose SKILL.md is `lines`, with one linked reference file. */
      const skillWith = (root, name, lines, reference = "# Topic\n\nProse.\n") =>
        writeSkill(root, name, {
          body: [
            `# ${name}`,
            "",
            ...lines,
            "",
            "## Topic",
            "",
            "Prose introducing the reference.",
            "",
            "See [topic.md](./references/topic.md) for:",
            "",
            "- what the reference covers",
            "",
          ].join("\n"),
          references: { "topic.md": reference },
        });

      it("warns on a `Verified against` line carrying no URL", async () => {
        const root = await tempDir();
        const dir = await skillWith(root, "unverifiable-claim", [
          "Verified against `@vendor/sdk` 4.2.0.",
        ]);

        expectWarning(dir, /citation: SKILL\.md:\d+ "Verified against/);
      });

      it("stays silent when the URL rides the claim", async () => {
        const root = await tempDir();
        const dir = await skillWith(root, "verifiable-claim", [
          "Verified against `@vendor/sdk` 4.2.0, per https://example.com/docs/sdk.",
        ]);

        const result = checkSkill(dir);

        expect(result).toPassCleanly();
        expect(result.stdout).not.toMatch(/citation:/);
      });

      it("warns on a version-pinning document that cites nothing", async () => {
        const root = await tempDir();
        const dir = await skillWith(root, "uncited-pin", [
          "Everything here is written against SDK 57 and inverts before it.",
        ]);

        expectWarning(dir, /citation: SKILL\.md:\d+ pins a version/);
      });

      it("stays silent once the document cites any documentation URL", async () => {
        const root = await tempDir();
        const dir = await skillWith(root, "cited-pin", [
          "Everything here is written against SDK 57, documented at",
          "https://example.com/docs/sdk-57.",
        ]);

        const result = checkSkill(dir);

        expect(result).toPassCleanly();
        expect(result.stdout).not.toMatch(/citation:/);
      });

      it("does not count the RFC-2119 boilerplate as a citation", async () => {
        const root = await tempDir();
        // Every skill carries this link. Counting it would silence the check on
        // the whole corpus, which is why #171 measured "non-RFC URLs".
        const dir = await skillWith(root, "boilerplate-only", [
          "Everything here is written against SDK 57.",
          "",
          'The key word "MUST" is to be interpreted as described in',
          "[RFC 2119](https://www.rfc-editor.org/rfc/rfc2119.html).",
        ]);

        expectWarning(dir, /citation: SKILL\.md:\d+ pins a version/);
      });

      it("reports one citation warning per document, not two", async () => {
        const root = await tempDir();
        // Both signals fire on this document; they share a remedy, so reporting
        // both would double the count that scopes the cleanup.
        const dir = await skillWith(root, "both-signals", [
          "Verified against SDK 57.",
          "",
          "The behaviour below changed in v57.",
        ]);

        const result = checkSkill(dir);

        expect(result).toPassCleanly();
        expect(result.stdout.match(/citation:/g)).toHaveLength(1);
        expect(result.stdout).toMatch(/states a verification with no URL/);
      });
    });

    describe("routing — a bullet that gestures instead of naming", () => {
      /** A skill whose single routing bullet is `bullet`. */
      const skillRouting = (root, name, bullet) =>
        writeSkill(root, name, {
          body: [
            `# ${name}`,
            "",
            "Prose for the fixture.",
            "",
            "## Topic",
            "",
            "Prose introducing the reference.",
            "",
            "See [topic.md](./references/topic.md) for:",
            "",
            `- ${bullet}`,
            "",
          ].join("\n"),
          references: { "topic.md": "# Topic\n\nProse.\n" },
        });

      it("warns on a bullet that names nothing it points at", async () => {
        const root = await tempDir();
        const dir = await skillRouting(
          root,
          "gestural-routing",
          "what makes a route static or dynamic, and the flag that changes the model",
        );

        expectWarning(
          dir,
          /routing: SKILL\.md:\d+ section "Topic" gestures at a fact without naming it/,
        );
      });

      it("stays silent once the bullet names the thing", async () => {
        const root = await tempDir();
        const dir = await skillRouting(
          root,
          "concrete-routing",
          "what makes a route static or dynamic, and how `cacheComponents` redraws that boundary",
        );

        const result = checkSkill(dir);

        expect(result).toPassCleanly();
        expect(result.stdout).not.toMatch(/routing:/);
      });

      it("stays silent on a bullet stating the rule about gesturing", async () => {
        const root = await tempDir();
        // `agent-skill-authoring`'s own bullet for this rule. Every hand-run
        // count of this defect has reported it as a violation of the rule it
        // states; a metric that reproduces that error replaces nothing.
        const dir = await skillRouting(
          root,
          "the-rule-itself",
          "stating the fact a routing bullet points at — the flag, limit, or rule by name — instead of announcing that one exists",
        );

        const result = checkSkill(dir);

        expect(result).toPassCleanly();
        expect(result.stdout).not.toMatch(/routing:/);
      });

      it("still warns when the bullet merely contains \"rather than\"", async () => {
        const root = await tempDir();
        // "rather than" was once excluded alongside "by name" and silenced this
        // very bullet. The phrase carries no connection to naming, so only the
        // naming phrase may exempt one.
        const dir = await skillRouting(
          root,
          "rather-than-bullet",
          "a typed config file, and the options that change behaviour rather than tune it",
        );

        expectWarning(dir, /routing: SKILL\.md:\d+ .*gestures at a fact/);
      });

      it("stays silent on a hyphenated compound that only starts with a gesture noun", async () => {
        const root = await tempDir();
        // "the file-notation set" never uses the noun "file"; matching its
        // prefix would report a bullet for a word it does not contain.
        const dir = await skillRouting(
          root,
          "hyphenated-compound",
          "the file-notation set the router recognizes, and what each segment shape produces",
        );

        const result = checkSkill(dir);

        expect(result).toPassCleanly();
        expect(result.stdout).not.toMatch(/routing:/);
      });

      it("stays silent on `loop-engineering`'s named false positive", async () => {
        const root = await tempDir();
        // Reproduced verbatim from loop-engineering/SKILL.md:56. TWO
        // independent mechanisms silence it: "channel" is outside
        // GESTURE_NOUNS, and "MCP" makes namesSomething true. Either alone
        // would do, so this pins the real-world bullet end-to-end rather than
        // any one path through the check.
        const dir = await skillRouting(
          root,
          "untracked-gesture-noun",
          "the one sanctioned MCP tool channel, and why a direct REST/GraphQL call from a session fails",
        );

        const result = checkSkill(dir);

        expect(result).toPassCleanly();
        expect(result.stdout).not.toMatch(/routing:/);
      });

      it("stays silent when a gerund governs the noun", async () => {
        const root = await tempDir();
        // An activity performed on the thing, not its name withheld.
        const dir = await skillRouting(
          root,
          "gerund-governed",
          "separating the settings a component owns from the ones its consumer owns",
        );

        const result = checkSkill(dir);

        expect(result).toPassCleanly();
        expect(result.stdout).not.toMatch(/routing:/);
      });
    });

    it("reports warnings from a reference file by its skill-relative path", async () => {
      const root = await tempDir();
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
          "topic.md": [
            "# Topic",
            "",
            "Prose.",
            "",
            "## Rules",
            "",
            "- MUST be labelled to stay silent.",
            "",
          ].join("\n"),
        },
      });

      expectWarning(
        dir,
        /placement: references\/topic\.md:\d+ RFC-2119 bullet sits outside/,
      );
    });

    it("keeps exit 0 with every advisory check firing at once", async () => {
      const root = await tempDir();
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
            ...Array.from(
              { length: 10 },
              (_, i) => `- MUST trip the length warning (${i + 1}).`,
            ),
            "",
            "Guidelines:",
            "",
            "```text",
            "A stale fence.",
            "```",
            "",
          ].join("\n") + "x".repeat(24000),
      });

      const result = checkSkill(dir);

      expect(result, "no combination of warnings may fail").toPassCleanly();
      for (const prefix of [
        /size:/,
        /length:/,
        /placement:/,
        /labels:/,
        /fences:/,
        /hedging:/,
      ]) {
        expect.soft(result.stdout).toMatch(prefix);
      }
      expect(result.stdout).toMatch(
        /raised advisory warnings \(they do not affect the exit code\)/,
      );
    });
  });

  describe("exit 2 — bad invocation or no skill at the path", () => {
    it("exits 2 with usage when given no arguments", () => {
      const result = checkSkill();

      expect(result).toExitWith(2);
      expect(result.stderr).toMatch(/Usage: check-skill\.mjs/);
    });

    it("exits 2 on an unrecognized option", async () => {
      const root = await tempDir();
      const dir = await writeSkill(root, "a-skill");

      const result = checkSkill("--no-such-option", dir);

      expect(result).toExitWith(2);
      expect(result.stderr).toMatch(/Unknown option "--no-such-option"/);
    });

    it("exits 2 when a path is not a directory", async () => {
      const root = await tempDir();
      const dir = await writeSkill(root, "a-skill");

      const result = checkSkill(join(dir, "SKILL.md"));

      expect(result).toExitWith(2);
      expect(result.stderr).toMatch(/Not a directory:/);
    });

    it("exits 2 when a directory holds no SKILL.md and no skill subdirectory", async () => {
      const root = await tempDir();

      const result = checkSkill(root);

      expect(result).toExitWith(2);
      expect(result.stderr).toMatch(
        /No SKILL\.md in ".*" or its immediate subdirectories\./,
      );
    });
  });

  it("prints usage on --help", () => {
    const result = checkSkill("--help");

    expect(result).toPassCleanly();
    expect(result.stdout).toMatch(/^Usage: check-skill\.mjs/);
  });
});
