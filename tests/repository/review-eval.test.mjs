// Unit coverage for the review evaluation's pure modules.
//
// Everything here runs offline against synthetic input. The harness itself
// drives the real CLI and cannot run in a suite; what CAN be pinned is the
// logic that decides what a probe found, and the most important assertion in
// this file is the one proving a prose mention is not scored as a finding —
// the defect that made revision 1 of the plan invalid.

import { describe, expect, it } from "vitest";

import { estimateCost, validate } from "../../scripts/review-eval/fixture.mjs";
import { hitCount, scoreCase, splitTarget } from "../../scripts/review-eval/score.mjs";
import { lensEnumeration, parseStream } from "../../scripts/review-eval/stream.mjs";

/** One assistant event carrying the given content blocks. */
const assistant = (...content) => JSON.stringify({ type: "assistant", message: { content } });

const anchorCall = (path, line) =>
  JSON.stringify({
    type: "assistant",
    message: {
      content: [
        {
          type: "tool_use",
          name: "mcp__inline__create_inline_comment",
          input: { path, line, body: "finding" },
        },
      ],
    },
  });

describe("parseStream", () => {
  it("recovers anchors from inline-comment tool calls", () => {
    const stdout = [
      JSON.stringify({ type: "system", model: "claude-opus-5" }),
      anchorCall("skills/a/SKILL.md", 12),
      anchorCall("skills/b/references/c.md", 4),
      JSON.stringify({ type: "result", total_cost_usd: 0.42 }),
    ].join("\n");

    const parsed = parseStream(stdout);
    expect(parsed.anchors).toEqual([
      { path: "skills/a/SKILL.md", line: 12 },
      { path: "skills/b/references/c.md", line: 4 },
    ]);
    expect(parsed.model).toBe("claude-opus-5");
    expect(parsed.cost).toBe(0.42);
  });

  it("does NOT treat a path named in prose as an anchor", () => {
    // The counterexample that invalidated scoring on cited paths: the review
    // that missed #166's duplication named module-mocking.md approvingly.
    const stdout = assistant({
      type: "text",
      text: "No duplicated rule — module-mocking.md:88 explicitly defers to unit-testing.",
    });

    expect(parseStream(stdout).anchors).toEqual([]);
  });

  it("takes the summary from the last text block only", () => {
    const stdout = [
      assistant({ type: "text", text: "Reading the diff now." }),
      assistant({ type: "text", text: "Summary: duplicated judgment — checked, none." }),
    ].join("\n");

    expect(parseStream(stdout).summary).toBe(
      "Summary: duplicated judgment — checked, none.",
    );
  });

  it("survives an unreadable line and a missing line number", () => {
    const stdout = [
      "{ not json",
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            { type: "tool_use", name: "mcp__inline__create_inline_comment", input: { path: "a.md" } },
          ],
        },
      }),
    ].join("\n");

    expect(parseStream(stdout).anchors).toEqual([{ path: "a.md", line: null }]);
  });

  it("ignores tool calls that are not the inline-comment tool", () => {
    const stdout = assistant({
      type: "tool_use",
      name: "Read",
      input: { path: "skills/a/SKILL.md" },
    });

    expect(parseStream(stdout).anchors).toEqual([]);
  });
});

describe("lensEnumeration", () => {
  it("requires all five lenses to be named", () => {
    const complete =
      "duplicated judgment: none. reproduced upstream: none. general knowledge: none. " +
      "routing concreteness: one finding. obligation load: proportionate.";
    expect(lensEnumeration(complete).enumerated).toBe(true);
  });

  it("reports which lenses a partial walk missed", () => {
    const partial = "duplicated judgment: none. obligation load: fine.";
    const result = lensEnumeration(partial);

    expect(result.enumerated).toBe(false);
    expect(result.missing).toEqual([
      "reproduced upstream",
      "general knowledge",
      "routing concreteness",
    ]);
  });
});

