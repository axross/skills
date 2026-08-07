// The shared guideline-structure rule, tested directly.
//
// guidelines.mjs is the one place the `**Guidelines:**` block boundary and the
// RFC-2119 recognizer live, so it is the one place worth testing exhaustively.
// The boundary used to exist twice inside check-skill.mjs — once for the
// guideline-voice failure and once for the placement/length/hedging advisories —
// under a comment reading "Change one and you must change both". These cases
// pin the single rule those two callers now share, including the edges that
// comment was warning about: a blank line and a fenced block are CONTINUATION,
// and only a heading or an unindented non-bullet line closes the block.
//
// The counterpart claim — that check-skill-body.mjs and the reporter each read this
// module correctly — is tests/validators/report-obligation-burden.test.mjs's
// partition case, not this file's.

import { describe, expect, it } from "vitest";

import {
  countObligations,
  GUIDELINES_RE,
  RFC2119_RE,
  scanGuidelines,
} from "../../skills/agent-skill-authoring/scripts/guidelines.mjs";

/** Every bullet event, so a case can assert on the whole stream at once. */
const bulletsOf = (body) =>
  [...scanGuidelines(body)].filter((event) => event.kind === "bullet");

/** A minimal document: one heading, a Guidelines label, then the given lines. */
const underGuidelines = (...lines) =>
  ["## Topic", "", "Prose that demonstrates the topic.", "", "**Guidelines:**", "", ...lines].join(
    "\n",
  );

