// Offline tests for the discovery evaluation's pure modules.
//
// Everything except the model call is deliberately pure, so the parts that
// decide what counts as a finding can be tested without a network, a secret, or
// a dollar. The one test that matters most is the NEGATIVE CONTROL: a harness
// that cannot report a miss is not evidence, so the suite proves it reports one
// when fed a deliberately wrong expected set, and reports clean when fed the
// right one.

import { mkdir, symlink } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { tempDir } from "../helpers/fixtures.mjs";

import {
  deltaAgainst,
  SELECTION_RATE,
  tallyCase,
  verdictFor,
} from "../../scripts/discovery-eval/compare.mjs";
import {
  parseBaseline,
  parseFixture,
  ValidationError,
} from "../../scripts/discovery-eval/fixture.mjs";
import {
  allowOverlayContent,
  allowOverlayPath,
  assertRealDirectory,
  COMBINED_MAX,
  DESCRIPTION_MAX,
  evalEnvironment,
  FILE_BYTES_MAX,
  planOverlay,
  resolveInside,
} from "../../scripts/discovery-eval/overlay.mjs";
import {
  renderBaseline,
  renderReport,
} from "../../scripts/discovery-eval/report.mjs";
import { parseStream } from "../../scripts/discovery-eval/stream.mjs";

const KNOWN = ["wireframe-design", "high-fidelity-ui-design", "professional-behavior"];

/** A minimal valid fixture, with `overrides` merged into its single case. */
function fixtureWith(overrides = {}, top = {}) {
  return JSON.stringify({
    version: 1,
    ...top,
    cases: [
      {
        id: "a-case",
        prompt: "Sketch a checkout screen.",
        rationale: "Because the layout is the question.",
        mustInclude: ["wireframe-design"],
        ...overrides,
      },
    ],
  });
}

/** The parsed single case from `fixtureWith`. */
const caseOf = (json) => parseFixture(json).cases[0];

/** `runs` shorthand: `runsOf("a", "a", "")` is three runs, the last selecting nothing. */
const runsOf = (...names) => names.map((name) => (name === "" ? [] : name.split("+")));