describe("scoring", () => {
  const probe = (paths) => ({
    anchors: paths.map((p) => {
      const [path, line] = splitTarget(p);
      return { path, line };
    }),
    lens: { enumerated: false, missing: [] },
  });

  it("splits path:line targets and leaves bare paths alone", () => {
    expect(splitTarget("a/b.md:12")).toEqual(["a/b.md", 12]);
    expect(splitTarget("a/b.md")).toEqual(["a/b.md", null]);
  });

  it("matches a bare-path target against an anchor on any line", () => {
    expect(hitCount([probe(["a/b.md:99"])], "a/b.md")).toBe(1);
  });

  it("requires an exact line when the target names one", () => {
    expect(hitCount([probe(["a/b.md:99"])], "a/b.md:12")).toBe(0);
    expect(hitCount([probe(["a/b.md:12"])], "a/b.md:12")).toBe(1);
  });

  it("counts a target reached when ANY probe anchors it", () => {
    const result = scoreCase(
      { id: "c", mustAnchor: ["a/b.md"] },
      [probe([]), probe(["a/b.md:3"])],
    );

    expect(result.reached).toEqual([{ target: "a/b.md", hits: 1 }]);
    expect(result.missed).toEqual([]);
  });

  it("counts a target missed only when NO probe anchors it", () => {
    const result = scoreCase({ id: "c", mustAnchor: ["a/b.md"] }, [probe([]), probe([])]);

    expect(result.missed).toEqual([{ target: "a/b.md", hits: 0 }]);
    expect(result.findings).toBe(1);
  });

  it("flags a false positive only on a majority of probes", () => {
    const minority = scoreCase({ id: "c", mustAnchor: ["x.md"], mustNotAnchor: ["n.md"] }, [
      probe(["x.md", "n.md"]),
      probe(["x.md"]),
    ]);
    expect(minority.spurious).toEqual([]);

    const majority = scoreCase({ id: "c", mustAnchor: ["x.md"], mustNotAnchor: ["n.md"] }, [
      probe(["x.md", "n.md"]),
      probe(["x.md", "n.md"]),
    ]);
    expect(majority.spurious).toEqual([{ target: "n.md", hits: 2 }]);
  });
});

describe("fixture validation", () => {
  const valid = {
    version: 1,
    cases: [
      {
        id: "case-one",
        baseSha: "49a11b276927272e1a1050abd604036200ef044a",
        headSha: "2b948ee91f7c973c101599c6ca57cf1b74118203",
        mustAnchor: ["a/b.md"],
        repeats: 2,
        rationale: "why this case exists",
      },
    ],
  };

  it("accepts a well-formed fixture", () => {
    expect(validate(valid)).toEqual([]);
  });

  it("reports every problem at once rather than the first", () => {
    const problems = validate({ cases: [{ id: "x", repeats: 0 }] });

    expect(problems.length).toBeGreaterThan(2);
    expect(problems.join("\n")).toContain("`repeats` must be a positive integer");
    expect(problems.join("\n")).toContain("missing `rationale`");
  });

  it("rejects a case that carries a pull-request URL", () => {
    // The contamination rule: #166's thread spells out its own defects with
    // fixes, so a probe that can reach it reads the answer key.
    const contaminated = {
      cases: [{ ...valid.cases[0], source: "https://github.com/axross/skills/pull/166" }],
    };

    expect(validate(contaminated).join("\n")).toContain("probes are diff-only");
  });

  it("rejects a duplicate case id and a malformed sha", () => {
    const broken = {
      cases: [valid.cases[0], { ...valid.cases[0], baseSha: "not-a-sha" }],
    };
    const problems = validate(broken).join("\n");

    expect(problems).toContain("duplicate id");
    expect(problems).toContain("`baseSha` is not a commit sha");
  });

  it("prices a run across every arm", () => {
    expect(estimateCost(valid, 0.5, 2)).toEqual({ probes: 4, usd: 2 });
  });
});
