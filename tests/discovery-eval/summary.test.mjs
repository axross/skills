// the derived layer: per-probe summaries, the two comparability scopes, the
// MISS/SPURIOUS/coverage verdicts, and the delta against a comparable
// predecessor.

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { canonicalJson } from "../../tools/discovery-eval/src/layout.mjs";
import {
  comparabilityOf,
  deriveCaseSummary,
  deriveDelta,
  deriveProbeSummary,
  findComparablePredecessor,
  readProbe,
  runComparabilityChecks,
  tallyVerdicts,
  trackedSkillsOf,
  verdictFor,
} from "../../tools/discovery-eval/src/summary.mjs";

const line = (event) => JSON.stringify(event);

const testCase = {
  id: "invalidate-a-stale-list-after-a-write",
  prompt: "Saving a draft leaves the title and timestamp on the post list stale.",
  mock: "inkwell",
  population: "discovered",
  mustInclude: ["tanstack-query-development"],
  mustExclude: ["next-app-development"],
  mayInclude: [],
  rationale: "because.",
};

function aConfiguration(overrides = {}) {
  return {
    runtime: {
      name: "claude-code",
      version: "2.1.220",
      options: {
        maxTurns: 40,
        settingSources: ["project"],
        allowedTools: ["Read", "Glob", "Grep", "Skill"],
        disallowedTools: ["Agent", "Bash", "Edit", "NotebookEdit", "Task", "TodoWrite", "WebFetch", "WebSearch", "Write"],
      },
    },
    model: { provider: "anthropic", model: "claude-sonnet-5", options: {} },
    workspace: { mode: "situated", mock: "inkwell", tree: "sha256:tree" },
    skills: { "tanstack-query-development": "sha256:aaa", "next-app-development": "sha256:bbb" },
    invocability: {},
    case: testCase,
    ...overrides,
  };
}

const transcriptSelecting = (skill, { turns = 3, cost = 0.3, model = "claude-sonnet-5" } = {}) =>
  [
    line({ type: "system", subtype: "init", model, version: "2.1.220", skills: [] }),
    line({
      type: "assistant",
      message: { content: [{ type: "tool_use", name: "Read", input: { file_path: "src/x.ts" } }] },
    }),
    line({
      type: "assistant",
      message: { content: [{ type: "tool_use", name: "Skill", input: { skill } }] },
    }),
    line({ type: "result", subtype: "success", num_turns: turns, total_cost_usd: cost }),
  ].join("\n") + "\n";

const transcriptTruncated = () =>
  [
    line({ type: "system", subtype: "init", model: "claude-sonnet-5", skills: [] }),
    line({ type: "result", subtype: "error_max_turns", num_turns: 40, total_cost_usd: 1.1 }),
  ].join("\n") + "\n";

let caseDir;
beforeEach(async () => {
  caseDir = await mkdtemp(join(tmpdir(), "discovery-case-measurement-"));
});
afterEach(async () => {
  await rm(caseDir, { recursive: true, force: true });
});

async function writeProbe(name, { configuration = {}, transcript, timestamp = "2026-08-09T00:00:00Z" } = {}) {
  const directory = join(caseDir, name);
  await mkdir(directory, { recursive: true });
  const full = aConfiguration(configuration);
  await writeFile(
    join(directory, "metadata.json"),
    canonicalJson({ timestamp, configuration: full }),
    "utf8",
  );
  await writeFile(
    join(directory, "transcript.jsonl"),
    transcript ?? transcriptSelecting("tanstack-query-development"),
    "utf8",
  );
}

describe("readProbe", () => {
  it("reads a probe's declared and measured files", async () => {
    await writeProbe("probe-aaaaaaaa");
    const probe = await readProbe(join(caseDir, "probe-aaaaaaaa"), "probe-aaaaaaaa");
    expect(probe.metadata.configuration.case.id).toBe(testCase.id);
    expect(probe.transcriptText).toContain("tanstack-query-development");
  });

  it("refuses a directory that does not name a probe", async () => {
    await writeProbe("probe-aaaaaaaa");
    await expect(readProbe(join(caseDir, "probe-aaaaaaaa"), "not-a-probe")).rejects.toThrow(
      /does not name a probe/,
    );
  });

  it("refuses invalid JSON metadata", async () => {
    const directory = join(caseDir, "probe-bbbbbbbb");
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "metadata.json"), "{not json", "utf8");
    await writeFile(join(directory, "transcript.jsonl"), "", "utf8");
    await expect(readProbe(directory, "probe-bbbbbbbb")).rejects.toThrow(/not valid JSON/);
  });
});

