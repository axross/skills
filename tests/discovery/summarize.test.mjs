// summarize.mjs driven as a real child process against a hand-built data
// root — no test here spawns the CLI or reaches the network; every
// measurement below is a hand-written metadata.json/transcript.jsonl pair.

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { canonicalJson } from "../../tools/evaluation/src/layout.mjs";
import { runScript, SCRIPTS } from "../helpers/run.mjs";

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

const transcriptSelecting = (skill) =>
  [
    line({ type: "system", subtype: "init", model: "claude-sonnet-5", skills: [] }),
    line({
      type: "assistant",
      message: { content: [{ type: "tool_use", name: "Skill", input: { skill } }] },
    }),
    line({ type: "result", subtype: "success", num_turns: 2, total_cost_usd: 0.3 }),
  ].join("\n") + "\n";

let root;
async function writeMeasurement(measurementName, probes) {
  const caseDir = join(root, "measurements", measurementName);
  for (const [probeName, { configuration = {}, transcript, timestamp = "2026-08-05T00:00:00Z" }] of Object.entries(
    probes,
  )) {
    const directory = join(caseDir, probeName);
    await mkdir(directory, { recursive: true });
    await writeFile(
      join(directory, "metadata.json"),
      canonicalJson({ timestamp, configuration: aConfiguration(configuration) }),
      "utf8",
    );
    await writeFile(
      join(directory, "transcript.jsonl"),
      transcript ?? transcriptSelecting("tanstack-query-development"),
      "utf8",
    );
  }
}

afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
  root = undefined;
});

const summarize = (args) => runScript(SCRIPTS.discoveryEvalSummarize, ["--root", root, ...args]);

