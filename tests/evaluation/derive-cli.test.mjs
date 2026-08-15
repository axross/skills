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
    const tampered = original.replace('"probeCount": 1', '"probeCount": 2');
    expect(tampered).not.toBe(original); // the plant actually changed something
    await writeFile(summaryPath, tampered, "utf8");

    const result = run(DERIVE_SCRIPT, [measurementDir, "--check"]);

    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/does not match a fresh re-derivation/);
  });
});
