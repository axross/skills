// exit-code and failure-message contract for check-skill-body.mjs.
//
// `audit-checklist.md` makes confirming a bundled script's documented exit codes
// a MUST, and this validator is one of the three the repository arms as a merge
// gate. the documented contract is: 0 when every checked skill passes (warnings
// alone do not fail a skill), 1 when any check fails, and 2 on a bad invocation
// or a path that holds no skill.
//
// every rule here is checked against a reference file as well as against
// SKILL.md, because a skill's prose lives in both and a walk that covered only
// the parent would leave the larger half unchecked.
//
// running the validator over this repository's own skill roots is a gate rather
// than a contract test, and lives in tests/repository/gate-runs.test.mjs.

import { join } from "node:path";

import { mkdir, symlink } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { tempDir, writeSkill } from "../helpers/fixtures.mjs";
import { SCRIPTS, validator } from "../helpers/run.mjs";

const checkSkill = validator(SCRIPTS.checkSkillBody);

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


describe("check-skill-body.mjs", () => {
  describe("exit 0 — prose the rules deliberately allow", () => {

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

  });

  describe("fence — an unterminated fenced block", () => {
    it("fails and hides a genuine violation past the unclosed fence", async () => {
      // the case this rule exists to catch: without it, everything from the
      // fence opener onward — including the routing-block violation below —
      // is silently unread by every check here, and the run reports PASS.
      const root = await tempDir();
      const dir = await writeSkill(root, "unterminated-fence", {
        body: [
          "# Unterminated Fence",
          "",
          "Prose for the fixture.",
          "",
          "## Topic",
          "",
          "An example that never closes:",
          "",
          "```markdown",
          "unterminated content that never closes",
          "",
          "## Topic",
          "",
          "See [topic.md](./references/topic.md) for:",
          "",
          "- what the reference covers",
          "",
          "**Guidelines:**",
          "",
          "- MUST read [topic.md](./references/topic.md) before doing the narrow thing.",
          "- MUST also do something unrelated to reading the reference.",
          "",
        ].join("\n"),
      });

      const result = checkSkill(dir);

      expect(result).toReportFailure(
        /fence: SKILL\.md:\d+ fenced block opened here is never closed/,
      );
      // the routing-block violation two lines below the fence opener is real
      // Markdown, but it sits past the unterminated fence — unreadable, and
      // this rule's whole point is that nothing here should have found it.
      expect(result.stdout).not.toMatch(/routing-block:/);
    });
  });

  describe("routing-block — the guidelines block a routing list introduces", () => {
    /** a SKILL.md body with one `## Topic` section, `lines` after its intro prose. */
    const withTopic = (...lines) =>
      [
        "# Routing Block",
        "",
        "Prose for the fixture.",
        "",
        "## Topic",
        "",
        "Prose introducing the reference.",
        "",
        ...lines,
        "",
      ].join("\n");

    it("accepts a guidelines block that carries only read obligations", async () => {
      const root = await tempDir();
      const dir = await writeSkill(root, "read-obligations-only", {
        body: withTopic(
          "See [topic.md](./references/topic.md) for:",
          "",
          "- what the reference covers",
          "",
          "**Guidelines:**",
          "",
          "- MUST read [topic.md](./references/topic.md) before doing the narrow thing.",
        ),
      });

      const result = checkSkill(dir);

      expect(result).toPassCleanly();
      expect(result.stdout).not.toMatch(/routing-block:/);
    });

    it("accepts a routing list with no guidelines block at all", async () => {
      const root = await tempDir();
      const dir = await writeSkill(root, "no-guidelines-block", {
        body: withTopic(
          "See [topic.md](./references/topic.md) for:",
          "",
          "- what the reference covers",
        ),
      });

      const result = checkSkill(dir);

      expect(result).toPassCleanly();
      expect(result.stdout).not.toMatch(/routing-block:/);
    });

    it("accepts a rule in its own guidelines block before the routing list", async () => {
      const root = await tempDir();
      const dir = await writeSkill(root, "rule-before-routing", {
        body: withTopic(
          "**Guidelines:**",
          "",
          "- MUST hold this rule before deciding what to open.",
          "",
          "See [topic.md](./references/topic.md) for:",
          "",
          "- what the reference covers",
          "",
          "**Guidelines:**",
          "",
          "- MUST read [topic.md](./references/topic.md) before doing the narrow thing.",
        ),
      });

      const result = checkSkill(dir);

      expect(result).toPassCleanly();
      expect(result.stdout).not.toMatch(/routing-block:/);
    });

    it("accepts a rule in a guidelines block separated from the routing list's by a paragraph", async () => {
      const root = await tempDir();
      const dir = await writeSkill(root, "rule-after-paragraph", {
        body: withTopic(
          "See [topic.md](./references/topic.md) for:",
          "",
          "- what the reference covers",
          "",
          "**Guidelines:**",
          "",
          "- MUST read [topic.md](./references/topic.md) before doing the narrow thing.",
          "",
          "This rule stays in the body because the reader needs it on every turn, not only once the reference is open.",
          "",
          "**Guidelines:**",
          "",
          "- MUST hold this rule regardless of whether the reference was opened.",
        ),
      });

      const result = checkSkill(dir);

      expect(result).toPassCleanly();
      expect(result.stdout).not.toMatch(/routing-block:/);
    });

    it("does not treat an illustrative routing list inside a fenced block as real", async () => {
      const root = await tempDir();
      const dir = await writeSkill(root, "fenced-routing-list", {
        body: withTopic(
          "An example of the shape this rule rejects:",
          "",
          "```markdown",
          "See [topic.md](./references/topic.md) for:",
          "",
          "- what the reference covers",
          "",
          "**Guidelines:**",
          "",
          "- MUST read [topic.md](./references/topic.md) before doing the narrow thing.",
          "- MUST do something that is not a read obligation.",
          "```",
        ),
      });

      const result = checkSkill(dir);

      expect(result).toPassCleanly();
      expect(result.stdout).not.toMatch(/routing-block:/);
    });

    it("reports a non-read-obligation bullet in a routing list's guidelines block", async () => {
      const root = await tempDir();
      const dir = await writeSkill(root, "folded-in-rule", {
        body: withTopic(
          "See [topic.md](./references/topic.md) for:",
          "",
          "- what the reference covers",
          "",
          "**Guidelines:**",
          "",
          "- MUST read [topic.md](./references/topic.md) before doing the narrow thing.",
          "- MUST also do something unrelated to reading the reference.",
        ),
      });

      expectFailure(
        dir,
        /routing-block: SKILL\.md:\d+ guidelines block introduced by a routing list carries a bullet that is not a read obligation: "MUST also do something/,
      );
    });
  });

  describe("exit 1 — each implemented failure class", () => {

    it("reports a section heading that abuts its guidelines block", async () => {
      const root = await tempDir();
      // written raw so the reported line is unambiguous: the `##` heading sits at
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
      // the failure check and the `placement:` advisory share one block
      // boundary, so a bullet after a fence must be claimed by exactly one of
      // them — never both, and never neither. here the keyword-bearing bullet
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

  });

  describe("advisory warnings — reported, never fatal", () => {
    /** a SKILL.md of exactly `bytes` UTF-8 bytes, padded with single-byte prose. */
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
        // one em dash is three bytes but one UTF-16 unit, so this file is 23,799
        // units — under the threshold by `String.length` — and 23,801 bytes,
        // over it. the narrowest margin that can tell the two units apart.
        const raw = `${skillOfBytes("multi-byte-budget", 23798)}—`;
        expect(raw.length, "under the threshold by String.length").toBe(23799);
        expect(Buffer.byteLength(raw, "utf8"), "over it by byte length").toBe(23801);
        const dir = await writeSkill(root, "multi-byte-budget", { raw });

        expectWarning(dir, /size: SKILL\.md is 23801 bytes, ~5000 estimated tokens/);
      });
    });

    describe("length — the section guideline-bullet ceiling", () => {
      /** a skill body whose one section carries `count` guideline bullets. */
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
        // twelve bullets in the section span, but six under each heading.
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

      // three positions that must never warn, for three different reasons: the
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
      /** a skill whose SKILL.md is `lines`, with one linked reference file. */
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
        // every skill carries this link. counting it would silence the check
        // on the whole corpus, which is why the citation count is "non-RFC
        // URLs" rather than URLs.
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
        // both signals fire on this document; they share a remedy, so reporting
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
});
