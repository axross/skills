// deriveMeasurement: computing the derived tier from a measurement's own
// probes (metadata.json + factors.json).
//
// two measurement shapes are exercised. The committed fixture is real —
// skill-present-1 is probe.mjs's own recording (task phase 3 will replace it
// with a fresh one), and skill-absent-1 is hand-authored the same way, so
// deriveMeasurement runs its real arithmetic end to end over both
// conditions rather than over one condition and a reason string. A
// synthetic, multi-probe measurement built in a temporary directory then
// exercises repetitions beyond one-per-condition, and the
// comparable-predecessor link across two sibling measurements.

import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
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
  it("derives a well-shaped, byte-serializable summary from both conditions", async () => {
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
    expect(summary.probeCount).toBe(2);
    expect(summary.probeCountByCondition).toEqual({ "skill-present": 1, "skill-absent": 1 });
    expect(summary.comparablePredecessor).toBeNull();
    // both probes carry their own costUsd, so the aggregate is their real sum
    // (0.061847 + 0.048213), not null and not either figure alone.
    expect(summary.costUsd).toBeCloseTo(0.11006, 5);
  });

  // this is the integration coverage the two-condition path lacked: not a
  // hand-built ProbeRecord, but deriveMeasurement's real output over the
  // committed fixture's two real conditions.
  //
  // docs/specs/skill-evaluation.md, "The differential": a discovery
  // factor's differential is read as the skill-present pass rate alone,
  // because the skill-absent condition cannot pass one by construction;
  // every other phase's differential is the skill-present rate minus the
  // skill-absent rate.
  //
  // the per-condition rate itself is not on summary.json — narrowed by
  // "What a measurement stores" — so the rate side of each assertion below
  // reads each probe's own written factors.json (one repetition per
  // condition here, so "the rate" is just that one result) rather than a
  // field the summary no longer carries.
  it("computes a discovery factor's differential as the skill-present rate, and a non-discovery factor's as the difference of the two rates", async () => {
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
    const byId = Object.fromEntries(summary.factors.map((factor) => [factor.id, factor]));

    async function rate(probeDirName, factorId) {
      const { factors } = JSON.parse(await readFile(join(measurementDir, probeDirName, "factors.json"), "utf8"));
      return factors.find((factor) => factor.id === factorId).result === true ? 1 : 0;
    }

    // the target skill was never installed in the skill-absent arm, so it
    // cannot have been discovered there — the present rate is the whole
    // differential.
    const discovery = byId["reaches-for-tanstack-query-development"];
    const discoveryPresentRate = await rate("skill-present-1", "reaches-for-tanstack-query-development");
    expect(await rate("skill-absent-1", "reaches-for-tanstack-query-development")).toBe(0);
    expect(discovery.differential).toBe(discoveryPresentRate);

    // the skill-absent arm's naive fix never invalidates the list query —
    // the skill made exactly this difference.
    const invalidates = byId["invalidates-the-post-list-after-save"];
    const invalidatesPresentRate = await rate("skill-present-1", "invalidates-the-post-list-after-save");
    const invalidatesAbsentRate = await rate("skill-absent-1", "invalidates-the-post-list-after-save");
    expect(invalidates.differential).toBe(invalidatesPresentRate - invalidatesAbsentRate);

    // both arms keep the pre-existing detail-cache write — a real,
    // non-null differential of zero, not the null a single-arm
    // measurement could only ever have reported here.
    const keepsDetail = byId["keeps-the-detail-cache-write"];
    const keepsDetailPresentRate = await rate("skill-present-1", "keeps-the-detail-cache-write");
    const keepsDetailAbsentRate = await rate("skill-absent-1", "keeps-the-detail-cache-write");
    expect(keepsDetailPresentRate).toBe(1);
    expect(keepsDetailAbsentRate).toBe(1);
    expect(keepsDetail.differential).toBe(0);
    expect(keepsDetail.differential).not.toBeNull();
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

    // present rate 2/3 (two `true` of three), absent rate 0 (three `false`)
    // — the per-condition rate is no longer on the summary, so this is
    // checked only through the differential their subtraction produces.
    expect(factor.differential).toBeCloseTo(2 / 3 - 0);
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
