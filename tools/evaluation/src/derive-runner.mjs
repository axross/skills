// reading one scenario measurement's probes off disk — each one's own
// metadata.json and factors.json — and computing its derived tier.
//
// writing (or checking) summary.json is the CLI layer's job (derive.mjs),
// not this module's: this module only reads and computes, so a test can
// point it at a temporary measurement directory and assert on the bytes it
// would write without touching anything under tools/evaluation/measurements/.

import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { findComparablePredecessor } from "./comparability.mjs";
import { computeDerivedSummary } from "./derive-summary.mjs";
import { canonicalJson, FACTORS_FILE, METADATA_FILE, SUMMARY_FILE } from "./layout.mjs";
import { loadScenario } from "./scenario.mjs";

/** reads and parses one probe's metadata.json + factors.json. */
async function readProbe(probeDir) {
  const metadata = JSON.parse(await readFile(join(probeDir, METADATA_FILE), "utf8"));
  const factorsFile = JSON.parse(await readFile(join(probeDir, FACTORS_FILE), "utf8"));
  return {
    condition: metadata.condition,
    repetition: metadata.repetition,
    metadata,
    factors: factorsFile.factors,
  };
}

/**
 * the condition fingerprint one measurement's own probes imply — see
 * comparability.mjs's ConditionFingerprint. read from the skill-present
 * condition when one is present (the fuller of the two skill sets), falling
 * back to whichever probe exists otherwise.
 *
 * @param {Array<Awaited<ReturnType<typeof readProbe>>>} probes
 */
function fingerprintOf(probes) {
  const present = probes.find((probe) => probe.condition === "skill-present") ?? probes[0];

  const seenFactors = new Set();
  const reasoningJudges = [];
  for (const probe of probes) {
    for (const factor of probe.factors) {
      if (factor.method !== "reasoning" || seenFactors.has(factor.id)) continue;
      seenFactors.add(factor.id);
      reasoningJudges.push({ factor: factor.id, judgeModel: factor.judge.model, prompt: factor.prompt });
    }
  }

  return {
    projectTree: present.metadata.runtime.project.tree,
    runtimeModel: present.metadata.runtime.model,
    skillDigests: present.metadata.harness.skills,
    reasoningJudges,
  };
}

/**
 * every OTHER measurement of the same scenario under `measurementsRoot`,
 * read as comparable-predecessor candidates. a sibling this cannot read (a
 * directory with no probe directories of its own, for instance) is skipped
 * rather than failing the whole derivation — an unrelated stray directory
 * must not block deriving the measurement actually asked for.
 *
 * @param {string} measurementsRoot
 * @param {string} scenarioId
 * @param {string} excludeMeasurementId
 */
async function comparablePredecessorCandidates(measurementsRoot, scenarioId, excludeMeasurementId) {
  let entries;
  try {
    entries = await readdir(measurementsRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const candidates = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === excludeMeasurementId) continue;
    if (!entry.name.startsWith(`${scenarioId}-`)) continue;

    const siblingDir = join(measurementsRoot, entry.name);
    let probeDirs;
    try {
      probeDirs = (await readdir(siblingDir, { withFileTypes: true })).filter((e) => e.isDirectory());
    } catch {
      continue;
    }
    if (probeDirs.length === 0) continue;

    let siblingProbes;
    try {
      siblingProbes = await Promise.all(probeDirs.map((e) => readProbe(join(siblingDir, e.name))));
    } catch {
      continue;
    }
    candidates.push({
      id: entry.name,
      timestamp: siblingProbes[0].metadata.timestamp,
      fingerprint: fingerprintOf(siblingProbes),
    });
  }
  return candidates;
}

/**
 * @param {{ measurementDir: string, scenariosRoot: string }} options
 * @returns {Promise<{ summaryPath: string, computed: string, scenarioId: string, measurementId: string }>}
 * @throws {Error} when `measurementDir` holds no probe directories, or a
 *   probe's `metadata.json`/`factors.json` is missing or unreadable
 */
export async function deriveMeasurement({ measurementDir, scenariosRoot }) {
  const entries = await readdir(measurementDir, { withFileTypes: true });
  const probeDirNames = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  if (probeDirNames.length === 0) {
    throw new Error(`${measurementDir} holds no probe directories to derive from.`);
  }

  let probes;
  try {
    probes = await Promise.all(probeDirNames.map((name) => readProbe(join(measurementDir, name))));
  } catch (error) {
    throw new Error(`${measurementDir}: ${error.message}`);
  }

  const scenarioId = probes[0].metadata.scenario;
  const scenario = await loadScenario(join(scenariosRoot, scenarioId));
  const measurementId = basename(measurementDir);

  const measurementsRoot = join(measurementDir, "..");
  const candidates = await comparablePredecessorCandidates(measurementsRoot, scenarioId, measurementId);
  const comparablePredecessor = findComparablePredecessor(candidates, fingerprintOf(probes));

  const summary = computeDerivedSummary({
    scenarioId,
    measurementId,
    factorDeclarations: scenario.factors.map((factor) => ({ id: factor.id, phase: factor.phase })),
    probes: probes.map(({ condition, repetition, factors, metadata }) => ({
      condition,
      repetition,
      factors,
      costUsd: metadata.costUsd ?? null,
    })),
    comparablePredecessor,
  });

  return {
    summaryPath: join(measurementDir, SUMMARY_FILE),
    computed: canonicalJson(summary),
    scenarioId,
    measurementId,
  };
}