describe("fixture parsing", () => {
  it("accepts a well-formed fixture", () => {
    const fixture = parseFixture(fixtureWith(), { knownSkills: KNOWN });
    expect(fixture.cases).toHaveLength(1);
    expect(fixture.cases[0].mustInclude).toEqual(["wireframe-design"]);
    // Absent tiers normalize to empty arrays so callers never branch on undefined.
    expect(fixture.cases[0].mayInclude).toEqual([]);
  });

  it("reports every problem at once rather than only the first", () => {
    const broken = JSON.stringify({
      version: 1,
      cases: [
        { id: "One", prompt: "", rationale: "", mustInclude: ["Not A Skill"] },
      ],
    });
    try {
      parseFixture(broken);
      expect.unreachable("a fixture this broken must not parse");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      // id casing, empty prompt, empty rationale, malformed skill name.
      expect(error.problems.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("rejects a label naming a skill this repository does not have", () => {
    expect(() =>
      parseFixture(fixtureWith({ mustInclude: ["skill-that-was-deleted"] }), {
        knownSkills: KNOWN,
      }),
    ).toThrow(/not a skill in this repository/);
  });

  it("rejects a case that asserts nothing", () => {
    expect(() =>
      parseFixture(fixtureWith({ mustInclude: [], mayInclude: ["wireframe-design"] })),
    ).toThrow(/asserts nothing/);
  });

  it("rejects a skill placed in two tiers of one case", () => {
    expect(() =>
      parseFixture(fixtureWith({ mustExclude: ["wireframe-design"] })),
    ).toThrow(/both mustInclude and mustExclude/);
  });

  it("rejects excluding a skill the fixture also expects always", () => {
    expect(() =>
      parseFixture(
        fixtureWith({ mustExclude: ["professional-behavior"] }, {
          expectAlways: ["professional-behavior"],
        }),
      ),
    ).toThrow(/expectAlways/);
  });

  it("rejects duplicate case ids", () => {
    const doubled = JSON.parse(fixtureWith());
    doubled.cases.push({ ...doubled.cases[0] });
    expect(() => parseFixture(JSON.stringify(doubled))).toThrow(/more than once/);
  });

  it("rejects an unknown schema version", () => {
    expect(() => parseFixture(JSON.stringify({ version: 2, cases: [] }))).toThrow(
      /"version" must be 1/,
    );
  });
});

describe("baseline parsing", () => {
  const baseline = (overrides = {}) =>
    JSON.stringify({
      recordedAt: "2026-07-29",
      model: "claude-opus-5",
      repeats: 5,
      cases: { "a-case": { "wireframe-design": 4 } },
      ...overrides,
    });

  it("accepts a well-formed baseline", () => {
    expect(parseBaseline(baseline(), { knownSkills: KNOWN }).model).toBe("claude-opus-5");
  });

  it("requires the model identifier the delta hangs on", () => {
    expect(() => parseBaseline(baseline({ model: "" }))).toThrow(/"model"/);
  });

  it("rejects a baseline naming a skill that no longer exists", () => {
    // The failure this repository has already produced twice: a skill is
    // renamed or removed, and every later delta is silently computed against
    // something that can never appear.
    expect(() =>
      parseBaseline(baseline({ cases: { "a-case": { "deleted-skill": 3 } } }), {
        knownSkills: KNOWN,
      }),
    ).toThrow(/every delta against it would be computed against a skill that can never appear/);
  });

  it("rejects more hits than repeats", () => {
    expect(() =>
      parseBaseline(baseline({ cases: { "a-case": { "wireframe-design": 9 } } })),
    ).toThrow(/9 hits out of 5 repeats/);
  });
});

describe("classification", () => {
  it("calls a mustInclude skill a miss only at zero hits", () => {
    expect(verdictFor("mustInclude", 0, 5)).toBe("miss");
    // The whole asymmetry: one selection out of five proves reachability.
    expect(verdictFor("mustInclude", 1, 5)).toBe("weak");
    expect(verdictFor("mustInclude", 4, 5)).toBe("clear");
  });

  it("calls a mustExclude skill spurious only above a majority", () => {
    expect(verdictFor("mustExclude", 0, 5)).toBe("clear");
    expect(verdictFor("mustExclude", 2, 5)).toBe("occasional");
    expect(verdictFor("mustExclude", 3, 5)).toBe("spurious");
  });

  it("puts the majority boundary strictly above half", () => {
    // An even split is not a spurious trigger; SELECTION_RATE is exclusive.
    expect(verdictFor("mustExclude", 2, 4)).toBe("occasional");
    expect(SELECTION_RATE).toBe(0.5);
  });

  it("never turns an unlabelled or expect-always skill into a finding", () => {
    expect(verdictFor(null, 5, 5)).toBe("unlabelled");
    expect(verdictFor("expectAlways", 0, 5)).toBe("expected");
    expect(verdictFor("mayInclude", 5, 5)).toBe("optional");
  });

  it("does not report two competing skills as two misses", () => {
    // The case the pilot was chosen to produce: the design trio disclaim each
    // other, so a prompt both legitimately answer splits the distribution.
    // A symmetric majority rule would report BOTH as misses here.
    const contested = caseOf(
      fixtureWith({
        mustInclude: ["wireframe-design", "high-fidelity-ui-design"],
      }),
    );
    const tally = tallyCase(
      contested,
      runsOf(
        "wireframe-design",
        "wireframe-design",
        "high-fidelity-ui-design",
        "high-fidelity-ui-design",
        "wireframe-design",
      ),
    );

    expect(tally.findings).toEqual([]);
    expect(tally.coverage).toEqual({
      covered: 5,
      repeats: 5,
      skills: ["wireframe-design", "high-fidelity-ui-design"],
    });
  });

  it("distinguishes a contested case from a leaky one by coverage", () => {
    const contested = caseOf(
      fixtureWith({
        mustInclude: ["wireframe-design", "high-fidelity-ui-design"],
      }),
    );
    const leaky = tallyCase(
      contested,
      runsOf("wireframe-design", "wireframe-design", "high-fidelity-ui-design", "", ""),
    );
    expect(leaky.coverage.covered).toBe(3);
    expect(leaky.findings).toEqual([]);
  });

  it("counts a run once however many times it names the same skill", () => {
    const single = caseOf(fixtureWith());
    const tally = tallyCase(single, [
      ["wireframe-design", "wireframe-design"],
      [],
    ]);
    expect(tally.skills.find((skill) => skill.name === "wireframe-design").hits).toBe(1);
  });

  it("reports a labelled skill that never appeared", () => {
    const tally = tallyCase(caseOf(fixtureWith()), runsOf("", "", ""));
    const entry = tally.skills.find((skill) => skill.name === "wireframe-design");
    expect(entry.hits).toBe(0);
    expect(entry.verdict).toBe("miss");
  });
});

describe("negative control — the harness can actually report a miss", () => {
  // A harness that always says "clean" is not evidence. These two tests are the
  // control: identical runs, one labelled correctly and one labelled wrongly.
  const runs = runsOf(
    "wireframe-design",
    "wireframe-design",
    "wireframe-design",
    "wireframe-design",
    "wireframe-design",
  );

  it("reports clean against the correct expected set", () => {
    const tally = tallyCase(caseOf(fixtureWith()), runs);
    expect(tally.findings).toEqual([]);
  });

  it("reports a miss and a spurious trigger against a deliberately wrong one", () => {
    const wrong = caseOf(
      fixtureWith({
        mustInclude: ["high-fidelity-ui-design"],
        mustExclude: ["wireframe-design"],
      }),
    );
    const tally = tallyCase(wrong, runs);

    expect(tally.findings).toEqual([
      {
        kind: "spurious",
        skill: "wireframe-design",
        hits: 5,
        repeats: 5,
        remedy: "narrow",
      },
      {
        kind: "miss",
        skill: "high-fidelity-ui-design",
        hits: 0,
        repeats: 5,
        remedy: "widen",
      },
    ]);
  });
});

describe("baseline delta", () => {
  const tallies = [{ id: "a-case", repeats: 5, skills: [{ name: "wireframe-design", hits: 5 }] }];

  it("refuses to compare across models", () => {
    const delta = deltaAgainst(
      tallies,
      { model: "claude-sonnet-5", repeats: 5, cases: {} },
      "claude-opus-5",
    );
    expect(delta.usable).toBe(false);
    expect(delta.reason).toMatch(/claude-sonnet-5/);
  });

  it("compares rates, not raw hits, when repeat counts differ", () => {
    // 5/5 against a baseline of 3/3 is the same rate and must not read as a change.
    const delta = deltaAgainst(
      tallies,
      { model: "m", repeats: 3, cases: { "a-case": { "wireframe-design": 3 } } },
      "m",
    );
    expect(delta.usable).toBe(true);
    expect(delta.cases[0].changes).toEqual([]);
  });

  it("flags a real rate change, a new case, and a removed one", () => {
    const delta = deltaAgainst(
      tallies,
      {
        model: "m",
        repeats: 5,
        cases: { "a-case": { "wireframe-design": 2 }, "gone-case": {} },
      },
      "m",
    );
    expect(delta.cases[0].changes).toEqual([
      { skill: "wireframe-design", was: 2, now: 5 },
    ]);
    expect(delta.removed).toEqual(["gone-case"]);
  });

  it("is unusable when there is no baseline at all", () => {
    expect(deltaAgainst(tallies, null, "m").usable).toBe(false);
  });
});

describe("head overlay allowlist", () => {
  it("allows a skill's own SKILL.md", () => {
    expect(allowOverlayPath(".claude/skills/code-review/SKILL.md")).toEqual({
      allowed: true,
      skill: "code-review",
    });
  });

  it.each([
    ["../../etc/passwd", "parent-directory segment"],
    [".claude/skills/../../../etc/passwd", "parent-directory segment"],
    ["/etc/passwd", "absolute path"],
    [".claude\\skills\\x\\SKILL.md", "backslash in path"],
    ["", "empty path"],
  ])("refuses %s", (path, reason) => {
    expect(allowOverlayPath(path)).toEqual({ allowed: false, reason });
  });

  it.each([
    // References cannot affect discovery, so they have no reason to cross the
    // boundary at all — narrower than "any markdown under a skill".
    ".claude/skills/code-review/references/severity.md",
    "scripts/discovery-eval/run.mjs",
    ".github/workflows/merge-checks.yaml",
    "package.json",
    "skills/code-review/SKILL.md",
    ".claude/skills/code-review/SKILL.md.bak",
    ".claude/skills/nested/deeper/SKILL.md",
  ])("refuses %s as outside the allowlist", (path) => {
    expect(allowOverlayPath(path).allowed).toBe(false);
  });

  it("refuses a skill directory name that is not kebab-case", () => {
    const verdict = allowOverlayPath(".claude/skills/Not_A_Skill/SKILL.md");
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toMatch(/kebab-case/);
  });

  it("partitions a mixed changed-file list", () => {
    const { allowed, rejected } = planOverlay([
      ".claude/skills/code-review/SKILL.md",
      ".github/workflows/merge-checks.yaml",
    ]);
    expect(allowed).toEqual([
      { path: ".claude/skills/code-review/SKILL.md", skill: "code-review" },
    ]);
    expect(rejected).toHaveLength(1);
  });

  it("refuses a destination that would escape the workspace", () => {
    expect(() => resolveInside("/tmp/ws", "../outside/SKILL.md")).toThrow(
      /resolves outside the workspace/,
    );
    expect(resolveInside("/tmp/ws", "code-review/SKILL.md")).toBe(
      "/tmp/ws/code-review/SKILL.md",
    );
  });

  it("refuses to write into a symlinked directory", async () => {
    // The gap path containment cannot close: `resolve` does not follow links,
    // so a symlinked skill directory looks textually inside the workspace while
    // pointing at the real working tree. The skills CLI installs exactly such
    // symlinks unless --copy is passed.
    const dir = await tempDir();
    const real = join(dir, "real");
    const linked = join(dir, "linked");
    await mkdir(real, { recursive: true });
    await symlink(real, linked, "dir");

    await expect(assertRealDirectory(real)).resolves.toBeUndefined();
    await expect(assertRealDirectory(linked)).rejects.toThrow(
      /not a real directory/,
    );
  });
});

describe("overlay content caps", () => {
  const skillFile = (description, whenToUse = "Apply when testing.", body = "# X\n") =>
    `---\nname: a-skill\ndescription: ${description}\nwhen_to_use: ${whenToUse}\n---\n\n${body}`;

  it("allows an ordinary skill file", () => {
    expect(allowOverlayContent(skillFile("A short description."))).toEqual({
      allowed: true,
    });
  });

  it("refuses an oversized description", () => {
    // The cost bound, not the authoring rule: overlaid discovery text is
    // re-sent with every probe in the run.
    const verdict = allowOverlayContent(skillFile("x".repeat(DESCRIPTION_MAX + 1)));
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toMatch(/description is \d+ chars/);
  });

  it("refuses an oversized description plus when_to_use", () => {
    const verdict = allowOverlayContent(
      skillFile("x".repeat(DESCRIPTION_MAX), "y".repeat(COMBINED_MAX)),
    );
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toMatch(/description \+ when_to_use is \d+ chars/);
  });

  it("refuses a file past the byte backstop before parsing it", () => {
    const verdict = allowOverlayContent(skillFile("ok", "ok", "z".repeat(FILE_BYTES_MAX)));
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toMatch(/file is \d+ bytes/);
  });

  it("refuses a file with no frontmatter block", () => {
    expect(allowOverlayContent("just prose\n").allowed).toBe(false);
  });
});

describe("evaluation environment", () => {
  it("withholds GITHUB_TOKEN and anything else credential-shaped", () => {
    const env = evalEnvironment({
      PATH: "/usr/bin",
      GITHUB_TOKEN: "ghs_secret",
      GH_TOKEN: "gho_secret",
      NPM_CONFIG_PASSWORD: "hunter2",
      AWS_SECRET_ACCESS_KEY: "nope",
      SOME_API_KEY: "nope",
    });
    expect(env).toEqual({ PATH: "/usr/bin" });
  });

  it("keeps the CLI's own authentication, which it cannot run without", () => {
    const env = evalEnvironment({
      CLAUDE_CODE_OAUTH_TOKEN: "keep",
      ANTHROPIC_API_KEY: "keep",
      GITHUB_TOKEN: "drop",
    });
    expect(env).toEqual({
      CLAUDE_CODE_OAUTH_TOKEN: "keep",
      ANTHROPIC_API_KEY: "keep",
    });
  });
});

describe("stream parsing", () => {
  const line = (object) => `${JSON.stringify(object)}\n`;

  it("reads the selected skill, the model, and the cost", () => {
    const stdout =
      line({ type: "system", subtype: "init", model: "claude-opus-5" }) +
      line({
        type: "assistant",
        message: {
          content: [
            { type: "text", text: "Let me use a skill." },
            { type: "tool_use", name: "Skill", input: { skill: "wireframe-design" } },
          ],
        },
      }) +
      line({ type: "result", subtype: "error_max_turns", total_cost_usd: 0.04 });

    expect(parseStream(stdout)).toEqual({
      skills: ["wireframe-design"],
      model: "claude-opus-5",
      cost: 0.04,
    });
  });

  it("ignores tool calls that are not skill selections", () => {
    const stdout = line({
      type: "assistant",
      message: {
        content: [{ type: "tool_use", name: "ToolSearch", input: { query: "x" } }],
      },
    });
    expect(parseStream(stdout).skills).toEqual([]);
  });

  it("reduces a plugin-qualified name to the skill itself", () => {
    const stdout = line({
      type: "assistant",
      message: {
        content: [
          { type: "tool_use", name: "Skill", input: { skill: "some-plugin:code-review" } },
        ],
      },
    });
    expect(parseStream(stdout).skills).toEqual(["code-review"]);
  });

  it("survives a truncated final line", () => {
    // Normal when the CLI is cut off by its own turn cap.
    const stdout =
      line({ type: "system", model: "m" }) + '{"type":"result","total_cos';
    expect(parseStream(stdout).model).toBe("m");
  });

  it("returns nothing selected for a run that chose no skill", () => {
    expect(parseStream("").skills).toEqual([]);
    expect(parseStream("").model).toBeNull();
  });
});

describe("report rendering", () => {
  const fixture = parseFixture(fixtureWith());
  const tallies = [tallyCase(fixture.cases[0], runsOf("wireframe-design", "", ""))];

  const render = (delta) =>
    renderReport({
      fixture,
      tallies,
      delta,
      context: { model: "claude-opus-5", repeats: 3, corpusSize: 19, headSha: "abc1234" },
    });

  it("states the repeat count, the rule, the model, and the evaluated head", () => {
    const report = render({ usable: true, baselineRepeats: 3, cases: [], removed: [] });
    expect(report).toContain("claude-opus-5");
    expect(report).toContain("3 per case");
    expect(report).toContain("abc1234");
    expect(report).toMatch(/MISS.+ZERO of the 3 runs/);
  });

  it("carries a denominator on every count", () => {
    const report = render({ usable: true, baselineRepeats: 3, cases: [], removed: [] });
    expect(report).toContain("1/3");
  });

  it("suppresses the delta loudly when the baseline is from another model", () => {
    const report = render({ usable: false, reason: "baseline was recorded on \"x\"" });
    expect(report).toContain("NO DELTA");
    expect(report).toMatch(/Re-record it with --emit-baseline/);
  });

  it("contains nothing checkout-dependent, so two runs diff cleanly", () => {
    const report = render({ usable: true, baselineRepeats: 3, cases: [], removed: [] });
    expect(report).not.toMatch(/\/(home|Users|tmp)\//);
    expect(report).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it("emits a baseline document keyed by case and skill", () => {
    const emitted = JSON.parse(
      renderBaseline(tallies, {
        model: "claude-opus-5",
        repeats: 3,
        recordedAt: "2026-07-29",
      }),
    );
    expect(emitted).toEqual({
      recordedAt: "2026-07-29",
      model: "claude-opus-5",
      repeats: 3,
      cases: { "a-case": { "wireframe-design": 1 } },
    });
  });
});