describe("--help", () => {
  it("prints usage and exits 0", () => {
    const result = runScript(SCRIPTS.discoveryEvalSummarize, ["--help"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/Usage: summarize\.mjs/);
  });
});

describe("against an empty data root", () => {
  it("derives the empty-but-valid document", async () => {
    root = await mkdtemp(join(tmpdir(), "discovery-summarize-empty-"));
    await mkdir(join(root, "measurements"), { recursive: true });
    const result = summarize([]);
    expect(result.code, result.output).toBe(0);
    expect(JSON.parse(await readFile(join(root, "summary.json"), "utf8"))).toEqual({
      measurementCount: 0,
      comparableCount: 0,
      measurements: [],
    });
  });

  it("--check passes against the shipped empty document", async () => {
    root = await mkdtemp(join(tmpdir(), "discovery-summarize-empty-"));
    await mkdir(join(root, "measurements"), { recursive: true });
    await writeFile(
      join(root, "summary.json"),
      canonicalJson({ measurementCount: 0, comparableCount: 0, measurements: [] }),
      "utf8",
    );
    expect(summarize(["--check"]).code).toBe(0);
  });

  it("handles a data root with no measurements/ directory at all the same way", async () => {
    root = await mkdtemp(join(tmpdir(), "discovery-summarize-missing-"));
    const result = summarize([]);
    expect(result.code, result.output).toBe(0);
    expect(JSON.parse(await readFile(join(root, "summary.json"), "utf8")).measurementCount).toBe(0);
  });
});

describe("a comparable single measurement", () => {
  it("writes a comparable case summary.json and reports it in the root summary", async () => {
    root = await mkdtemp(join(tmpdir(), "discovery-summarize-one-"));
    await writeMeasurement(`${testCase.id}-aaaaaaaa`, {
      "probe-11111111": {},
      "probe-22222222": {},
    });
    const result = summarize([]);
    expect(result.code, result.output).toBe(0);
    expect(result.stdout).toMatch(/^ok {6}/m);

    const caseSummary = JSON.parse(
      await readFile(join(root, "measurements", `${testCase.id}-aaaaaaaa`, "summary.json"), "utf8"),
    );
    expect(caseSummary.comparable).toBe(true);
    expect(caseSummary.probeCount).toBe(2);
    expect(caseSummary.delta).toEqual({ usable: false, reason: "no prior measurement of this case exists yet" });

    const rootSummary = JSON.parse(await readFile(join(root, "summary.json"), "utf8"));
    expect(rootSummary.measurementCount).toBe(1);
    expect(rootSummary.comparableCount).toBe(1);
    expect(rootSummary.measurements[0].case).toBe(testCase.id);
  });

  it("reproduces its summary.json byte for byte on a second run", async () => {
    root = await mkdtemp(join(tmpdir(), "discovery-summarize-repro-"));
    await writeMeasurement(`${testCase.id}-aaaaaaaa`, { "probe-11111111": {} });
    summarize([]);
    const first = await readFile(join(root, "measurements", `${testCase.id}-aaaaaaaa`, "summary.json"), "utf8");
    const firstRoot = await readFile(join(root, "summary.json"), "utf8");

    await rm(join(root, "summary.json"));
    await rm(join(root, "measurements", `${testCase.id}-aaaaaaaa`, "summary.json"));
    summarize([]);

    expect(await readFile(join(root, "measurements", `${testCase.id}-aaaaaaaa`, "summary.json"), "utf8")).toBe(first);
    expect(await readFile(join(root, "summary.json"), "utf8")).toBe(firstRoot);
    expect(summarize(["--check"]).code).toBe(0);
  });
});

describe("a comparability failure within one measurement", () => {
  it("exits 4 and names the disagreement, and fails --check with the same name", async () => {
    root = await mkdtemp(join(tmpdir(), "discovery-summarize-incomparable-"));
    await writeMeasurement(`${testCase.id}-bbbbbbbb`, {
      "probe-11111111": {},
      "probe-22222222": {
        // a workspace-tree disagreement, rather than a model one: the model a
        // transcript reports is cross-checked against what was declared
        // (deriveProbeSummary's own, earlier refusal), so a model mismatch
        // here would be caught before comparability ever runs.
        configuration: { workspace: { mode: "situated", mock: "inkwell", tree: "sha256:other" } },
      },
    });
    const result = summarize([]);
    expect(result.code).toBe(4);
    expect(result.output).toMatch(/one project tree/);

    // --check re-derives and finds the SAME comparability failure — it is a
    // finding about the measurement, not something --check alone silences.
    // exit 4 here, not 5: the written bytes match what re-derives, so there
    // is no DRIFT, only the standing incomparability.
    const check = summarize(["--check"]);
    expect(check.code).toBe(4);
    expect(check.output).toMatch(/one project tree/);
  });
});

describe("the drift check", () => {
  it("fails when a committed summary.json is hand-edited", async () => {
    root = await mkdtemp(join(tmpdir(), "discovery-summarize-drift-"));
    await writeMeasurement(`${testCase.id}-cccccccc`, { "probe-11111111": {} });
    summarize([]);
    const summaryPath = join(root, "measurements", `${testCase.id}-cccccccc`, "summary.json");
    const tampered = JSON.parse(await readFile(summaryPath, "utf8"));
    tampered.totalCostUsd = 999;
    await writeFile(summaryPath, canonicalJson(tampered), "utf8");

    const result = summarize(["--check"]);
    expect(result.code).toBe(5);
    expect(result.output).toMatch(/drifted/);
  });
});

describe("the delta across two measurements of the same case", () => {
  it("picks the comparable predecessor and reports the rate change", async () => {
    root = await mkdtemp(join(tmpdir(), "discovery-summarize-delta-"));
    await writeMeasurement(`${testCase.id}-11111111`, {
      "probe-aaaaaaaa": { timestamp: "2026-08-01T00:00:00Z", transcript: transcriptSelecting("something-else") },
      "probe-bbbbbbbb": { timestamp: "2026-08-01T00:00:01Z", transcript: transcriptSelecting("something-else") },
    });
    await writeMeasurement(`${testCase.id}-22222222`, {
      "probe-cccccccc": { timestamp: "2026-08-05T00:00:00Z" },
      "probe-dddddddd": { timestamp: "2026-08-05T00:00:01Z" },
    });

    const result = summarize([]);
    expect(result.code, result.output).toBe(0);

    const later = JSON.parse(
      await readFile(join(root, "measurements", `${testCase.id}-22222222`, "summary.json"), "utf8"),
    );
    expect(later.delta.usable).toBe(true);
    expect(later.delta.predecessor).toBe(`${testCase.id}-11111111`);

    const earlier = JSON.parse(
      await readFile(join(root, "measurements", `${testCase.id}-11111111`, "summary.json"), "utf8"),
    );
    // the earlier measurement has a sibling, but that sibling is LATER than
    // it — a predecessor must be looked back to, never forward.
    expect(earlier.delta).toEqual({
      usable: false,
      reason: "no measurement of this case is timestamped earlier than this one",
    });
  });
});
