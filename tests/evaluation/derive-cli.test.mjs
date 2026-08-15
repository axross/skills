// derive.mjs, driven as a real subprocess: writes summary.json, and
// `--check` re-derives it and compares byte-for-byte.

import { spawnSync } from "node:child_process";
import { cp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { tempDir } from "../helpers/fixtures.mjs";
import { repoPath } from "../helpers/run.mjs";

const EVALUATE_SCRIPT = repoPath("tools/evaluation/evaluate.mjs");
const DERIVE_SCRIPT = repoPath("tools/evaluation/derive.mjs");
const FIXTURE_MEASUREMENT_DIR = repoPath(
  "tests/evaluation/fixtures/measurement/quiet-the-stale-post-list-after-a-draft-save-fixture01",
);

function run(script, args) {
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  const result = spawnSync(process.execPath, [script, ...args], { encoding: "utf8", env });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** a fresh measurement directory with factors.json already written, ready for derive.mjs. */
async function preparedMeasurement() {
  const measurementDir = join(await tempDir(), "measurement");
  await cp(FIXTURE_MEASUREMENT_DIR, measurementDir, { recursive: true });
  const evaluated = run(EVALUATE_SCRIPT, [measurementDir]);
  if (evaluated.code !== 0) throw new Error(`evaluate.mjs setup failed: ${evaluated.stderr}`);
  return measurementDir;
}

describe("derive.mjs --help", () => {
  it("prints usage and exits 0", () => {
    const result = run(DERIVE_SCRIPT, ["--help"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/^Usage: derive\.mjs/);
  });
});

describe("derive.mjs bad invocation", () => {
  it("exits 2 with no measurement-dir argument", () => {
    expect(run(DERIVE_SCRIPT, ["--check"]).code).toBe(2);
  });
});

describe("derive.mjs — write mode", () => {
  it("writes summary.json in the declared derived shape", async () => {
    const measurementDir = await preparedMeasurement();

    const result = run(DERIVE_SCRIPT, [measurementDir]);

    expect(result.code).toBe(0);
    const summary = JSON.parse(await readFile(join(measurementDir, "summary.json"), "utf8"));
    expect(summary).not.toHaveProperty("comparable");
    expect(summary).not.toHaveProperty("probes");
    expect(summary.factors.length).toBeGreaterThan(0);
    // both probes carry their own costUsd (0.061847, 0.048213), so the
    // aggregate is their real sum rather than null or either figure alone.
    expect(summary.costUsd).toBeCloseTo(0.11006, 5);
  });
});

// the fixture carries both conditions (skill-present-1, skill-absent-1), so
// the two-condition path runs end to end here rather than only in
// derive-summary.test.mjs's hand-built ProbeRecords. these assertions read
// derive.mjs's real subprocess output on that fixture, not a constructed
// object.
describe("derive.mjs — the two-condition path, on the real fixture", () => {
  it("computes a discovery factor's differential as the skill-present pass rate, and a non-discovery factor's as the difference of the two rates", async () => {
    const measurementDir = await preparedMeasurement();

    expect(run(DERIVE_SCRIPT, [measurementDir]).code).toBe(0);
    const summary = JSON.parse(await readFile(join(measurementDir, "summary.json"), "utf8"));
    const byId = Object.fromEntries(summary.factors.map((factor) => [factor.id, factor]));

    // docs/specs/skill-evaluation.md, "The differential": a discovery
    // factor's differential is read as the skill-present pass rate alone,
    // since the skill-absent condition cannot pass one by construction —
    // the target skill was never installed there.
    const discovery = byId["reaches-for-tanstack-query-development"];
    expect(discovery.phase).toBe("discovery");
    expect(discovery.skillPresentPassRate).toBe(1);
    expect(discovery.skillAbsentPassRate).toBe(0);
    expect(discovery.differential).toBe(discovery.skillPresentPassRate);

    // every other phase's differential is the skill-present rate minus the
    // skill-absent rate — here, the difference the skill made between the
    // idiomatic fix and the skill-absent arm's naive one.
    const outcome = byId["invalidates-the-post-list-after-save"];
    expect(outcome.phase).toBe("outcome");
    expect(outcome.skillPresentPassRate).toBe(1);
    expect(outcome.skillAbsentPassRate).toBe(0);
    expect(outcome.differential).toBe(outcome.skillPresentPassRate - outcome.skillAbsentPassRate);
  });
});

describe("derive.mjs --check", () => {
  it("passes against a freshly-written summary.json", async () => {
    const measurementDir = await preparedMeasurement();
    expect(run(DERIVE_SCRIPT, [measurementDir]).code).toBe(0);

    const result = run(DERIVE_SCRIPT, [measurementDir, "--check"]);

    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/matches a fresh re-derivation byte-for-byte/);
  });

  it("exits non-zero when no summary.json exists yet", async () => {
    const measurementDir = await preparedMeasurement();

    const result = run(DERIVE_SCRIPT, [measurementDir, "--check"]);

    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/No .*summary\.json/);
  });

  // negative control 3/5: a derived byte altered by hand fails
  // `derive.mjs --check` — planted directly on the summary.json this test
  // itself wrote, and never touching anything committed.
  it("fails when a derived byte is altered by hand", async () => {
    const measurementDir = await preparedMeasurement();
    expect(run(DERIVE_SCRIPT, [measurementDir]).code).toBe(0);

    const summaryPath = join(measurementDir, "summary.json");
    const original = await readFile(summaryPath, "utf8");
    const tampered = original.replace('"probeCount": 2', '"probeCount": 3');
    expect(tampered).not.toBe(original); // the plant actually changed something
    await writeFile(summaryPath, tampered, "utf8");

    const result = run(DERIVE_SCRIPT, [measurementDir, "--check"]);

    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/does not match a fresh re-derivation/);
  });
});