describe("deriveProbeSummary", () => {
  it("derives turns, terminal reason, paths, selection and cost from the transcript", async () => {
    await writeProbe("probe-aaaaaaaa");
    const summary = deriveProbeSummary(
      await readProbe(join(caseDir, "probe-aaaaaaaa"), "probe-aaaaaaaa"),
    );
    expect(summary.turns).toBe(3);
    expect(summary.terminalReason).toBe("success");
    expect(summary.readable).toBe(true);
    expect(summary.pathsBeforeSelection).toEqual([{ tool: "Read", target: "src/x.ts" }]);
    expect(summary.selectedSkills).toEqual(["tanstack-query-development"]);
    expect(summary.costUsd).toBe(0.3);
    expect(summary.mode).toBe("situated");
  });

  it("marks an error_max_turns probe unreadable with a null selection", async () => {
    await writeProbe("probe-aaaaaaaa", { transcript: transcriptTruncated() });
    const summary = deriveProbeSummary(
      await readProbe(join(caseDir, "probe-aaaaaaaa"), "probe-aaaaaaaa"),
    );
    expect(summary.readable).toBe(false);
    expect(summary.selectedSkills).toBeNull();
  });

  it("fails when the transcript contradicts the declared model", async () => {
    await writeProbe("probe-aaaaaaaa", {
      transcript: transcriptSelecting("tanstack-query-development", { model: "some-other-model" }),
    });
    const probe = await readProbe(join(caseDir, "probe-aaaaaaaa"), "probe-aaaaaaaa");
    expect(() => deriveProbeSummary(probe)).toThrow(/declared model .* but the transcript reports/);
  });

  it("does not fail when the transcript is merely silent about the model", async () => {
    await writeProbe("probe-aaaaaaaa", {
      transcript: `${line({ type: "result", subtype: "success", num_turns: 1 })}\n`,
    });
    const probe = await readProbe(join(caseDir, "probe-aaaaaaaa"), "probe-aaaaaaaa");
    expect(() => deriveProbeSummary(probe)).not.toThrow();
  });

  it("classifies loadedSkills against the declared invocability map", async () => {
    await writeProbe("probe-aaaaaaaa", {
      configuration: { invocability: { "some-foreign-skill": undefined } },
      transcript: [
        line({
          type: "system",
          subtype: "init",
          model: "claude-sonnet-5",
          skills: ["some-foreign-skill"],
        }),
        line({ type: "result", subtype: "success", num_turns: 1, total_cost_usd: 0.1 }),
      ].join("\n"),
    });
    const summary = deriveProbeSummary(
      await readProbe(join(caseDir, "probe-aaaaaaaa"), "probe-aaaaaaaa"),
    );
    expect(summary.isolation.foreign).toEqual(["some-foreign-skill"]);
  });

  it("leaves isolation null when the transcript never reported a loaded list", async () => {
    await writeProbe("probe-aaaaaaaa", {
      transcript: `${line({ type: "result", subtype: "success", num_turns: 1 })}\n`,
    });
    const summary = deriveProbeSummary(
      await readProbe(join(caseDir, "probe-aaaaaaaa"), "probe-aaaaaaaa"),
    );
    expect(summary.isolation).toBeNull();
  });
});

