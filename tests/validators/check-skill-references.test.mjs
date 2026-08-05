// Exit-code and failure-message contract for check-skill-references.mjs.
//
// `audit-checklist.md` makes confirming a bundled script's documented exit codes
// a MUST, and this validator is one of the three the repository arms as a merge
// gate. The documented contract is: 0 when every checked skill passes (warnings
// alone do not fail a skill), 1 when any check fails, and 2 on a bad invocation
// or a path that holds no skill.
//
// The anchor cases carry the most weight here: a fragment is resolved against
// GitHub's slug rules, and a fragment on a target that does not resolve is
// deliberately left to check-links.mjs rather than reported by both.
//
// Running the validator over THIS repository's own skill roots is a gate rather
// than a contract test, and lives in tests/repository/gate-runs.test.mjs.

import { join } from "node:path";

import { mkdir, symlink } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { tempDir, writeSkill } from "../helpers/fixtures.mjs";
import { SCRIPTS, validator } from "../helpers/run.mjs";

const checkSkill = validator(SCRIPTS.checkSkillReferences);

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


describe("check-skill-references.mjs", () => {
  describe("exit 0 — links the rules deliberately allow", () => {

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

    it("reports a reference file that SKILL.md never links", async () => {
      const root = await tempDir();
      const dir = await writeSkill(root, "orphan-reference", {
        references: { "orphan.md": "# Orphan\n\nLinked from nowhere.\n" },
      });

      expectFailure(
        dir,
        /references: "references\/orphan\.md" is not linked from SKILL\.md \(orphan reference\)/,
      );
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
});
