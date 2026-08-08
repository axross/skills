// the shared rules for reading a Markdown document — which lines are inside a
// fence, and which text is prose rather than an example — tested directly.
//
// commonmark.mjs is the one place both rules live, so it is also the one place
// worth testing exhaustively. everything here used to be reachable only by
// spawning a CLI and inferring the parse from whether a link resolved — which
// made the cheap cases expensive and the awkward ones (an unterminated fence's
// line number, a fence opener's own position) untestable without a validator
// that happened to report them.
//
// tests/unit/fence-parsing.test.mjs still drives both CLIs, because a correct
// module and two callers reading it correctly are different claims.

import { describe, expect, it } from "vitest";

import {
  closesFence,
  extractProse,
  FENCE_RE,
  scanLines,
  unterminatedFenceLine,
} from "../../skills/agent-skill-authoring/scripts/commonmark.mjs";

/** the text of every line the scanner reports as outside a fence. */
const proseOf = (body) =>
  [...scanLines(body)].filter((line) => !line.fence).map((line) => line.text);

/** just the text of `extractProse`'s lines, one entry per source line. */
const textOf = (body) => extractProse(body).lines.map((line) => line.text);

describe("commonmark.mjs", () => {
  describe("FENCE_RE", () => {
    it.each([
      { line: "```", marker: "```", info: "" },
      { line: "````markdown", marker: "````", info: "markdown" },
      { line: "~~~", marker: "~~~", info: "" },
      { line: "   ```ts", marker: "```", info: "ts" },
      { line: "\t~~~~ js", marker: "~~~~", info: " js" },
    ])("reads $line as a fence line", ({ line, marker, info }) => {
      const match = line.match(FENCE_RE);

      expect(match).not.toBeNull();
      expect(match[1]).toBe(marker);
      expect(match[2]).toBe(info);
    });

    it.each(["``", "~~", "text", "", "  ", "a ``` mid-line"])(
      "does not read %j as a fence line",
      (line) => {
        expect(line.match(FENCE_RE)).toBeNull();
      },
    );
  });

  describe("closesFence()", () => {
    it.each([
      { what: "the same marker at the same length", line: "```", closes: true },
      { what: "a longer marker of the same character", line: "````", closes: true },
      { what: "a shorter marker", line: "``", closes: false },
      { what: "a different fence character", line: "~~~", closes: false },
      { what: "a marker carrying an info string", line: "```ts", closes: false },
      { what: "a marker with trailing whitespace only", line: "```   ", closes: true },
    ])("$what closes a ``` fence: $closes", ({ line, closes }) => {
      expect(closesFence(line.match(FENCE_RE), "`", 3)).toBe(closes);
    });

    it("never closes on a non-fence line", () => {
      expect(closesFence(null, "`", 3)).toBe(false);
    });
  });

  describe("scanLines()", () => {
    it("reports every line of a document with no fences", () => {
      expect(proseOf("# Title\n\nBody.\n")).toEqual(["# Title", "", "Body.", ""]);
    });

    it("hides a fenced block's content but surfaces its opener", () => {
      const lines = [...scanLines("before\n```ts\nhidden\n```\nafter\n")];

      expect(lines.map((line) => line.text)).toEqual([
        "before",
        "```ts",
        "after",
        "",
      ]);
      expect(lines.map((line) => line.fence)).toEqual([
        false,
        true,
        false,
        false,
      ]);
    });

    it("numbers lines from 1, counting the ones inside a fence", () => {
      const lines = [...scanLines("a\n```\nx\ny\n```\nb\n")];

      expect(lines.map((line) => line.line)).toEqual([1, 2, 6, 7]);
    });

    it("keeps a shorter inner fence inside a longer outer one", () => {
      const body = ["````markdown", "```ts", "inner", "```", "````", "after"].join(
        "\n",
      );

      expect(proseOf(body)).toEqual(["after"]);
    });

    it("does not let a tilde fence close a backtick fence", () => {
      const body = ["```", "~~~", "hidden", "~~~", "```", "after"].join("\n");

      expect(proseOf(body)).toEqual(["after"]);
    });

    it("treats everything after an unterminated fence as inside it", () => {
      expect(proseOf("visible\n```\nswallowed\nalso swallowed\n")).toEqual([
        "visible",
      ]);
    });
  });

  describe("unterminatedFenceLine()", () => {
    it("returns null when every fence closes", () => {
      expect(unterminatedFenceLine("a\n```\nx\n```\nb\n")).toBeNull();
    });

    it("returns null for a document with no fences at all", () => {
      expect(unterminatedFenceLine("# Title\n\nBody.\n")).toBeNull();
    });

    it("returns the 1-based line where the unclosed fence opened", () => {
      expect(unterminatedFenceLine("a\nb\n```ts\nx\n")).toBe(3);
    });

    it("reports the OUTER fence when a nested block leaves it open", () => {
      const body = ["intro", "````markdown", "```ts", "x", "```", "still inside"].join(
        "\n",
      );

      expect(unterminatedFenceLine(body)).toBe(2);
    });

    it("agrees with scanLines() about where the open fence began", () => {
      const body = "a\n```\nx\n";
      const opener = [...scanLines(body)].find((line) => line.fence);

      expect(unterminatedFenceLine(body)).toBe(opener.line);
    });
  });

  describe("extractProse()", () => {
    it("returns one entry per source line, numbered from 1", () => {
      const { lines } = extractProse("a\nb\nc\n");

      expect(lines).toEqual([
        { line: 1, text: "a" },
        { line: 2, text: "b" },
        { line: 3, text: "c" },
        { line: 4, text: "" },
      ]);
    });

    it("blanks a fenced block's content AND its opening fence", () => {
      expect(textOf("before\n```ts\nhidden\n```\nafter")).toEqual([
        "before",
        "",
        "",
        "",
        "after",
      ]);
    });

    it("blanks an inline code span but keeps the prose around it", () => {
      expect(textOf("Write `[x](./y.md)` in prose.")).toEqual(["Write  in prose."]);
    });

    it("blanks an HTML comment", () => {
      expect(textOf("<!-- parked -->after")).toEqual(["after"]);
    });

    it("keeps the lines after a multi-line comment at their own numbers", () => {
      const { lines } = extractProse("<!--\nparked\n-->\nreal\n");

      expect(lines).toEqual([
        { line: 1, text: "" },
        { line: 2, text: "" },
        { line: 3, text: "" },
        { line: 4, text: "real" },
        { line: 5, text: "" },
      ]);
    });

    // the regression this export exists for (#185). README.md documents the
    // `count:` marker rule with the sentence "a line beginning with `<!--` is an
    // HTML block in CommonMark" — a comment opener inside an inline code span.
    // stripping comments from the raw source believes that opener and discards
    // everything up to the next `-->`, which in README.md was 90 lines of real
    // prose and three unchecked relative links. blanking code spans first is
    // what makes an opener have to be real text to count.
    it("does not let a quoted comment opener swallow the prose after it", () => {
      const body = [
        "A line beginning with `<!--` is an HTML block in CommonMark.",
        "",
        "See [a](./a.md).",
        "",
        "<!-- count:things -->three<!-- /count -->",
        "",
        "And [b](./b.md).",
      ].join("\n");

      expect(textOf(body)).toEqual([
        "A line beginning with  is an HTML block in CommonMark.",
        "",
        "See [a](./a.md).",
        "",
        "three",
        "",
        "And [b](./b.md).",
      ]);
    });

    it("does not let a comment opener inside a fence swallow the prose after it", () => {
      const body = ["```markdown", "<!--", "```", "real", "-->", "still real"].join(
        "\n",
      );

      expect(textOf(body)).toEqual(["", "", "", "real", "-->", "still real"]);
    });

    it("treats an unterminated comment opener as content rather than stopping", () => {
      // a dangling `<!--` comments out the rest of a rendered document, but
      // honouring it here would silently stop reading — the failure mode that
      // looks like a clean result.
      expect(textOf("<!-- dangling\nSee [x](./x.md).")).toEqual([
        "<!-- dangling",
        "See [x](./x.md).",
      ]);
    });

    it("normalises carriage returns so no caller has to", () => {
      expect(textOf("a\r\nb\r\n")).toEqual(["a", "b", ""]);
    });

    it("reports the open fence from the same walk as the lines", () => {
      const body = "a\n```ts\nx\n";

      expect(extractProse(body).unterminatedFenceAt).toBe(unterminatedFenceLine(body));
    });

    it("reports no open fence when every fence closes", () => {
      expect(extractProse("a\n```\nx\n```\nb\n").unterminatedFenceAt).toBeNull();
    });
  });
});