describe("runComparabilityChecks — within one measurement", () => {
  const pairOf = async (overrideB = {}) => {
    await writeProbe("probe-aaaaaaaa");
    await writeProbe("probe-bbbbbbbb", { configuration: overrideB });
    const probes = [
      await readProbe(join(caseDir, "probe-aaaaaaaa"), "probe-aaaaaaaa"),
      await readProbe(join(caseDir, "probe-bbbbbbbb"), "probe-bbbbbbbb"),
    ];
    return { probes, derived: probes.map(deriveProbeSummary) };
  };

  it("passes a well-formed pair", async () => {
    const { probes, derived } = await pairOf();
    const checks = runComparabilityChecks(probes, derived, null);
    expect(checks.every((check) => check.passed)).toBe(true);
  });

  it("fails and names a prompt disagreement", async () => {
    const { probes, derived } = await pairOf({ case: { ...testCase, prompt: "a different prompt" } });
    const checks = runComparabilityChecks(probes, derived, null);
    expect(checks.find((check) => check.check === "one prompt").passed).toBe(false);
  });

  it("fails and names a model disagreement", async () => {
    await writeProbe("probe-aaaaaaaa");
    await writeProbe("probe-bbbbbbbb", {
      configuration: { model: { provider: "anthropic", model: "claude-opus-5", options: {} } },
      // the transcript must agree with what it declares, or deriveProbeSummary
      // itself refuses (a different, earlier check) before comparability ever runs.
      transcript: transcriptSelecting("tanstack-query-development", { model: "claude-opus-5" }),
    });
    const probes = [
      await readProbe(join(caseDir, "probe-aaaaaaaa"), "probe-aaaaaaaa"),
      await readProbe(join(caseDir, "probe-bbbbbbbb"), "probe-bbbbbbbb"),
    ];
    const derived = probes.map(deriveProbeSummary);
    const checks = runComparabilityChecks(probes, derived, null);
    const failed = checks.find((check) => check.check === "one model");
    expect(failed.passed).toBe(false);
    expect(failed.detail).toMatch(/claude-sonnet-5.*claude-opus-5/s);
  });

  it("fails and names a project-tree disagreement", async () => {
    const { probes, derived } = await pairOf({ workspace: { mode: "situated", mock: "inkwell", tree: "sha256:other" } });
    const checks = runComparabilityChecks(probes, derived, null);
    expect(checks.find((check) => check.check === "one project tree").passed).toBe(false);
  });

  it("fails and names a probe-mode disagreement", async () => {
    const { probes, derived } = await pairOf({ workspace: { mode: "bare", mock: null, tree: null } });
    const checks = runComparabilityChecks(probes, derived, null);
    expect(checks.find((check) => check.check === "one probe mode").passed).toBe(false);
  });

  it("fails when the corpus digest map differs", async () => {
    const { probes, derived } = await pairOf({ skills: { "unit-testing": "sha256:EDITED" } });
    const checks = runComparabilityChecks(probes, derived, null);
    expect(checks.find((check) => check.check === "one corpus digest").passed).toBe(false);
  });

  it("fails when the loaded skill set differs between probes", async () => {
    await writeProbe("probe-aaaaaaaa");
    await writeProbe("probe-bbbbbbbb", {
      transcript: [
        line({ type: "system", subtype: "init", model: "claude-sonnet-5", skills: ["injected"] }),
        line({
          type: "assistant",
          message: {
            content: [{ type: "tool_use", name: "Skill", input: { skill: "tanstack-query-development" } }],
          },
        }),
        line({ type: "result", subtype: "success", num_turns: 2, total_cost_usd: 0.2 }),
      ].join("\n"),
    });
    const probes = [
      await readProbe(join(caseDir, "probe-aaaaaaaa"), "probe-aaaaaaaa"),
      await readProbe(join(caseDir, "probe-bbbbbbbb"), "probe-bbbbbbbb"),
    ];
    const derived = probes.map(deriveProbeSummary);
    const checks = runComparabilityChecks(probes, derived, null);
    expect(checks.find((check) => check.check === "one loaded skill set").passed).toBe(false);
  });

  it("fails when the probe count does not match the declared repeats", async () => {
    const { probes, derived } = await pairOf();
    const checks = runComparabilityChecks(probes, derived, 5);
    const failed = checks.find((check) => check.check === "declared repeat count");
    expect(failed.passed).toBe(false);
    expect(failed.detail).toMatch(/declares 5 repeat\(s\).*but 2/);
  });

  it("does not check the repeat count when none is declared", async () => {
    const { probes, derived } = await pairOf();
    const checks = runComparabilityChecks(probes, derived, null);
    expect(checks.some((check) => check.check === "declared repeat count")).toBe(false);
  });
});

describe("comparabilityOf", () => {
  it("names every failing check's detail", () => {
    const summary = {
      checks: [
        { check: "one model", passed: false, detail: "disagree" },
        { check: "one prompt", passed: true, detail: "same" },
      ],
    };
    expect(comparabilityOf(summary)).toEqual({ comparable: false, failures: ["one model: disagree"] });
  });

  it("is comparable when every check passed", () => {
    expect(comparabilityOf({ checks: [{ check: "x", passed: true, detail: "" }] })).toEqual({
      comparable: true,
      failures: [],
    });
  });
});

