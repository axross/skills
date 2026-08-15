// evaluateMeasurement, against this repository's own committed
// stored-measurement fixture — the one probe.mjs's own real recording
// (task phase 3) will later replace as a file swap. This is what the plan
// package calls "a hand-authored stored-measurement fixture under tests/
// that evaluate.mjs and derive.mjs are exercised against".
//
// every test here copies the fixture into a throwaway temporary directory
// first, so a mutating case (a negative control) never touches the
// committed original.

import { cp, readdir, rm } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { tempDir } from "../helpers/fixtures.mjs";
import { repoPath } from "../helpers/run.mjs";
import { evaluateMeasurement } from "../../tools/evaluation/src/evaluate-runner.mjs";

const FIXTURE_MEASUREMENT_DIR = repoPath(
  "tests/evaluation/fixtures/measurement/quiet-the-stale-post-list-after-a-draft-save-fixture01",
);
const SCENARIOS_ROOT = repoPath("tools/evaluation/scenarios");

/** a fresh, mutable copy of the committed fixture measurement. */
async function copyFixture() {
  const dir = await tempDir();
  const measurementDir = join(dir, "measurement");
  await cp(FIXTURE_MEASUREMENT_DIR, measurementDir, { recursive: true });
  return measurementDir;
}

const okFetch = () =>
  Promise.resolve({
    ok: true,
    json: async () => ({ content: [{ type: "text", text: '{"result": true, "evidence": "stated plainly"}' }] }),
  });

describe("evaluateMeasurement — the committed fixture", () => {
  it("judges every probe to completion, reconstructing the workspace from the fixture alone", async () => {
    const measurementDir = await copyFixture();

    const results = await evaluateMeasurement({
      measurementDir,
      scenariosRoot: SCENARIOS_ROOT,
      apiKey: "test-key",
      fetchImpl: okFetch,
    });

    // the fixture carries both conditions — see this file's own header.
    expect(results).toHaveLength(2);
    const probe = results.find((result) => result.condition === "skill-present");
    expect(probe.factors).toHaveLength(4);

    const byId = Object.fromEntries(probe.factors.map((factor) => [factor.id, factor]));
    expect(byId["reaches-for-tanstack-query-development"].result).toBe(true);
    expect(byId["invalidates-the-post-list-after-save"].result).toBe(true);
    expect(byId["keeps-the-detail-cache-write"].result).toBe(true);
    expect(byId["explains-why-the-list-was-stale"]).toMatchObject({
      method: "reasoning",
      result: true,
      judge: { model: "anthropic/claude-haiku-4-5-20251001" },
    });
    expect(byId["explains-why-the-list-was-stale"].prompt).toBeTypeOf("string");

    // every factor result carries evidence.
    for (const factor of probe.factors) {
      expect(factor.evidence).toBeTypeOf("string");
      expect(factor.evidence.length).toBeGreaterThan(0);
    }
  });

  it("judges the skill-absent arm too, and its incomplete fix does not pass every outcome factor", async () => {
    const measurementDir = await copyFixture();

    const results = await evaluateMeasurement({
      measurementDir,
      scenariosRoot: SCENARIOS_ROOT,
      apiKey: "test-key",
      fetchImpl: okFetch,
    });

    const probe = results.find((result) => result.condition === "skill-absent");
    const byId = Object.fromEntries(probe.factors.map((factor) => [factor.id, factor]));
    // the target skill was never installed, so nothing could invoke it.
    expect(byId["reaches-for-tanstack-query-development"].result).toBe(false);
    // the naive fix patches the list's cache by hand rather than invalidating it.
    expect(byId["invalidates-the-post-list-after-save"].result).toBe(false);
    // it never touched the existing, already-correct detail-cache write.
    expect(byId["keeps-the-detail-cache-write"].result).toBe(true);
  });

  it("completes even with no reasoning-judge API key — the one factor errors, nothing else does", async () => {
    const measurementDir = await copyFixture();

    const results = await evaluateMeasurement({ measurementDir, scenariosRoot: SCENARIOS_ROOT });

    const probe = results.find((result) => result.condition === "skill-present");
    const byId = Object.fromEntries(probe.factors.map((factor) => [factor.id, factor]));
    expect(byId["reaches-for-tanstack-query-development"].result).toBe(true);
    expect(byId["explains-why-the-list-was-stale"].result).toEqual({
      error: expect.stringContaining("no reasoning-judge API key"),
    });
  });

  // negative control 2/5: a measurement fixture missing a required artefact
  // makes evaluate.mjs fail loudly rather than judging on what remains.
  it("fails loudly, naming the missing file, rather than judging on what remains", async () => {
    const measurementDir = await copyFixture();
    await rm(join(measurementDir, "skill-present-1", "changes.patch"));

    await expect(evaluateMeasurement({ measurementDir, scenariosRoot: SCENARIOS_ROOT })).rejects.toThrow(
      /missing required artefact.*changes\.patch/,
    );
  });

  it("fails loudly when metadata.json itself is missing", async () => {
    const measurementDir = await copyFixture();
    await rm(join(measurementDir, "skill-present-1", "metadata.json"));

    await expect(evaluateMeasurement({ measurementDir, scenariosRoot: SCENARIOS_ROOT })).rejects.toThrow(
      /missing required artefact.*metadata\.json/,
    );
  });

  it("throws when the measurement directory holds no probe directories", async () => {
    const dir = await tempDir();
    await expect(evaluateMeasurement({ measurementDir: dir, scenariosRoot: SCENARIOS_ROOT })).rejects.toThrow(
      /holds no probe directories/,
    );
  });

  // negative control 5/5: a real judge returning something unreadable
  // yields an errored judgment carrying its reason, never `false`.
  it("errors, never `false`, when the reasoning judge answers off-contract", async () => {
    const measurementDir = await copyFixture();
    const unreadableFetch = () =>
      Promise.resolve({ ok: true, json: async () => ({ content: [{ type: "text", text: "hard to say" }] }) });

    const results = await evaluateMeasurement({
      measurementDir,
      scenariosRoot: SCENARIOS_ROOT,
      apiKey: "test-key",
      fetchImpl: unreadableFetch,
    });

    const reasoning = results[0].factors.find((factor) => factor.method === "reasoning");
    expect(reasoning.result).not.toBe(false);
    expect(reasoning.result.error).toMatch(/held no JSON object/);
    expect(reasoning.judge).toEqual({ model: "anthropic/claude-haiku-4-5-20251001" });
  });
});
