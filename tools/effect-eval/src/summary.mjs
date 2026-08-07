// summary.mjs — the derived layer, and the comparability checks that decide
// whether a case measurement is a measurement at all.
//
// EVERYTHING HERE IS A PURE FUNCTION OF THE MEASURED AND DECLARED FILES. That
// is what makes the drift check possible: re-deriving a committed summary and
// comparing bytes is a real check only if the derivation cannot consult
// anything else — not the clock, not the environment, not the network. Keep it
// that way. A field that cannot be recomputed from `metadata.json`,
// `transcript.jsonl`, and `changes.patch` does not belong in a summary; it
// belongs in `metadata.json`, where it is declared rather than derived.
//
// THE CHECKS ARE THE PRODUCT, NOT A SIDE EFFECT. A case measurement whose
// probes ran against different project trees, or against different skill sets
// within one condition, or with different skills LOADED, is not a measurement
// of anything — the difference it reports cannot be attributed. Recording that
// fact in the summary and failing the measurement is the only honest outcome;
// storing the numbers and leaving a reader to notice would be worse than not
// measuring, because it looks like data.
//
// WHY "IDENTICAL", NOT "EMPTY", FOR THE LOADED SKILL SET. No available flag can
// guarantee the CLI loads nothing: `--setting-sources project` strips the
// user-level skills, but the ones a managed environment injects cannot be
// stripped without also stripping the workspace's own — which are the
// treatment. So the achievable invariant is that whatever contamination exists
// is the SAME on both sides, where it cancels, rather than absent.

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { parseTranscript, readBehaviour } from "../../lib/transcript/index.mjs";
import { conditionOf, METADATA_FILE, probePaths } from "./layout.mjs";

/** Paths a unified diff touches, in first-appearance order. */
export function changedPaths(patch) {
  const paths = [];
  const seen = new Set();
  for (const match of patch.matchAll(/^diff --git a\/(.+?) b\/(.+)$/gm)) {
    const path = match[2];
    if (seen.has(path)) continue;
    seen.add(path);
    paths.push(path);
  }
  return paths;
}

/**
 * Reads one probe directory off disk.
 *
 * @param {string} probeDir
 * @param {string} name the directory's own name, which declares the condition
 */
export async function readProbe(probeDir, name) {
  const paths = probePaths(probeDir);
  const [metadataRaw, transcriptText, changesText] = await Promise.all([
    readFile(paths.metadata, "utf8"),
    readFile(paths.transcript, "utf8"),
    readFile(paths.changes, "utf8"),
  ]);

  let metadata;
  try {
    metadata = JSON.parse(metadataRaw);
  } catch (error) {
    throw new Error(`${name}/${METADATA_FILE} is not valid JSON: ${error.message}`);
  }

  const condition = conditionOf(name);
  if (condition === null) {
    throw new Error(
      `Probe directory ${JSON.stringify(name)} does not name a condition; expected it to ` +
        "start with skill-absent- or skill-present-.",
    );
  }

  return { name, condition, metadata, transcriptText, changesText };
}

/**
 * The derived reading of one probe.
 *
 * @param {Awaited<ReturnType<typeof readProbe>>} probe
 * @returns {Record<string, unknown>}
 * @throws {Error} when the transcript contradicts what `metadata.json` declared
 */
export function deriveProbeSummary(probe) {
  const { name, condition, metadata, transcriptText, changesText } = probe;
  const configuration = metadata?.configuration;
  if (!configuration) {
    throw new Error(`${name}/${METADATA_FILE} carries no "configuration" object.`);
  }

  const transcript = parseTranscript(transcriptText);
  const behaviour = readBehaviour(transcript);

  // A declared value the transcript CONTRADICTS fails the derivation; one the
  // transcript is simply silent about does not. `null` from the parse means
  // "the stream did not say" — an older CLI reporting nothing must not read as
  // a probe that ran against the wrong model.
  const disagreements = [];
  if (transcript.model !== null && transcript.model !== configuration.model?.model) {
    disagreements.push(
      `declared model ${JSON.stringify(configuration.model?.model)} but the transcript ` +
        `reports ${JSON.stringify(transcript.model)}`,
    );
  }
  if (
    transcript.runtimeVersion !== null &&
    configuration.runtime?.version !== null &&
    transcript.runtimeVersion !== configuration.runtime?.version
  ) {
    disagreements.push(
      `declared runtime version ${JSON.stringify(configuration.runtime?.version)} but the ` +
        `transcript reports ${JSON.stringify(transcript.runtimeVersion)}`,
    );
  }
  if (disagreements.length > 0) {
    throw new Error(`${name}: ${disagreements.join("; ")}.`);
  }

  return {
    probe: name,
    condition,
    // Derived from the transcript's init event, deliberately NOT stored in
    // metadata.json: what the CLI loaded is an outcome of the run, not a
    // setting of it, and a declared value would be a claim nothing checks.
    loadedSkills: transcript.loadedSkills,
    skillsInvoked: behaviour.skillsInvoked,
    turns: transcript.turns,
    truncated: transcript.truncated,
    costUsd: transcript.cost,
    usage: transcript.usage,
    toolCalls: transcript.toolCalls.length,
    filesRead: behaviour.filesRead,
    commandsRun: behaviour.commandsRun,
    ranTests: behaviour.ranTests,
    ranLint: behaviour.ranLint,
    ranFormat: behaviour.ranFormat,
    changedPaths: changedPaths(changesText),
  };
}