describe("verdictFor — carried over unchanged from the replaced instrument", () => {
  it("MISS at zero hits for a mustInclude skill", () => {
    expect(verdictFor("mustInclude", 0, 2)).toBe("miss");
  });

  it("is never a MISS once selected even a single time, however low the rate — zero is the only miss condition", () => {
    expect(verdictFor("mustInclude", 1, 5)).not.toBe("miss");
  });

  it("is weak at or below half the rate", () => {
    expect(verdictFor("mustInclude", 1, 5)).toBe("weak"); // 20%
    expect(verdictFor("mustInclude", 1, 2)).toBe("weak"); // exactly half — not ABOVE it
  });

  it("is clear once the rate clears half", () => {
    expect(verdictFor("mustInclude", 3, 4)).toBe("clear"); // 75%
  });

  it("mustExclude is clear at zero hits", () => {
    expect(verdictFor("mustExclude", 0, 2)).toBe("clear");
  });

  it("mustExclude is occasional below half — one stray selection is never a defect", () => {
    expect(verdictFor("mustExclude", 1, 2)).toBe("occasional");
  });

  it("mustExclude is SPURIOUS above half", () => {
    expect(verdictFor("mustExclude", 3, 4)).toBe("spurious");
  });

  it("mayInclude is always optional", () => {
    expect(verdictFor("mayInclude", 0, 2)).toBe("optional");
    expect(verdictFor("mayInclude", 2, 2)).toBe("optional");
  });

  it("an unlabelled skill is reported but never a finding", () => {
    expect(verdictFor(null, 1, 2)).toBe("unlabelled");
  });
});

describe("trackedSkillsOf", () => {
  it("is the union of mustInclude and mustExclude, never mayInclude", () => {
    expect(
      trackedSkillsOf({ mustInclude: ["a"], mustExclude: ["b"], mayInclude: ["c"] }),
    ).toEqual(["a", "b"]);
  });
});

describe("tallyVerdicts", () => {
  it("counts hits only among the readable selections handed to it", () => {
    const tally = tallyVerdicts(testCase, [
      ["tanstack-query-development"],
      ["tanstack-query-development", "next-app-development"],
    ]);
    expect(tally.repeats).toBe(2);
    const must = tally.skills.find((skill) => skill.name === "tanstack-query-development");
    expect(must).toMatchObject({ hits: 2, verdict: "clear" });
    const excl = tally.skills.find((skill) => skill.name === "next-app-development");
    expect(excl).toMatchObject({ hits: 1, verdict: "occasional" });
  });

  it("reports a MISS finding when mustInclude is never selected", () => {
    const tally = tallyVerdicts(testCase, [[], []]);
    expect(tally.findings).toEqual([
      { kind: "miss", skill: "tanstack-query-development", hits: 0, repeats: 2 },
    ]);
  });

  it("has no coverage line with fewer than two mustInclude skills", () => {
    expect(tallyVerdicts(testCase, [["tanstack-query-development"]]).coverage).toBeNull();
  });

  it("computes coverage across repeats when two or more mustInclude skills compete", () => {
    const twoWay = { ...testCase, mustInclude: ["a", "b"] };
    const tally = tallyVerdicts(twoWay, [["a"], ["b"], []]);
    expect(tally.coverage).toEqual({ covered: 2, repeats: 3, skills: ["a", "b"] });
  });
});

