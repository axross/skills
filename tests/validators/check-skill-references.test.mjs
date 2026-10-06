// exit-code and failure-message contract for check-skill-references.mjs.
//
// `audit-checklist.md` makes confirming a bundled script's documented exit codes
// a MUST, and this validator is one of the three the repository arms as a merge
// gate. the documented contract is: 0 when every checked skill passes (warnings
// alone do not fail a skill), 1 when any check fails, and 2 on a bad invocation
// or a path that holds no skill.
//
// the anchor cases carry the most weight here: a fragment is resolved against
// GitHub's slug rules, and a fragment on a target that does not resolve is
// deliberately left to check-links.mjs rather than reported by both.
//
// running the validator over this repository's own skill roots is a gate rather
// than a contract test, and lives in tests/repository/gate-runs.test.mjs.

import { join } from "node:path";

import { mkdir, symlink } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { tempDir, writeSkill } from "../helpers/fixtures.mjs";
import { SCRIPTS, validator } from "../helpers/run.mjs";

const checkSkill = validator(SCRIPTS.checkSkillReferences);

describe.each(["\n", "\r\n"])("CommonMark routing boundaries with %j endings", (eol) => {
  it.each([
    ["under-indented heading", [" ## Independent"], 0],
    ["empty ATX heading", [" #"], 0],
    ["list-contained heading", ["  ## Nested"], 1],
    ["paragraph after contained heading", ["  ## Nested", "independent"], 0],
    ["paragraph after deeper contained heading", ["    ## Nested", "independent"], 0],
    ["paragraph still contained after heading", ["  ## Nested", "  nested"], 1],
    ["independent plus item", ["+ independent"], 0],
    ["independent asterisk item", ["* independent"], 0],
    ["empty plus continuation", ["+"], 1],
    ["empty asterisk continuation", ["*"], 1],
    ["separated empty plus item", ["", "+"], 0],
    ["separated empty asterisk item", ["", "*"], 0],
    ["paragraph after empty contained quote", ["  >", "independent"], 0],
    ["paragraph after empty contained list", ["", "  +", "independent"], 0],
    ["paragraph after empty contained dash list", ["", "  -", "independent"], 0],
    ["paragraph after contained declaration", ["  <!DOCTYPE html>", "independent"], 0],
    ["paragraph after contained processing instruction", ["  <?instruction ?>", "independent"], 0],
    ["paragraph after contained CDATA", ["  <![CDATA[example]]>", "independent"], 0],
    ["paragraph after multiline contained HTML", ["  <script>", "  raw", "  </script>", "independent"], 0],
    ["contained paragraph after HTML", ["  <script>", "  raw", "  </script>", "  nested"], 1],
    ["paragraph after separated contained HTML", ["  <div>", "  raw", "  </div>", "", "independent"], 0],
    ["lazy paragraph after nonempty quote", ["  > nested", "continued"], 1],
    ["lazy paragraph after nonempty list", ["  + nested", "continued"], 1],
    ["contained plus item", ["  + nested"], 1],
    ["contained asterisk item", ["  * nested"], 1],
    ["independent HTML block", ["<div>", "independent", "</div>"], 0],
    ["independent raw HTML", ["<script>", "example", "</script>"], 0],
    ["independent processing instruction", ["<?instruction ?>"], 0],
    ["independent declaration", ["<!DOCTYPE html>"], 0],
    ["independent CDATA", ["<![CDATA[example]]>"], 0],
    ["contained HTML block", ["  <div>", "  nested", "  </div>"], 1],
    ["non-interrupting inline HTML", ["<span>continued</span>"], 1],
    ["non-interrupting lowercase declaration", ["<!doctype html>"], 1],
    ["multiline routing example", ["", "``", "See [topic.md](./references/topic.md) for:", "``"], 1],
    ["code-leading plus-like continuation", ["`example` + continued"], 1],
    ["code-leading HTML-like continuation", ["`example` <div>continued</div>"], 1],
    ["under-indented quote", [" > Independent"], 0],
    ["list-contained quote", ["  > Nested"], 1],
    ["under-indented ordered item", [" 1. Independent"], 0],
    ["list-contained ordered item", ["  1. Nested"], 1],
    ["under-indented paragraph", ["", " independent"], 0],
    ["list-contained paragraph", ["", "  nested"], 1],
    ["independent asterisk thematic break", ["***"], 0],
    ["independent dash thematic break", ["---"], 0],
    ["independent underscore thematic break", ["_ _ _"], 0],
    ["under-indented spaced thematic break", [" *\t* * "], 0],
    ["list-contained thematic break", ["  ***"], 1],
    ["paragraph after list-contained thematic break", ["  ***", "independent"], 0],
    ["paragraph after deeper thematic break", ["    ***", "independent"], 0],
    ["over-indented thematic-break-like continuation", ["      ***", "continued"], 1],
    ["short thematic-break-like text", ["**"], 1],
    ["mixed thematic-break-like text", ["*-*"], 1],
    ["inline thematic-break example", ["`***`"], 1],
    ["code-leading lazy thematic-break-like text", ["`example` ***"], 1],
    ["unindented lazy continuation", ["continued"], 1],
    ["under-indented lazy continuation", [" continued"], 1],
    ["code-leading lazy heading-like text", ["`example` ## still continuation"], 1],
    ["code-leading lazy quote-like text", ["`example` > still continuation"], 1],
    ["code-leading lazy ordered-item-like text", ["`example` 1. still continuation"], 1],
    ["hash-leading lazy inline code", ["#`example` ## still continuation"], 1],
    ["code-leading lazy fence-like text", ["`example` ```still continuation"], 1],
    ["independent code-leading paragraph", ["", "`example` ## independent"], 0],
    ["unequal backticks", ["", "``x`"], 0],
    ["unmatched backticks", ["", "``x"], 0],
    ["matched inline example", ["", "``x``"], 1],
    ["different-length run inside code", ["", "``x`y``"], 1],
  ].map(([name, separator, code]) => [name, separator, code, [
    /^PASS {2}/m,
    /routing: section "Scope" has a routing bullet starting with an RFC-2119 keyword/,
  ][code]]))("classifies %s without losing the following requirement", async (name, separator, code, report) => {
    const root = await tempDir();
    const dir = await writeSkill(root, "routing-boundary", {
      raw: [
        "---", "name: routing-boundary", "description: Exercises routing boundaries.", "---", "",
        "# Routing", "", "## Scope", "",
        "See [topic.md](./references/topic.md) for:", "", "- condition",
        ...separator, "", "- MUST preserve output.", "",
      ].join(eol),
      references: { "topic.md": ["# Topic", "", "Detail.", ""].join(eol) },
    });
    const result = checkSkill(dir);
    expect(result).toExitWith(code);
    expect(result.output).toMatch(report);
  });

  it.each([
    ["unequal", "``[gone](#missing)`", 1, /anchors: SKILL\.md:8 link "#missing" resolves to no heading/],
    ["equal", "``[gone](#missing)``", 0, /^PASS {2}/m],
    ["internal single run", "``x`[gone](#missing)``", 0, /^PASS {2}/m],
  ])("checks literal %s backticks without checking actual code links", async (name, text, code, report) => {
    const root = await tempDir();
    const dir = await writeSkill(root, "literal-link", {
      raw: ["---", "name: literal-link", "description: Exercises links.", "---", "", "# Literal Link", "", text, ""].join(eol),
    });
    const result = checkSkill(dir);
    expect(result).toExitWith(code);
    expect(result.output).toMatch(report);
  });

  it.each([
    ["multiline code", ["before ``", "[gone](#missing)", "`` after"], 0, /^PASS {2}/m],
    ["multiline comment example", ["before ``", "<!--", "`` after", "", "[gone](#missing)", "-->"], 1, /anchors: SKILL\.md:12 link "#missing"/],
    ["separate paragraphs", ["before ``", "", "[gone](#missing)", "`` after"], 1, /anchors: SKILL\.md:10 link "#missing"/],
    ["independent heading", ["before ``", "## Independent", "[gone](#missing)", "`` after"], 1, /anchors: SKILL\.md:10 link "#missing"/],
    ["separate list items", ["- before ``", "- [gone](#missing)", "  `` after"], 1, /anchors: SKILL\.md:9 link "#missing"/],
    ["fenced boundary", ["before ``", "~~~", "hidden", "~~~", "[gone](#missing)", "`` after"], 1, /anchors: SKILL\.md:12 link "#missing"/],
    ["closed HTML block", ["<script>``</script>", "[gone](#missing) ``"], 1, /anchors: SKILL\.md:9 link "#missing"/],
    ["multiline HTML block", ["<script>``", "</script>", "[gone](#missing) ``"], 1, /anchors: SKILL\.md:10 link "#missing"/],
  ])("uses shared inline boundaries for %s", async (name, lines, code, report) => {
    const root = await tempDir();
    const dir = await writeSkill(root, "wrapped-link", {
      raw: ["---", "name: wrapped-link", "description: Exercises wrapped links.", "---", "", "# Wrapped Link", "", ...lines, ""].join(eol),
    });
    const result = checkSkill(dir);
    expect(result).toExitWith(code);
    expect(result.output).toMatch(report);
  });
});