describe("guidelines.mjs", () => {
  describe("RFC2119_RE", () => {
    it.each([
      "MUST do the thing",
      "MUST NOT do the thing",
      "SHOULD do the thing",
      "SHOULD NOT do the thing",
      "MAY do the thing",
      "REQUIRED for the thing",
      "OPTIONAL for the thing",
      "RECOMMENDED for the thing",
      "NOT RECOMMENDED for the thing",
    ])("recognizes %j as an obligation", (rule) => {
      expect(RFC2119_RE.test(rule)).toBe(true);
    });

    it.each([
      "Must do the thing",
      "must do the thing",
      "MUSTard is not a keyword",
      "Consider doing the thing",
      "Always do the thing",
      "",
    ])("does not recognize %j", (rule) => {
      expect(RFC2119_RE.test(rule)).toBe(false);
    });

    it("prefers the longer keyword when one prefixes another", () => {
      // "MUST NOT" must not be read as a bare "MUST" with stray prose after it,
      // or a prohibition would report as an obligation of the opposite sense.
      expect("MUST NOT ship".match(RFC2119_RE)[0]).toBe("MUST NOT");
      expect("SHOULD NOT ship".match(RFC2119_RE)[0]).toBe("SHOULD NOT");
      expect("NOT RECOMMENDED to ship".match(RFC2119_RE)[0]).toBe("NOT RECOMMENDED");
    });
  });

  describe("GUIDELINES_RE", () => {
    it.each(["**Guidelines:**", "**Guidelines:** "])("opens a block on %j", (line) => {
      expect(GUIDELINES_RE.test(line)).toBe(true);
    });

    it.each(["Guidelines:", "**Guidelines**", "**Guidelines:** and more", "  **Guidelines:**"])(
      "does not open a block on %j",
      (line) => {
        expect(GUIDELINES_RE.test(line)).toBe(false);
      },
    );
  });

  describe("scanGuidelines()", () => {
    it("marks bullets inside a Guidelines block", () => {
      const bullets = bulletsOf(underGuidelines("- MUST hold the line.", "- SHOULD hold it too."));

      expect(bullets).toHaveLength(2);
      expect(bullets.every((bullet) => bullet.inBlock)).toBe(true);
      expect(bullets.map((bullet) => bullet.keyword)).toEqual(["MUST", "SHOULD"]);
    });

    it("marks a bullet before any Guidelines label as outside the block", () => {
      const bullets = bulletsOf("## Topic\n\n- MUST hold the line.\n");

      expect(bullets).toHaveLength(1);
      expect(bullets[0].inBlock).toBe(false);
      expect(bullets[0].keyword).toBe("MUST");
    });

    it("reports a null keyword for a bullet that opens with none", () => {
      const bullets = bulletsOf(underGuidelines("- Consider holding the line."));

      expect(bullets[0].keyword).toBeNull();
      expect(bullets[0].rule).toBe("Consider holding the line.");
    });

    it("keeps the block open across a blank line", () => {
      // A loose list is still one list.
      const bullets = bulletsOf(underGuidelines("- MUST hold the line.", "", "- MUST hold it too."));

      expect(bullets.every((bullet) => bullet.inBlock)).toBe(true);
    });

    it("keeps the block open across a fenced block", () => {
      const bullets = bulletsOf(
        underGuidelines("- MUST hold the line.", "", "```ts", "const held = true;", "```", "", "- MUST hold it too."),
      );

      expect(bullets).toHaveLength(2);
      expect(bullets.every((bullet) => bullet.inBlock)).toBe(true);
    });

    it("ignores bullets inside a fenced block", () => {
      // The authoring docs show `- MUST …` as an EXAMPLE; counting it would make
      // documenting the rule inflate the very number the rule is measured by.
      const bullets = bulletsOf(
        underGuidelines("- MUST hold the line.", "", "```markdown", "- MUST be an example only.", "```"),
      );

      expect(bullets).toHaveLength(1);
    });

    it("closes the block at a heading", () => {
      const body = underGuidelines("- MUST hold the line.") + "\n\n## Next\n\n- MUST be outside.\n";
      const bullets = bulletsOf(body);

      expect(bullets.map((bullet) => bullet.inBlock)).toEqual([true, false]);
    });

    it("closes the block at an unindented non-bullet line", () => {
      const body = underGuidelines("- MUST hold the line.", "", "Closing prose.", "", "- MUST be outside.");

      expect(bulletsOf(body).map((bullet) => bullet.inBlock)).toEqual([true, false]);
    });

    it("keeps the block open across an indented continuation line", () => {
      const body = underGuidelines("- MUST hold the line.", "  continuation detail.", "- MUST hold it too.");

      expect(bulletsOf(body).every((bullet) => bullet.inBlock)).toBe(true);
    });

    it("reports only top-level bullets, not nested ones", () => {
      // Nested items carry continuation detail, not rules.
      const bullets = bulletsOf(underGuidelines("- MUST hold the line.", "  - a nested elaboration."));

      expect(bullets).toHaveLength(1);
      expect(bullets[0].rule).toBe("MUST hold the line.");
    });

    it("emits a heading event per heading, at any level", () => {
      const headings = [...scanGuidelines("# One\n\n## Two\n\n###### Six\n")].filter(
        (event) => event.kind === "heading",
      );

      expect(headings.map((event) => event.title)).toEqual(["One", "Two", "Six"]);
      expect(headings.map((event) => event.line)).toEqual([1, 3, 5]);
    });

    it("does not emit a heading event for a heading inside a fence", () => {
      const headings = [...scanGuidelines("# Real\n\n```md\n# Illustrative\n```\n")].filter(
        (event) => event.kind === "heading",
      );

      expect(headings.map((event) => event.title)).toEqual(["Real"]);
    });

    it("reports 1-based line numbers", () => {
      const bullets = bulletsOf("**Guidelines:**\n\n- MUST be on line three.\n");

      expect(bullets[0].line).toBe(3);
    });
  });

  describe("countObligations()", () => {
    it.each([
      { label: "an empty document", body: "", expected: 0 },
      { label: "prose with no bullets", body: "# Title\n\nJust prose.\n", expected: 0 },
      {
        label: "a bullet outside any block",
        body: "# Title\n\n- MUST be uncounted.\n",
        expected: 0,
      },
      {
        label: "a non-keyword bullet inside a block",
        body: underGuidelines("- Consider holding the line."),
        expected: 0,
      },
      {
        label: "one keyword bullet inside a block",
        body: underGuidelines("- MUST hold the line."),
        expected: 1,
      },
      {
        label: "a nested keyword bullet",
        body: underGuidelines("- MUST hold the line.", "  - MUST NOT be counted twice."),
        expected: 1,
      },
      {
        label: "a keyword bullet inside a fence",
        body: underGuidelines("- MUST hold the line.", "", "```md", "- MUST be an example.", "```"),
        expected: 1,
      },
      {
        label: "two blocks under two headings",
        body: `${underGuidelines("- MUST hold the line.")}\n\n${underGuidelines("- SHOULD hold it too.", "- MAY hold a third.")}`,
        expected: 3,
      },
    ])("counts $expected in $label", ({ body, expected }) => {
      expect(countObligations(body)).toBe(expected);
    });

    it("counts every RFC-2119 keyword form once", () => {
      const body = underGuidelines(
        "- MUST do one.",
        "- MUST NOT do two.",
        "- SHOULD do three.",
        "- SHOULD NOT do four.",
        "- MAY do five.",
        "- REQUIRED for six.",
        "- OPTIONAL for seven.",
        "- RECOMMENDED for eight.",
        "- NOT RECOMMENDED for nine.",
      );

      expect(countObligations(body)).toBe(9);
    });

    it("normalizes CRLF line endings", () => {
      const body = underGuidelines("- MUST hold the line.").replace(/\n/g, "\r\n");

      expect(countObligations(body)).toBe(1);
    });
  });
});
