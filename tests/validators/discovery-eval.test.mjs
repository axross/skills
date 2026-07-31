// Offline tests for the discovery evaluation's pure modules.
//
// Everything except the model call is deliberately pure, so the parts that
// decide what counts as a finding can be tested without a network, a secret, or
// a dollar. The one test that matters most is the NEGATIVE CONTROL: a harness
// that cannot report a miss is not evidence, so the suite proves it reports one
// when fed a deliberately wrong expected set, and reports clean when fed the
// right one.

import { mkdir, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { tempDir, writeSkill } from "../helpers/fixtures.mjs";
import { runScript, SCRIPTS } from "../helpers/run.mjs";

import {
  deltaAgainst,
  SELECTION_RATE,
  tallyCase,
  verdictFor,
} from "../../scripts/discovery-eval/compare.mjs";
import {
  compareCorpus,
  corpusDigest,
  corpusInvocability,
  DIGEST_LENGTH,
  digestDiscoveryText,
  INVOCABLE,
  isDigest,
  NOT_INVOCABLE,
  readDiscoveryText,
  readInvocable,
  UNRECOGNISED,
} from "../../scripts/discovery-eval/corpus.mjs";
import {
  baselineRefusal,
  classifyLoaded,
  contamination,
  summariseIsolation,
  unrecognisedInvocability,
} from "../../scripts/discovery-eval/isolation.mjs";
import { sliceBaseline } from "../../scripts/discovery-eval/extract-baseline.mjs";
import {
  MIN_CASE_REPEATS,
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
  BASELINE_MARKER,
  renderBaseline,
  renderProbeBudget,
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

  it("accepts a case declaring its own repeat count", () => {
    const parsed = parseFixture(fixtureWith({ repeats: 2 }));
    expect(parsed.cases[0].repeats).toBe(2);
  });

  it("leaves repeats null when a case declares none", () => {
    expect(parseFixture(fixtureWith()).cases[0].repeats).toBeNull();
  });

  it("refuses a single repeat, naming the false-SPURIOUS reason", () => {
    // The floor is arithmetic, not taste: at 1 repeat a stray selection is 1/1,
    // which clears the above-half bar and reports a finding on one probe.
    expect(() => parseFixture(fixtureWith({ repeats: 1 }))).toThrow(/1\/1/);
    expect(() => parseFixture(fixtureWith({ repeats: 1 }))).toThrow(
      new RegExp(`at least ${MIN_CASE_REPEATS}`),
    );
  });

  it("refuses a repeat count that is not a whole number of runs", () => {
    expect(() => parseFixture(fixtureWith({ repeats: 0 }))).toThrow(/"repeats"/);
    expect(() => parseFixture(fixtureWith({ repeats: 2.5 }))).toThrow(/"repeats"/);
    expect(() => parseFixture(fixtureWith({ repeats: "2" }))).toThrow(/"repeats"/);
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
      recordedAt: "2026-07-29T14:32:07Z",
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

  it("treats an absent unmeasured list as none declared", () => {
    // Every baseline recorded before this field existed must keep parsing, or
    // adding the field would invalidate the one document in the tree.
    expect(parseBaseline(baseline(), { knownSkills: KNOWN }).unmeasured).toEqual([]);
  });

  it("accepts a case declared unmeasured", () => {
    const parsed = parseBaseline(
      baseline({ unmeasured: ["later-case", "another-case"] }),
      { knownSkills: KNOWN },
    );
    expect(parsed.unmeasured).toEqual(["later-case", "another-case"]);
  });

  it("rejects a case that is both measured and declared unmeasured", () => {
    // The contradiction that would hollow the declaration out: if a tally can
    // sit beside the claim that no tally was taken, an absent case stops being
    // trustworthy evidence of anything.
    expect(() =>
      parseBaseline(baseline({ unmeasured: ["a-case"] }), { knownSkills: KNOWN }),
    ).toThrow(/"a-case".+"unmeasured".+tally/s);
  });

  it("rejects an unmeasured list that is not a list of case ids", () => {
    expect(() => parseBaseline(baseline({ unmeasured: "a-case" }))).toThrow(
      /"unmeasured" must be an array/,
    );
    expect(() => parseBaseline(baseline({ unmeasured: ["Not A Case"] }))).toThrow(
      /not a kebab-case case id/,
    );
    expect(() =>
      parseBaseline(baseline({ unmeasured: ["twice-case", "twice-case"] })),
    ).toThrow(/lists "twice-case" twice/);
  });

  it("records per-case denominators, and defaults the rest", () => {
    const parsed = parseBaseline(
      baseline({
        caseRepeats: { "a-case": 2 },
        cases: { "a-case": { "wireframe-design": 2 } },
      }),
      { knownSkills: KNOWN },
    );
    expect(parsed.caseRepeats).toEqual({ "a-case": 2 });
    expect(parseBaseline(baseline(), { knownSkills: KNOWN }).caseRepeats).toEqual({});
  });

  it("counts hits against the case's own denominator, not the document's", () => {
    // 3 hits is fine at the document's 5 and impossible at the case's 2. Using
    // the document default here would let a mis-recorded tally through.
    expect(() =>
      parseBaseline(
        baseline({
          caseRepeats: { "a-case": 2 },
          cases: { "a-case": { "wireframe-design": 3 } },
        }),
        { knownSkills: KNOWN },
      ),
    ).toThrow(/3 hits out of 2 repeats/);
  });

  it("rejects a denominator for a case it records no tally for", () => {
    expect(() =>
      parseBaseline(baseline({ caseRepeats: { "ghost-case": 2 } })),
    ).toThrow(/records no tally/);
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

  it("accepts a UTC instant recorded to the second", () => {
    expect(parseBaseline(baseline()).recordedAt).toBe("2026-07-29T14:32:07Z");
  });

  it.each([
    // The shape the runner used to emit, before this field carried a time.
    ["2026-07-29", "bare date"],
    ["2026-07-29T14:32:07", "no zone"],
    ["2026-07-29T14:32:07+09:00", "an offset rather than UTC"],
    ["2026-07-29T14:32:07.678Z", "a millisecond fraction"],
  ])("rejects %s — %s", (recordedAt) => {
    expect(() => parseBaseline(baseline({ recordedAt }))).toThrow(
      /must be a UTC timestamp of the form YYYY-MM-DDTHH:MM:SSZ/,
    );
  });

  it.each([
    // Date does NOT reject this one: it rolls February 30th over to March 2nd,
    // so only comparing the parsed instant back against the string catches it.
    "2026-02-30T00:00:00Z",
    // A legal ISO 8601 spelling of the next midnight. Refused because one
    // instant with two spellings defeats diffing the file it lives in.
    "2026-07-29T24:00:00Z",
  ])("rejects %s, which has the right shape and is not a real instant", (recordedAt) => {
    expect(() => parseBaseline(baseline({ recordedAt }))).toThrow(
      /which is not a real UTC instant/,
    );
  });

  it("accepts a baseline that records no corpus at all", () => {
    // The baseline in this tree. Refusing it would leave the harness unusable
    // until someone paid $2.57 for a fresh recording.
    expect(parseBaseline(baseline()).corpus).toBeNull();
  });

  it("accepts a well-formed corpus record", () => {
    const corpus = { "wireframe-design": "b17c4e2a8d61" };
    expect(parseBaseline(baseline({ corpus }), { knownSkills: KNOWN }).corpus).toEqual(
      corpus,
    );
  });

  it("accepts a corpus entry naming a skill that no longer exists", () => {
    // The deliberate asymmetry with a TALLY, which is a hard failure for the
    // same name: in the corpus record, a vanished skill is the signal itself.
    const parsed = parseBaseline(
      baseline({ corpus: { "deleted-skill": "b17c4e2a8d61" } }),
      { knownSkills: KNOWN },
    );
    expect(parsed.corpus).toEqual({ "deleted-skill": "b17c4e2a8d61" });
  });

  it("rejects a corpus that is not an object", () => {
    expect(() => parseBaseline(baseline({ corpus: ["wireframe-design"] }))).toThrow(
      /"corpus" must be an object mapping skill names to discovery-text digests/,
    );
  });

  it("rejects a corpus key that is not a kebab-case skill name", () => {
    expect(() =>
      parseBaseline(baseline({ corpus: { "Not A Skill": "b17c4e2a8d61" } })),
    ).toThrow(/"corpus" names "Not A Skill", which is not a kebab-case skill name/);
  });

  it.each([
    ["b17c4e2a8d6", "too short"],
    ["b17c4e2a8d61f", "too long"],
    ["B17C4E2A8D61", "uppercase"],
    ["b17c4e2a8d6z", "not hex"],
    [42, "not a string"],
  ])("rejects the digest %s — %s, naming the entry", (digest) => {
    expect(() =>
      parseBaseline(baseline({ corpus: { "wireframe-design": digest } })),
    ).toThrow(/"corpus" entry for "wireframe-design"/);
  });
});

describe("the extractor as a CLI", () => {
  it("answers --help with the usage text and exit 0", () => {
    // Asking for help is not a bad invocation. Exit 2 here would also contradict
    // run.mjs, which answers --help before looking at anything else.
    const result = runScript(SCRIPTS.extractBaseline, ["--help"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Usage: extract-baseline.mjs");
  });

  it("still refuses an invocation missing its paths", () => {
    const result = runScript(SCRIPTS.extractBaseline, []);
    expect(result.code).toBe(2);
    expect(result.output).toMatch(/report file and an output file are required/);
  });
});

describe("lifting an emitted baseline out of a report", () => {
  const document = '{\n  "model": "m"\n}\n';
  const emitted = (body) => `${BASELINE_MARKER}\n${document}${body ?? ""}`;

  it("returns everything after the marker line", () => {
    expect(sliceBaseline(`a report\n\n${emitted()}`)).toBe(document);
  });

  it("finds a marker that opens the text", () => {
    // Not the shape run.mjs produces, but the shape a piped or trimmed capture
    // can arrive in, and an off-by-one here silently drops the opening brace.
    expect(sliceBaseline(emitted())).toBe(document);
  });

  it("returns null when the run emitted no baseline", () => {
    // The ordinary dispatch. It must be distinguishable from a slice that found
    // nothing useful, because the remedy is different: pass --emit-baseline.
    expect(sliceBaseline("a report with no proposed baseline\n")).toBeNull();
  });

  it("ignores the marker quoted mid-line", () => {
    // A report that merely mentions the phrase — a future doc-comment, a copied
    // log — must not cut the document short at the mention.
    const mentioned = `see "${BASELINE_MARKER}" below\n${emitted()}`;
    expect(sliceBaseline(mentioned)).toBe(document);
  });

  it("round-trips through parseBaseline, which is what the workflow relies on", () => {
    const real = renderBaseline(
      [{ id: "a-case", skills: [{ name: "wireframe-design", hits: 3 }] }],
      { model: "claude-opus-5", repeats: 3, recordedAt: "2026-07-29T14:32:07Z" },
    );
    const sliced = sliceBaseline(`report text\n\n${BASELINE_MARKER}\n${real}`);
    expect(sliced).toBe(real);
    expect(parseBaseline(sliced, { knownSkills: KNOWN }).model).toBe("claude-opus-5");
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
      { skill: "wireframe-design", was: 2, now: 5, wasRepeats: 5 },
    ]);
    expect(delta.removed).toEqual(["gone-case"]);
  });

  it("is unusable when there is no baseline at all", () => {
    expect(deltaAgainst(tallies, null, "m").usable).toBe(false);
  });

  it("compares a reduced-repeat case against its own denominator", () => {
    // The saving is only safe if it does not manufacture findings: a case
    // recorded 2/2 and now running 5/5 is the SAME rate and must report no
    // change. Against the document's default of 5 it would read as 2/5 -> 5/5.
    const delta = deltaAgainst(
      tallies,
      {
        model: "m",
        repeats: 5,
        caseRepeats: { "a-case": 2 },
        cases: { "a-case": { "wireframe-design": 2 } },
      },
      "m",
    );
    expect(delta.usable).toBe(true);
    expect(delta.cases[0].changes).toEqual([]);
  });

  it("prints a moved reduced-repeat case against the denominator it was recorded at", () => {
    const delta = deltaAgainst(
      tallies,
      {
        model: "m",
        repeats: 5,
        caseRepeats: { "a-case": 2 },
        cases: { "a-case": { "wireframe-design": 1 } },
      },
      "m",
    );
    expect(delta.cases[0].changes).toEqual([
      { skill: "wireframe-design", was: 1, now: 5, wasRepeats: 2 },
    ]);
  });

  it("tells a declared unmeasured case from one nobody recorded", () => {
    // Both are absent from `cases` and both are `isNew`. Only the declared one
    // is a gap somebody planned, and the delta has to carry that difference or
    // the report cannot state it.
    const declared = deltaAgainst(
      tallies,
      { model: "m", repeats: 5, unmeasured: ["a-case"], cases: {} },
      "m",
    );
    expect(declared.cases[0]).toMatchObject({ isNew: true, isUnmeasured: true });

    const undeclared = deltaAgainst(
      tallies,
      { model: "m", repeats: 5, unmeasured: [], cases: {} },
      "m",
    );
    expect(undeclared.cases[0]).toMatchObject({ isNew: true, isUnmeasured: false });
  });
});

describe("corpus fingerprint", () => {
  const discovery = (description, whenToUse) => ({ description, whenToUse });

  it("produces a short lowercase hex digest", () => {
    const digest = digestDiscoveryText(discovery("A description.", "Apply when X."));
    expect(digest).toHaveLength(DIGEST_LENGTH);
    expect(isDigest(digest)).toBe(true);
  });

  it("is stable for the same discovery text", () => {
    expect(digestDiscoveryText(discovery("A.", "B."))).toBe(
      digestDiscoveryText(discovery("A.", "B.")),
    );
  });

  it.each([
    ["description", discovery("Changed.", "Apply when X.")],
    ["when_to_use", discovery("A description.", "Apply when Y.")],
  ])("moves when %s changes", (_field, changed) => {
    expect(digestDiscoveryText(changed)).not.toBe(
      digestDiscoveryText(discovery("A description.", "Apply when X.")),
    );
  });

  it("moves when text is relocated between the two fields", () => {
    // What the NUL separator buys. Concatenating without one would digest
    // "ab" + "" identically to "a" + "b", and that move changes what discovery
    // reads for each field.
    expect(digestDiscoveryText(discovery("ab", ""))).not.toBe(
      digestDiscoveryText(discovery("a", "b")),
    );
  });

  it("reads only the two keys discovery reads", () => {
    const parsed = readDiscoveryText(
      "---\nname: a-skill\ndescription: D.\nwhen_to_use: W.\n---\n\n# Body\n",
    );
    expect(parsed).toEqual({ description: "D.", whenToUse: "W." });
  });

  it("returns nothing for a file with no frontmatter block", () => {
    expect(readDiscoveryText("just prose\n")).toBeNull();
  });

  it("digests a skill root, skipping anything that is not a skill", async () => {
    const root = await tempDir();
    await writeSkill(root, "alpha-skill");
    await writeSkill(root, "beta-skill");
    // A directory with no SKILL.md, and a loose file beside the directories.
    await mkdir(join(root, "not-a-skill"), { recursive: true });
    await writeFile(join(root, "README.md"), "# not a skill\n", "utf8");

    const digests = await corpusDigest(root);
    expect(Object.keys(digests)).toEqual(["alpha-skill", "beta-skill"]);
    expect(Object.values(digests).every(isDigest)).toBe(true);
  });

  it("does not move when only a skill's body changes", async () => {
    // The premise the whole field rests on: discovery never reads the body, so
    // editing it must not invalidate a baseline.
    const root = await tempDir();
    await writeSkill(root, "alpha-skill", { body: "# One\n\nFirst body.\n" });
    const before = await corpusDigest(root);

    await writeSkill(root, "alpha-skill", { body: "# Two\n\nRewritten body.\n" });
    const after = await corpusDigest(root);

    expect(after).toEqual(before);
  });

  it("moves when a skill's discovery text changes", async () => {
    const root = await tempDir();
    await writeSkill(root, "alpha-skill");
    const before = await corpusDigest(root);

    await writeSkill(root, "alpha-skill", {
      frontmatter: { when_to_use: "Apply under entirely different circumstances." },
    });
    const after = await corpusDigest(root);

    expect(after["alpha-skill"]).not.toBe(before["alpha-skill"]);
  });
});

describe("corpus comparison", () => {
  const recorded = { alpha: "aaaaaaaaaaaa", beta: "bbbbbbbbbbbb" };

  it("reports no drift when the corpus matches", () => {
    expect(compareCorpus(recorded, { ...recorded })).toEqual({
      recorded: true,
      added: [],
      removed: [],
      changed: [],
      drifted: false,
    });
  });

  it("sorts each of the three buckets", () => {
    const result = compareCorpus(recorded, {
      beta: "cccccccccccc",
      zeta: "dddddddddddd",
      delta: "eeeeeeeeeeee",
    });
    expect(result).toEqual({
      recorded: true,
      added: ["delta", "zeta"],
      removed: ["alpha"],
      changed: ["beta"],
      drifted: true,
    });
  });

  it.each([
    ["the baseline recorded none", null, recorded],
    ["the run computed none", recorded, null],
  ])("reports 'not recorded' when %s", (_case, before, now) => {
    expect(compareCorpus(before, now)).toEqual({
      recorded: false,
      added: [],
      removed: [],
      changed: [],
      drifted: false,
    });
  });
});

describe("corpus drift in the delta", () => {
  const tallies = [
    { id: "a-case", repeats: 5, skills: [{ name: "wireframe-design", hits: 5 }] },
  ];
  const withCorpus = (corpus) => ({
    model: "m",
    repeats: 5,
    corpus,
    cases: { "a-case": { "wireframe-design": 2 } },
  });
  const current = { "wireframe-design": "aaaaaaaaaaaa" };

  it("renders the delta and says so when the baseline recorded no corpus", () => {
    const delta = deltaAgainst(tallies, withCorpus(null), "m", current);
    expect(delta.usable).toBe(true);
    expect(delta.corpus.recorded).toBe(false);
    expect(delta.cases[0].changes).toHaveLength(1);
    expect(delta.cases[0].unattributable).toBe(false);
  });

  it("marks nothing when the corpus matches", () => {
    const delta = deltaAgainst(tallies, withCorpus({ ...current }), "m", current);
    expect(delta.corpus.drifted).toBe(false);
    expect(delta.cases[0].unattributable).toBe(false);
  });

  it.each([
    ["a skill was added", {}],
    ["a skill's text changed", { "wireframe-design": "bbbbbbbbbbbb" }],
    // Removal marks too. A skill absent from the corpus was still competing for
    // selection while the baseline was being measured, so its disappearance can
    // move a result exactly as an addition can.
    ["a skill was removed", { ...current, gone: "cccccccccccc" }],
  ])("marks the comparison unattributable when %s", (_case, recorded) => {
    const delta = deltaAgainst(tallies, withCorpus(recorded), "m", current);
    expect(delta.corpus.drifted).toBe(true);
    expect(delta.cases[0].unattributable).toBe(true);
    // Marked, NOT suppressed — the change is still there to read.
    expect(delta.usable).toBe(true);
    expect(delta.cases[0].changes).toEqual([
      { skill: "wireframe-design", was: 2, now: 5, wasRepeats: 5 },
    ]);
  });

  it("never marks a case the baseline never measured", () => {
    const delta = deltaAgainst(
      [{ id: "new-case", repeats: 5, skills: [] }],
      withCorpus({}),
      "m",
      current,
    );
    expect(delta.cases[0].isNew).toBe(true);
    expect(delta.cases[0].unattributable).toBe(false);
  });

  it("lets a model mismatch suppress the delta before the corpus rule runs", () => {
    // The corpus rule annotates; it must not soften the one rule that refuses.
    const delta = deltaAgainst(
      tallies,
      { ...withCorpus({}), model: "claude-sonnet-5" },
      "claude-opus-5",
      current,
    );
    expect(delta.usable).toBe(false);
    expect(delta.corpus).toBeUndefined();
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
      // The init event carried no `skills` array, so what the CLI loaded is
      // UNKNOWN rather than empty — the distinction the isolation check rests on.
      loaded: null,
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
    // Count-agnostic since cases may declare their own: the header states the
    // default, and every finding below carries its own denominator.
    expect(report).toMatch(/MISS.+ZERO of a case's runs/);
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

  it("words a declared unmeasured case differently from an unrecorded one", () => {
    const declared = render({
      usable: true,
      baselineRepeats: 3,
      cases: [{ id: "a-case", repeats: 3, isNew: true, isUnmeasured: true, changes: [] }],
      removed: [],
    });
    expect(declared).toContain("awaiting the next re-record");
    expect(declared).not.toContain("new case, not in the baseline");

    const unrecorded = render({
      usable: true,
      baselineRepeats: 3,
      cases: [{ id: "a-case", repeats: 3, isNew: true, isUnmeasured: false, changes: [] }],
      removed: [],
    });
    expect(unrecorded).toContain("new case, not in the baseline");
    expect(unrecorded).not.toContain("awaiting the next re-record");
  });

  it("records the denominators it actually measured against", () => {
    // Without this the emitted document would claim every case ran at the
    // default, and the next delta would compare a 2-repeat tally as though it
    // were a 5-repeat one.
    const mixed = [
      { id: "a-case", repeats: 2, skills: [{ name: "wireframe-design", hits: 2 }] },
      { id: "b-case", repeats: 5, skills: [{ name: "wireframe-design", hits: 5 }] },
    ];
    const emitted = JSON.parse(
      renderBaseline(mixed, {
        model: "claude-opus-5",
        repeats: 5,
        recordedAt: "2026-07-29T14:32:07Z",
      }),
    );
    expect(emitted.caseRepeats).toEqual({ "a-case": 2 });
    expect(emitted.cases).toEqual({
      "a-case": { "wireframe-design": 2 },
      "b-case": { "wireframe-design": 5 },
    });
  });

  it("omits caseRepeats entirely when every case ran at the default", () => {
    const emitted = JSON.parse(
      renderBaseline(tallies, {
        model: "claude-opus-5",
        repeats: 3,
        recordedAt: "2026-07-29T14:32:07Z",
      }),
    );
    expect(emitted).not.toHaveProperty("caseRepeats");
  });

  it("emits no unmeasured key, so a re-record clears the declaration by itself", () => {
    // The property that keeps the relaxation from becoming permanent: a
    // measurement covers every case it ran, so the emitted document has nothing
    // left to declare and nobody has to remember to delete the field.
    const emitted = renderBaseline(tallies, {
      model: "claude-opus-5",
      repeats: 3,
      recordedAt: "2026-07-29T14:32:07Z",
    });
    expect(JSON.parse(emitted)).not.toHaveProperty("unmeasured");
    expect(parseBaseline(emitted, { knownSkills: KNOWN }).unmeasured).toEqual([]);
  });

  it("emits a baseline document keyed by case and skill", () => {
    const emitted = JSON.parse(
      renderBaseline(tallies, {
        model: "claude-opus-5",
        repeats: 3,
        recordedAt: "2026-07-29T14:32:07Z",
      }),
    );
    expect(emitted).toEqual({
      recordedAt: "2026-07-29T14:32:07Z",
      model: "claude-opus-5",
      repeats: 3,
      // Present even when empty, unlike `corpus` and `caseRepeats`. `[]` is a
      // real state — "recorded, and nothing foreign loaded" — that absence
      // cannot express, since a baseline predating the field looks identical.
      foreignSkills: [],
      cases: { "a-case": { "wireframe-design": 1 } },
    });
  });

  it("always writes foreignSkills, so absence can only mean 'not recorded'", () => {
    const clean = JSON.parse(
      renderBaseline(tallies, {
        model: "claude-opus-5",
        repeats: 3,
        recordedAt: "2026-07-29T14:32:07Z",
      }),
    );
    expect(clean.foreignSkills).toEqual([]);

    const contaminated = JSON.parse(
      renderBaseline(tallies, {
        model: "claude-opus-5",
        repeats: 3,
        recordedAt: "2026-07-29T14:32:07Z",
        foreignSkills: ["simplify", "code-review"],
      }),
    );
    expect(contaminated.foreignSkills).toEqual(["code-review", "simplify"]);
  });

  it("emits the corpus record sorted, and parses it straight back", () => {
    // The round trip that --dry-run cannot cover: it exits before any baseline
    // is emitted, so asserting it end-to-end would mean paying for a real run.
    const emitted = renderBaseline(tallies, {
      model: "claude-opus-5",
      repeats: 3,
      recordedAt: "2026-07-29T14:32:07Z",
      corpus: {
        "wireframe-design": "b17c4e2a8d61",
        "high-fidelity-ui-design": "3f2a1c9d0b47",
      },
    });

    expect(Object.keys(JSON.parse(emitted).corpus)).toEqual([
      "high-fidelity-ui-design",
      "wireframe-design",
    ]);
    expect(parseBaseline(emitted, { knownSkills: KNOWN })).toMatchObject({
      recordedAt: "2026-07-29T14:32:07Z",
      corpus: {
        "high-fidelity-ui-design": "3f2a1c9d0b47",
        "wireframe-design": "b17c4e2a8d61",
      },
    });
  });

  it("omits the corpus entirely when the run recorded none", () => {
    const emitted = JSON.parse(
      renderBaseline(tallies, {
        model: "claude-opus-5",
        repeats: 3,
        recordedAt: "2026-07-29T14:32:07Z",
      }),
    );
    expect("corpus" in emitted).toBe(false);
  });
});

describe("dry-run probe budget", () => {
  // Derived, never recorded. The figure this replaced read "a full run measured
  // $2.57" beside a probe count that had grown past the run it was measured on,
  // so the line contradicted itself on every invocation.
  it("derives the total from the probe count and the rate", () => {
    expect(renderProbeBudget(110, 0.026)).toBe(
      "Would spawn 110 one-turn probe(s); ~$0.026 each, so ~$2.86 for this fixture.",
    );
  });

  it("tracks a shorter run rather than staying fixed", () => {
    const line = renderProbeBudget(3, 0.026);
    expect(line).toContain("3 one-turn probe(s)");
    expect(line).toContain("~$0.08 for this fixture");
  });

  it("rounds the total to cents", () => {
    expect(renderProbeBudget(1, 0.026)).toContain("~$0.03 for this fixture");
  });

  it("prints the rate it was given, so the line cannot disagree with itself", () => {
    const line = renderProbeBudget(200, 0.05);
    expect(line).toContain("~$0.05 each");
    expect(line).toContain("~$10.00 for this fixture");
  });
});

describe("corpus notice rendering", () => {
  const fixture = parseFixture(
    fixtureWith({}, { expectAlways: ["professional-behavior"] }),
  );
  const tallies = [tallyCase(fixture.cases[0], runsOf("wireframe-design", "", ""))];

  const render = (corpus, cases) =>
    renderReport({
      fixture,
      tallies,
      delta: { usable: true, baselineRepeats: 3, corpus, cases, removed: [] },
      context: { model: "claude-opus-5", repeats: 3, corpusSize: 22 },
    });

  const movedCase = (unattributable) => [
    {
      id: "a-case",
      repeats: 3,
      isNew: false,
      unattributable,
      changes: [{ skill: "wireframe-design", was: 3, now: 1 }],
    },
  ];

  it("says nothing at all when the corpus matches", () => {
    // A notice on every clean run is a notice skipped on the run that matters.
    const report = render(
      { recorded: true, added: [], removed: [], changed: [], drifted: false },
      movedCase(false),
    );
    expect(report).not.toContain("Corpus drift");
    expect(report).not.toContain("Corpus not recorded");
    expect(report).not.toContain("(unattributable)");
    // The delta itself is still rendered.
    expect(report).toContain("a-case: wireframe-design 3/3 -> 1/3");
  });

  it("states that an older baseline recorded no corpus, and still renders the delta", () => {
    const report = render({ recorded: false, drifted: false }, movedCase(false));
    expect(report).toContain("Corpus not recorded");
    expect(report).toContain("a-case: wireframe-design 3/3 -> 1/3");
    expect(report).not.toContain("(unattributable)");
  });

  it("names all three buckets once and marks the affected comparison", () => {
    const report = render(
      {
        recorded: true,
        added: ["next-app-development"],
        removed: ["a-deleted-skill"],
        changed: ["wireframe-design"],
        drifted: true,
      },
      movedCase(true),
    );

    expect(report).toContain("added         next-app-development");
    expect(report).toContain("removed       a-deleted-skill");
    expect(report).toContain("text-changed  wireframe-design");
    expect(report).toContain("a-case: wireframe-design 3/3 -> 1/3  (unattributable)");
    // Named once at the top, not repeated per case.
    expect(report.match(/next-app-development/g)).toHaveLength(1);
  });

  it("gives an expectAlways skill its own line, because it is tracked everywhere", () => {
    const report = render(
      {
        recorded: true,
        added: [],
        removed: [],
        changed: ["professional-behavior"],
        drifted: true,
      },
      movedCase(true),
    );
    expect(report).toMatch(
      /note\s+professional-behavior is an expectAlways skill, tracked on every case/,
    );
  });

  it("omits that line for a text-changed skill the fixture does not track everywhere", () => {
    const report = render(
      {
        recorded: true,
        added: [],
        removed: [],
        changed: ["wireframe-design"],
        drifted: true,
      },
      movedCase(true),
    );
    expect(report).not.toContain("is an expectAlways skill");
  });
});

describe("negative control — the corpus notice can actually fire", () => {
  // A drift check that silently never triggers is not evidence. These two build
  // a real skill tree on disk and compare a recorded digest map against it: one
  // agreeing, one not. The pair is what proves the check has teeth.
  const fixture = parseFixture(fixtureWith());
  const tallies = [tallyCase(fixture.cases[0], runsOf("wireframe-design", "", ""))];

  const reportFor = async (recorded, current) =>
    renderReport({
      fixture,
      tallies,
      delta: deltaAgainst(
        [{ id: "a-case", repeats: 3, skills: [{ name: "wireframe-design", hits: 1 }] }],
        {
          model: "m",
          repeats: 3,
          corpus: recorded,
          cases: { "a-case": { "wireframe-design": 3 } },
        },
        "m",
        current,
      ),
      context: { model: "m", repeats: 3, corpusSize: 2 },
    });

  it("stays silent against a record that agrees with the tree", async () => {
    const root = await tempDir();
    await writeSkill(root, "alpha-skill");
    await writeSkill(root, "beta-skill");
    const onDisk = await corpusDigest(root);

    const report = await reportFor({ ...onDisk }, onDisk);
    expect(report).not.toContain("Corpus drift");
    expect(report).not.toContain("(unattributable)");
  });

  it("fires against a record that disagrees with the same tree", async () => {
    const root = await tempDir();
    await writeSkill(root, "alpha-skill");
    await writeSkill(root, "beta-skill");
    const onDisk = await corpusDigest(root);

    // One skill reworded since the recording, one added, one since deleted.
    const recorded = {
      ...onDisk,
      "alpha-skill": "000000000000",
      "gone-skill": "111111111111",
    };
    delete recorded["beta-skill"];

    const report = await reportFor(recorded, onDisk);
    expect(report).toContain("Corpus drift");
    expect(report).toContain("added         beta-skill");
    expect(report).toContain("removed       gone-skill");
    expect(report).toContain("text-changed  alpha-skill");
    expect(report).toContain("(unattributable)");
  });
});

describe("reading a skill's invocability", () => {
  /** Wrap a frontmatter body in the block shape a SKILL.md carries. */
  const skill = (line) =>
    [
      "---",
      "name: probe-skill",
      "description: A probe skill for the invocability reader.",
      "when_to_use: Only inside this suite.",
      ...(line === null ? [] : [line]),
      "---",
      "",
      "# Probe",
      "",
    ].join("\n");

  // The whole table, because two separate defects were written into this one
  // predicate before it was specified spelling by spelling: a boolean
  // comparison (`!== false`) against a reader that returns strings, and a
  // value-only test that cannot tell a present-but-empty key from an absent one.
  it.each([
    ["the key absent", null, INVOCABLE],
    ["an explicit true", "user-invocable: true", INVOCABLE],
    ["an explicit false", "user-invocable: false", NOT_INVOCABLE],
    ["a present but EMPTY value", "user-invocable:", UNRECOGNISED],
    ["a quoted value", 'user-invocable: "false"', UNRECOGNISED],
    ["a capitalised value", "user-invocable: FALSE", UNRECOGNISED],
    ["a typo", "user-invocable: fasle", UNRECOGNISED],
  ])("reads %s as %s", (_label, line, expected) => {
    expect(readInvocable(skill(line))).toBe(expected);
  });

  it("reads a present-but-empty key differently from an absent one", () => {
    // Both yield "" from the value reader. Only key PRESENCE separates them,
    // and only the absent case is a well-defined default rather than a parse
    // failure.
    expect(readInvocable(skill(null))).toBe(INVOCABLE);
    expect(readInvocable(skill("user-invocable:"))).toBe(UNRECOGNISED);
  });

  it("treats a file with no frontmatter as unrecognised, not invocable", () => {
    expect(readInvocable("# Just a heading\n")).toBe(UNRECOGNISED);
  });

  it("ignores a user-invocable line in the body, outside the frontmatter", () => {
    // Skill bodies here quote frontmatter inside fenced code blocks — the
    // authoring skill's own references do — so a documentation example must
    // never be read as a declaration.
    const text = [
      "---",
      "name: probe-skill",
      "description: A probe skill.",
      "when_to_use: Only inside this suite.",
      "---",
      "",
      "# Probe",
      "",
      "```yaml",
      "user-invocable: false",
      "```",
      "",
    ].join("\n");
    expect(readInvocable(text)).toBe(INVOCABLE);
  });
});

describe("corpus invocability over a skill root", () => {
  it("maps every skill directory to a state", async () => {
    const root = await tempDir();
    await writeSkill(root, "guideline-skill", {
      frontmatter: { "user-invocable": "false" },
    });
    await writeSkill(root, "entry-point-skill", {
      frontmatter: { "user-invocable": "true" },
    });
    await writeSkill(root, "silent-skill");

    expect(await corpusInvocability(root)).toEqual({
      "guideline-skill": NOT_INVOCABLE,
      "entry-point-skill": INVOCABLE,
      "silent-skill": INVOCABLE,
    });
  });

  it("leaves the discovery digest untouched", async () => {
    // `user-invocable` must never join DISCOVERY_KEYS: discovery does not read
    // it, so folding it into the digest would invalidate every recorded
    // baseline over a value no probe can see.
    const root = await tempDir();
    await writeSkill(root, "alpha-skill", {
      frontmatter: { "user-invocable": "false" },
    });
    const before = await corpusDigest(root);

    await writeSkill(root, "alpha-skill", {
      frontmatter: { "user-invocable": "true" },
    });
    expect(await corpusDigest(root)).toEqual(before);
  });
});

describe("classifying what the CLI loaded", () => {
  const invocability = {
    "guideline-skill": NOT_INVOCABLE,
    "entry-point-skill": INVOCABLE,
    "broken-skill": UNRECOGNISED,
  };

  it("calls an unknown name foreign", () => {
    expect(classifyLoaded(["some-plugin-skill"], invocability)).toEqual({
      own: [],
      colliding: [],
      foreign: ["some-plugin-skill"],
    });
  });

  it("calls one of ours that is legitimately invocable `own`", () => {
    // The state this repository's authoring rules REQUIRE for a workflow
    // entry-point skill. Reporting it foreign would refuse a clean baseline.
    expect(classifyLoaded(["entry-point-skill"], invocability).own).toEqual([
      "entry-point-skill",
    ]);
  });

  it("calls a name shared with a non-invocable skill of ours `colliding`", () => {
    // Our skill cannot BE the loaded one, so something else is wearing its
    // name. This is the case a plain `loaded - corpus` subtraction would have
    // silently dropped.
    expect(classifyLoaded(["guideline-skill"], invocability).colliding).toEqual([
      "guideline-skill",
    ]);
  });

  it("puts an unreadable invocability on the loud side", () => {
    expect(classifyLoaded(["broken-skill"], invocability)).toEqual({
      own: [],
      colliding: ["broken-skill"],
      foreign: [],
    });
  });

  it("de-duplicates and sorts", () => {
    const result = classifyLoaded(["zeta", "alpha", "zeta"], {});
    expect(result.foreign).toEqual(["alpha", "zeta"]);
  });
});

describe("summarising isolation across a run", () => {
  it("unions every probe rather than sampling one", () => {
    const summary = summariseIsolation([["a-skill"], ["b-skill"], ["a-skill"]], {});
    expect(summary).toEqual({
      recorded: true,
      complete: true,
      reported: 3,
      total: 3,
      own: [],
      colliding: [],
      foreign: ["a-skill", "b-skill"],
    });
  });

  it("distinguishes 'reported nothing' from 'reported an empty list'", () => {
    // An older CLI emitting no skills field must never read as a clean run.
    expect(summariseIsolation([null, null], {}).recorded).toBe(false);
    expect(summariseIsolation([[]], {}).recorded).toBe(true);
  });

  it("counts coverage rather than collapsing it to a boolean", () => {
    expect(summariseIsolation([[], [], null], {})).toMatchObject({
      recorded: true,
      complete: false,
      reported: 2,
      total: 3,
    });
    expect(summariseIsolation([[], []], {})).toMatchObject({
      complete: true,
      reported: 2,
      total: 2,
    });
  });

  it("does not call an empty run complete", () => {
    // Zero of zero is vacuous agreement, not confirmation.
    expect(summariseIsolation([], {}).complete).toBe(false);
  });
});

describe("isolation against the real installed corpus", () => {
  // THE TEST A HAND-BUILT MAP CANNOT REPLACE. Every defect written into
  // `readInvocable` — the boolean comparison, and the empty-value conflation —
  // passes straight through a test that hands `classifyLoaded` an invocability
  // map built by hand. Only going through `corpusInvocability` over real
  // SKILL.md text exercises the parser where those errors live.
  it("classifies a real guideline skill's name as colliding, not own", async () => {
    const invocability = await corpusInvocability(
      join(process.cwd(), ".claude", "skills"),
    );
    // `code-review` is the collision that actually occurs: this repository ships
    // one, and the managed environment loads another under the same name.
    expect(invocability["code-review"]).toBe(NOT_INVOCABLE);

    const result = classifyLoaded(["code-review"], invocability);
    expect(result.colliding).toEqual(["code-review"]);
    expect(result.own).toEqual([]);
  });

  it("reads no corpus skill as unrecognised", async () => {
    const invocability = await corpusInvocability(
      join(process.cwd(), ".claude", "skills"),
    );
    expect(unrecognisedInvocability(invocability)).toEqual([]);
  });
});

describe("deciding whether a run may record a baseline", () => {
  it("refuses on foreign and colliding names alike", () => {
    expect(
      contamination({ colliding: ["code-review"], foreign: ["simplify"] }),
    ).toEqual(["code-review", "simplify"]);
  });

  it("never refuses on a skill of ours that is legitimately invocable", () => {
    // `own` is populated exactly when a workflow entry-point skill loads as
    // designed. Refusing there would break recording for a corpus state this
    // repository's own authoring rules require.
    const isolation = summariseIsolation([["entry-point-skill"]], {
      "entry-point-skill": INVOCABLE,
    });
    expect(isolation.own).toEqual(["entry-point-skill"]);
    expect(contamination(isolation)).toEqual([]);
  });

  it("refuses when a foreign skill wears one of our names", () => {
    const isolation = summariseIsolation([["code-review"]], {
      "code-review": NOT_INVOCABLE,
    });
    expect(contamination(isolation)).toEqual(["code-review"]);
  });

  it("refuses when no probe reported what the CLI loaded", () => {
    // THE STATE THAT LOOKS LIKE SUCCESS. `colliding` and `foreign` are both
    // empty here because nothing was ever observed, not because nothing was
    // there — so a check that only counts names emits a document whose
    // `foreignSkills: []` is byte-identical to a verified-clean run, and a
    // reader of the committed baseline can no longer tell the two apart.
    const isolation = summariseIsolation([null, null], {
      "code-review": NOT_INVOCABLE,
    });
    expect(contamination(isolation)).toEqual([]);
    expect(baselineRefusal(isolation)).toMatchObject({ names: [] });
    expect(baselineRefusal(isolation).reason).toMatch(/never checked/);
  });

  it("permits a measured, genuinely clean run", () => {
    expect(baselineRefusal(summariseIsolation([[]], {}))).toBeNull();
  });

  it("refuses a PARTIAL run, however many probes did report", () => {
    // The state that most convincingly fakes success: names are empty and
    // something did report, so both a name count and a "did anything report?"
    // boolean wave it through. One probe out of 145 would otherwise write the
    // same `foreignSkills: []` as 145 agreeing probes — and the unreported
    // probes are exactly the ones that could have carried the contamination.
    const nearlyAll = summariseIsolation([...Array(142).fill([]), null, null, null], {});
    expect(nearlyAll.recorded).toBe(true);
    expect(contamination(nearlyAll)).toEqual([]);
    expect(baselineRefusal(nearlyAll).reason).toMatch(/142 of 145/);

    const barelyAny = summariseIsolation([[], ...Array(144).fill(null)], {});
    expect(baselineRefusal(barelyAny).reason).toMatch(/1 of 145/);
  });

  it("names the offenders when it refuses for contamination", () => {
    const refusal = baselineRefusal(
      summariseIsolation([["simplify", "code-review"]], {
        "code-review": NOT_INVOCABLE,
      }),
    );
    expect(refusal.names).toEqual(["code-review", "simplify"]);
    expect(refusal.reason).toMatch(/did not install/);
  });
});

describe("the runner's published exit-code contract", () => {
  it("documents exit 3 in --help", () => {
    // Adding a third code changes a contract a caller may key on, so the help
    // text and the header comment have to say so.
    const result = runScript(SCRIPTS.discoveryEval, ["--help"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/3 --emit-baseline/);
  });
});

describe("baseline parsing of the foreign-skill record", () => {
  const withForeign = (value) =>
    JSON.stringify({
      recordedAt: "2026-07-29T14:32:07Z",
      model: "claude-opus-5",
      repeats: 5,
      foreignSkills: value,
      cases: { "a-case": { "wireframe-design": 4 } },
    });

  it("accepts a name that is not a skill in this repository", () => {
    // THE POINT OF THE FIELD. A foreign skill is by definition not one of ours,
    // so the knownSkills strictness that makes a rotten tally a hard error would
    // reject exactly this field's legitimate contents.
    const parsed = parseBaseline(withForeign(["simplify", "dataviz"]), {
      knownSkills: KNOWN,
    });
    expect(parsed.foreignSkills).toEqual(["simplify", "dataviz"]);
  });

  it("accepts an empty list as a recorded clean run", () => {
    expect(parseBaseline(withForeign([]), { knownSkills: KNOWN }).foreignSkills).toEqual(
      [],
    );
  });

  it("reports absence as not recorded, distinct from clean", () => {
    const parsed = parseBaseline(
      JSON.stringify({
        recordedAt: "2026-07-29T14:32:07Z",
        model: "claude-opus-5",
        repeats: 5,
        cases: {},
      }),
    );
    expect(parsed.foreignSkills).toBeNull();
  });

  it("rejects a malformed entry", () => {
    expect(() => parseBaseline(withForeign(["Not A Skill"]))).toThrow(
      /not a kebab-case skill name/,
    );
    expect(() => parseBaseline(withForeign("simplify"))).toThrow(
      /must be an array of skill names/,
    );
    expect(() => parseBaseline(withForeign(["simplify", "simplify"]))).toThrow(
      /lists "simplify" twice/,
    );
  });

  it("round-trips through the emitted document", () => {
    const emitted = renderBaseline(
      [{ id: "a-case", repeats: 5, skills: [{ name: "wireframe-design", hits: 4 }] }],
      {
        model: "claude-opus-5",
        repeats: 5,
        recordedAt: "2026-07-29T14:32:07Z",
        foreignSkills: ["simplify"],
      },
    );
    expect(parseBaseline(emitted, { knownSkills: KNOWN }).foreignSkills).toEqual([
      "simplify",
    ]);
  });
});

describe("reporting what a run could not isolate", () => {
  const fixture = parseFixture(fixtureWith(), { knownSkills: KNOWN });
  const tallies = [tallyCase(fixture.cases[0], runsOf("wireframe-design"), [])];

  const reportWith = (isolation, unrecognised = []) =>
    renderReport({
      fixture,
      tallies,
      delta: { usable: false, reason: "no baseline recorded" },
      context: {
        model: "claude-opus-5",
        repeats: 1,
        corpusSize: 25,
        isolation,
        unrecognisedInvocability: unrecognised,
      },
    });

  it("always prints a count, so a clean run is visibly clean", () => {
    // Unlike the corpus notice, which is silent when clean. Here an absent line
    // would be indistinguishable from a runner too old to look.
    const report = reportWith({ recorded: true, own: [], colliding: [], foreign: [] });
    expect(report).toMatch(/foreign skills\s+0 \(user-invocable only\)/);
    expect(report).not.toContain("could not isolate");
  });

  it("says 'unknown' rather than 0 when the CLI reported no list", () => {
    const report = reportWith({ recorded: false, own: [], colliding: [], foreign: [] });
    expect(report).toContain("unknown (CLI reported no skill list)");
  });

  it("names the skills, collisions first", () => {
    const report = reportWith({
      recorded: true,
      own: [],
      colliding: ["code-review"],
      foreign: ["simplify"],
    });
    expect(report).toContain("Skills the run could not isolate");
    expect(report).toContain("colliding with a skill of ours (1)");
    expect(report.indexOf("code-review")).toBeLessThan(report.indexOf("simplify"));
  });

  it("explains a collision caused by an unreadable field of ours", () => {
    const report = reportWith(
      { recorded: true, own: [], colliding: ["odd-skill"], foreign: [] },
      ["odd-skill"],
    );
    expect(report).toMatch(/could not read/);
    expect(report).toContain("odd-skill");
  });
});