/**
 * assert that a fixture fails with exit 1 and reports `expected`.
 *
 * the two framing assertions are soft: when a rule stops firing, the useful
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
 * assert that a fixture raises `expected` as a WARN and still exits 0. every
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
      // written with Windows line endings: the anchor target is read straight
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

    it.each(["for:", "when:", "when"])("does not treat an inline See ... %s example as routing", async (leadIn) => {
      const root = await tempDir();
      const dir = await writeSkill(root, "inline-routing-example", {
        body: [
          "# Inline Routing Example",
          "",
          "## Some Topic",
          "",
          `Use \`See [topic.md](./references/topic.md) ${leadIn} needed\` as the inline form.`,
          "",
          "- MUST preserve this substantive rule.",
          "",
        ].join("\n"),
      });

      expect(checkSkill(dir)).toPassCleanly();
    });

    it.each(["for:", "when:", "when"])("ignores a routing example with See ... %s inside an HTML comment", async (leadIn) => {
      const root = await tempDir();
      const dir = await writeSkill(root, "commented-routing-example", {
        body: [
          "# Commented Routing Example",
          "",
          "<!--",
          `See [topic.md](./references/topic.md) ${leadIn}`,
          "",
          "- MUST not turn this hidden example into a routing failure.",
          "-->",
          "",
          "Actual prose outside the comment.",
          "",
        ].join("\n"),
      });

      expect(checkSkill(dir)).toPassCleanly();
    });

    it.each([
      ["top-level backtick", "```markdown", "```"],
      ["top-level tilde", "~~~markdown", "~~~"],
      ["one-space backtick", " ```markdown", " ```"],
      ["one-space tilde", " ~~~markdown", " ~~~"],
      ["wider item padding", "   ```markdown", "   ```", "-   choosing the first topic"],
      ["four-column padding", "  ```markdown", "  ```", "-    choosing the first topic"],
      ["five-column padding", " ```markdown", " ```", "-     choosing the first topic"],
      ["inline-code item content", "  ```markdown", "  ```", "-   `choosing the first topic`"],
      ["comment item content", "  ```markdown", "  ```", "-   <!-- choosing the first topic -->"],
      ["tab-padded item", "   ```markdown", "   ```", "- \tchoosing the first topic"],
      ["indented backtick opener", "  ```markdown", "```"],
      ["indented tilde opener", "  ~~~markdown", "~~~"],
      ["indented backtick closer", "```markdown", "  ```"],
      ["indented tilde closer", "~~~markdown", "  ~~~"],
    ])("ends routing at a fence with a %s boundary", async (name, opener, closer, item = "- choosing the first topic") => {
      const root = await tempDir();
      const dir = await writeSkill(root, "top-level-fence", {
        body: [
          "# Routing Boundary",
          "",
          "## Some Topic",
          "",
          "See [topic.md](./references/topic.md) for:",
          "",
          item,
          "",
          opener,
          "  - MUST ignore this illustrative rule.",
          closer,
          "",
          "- MUST preserve this independent substantive rule.",
          "- choosing the options",
          "",
        ].join("\n"),
        references: { "topic.md": "# Topic\n\nDetail.\n" },
      });

      const result = checkSkill(dir);

      expect(result).toPassCleanly();
      expect(result.stdout).not.toMatch(/routing:/);
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

    it.each(["for:", "when:", "when"].flatMap(leadIn => [0, 1, 2, 3].map(spaces => [leadIn, spaces])))("reports a normative routing bullet after See ... %s with %i leading spaces", async (leadIn, spaces) => {
      const root = await tempDir();
      const dir = await writeSkill(root, "normative-routing", {
        body: [
          "# Normative Routing",
          "",
          "## Some Topic",
          "",
          `${" ".repeat(spaces)}See [topic.md](./references/topic.md) ${leadIn}`,
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

    it.each([
      ["unfenced", []],
      ["wrapped", ["  with a wrapped continuation"]],
      ["backtick", ["", "  ```markdown", "  - MUST ignore this illustrative rule.", "  ```", ""]],
      ["tilde", ["", "  ~~~markdown", "  - MUST ignore this illustrative rule.", "  ~~~", ""]],
      ["nested list", ["  - choosing a nested topic", "", "  ```markdown", "  - MUST ignore this illustrative rule.", "  ```", ""]],
      ["wider item padding", ["", "    ```markdown", "    - MUST ignore this illustrative rule.", "    ```", ""], "-   choosing the first topic"],
      ["five-column padding", ["", "  ```markdown", "  - MUST ignore this illustrative rule.", "  ```", ""], "-     choosing the first topic"],
      ["wide tab padding", ["", "  ```markdown", "  - MUST ignore this illustrative rule.", "  ```", ""], "-\t \tchoosing the first topic"],
      ["blank item with two-space padding", ["  choosing the first topic", "", "  ```markdown", "  - MUST ignore this illustrative rule.", "  ```", ""], "-  "],
      ["blank item with four-space padding", ["  choosing the first topic", "", "  ```markdown", "  - MUST ignore this illustrative rule.", "  ```", ""], "-    "],
      ["blank item with tab padding", ["  choosing the first topic", "", "  ```markdown", "  - MUST ignore this illustrative rule.", "  ```", ""], "-\t"],
      ["tab-indented", ["", " \t```markdown", " \t- MUST ignore this illustrative rule.", " \t```", ""], "- \tchoosing the first topic"],
      ["nested fence", ["", "  ````markdown", "```markdown", "- MUST ignore this illustrative rule.", "```", "~~~", "````not-a-closer", "  ````", ""]],
      ["commented fence", ["", "<!--", "```markdown", "- MUST ignore this illustrative rule.", "```", "-->", ""]],
    ])("checks routing bullets after a %s example or continuation", async (name, example, item = "- choosing the first topic") => {
      const root = await tempDir();
      for (const rule of ["MUST reject this actual routing rule.", "choosing the next topic"]) {
        const dir = await writeSkill(root, `${name}-${rule.startsWith("MUST") ? "normative" : "descriptive"}`, {
          body: [
            "# Routing Examples",
            "",
            "## Some Topic",
            "",
            "See [topic.md](./references/topic.md) for:",
            "",
            item,
            ...example,
            `- ${rule}`,
            "",
          ].join("\n"),
          references: { "topic.md": "# Topic\n\nDetail.\n" },
        });

        const result = checkSkill(dir);
        if (rule.startsWith("MUST")) {
          expect(result).toReportFailure(/routing: section "Some Topic" has a routing bullet starting with an RFC-2119 keyword/);
          expect(result.stdout.match(/routing: section/g)).toHaveLength(1);
        } else {
          expect(result).toPassCleanly();
          expect(result.stdout).not.toMatch(/routing:/);
        }
      }
    });

    it.each(["This rule", "`process.exit`"])("leaves substantive rules after separating prose beginning with %s alone", async (opening) => {
      const root = await tempDir();
      const dir = await writeSkill(root, "separate-rule", {
        body: [
          "# Separate Rule",
          "",
          "See [topic.md](./references/topic.md) for:",
          "",
          "- choosing the topic",
          "",
          `${opening} belongs in the body rather than behind a pointer.`,
          "",
          "**Guidelines:**",
          "",
          "- MUST preserve this substantive rule.",
          "",
        ].join("\n"),
        references: { "topic.md": "# Topic\n\nDetail.\n" },
      });

      const result = checkSkill(dir);
      expect(result).toPassCleanly();
      expect(result.stdout).not.toMatch(/routing:/);
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
      // a reference reaching up to its own SKILL.md is the common legitimate
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
      // same-file fragment inside a reference…
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
      /** a skill whose single routing bullet is `bullet`. */
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
        // `agent-skill-authoring`'s own bullet for this rule. every hand-run
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
        // very bullet. the phrase carries no connection to naming, so only the
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
        // reproduced verbatim from loop-engineering/SKILL.md:56. two
        // independent mechanisms silence it: "channel" is outside
        // GESTURE_NOUNS, and "MCP" makes namesSomething true. either alone
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
        // an activity performed on the thing, not its name withheld.
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