describe("deriveCaseSummary — end to end over real files", () => {
  it("excludes an unreadable probe from the verdict's denominator entirely", async () => {
    await writeProbe("probe-aaaaaaaa", { transcript: transcriptSelecting("tanstack-query-development") });
    await writeProbe("probe-bbbbbbbb", { transcript: transcriptTruncated() });

    const summary = await deriveCaseSummary(caseDir, { measurementName: "x-aaaaaaaa" });
    expect(summary.probeCount).toBe(2);
    expect(summary.readableCount).toBe(1);
    // the truncated probe must not be folded in as a zero-hit repeat: at 1
    // readable repeat with 1 hit the rate is 100%, not 50%.
    const must = summary.verdict.skills.find((skill) => skill.name === "tanstack-query-development");
    expect(must.hits).toBe(1);
    expect(summary.verdict.repeats).toBe(1);
  });

  it("is a pure function of the files, so two derivations agree byte for byte", async () => {
    await writeProbe("probe-aaaaaaaa");
    await writeProbe("probe-bbbbbbbb");
    const options = { measurementName: "x-aaaaaaaa", declaredRepeats: 2 };
    expect(canonicalJson(await deriveCaseSummary(caseDir, options))).toBe(
      canonicalJson(await deriveCaseSummary(caseDir, options)),
    );
  });

  it("totals the probes' own reported costs", async () => {
    await writeProbe("probe-aaaaaaaa", { transcript: transcriptSelecting("tanstack-query-development", { cost: 0.2 }) });
    await writeProbe("probe-bbbbbbbb", { transcript: transcriptSelecting("tanstack-query-development", { cost: 0.4 }) });
    expect((await deriveCaseSummary(caseDir)).totalCostUsd).toBeCloseTo(0.6);
  });

  it("refuses a directory holding no probes", async () => {
    await expect(deriveCaseSummary(caseDir)).rejects.toThrow(/holds no probe directories/);
  });

  it("carries the case, workspace, model, runtime and skills lifted from the first probe", async () => {
    await writeProbe("probe-aaaaaaaa");
    const summary = await deriveCaseSummary(caseDir);
    expect(summary.case.id).toBe(testCase.id);
    expect(summary.workspace).toEqual({ mode: "situated", mock: "inkwell", tree: "sha256:tree" });
  });

  it("takes the latest probe timestamp as the measurement's own", async () => {
    await writeProbe("probe-aaaaaaaa", { timestamp: "2026-08-01T00:00:00Z" });
    await writeProbe("probe-bbbbbbbb", { timestamp: "2026-08-05T00:00:00Z" });
    expect((await deriveCaseSummary(caseDir)).timestamp).toBe("2026-08-05T00:00:00Z");
  });
});

describe("findComparablePredecessor — comparability's second scope", () => {
  const summaryAt = (timestamp, overrides = {}) => ({
    measurement: `${testCase.id}-${timestamp}`,
    timestamp,
    case: testCase,
    model: { provider: "anthropic", model: "claude-sonnet-5", options: {} },
    workspace: { mode: "situated", mock: "inkwell", tree: "sha256:tree" },
    skills: { "tanstack-query-development": "sha256:aaa", "next-app-development": "sha256:bbb" },
    verdict: tallyVerdicts(testCase, [["tanstack-query-development"]]),
    ...overrides,
  });

  it("names the condition that failed when there is no prior measurement at all", () => {
    const result = findComparablePredecessor(summaryAt("2026-08-09"), [], trackedSkillsOf(testCase));
    expect(result.usable).toBe(false);
    expect(result.reason).toMatch(/no prior measurement of this case exists yet/);
  });

  it("picks the most recent comparable predecessor over an older one", () => {
    const older = summaryAt("2026-08-01");
    const newer = summaryAt("2026-08-05");
    const current = summaryAt("2026-08-09");
    const result = findComparablePredecessor(current, [older, newer], trackedSkillsOf(testCase));
    expect(result.usable).toBe(true);
    expect(result.predecessor.measurement).toBe(newer.measurement);
  });

  it("never picks a sibling timestamped AFTER current — a predecessor is looked back to, not forward", () => {
    // the earliest measurement of a case has a sibling, but that sibling
    // came later — this is the bug a naive "sort every sibling by recency"
    // implementation has: it would pick the later one as this one's own
    // predecessor.
    const earliest = summaryAt("2026-08-01");
    const later = summaryAt("2026-08-09");
    const result = findComparablePredecessor(earliest, [later], trackedSkillsOf(testCase));
    expect(result.usable).toBe(false);
    expect(result.reason).toBe("no measurement of this case is timestamped earlier than this one");
  });

  it("skips an incomparable recent prior for an older comparable one", () => {
    const incomparableRecent = summaryAt("2026-08-08", {
      model: { provider: "anthropic", model: "claude-opus-5", options: {} },
    });
    const comparableOlder = summaryAt("2026-08-01");
    const current = summaryAt("2026-08-09");
    const result = findComparablePredecessor(
      current,
      [incomparableRecent, comparableOlder],
      trackedSkillsOf(testCase),
    );
    expect(result.usable).toBe(true);
    expect(result.predecessor.measurement).toBe(comparableOlder.measurement);
  });

  it("names the closest miss's specific mismatch when nothing is comparable", () => {
    const prior = summaryAt("2026-08-01", { workspace: { mode: "situated", mock: "inkwell", tree: "sha256:different" } });
    const current = summaryAt("2026-08-09");
    const result = findComparablePredecessor(current, [prior], trackedSkillsOf(testCase));
    expect(result.usable).toBe(false);
    expect(result.reason).toMatch(/is not comparable: project tree differs/);
  });

  it("ignores a description-digest change on a skill this case does not track", () => {
    const prior = summaryAt("2026-08-01", {
      skills: { "tanstack-query-development": "sha256:aaa", "next-app-development": "sha256:bbb", "zod-schema": "sha256:UNRELATED" },
    });
    const current = summaryAt("2026-08-09", {
      skills: { "tanstack-query-development": "sha256:aaa", "next-app-development": "sha256:bbb", "zod-schema": "sha256:CHANGED" },
    });
    const result = findComparablePredecessor(current, [prior], trackedSkillsOf(testCase));
    expect(result.usable).toBe(true);
  });

  it("is sensitive to a description-digest change on a tracked skill", () => {
    const prior = summaryAt("2026-08-01");
    const current = summaryAt("2026-08-09", {
      skills: { "tanstack-query-development": "sha256:EDITED", "next-app-development": "sha256:bbb" },
    });
    const result = findComparablePredecessor(current, [prior], trackedSkillsOf(testCase));
    expect(result.usable).toBe(false);
    expect(result.reason).toMatch(/description digest differs for tracked skill\(s\): tanstack-query-development/);
  });
});

