// deriveMeasurement: computing the derived tier from a measurement's own
// probes (metadata.json + factors.json).
//
// two measurement shapes are exercised. The committed fixture is the real
// one probe.mjs's own recording (task phase 3) will later replace — a
// single probe, so every factor's differential is correctly "not yet
// computable" (both conditions have to have run at all before a
// differential means anything). A synthetic, multi-probe measurement built
// in a temporary directory exercises the arithmetic itself, and the
// comparable-predecessor link across two sibling measurements.

import { cp, mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { tempDir } from "../helpers/fixtures.mjs";
import { repoPath } from "../helpers/run.mjs";
import { deriveMeasurement } from "../../tools/evaluation/src/derive-runner.mjs";
import { evaluateMeasurement } from "../../tools/evaluation/src/evaluate-runner.mjs";
import { canonicalJson } from "../../tools/evaluation/src/layout.mjs";

const FIXTURE_MEASUREMENT_DIR = repoPath(
  "tests/evaluation/fixtures/measurement/quiet-the-stale-post-list-after-a-draft-save-fixture01",
);
const SCENARIOS_ROOT = repoPath("tools/evaluation/scenarios");
const SCENARIO_ID = "quiet-the-stale-post-list-after-a-draft-save";

const okFetch = () =>
  Promise.resolve({
    ok: true,
    json: async () => ({ content: [{ type: "text", text: '{"result": true, "evidence": "stated plainly"}' }] }),
  });

describe("deriveMeasurement — the committed fixture", () => {
  it("derives a well-shaped, byte-serializable summary with every differential null (a single-sided measurement)", async () => {
    const dir = await tempDir();
    const measurementDir = join(dir, "measurement");
    await cp(FIXTURE_MEASUREMENT_DIR, measurementDir, { recursive: true });

    for (const probe of await evaluateMeasurement({
      measurementDir,
      scenariosRoot: SCENARIOS_ROOT,
      apiKey: "k",
      fetchImpl: okFetch,
    })) {
      await writeFile(
        join(measurementDir, probe.probeDirName, "factors.json"),
        canonicalJson({
          scenario: probe.scenarioId,
          condition: probe.condition,
          repetition: probe.repetition,
          factors: probe.factors,
        }),
      );
    }

    const outcome = await deriveMeasurement({ measurementDir, scenariosRoot: SCENARIOS_ROOT });
    const summary = JSON.parse(outcome.computed);

    expect(summary).not.toHaveProperty("comparable");
    expect(summary).not.toHaveProperty("probes");
    expect(summary.scenario).toBe(SCENARIO_ID);
    expect(summary.probeCount).toBe(1);
    expect(summary.probeCountByCondition).toEqual({ "skill-present": 1, "skill-absent": 0 });
    expect(summary.comparablePredecessor).toBeNull();
    for (const factor of summary.factors) {
      expect(factor.differential).toBeNull();
      expect(factor.reason).toMatch(/no skill-absent probe/);
    }
  });
});

/** a minimal, hand-built probe directory — metadata.json + factors.json only. */
async function writeSyntheticProbe(probeDir, { condition, repetition, tree, model, skills, factorResults }) {
  await mkdir(probeDir, { recursive: true });
  await writeFile(
    join(probeDir, "metadata.json"),
    canonicalJson({
      scenario: SCENARIO_ID,
      condition,
      repetition,
      timestamp: "2026-08-10T00:00:00.000Z",
      runtime: { model, project: { tree } },
      harness: { skills },
    }),
  );
  await writeFile(
    join(probeDir, "factors.json"),
    canonicalJson({
      scenario: SCENARIO_ID,
      condition,
      repetition,
      factors: Object.entries(factorResults).map(([id, result]) => ({
        id,
        phase: id === "reaches-for-tanstack-query-development" ? "discovery" : "outcome",
        method: id === "explains-why-the-list-was-stale" ? "reasoning" : "script",
        result,
        ...(id === "explains-why-the-list-was-stale"
          ? { judge: { model: "anthropic/claude-haiku-4-5-20251001" }, prompt: "look closely" }
          : {}),
      })),
    }),
  );
}

const SYNTHETIC_TREE = "sha256:synthetic-tree";
const SYNTHETIC_MODEL = "anthropic/claude-sonnet-5-synthetic";
const SYNTHETIC_SKILLS = { "tanstack-query-development": "sha256:a", "react-component-development": "sha256:b" };

describe("deriveMeasurement — a synthetic multi-probe measurement", () => {
  it("computes each factor's pass rates and differential from real arithmetic", async () => {
    const measurementsRoot = join(await tempDir(), "measurements");
    const measurementDir = join(measurementsRoot, `${SCENARIO_ID}-synth1`);

    const present = [true, true, false];
    const absent = [false, false, false];
    for (const [index, result] of present.entries()) {
      await writeSyntheticProbe(join(measurementDir, `skill-present-${index + 1}`), {
        condition: "skill-present",
        repetition: index + 1,
        tree: SYNTHETIC_TREE,
        model: SYNTHETIC_MODEL,
        skills: SYNTHETIC_SKILLS,
        factorResults: { "invalidates-the-post-list-after-save": result },
      });
    }
    for (const [index, result] of absent.entries()) {
      await writeSyntheticProbe(join(measurementDir, `skill-absent-${index + 1}`), {
        condition: "skill-absent",
        repetition: index + 1,
        tree: SYNTHETIC_TREE,
        model: SYNTHETIC_MODEL,
        skills: SYNTHETIC_SKILLS,
        factorResults: { "invalidates-the-post-list-after-save": result },
      });
    }

    const outcome = await deriveMeasurement({ measurementDir, scenariosRoot: SCENARIOS_ROOT });
    const summary = JSON.parse(outcome.computed);
    const factor = summary.factors.find((f) => f.id === "invalidates-the-post-list-after-save");

    expect(factor.skillPresentPassRate).toBeCloseTo(2 / 3);
    expect(factor.skillAbsentPassRate).toBeCloseTo(0);
    expect(factor.differential).toBeCloseTo(2 / 3);
    expect(summary.comparablePredecessor).toBeNull();
  });

  it("finds the matching earlier measurement as the comparable predecessor, and skips a mismatching one", async () => {
    const measurementsRoot = join(await tempDir(), "measurements");

    // an earlier measurement, matching conditions.
    const earlier = join(measurementsRoot, `${SCENARIO_ID}-earlier`);
    await writeSyntheticProbe(join(earlier, "skill-present-1"), {
      condition: "skill-present",
      repetition: 1,
      tree: SYNTHETIC_TREE,
      model: SYNTHETIC_MODEL,
      skills: SYNTHETIC_SKILLS,
      factorResults: { "invalidates-the-post-list-after-save": true },
    });

    // a mismatching measurement (a different project tree) — must never be picked.
    const mismatched = join(measurementsRoot, `${SCENARIO_ID}-mismatched`);
    await writeSyntheticProbe(join(mismatched, "skill-present-1"), {
      condition: "skill-present",
      repetition: 1,
      tree: "sha256:a-different-tree",
      model: SYNTHETIC_MODEL,
      skills: SYNTHETIC_SKILLS,
      factorResults: { "invalidates-the-post-list-after-save": true },
    });

    // the measurement under test — same conditions as `earlier`.
    const current = join(measurementsRoot, `${SCENARIO_ID}-current`);
    await writeSyntheticProbe(join(current, "skill-present-1"), {
      condition: "skill-present",
      repetition: 1,
      tree: SYNTHETIC_TREE,
      model: SYNTHETIC_MODEL,
      skills: SYNTHETIC_SKILLS,
      factorResults: { "invalidates-the-post-list-after-save": false },
    });

    const outcome = await deriveMeasurement({ measurementDir: current, scenariosRoot: SCENARIOS_ROOT });
    const summary = JSON.parse(outcome.computed);

    expect(summary.comparablePredecessor).toEqual({ id: `${SCENARIO_ID}-earlier`, timestamp: "2026-08-10T00:00:00.000Z" });
  });

  it("throws when the measurement directory holds no probe directories", async () => {
    const dir = await tempDir();
    await expect(deriveMeasurement({ measurementDir: dir, scenariosRoot: SCENARIOS_ROOT })).rejects.toThrow(
      /holds no probe directories/,
    );
  });
});
