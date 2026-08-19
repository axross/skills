// evaluate.mjs, driven as a real subprocess against the committed
// stored-measurement fixture. Neither CLAUDE_CODE_OAUTH_TOKEN nor
// ANTHROPIC_API_KEY is set for these invocations — real, not stubbed, so the
// reasoning factor legitimately errors on a missing credential rather than
// spawning a real `claude`, and the run still completes end to end (see this
// file's own header note on why that is the honest way to exercise this CLI
// without ever billing anything).

import { spawnSync } from "node:child_process";
import { cp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { tempDir } from "../helpers/fixtures.mjs";
import { repoPath } from "../helpers/run.mjs";

const EVALUATE_SCRIPT = repoPath("tools/evaluation/evaluate.mjs");
const FIXTURE_MEASUREMENT_DIR = repoPath(
  "tests/evaluation/fixtures/measurement/quiet-the-stale-post-list-after-a-draft-save-fixture01",
);

function runEvaluateCli(args) {
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  delete env.CLAUDE_CODE_OAUTH_TOKEN;
  const result = spawnSync(process.execPath, [EVALUATE_SCRIPT, ...args], { encoding: "utf8", env });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

async function copyFixture() {
  const dir = await tempDir();
  const measurementDir = join(dir, "measurement");
  await cp(FIXTURE_MEASUREMENT_DIR, measurementDir, { recursive: true });
  return measurementDir;
}

describe("evaluate.mjs --help", () => {
  it("prints usage and exits 0", () => {
    const result = runEvaluateCli(["--help"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/^Usage: evaluate\.mjs/);
  });
});

describe("evaluate.mjs bad invocation", () => {
  it("exits 2 with no measurement-dir argument", () => {
    const result = runEvaluateCli([]);
    expect(result.code).toBe(2);
    expect(result.stderr).toMatch(/Expected exactly one/);
  });
});

describe("evaluate.mjs against the committed fixture", () => {
  it("judges the stored-measurement fixture to completion, writing factors.json", async () => {
    const measurementDir = await copyFixture();

    const result = runEvaluateCli([measurementDir]);

    expect(result.code).toBe(0);
    // the fixture carries both conditions, skill-present-1 and skill-absent-1.
    expect(result.stdout).toMatch(/Judged 2 probe\(s\)/);

    const factors = JSON.parse(
      await readFile(join(measurementDir, "skill-present-1", "factors.json"), "utf8"),
    );
    expect(factors.factors).toHaveLength(4);
    expect(factors.factors.map((f) => f.id)).toContain("reaches-for-tanstack-query-development");

    // named "result", not "outcome" — the declared factors.json shape.
    for (const factor of factors.factors) {
      expect(factor).toHaveProperty("result");
      expect(factor).not.toHaveProperty("outcome");
    }

    const reasoning = factors.factors.find((f) => f.method === "reasoning");
    expect(reasoning.result).toEqual({ error: expect.stringContaining("no Claude CLI credential") });
    expect(reasoning.judge.model).toBe("anthropic/claude-haiku-4-5-20251001");
    expect(reasoning.judge.route).toBe("claude-code-cli");
  });

  // negative control 2/5, exercised through the real CLI: a measurement
  // fixture missing a required artefact makes evaluate.mjs fail loudly.
  it("exits non-zero and names the missing artefact when one is absent", async () => {
    const measurementDir = await copyFixture();
    await rm(join(measurementDir, "skill-present-1", "invocations.json"));

    const result = runEvaluateCli([measurementDir]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("invocations.json");
  });
});