describe("deriveDelta", () => {
  const summaryAt = (timestamp, verdictHits, overrides = {}) => ({
    measurement: `${testCase.id}-${timestamp}`,
    timestamp,
    case: testCase,
    model: { provider: "anthropic", model: "claude-sonnet-5", options: {} },
    workspace: { mode: "situated", mock: "inkwell", tree: "sha256:tree" },
    skills: { "tanstack-query-development": "sha256:aaa", "next-app-development": "sha256:bbb" },
    verdict: tallyVerdicts(testCase, verdictHits),
    ...overrides,
  });

  it("reports usable: false with a reason when no comparable predecessor exists", () => {
    const current = summaryAt("2026-08-09", [["tanstack-query-development"]]);
    const delta = deriveDelta(current, []);
    expect(delta.usable).toBe(false);
    expect(delta.reason).toMatch(/no prior measurement/);
  });

  it("reports which skills' rates changed against the comparable predecessor", () => {
    const prior = summaryAt("2026-08-01", [[], []]); // 0/2 for tanstack, 0/2 for next
    const current = summaryAt("2026-08-09", [
      ["tanstack-query-development"],
      ["tanstack-query-development"],
    ]); // 2/2 now
    const delta = deriveDelta(current, [prior]);
    expect(delta.usable).toBe(true);
    expect(delta.predecessor).toBe(prior.measurement);
    const changed = delta.changes.find((change) => change.skill === "tanstack-query-development");
    expect(changed).toMatchObject({ now: 2, nowRepeats: 2, was: 0, wasRepeats: 2 });
  });

  it("reports no changes when the predecessor's rates match exactly", () => {
    const prior = summaryAt("2026-08-01", [["tanstack-query-development"], []]);
    const current = summaryAt("2026-08-09", [["tanstack-query-development"], []]);
    const delta = deriveDelta(current, [prior]);
    expect(delta.usable).toBe(true);
    expect(delta.changes).toEqual([]);
  });

  it("compares rates rather than raw hits, so a different repeat count does not read as a doubling", () => {
    const prior = summaryAt("2026-08-01", [["tanstack-query-development"]]); // 1/1 = 100%
    const current = summaryAt("2026-08-09", [
      ["tanstack-query-development"],
      ["tanstack-query-development"],
    ]); // 2/2 = 100%, same rate
    const delta = deriveDelta(current, [prior]);
    expect(delta.changes).toEqual([]);
  });
});