/** Deep equality over the JSON-shaped values this module compares. */
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Runs every comparability check over one case's probes.
 *
 * @param {Array<Awaited<ReturnType<typeof readProbe>>>} probes
 * @param {Array<Record<string, unknown>>} derived one per probe, same order
 * @param {number|null} declaredRepetitions repeats per condition the case declares
 * @returns {Array<{ check: string, passed: boolean, detail: string }>}
 */
export function runComparabilityChecks(probes, derived, declaredRepetitions) {
  const checks = [];
  const record = (check, passed, detail) => checks.push({ check, passed, detail });

  const configurationOf = (probe) => probe.metadata.configuration;
  const distinct = (values) => [...new Set(values.map((value) => JSON.stringify(value)))];

  // 1. One project tree across every probe. This is the check that would be
  //    impossible if the project digest covered .claude/skills/ — see
  //    fingerprint.mjs.
  const trees = distinct(probes.map((probe) => configurationOf(probe).project?.tree));
  record(
    "one project tree",
    trees.length === 1,
    trees.length === 1
      ? `every probe ran against ${JSON.parse(trees[0])}`
      : `probes disagree: ${trees.join(", ")}`,
  );

  // 2. Skills: identical within skill-present, empty throughout skill-absent.
  const present = probes.filter((probe) => probe.condition === "skill-present");
  const absent = probes.filter((probe) => probe.condition === "skill-absent");

  const presentSkills = distinct(present.map((probe) => configurationOf(probe).skills));
  record(
    "one skill set in the skill-present condition",
    present.length === 0 || presentSkills.length === 1,
    present.length === 0
      ? "no skill-present probe in this measurement"
      : presentSkills.length === 1
        ? `every skill-present probe installed ${presentSkills[0]}`
        : `skill-present probes disagree: ${presentSkills.join(" vs ")}`,
  );

  const nonEmptyAbsent = absent.filter(
    (probe) => Object.keys(configurationOf(probe).skills ?? {}).length > 0,
  );
  record(
    "no skill in the skill-absent condition",
    nonEmptyAbsent.length === 0,
    nonEmptyAbsent.length === 0
      ? "every skill-absent probe installed nothing"
      : `these skill-absent probes installed a skill: ${nonEmptyAbsent
          .map((probe) => probe.name)
          .join(", ")}`,
  );

  // 3. One runtime version, model, and task.
  for (const [label, read] of [
    ["runtime version", (config) => config.runtime?.version],
    ["model", (config) => config.model?.model],
    ["task", (config) => config.task],
  ]) {
    const values = distinct(probes.map((probe) => read(configurationOf(probe))));
    record(
      `one ${label}`,
      values.length === 1,
      values.length === 1 ? `every probe shares ${values[0]}` : `probes disagree: ${values.join(" vs ")}`,
    );
  }

  // 4. The loaded skill set is IDENTICAL across every probe — see the header on
  //    why identical rather than empty. Order is not signal, so compare sorted.
  const loaded = distinct(
    derived.map((summary) =>
      Array.isArray(summary.loadedSkills) ? [...summary.loadedSkills].sort() : summary.loadedSkills,
    ),
  );
  record(
    "one loaded skill set",
    loaded.length === 1,
    loaded.length === 1
      ? `every probe loaded ${loaded[0]}`
      : `probes disagree, so contamination does not cancel between the conditions: ${loaded.join(" vs ")}`,
  );

  // 5. The declared repetition count is what is actually on disk.
  if (declaredRepetitions !== null) {
    const expected = declaredRepetitions * 2;
    record(
      "declared repetition count",
      probes.length === expected,
      probes.length === expected
        ? `${declaredRepetitions} repeat(s) per condition, ${expected} probe directories`
        : `the case declares ${declaredRepetitions} repeat(s) per condition (${expected} probes) ` +
          `but ${probes.length} probe director${probes.length === 1 ? "y" : "ies"} are present`,
    );
  }

  return checks;
}

/**
 * Derives one case measurement's `summary.json` from the files under its
 * directory.
 *
 * @param {string} caseDir
 * @param {{ declaredRepetitions?: number|null }} [options]
 * @returns {Promise<Record<string, unknown>>}
 */
export async function deriveCaseSummary(caseDir, { declaredRepetitions = null } = {}) {
  const entries = await readdir(caseDir, { withFileTypes: true });
  const names = entries
    .filter((entry) => entry.isDirectory() && conditionOf(entry.name) !== null)
    .map((entry) => entry.name)
    .sort();

  if (names.length === 0) {
    throw new Error(`${caseDir} holds no probe directories.`);
  }

  const probes = [];
  for (const name of names) {
    probes.push(await readProbe(join(caseDir, name), name));
  }
  const derived = probes.map(deriveProbeSummary);
  const checks = runComparabilityChecks(probes, derived, declaredRepetitions);
  const configuration = probes[0].metadata.configuration;

  const totalCost = derived.reduce(
    (sum, summary) => (typeof summary.costUsd === "number" ? sum + summary.costUsd : sum),
    0,
  );

  return {
    // The case identity and the conditions every probe shares, lifted out of
    // the probes so a reader does not have to open one to know what this is.
    case: configuration.task,
    project: configuration.project,
    runtime: configuration.runtime,
    model: configuration.model,
    comparable: checks.every((check) => check.passed),
    checks,
    probeCount: probes.length,
    totalCostUsd: totalCost,
    probes: derived,
  };
}

/**
 * Whether a case measurement passed every comparability check.
 *
 * @param {Record<string, unknown>} summary
 * @returns {{ comparable: boolean, failures: string[] }}
 */
export function comparabilityOf(summary) {
  const failures = (summary.checks ?? [])
    .filter((check) => !check.passed)
    .map((check) => `${check.check}: ${check.detail}`);
  return { comparable: failures.length === 0, failures };
}
