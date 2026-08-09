// the derived layer, and the checks that decide whether a case measurement
// measures anything.
//
// everything here must be a pure function of the measured and declared files.
// that is what makes the drift check possible: re-deriving a committed summary
// and comparing bytes is a real check only if the derivation cannot consult the
// clock, the environment, or the network. a field that cannot be recomputed
// from metadata.json, transcript.jsonl, and changes.patch belongs in
// metadata.json, where it is declared rather than derived.
//
// the checks are the product, not a side effect. a case whose probes ran
// against different project trees, or different skill sets within one
// condition, or with different skills loaded, is not a measurement of anything
// — the difference it reports cannot be attributed. storing the numbers and
// leaving a reader to notice would be worse than not measuring, because it
// looks like data.

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { parseTranscript, readBehaviour } from "../../lib/transcript/index.mjs";
import { conditionOf, METADATA_FILE, probePaths } from "./layout.mjs";

/** @returns {string[]} in first-appearance order */
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
 * @param {string} probeDir
 * @param {string} name the directory's own name, which declares the condition
 * @throws {Error} when any of the probe's files cannot be read, when its
 *   metadata is not valid JSON, or when `name` declares no condition
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

  // a value the transcript contradicts fails the derivation; one it is silent
  // about does not. `null` means the stream did not say, and an older CLI
  // reporting nothing must not read as a probe that ran against the wrong model.
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
    // from the transcript's init event, deliberately not from metadata.json:
    // what the CLI loaded is an outcome of the run, not a setting of it, and a
    // declared value would be a claim nothing checks.
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

/**
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

  const trees = distinct(probes.map((probe) => configurationOf(probe).project?.tree));
  record(
    "one project tree",
    trees.length === 1,
    trees.length === 1
      ? `every probe ran against ${JSON.parse(trees[0])}`
      : `probes disagree: ${trees.join(", ")}`,
  );

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

  // identical, not empty. no available flag can guarantee the CLI loads
  // nothing: `--setting-sources project` strips the user-level skills, but the
  // ones a managed environment injects cannot be stripped without also
  // stripping the workspace's own, which are the treatment. so the achievable
  // invariant is that whatever contamination exists is the same on both sides,
  // where it cancels. order is not signal, so compare sorted.
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
 * @param {string} caseDir
 * @param {{ declaredRepetitions?: number|null }} [options]
 * @returns {Promise<Record<string, unknown>>}
 * @throws {Error} when `caseDir` cannot be read or holds no probe directories,
 *   or when any probe in it fails to read or to summarize. a case that reads
 *   but is not comparable does not throw — `comparable: false` and the failing
 *   checks are part of the returned summary
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
    // lifted out of the probes so a reader does not have to open one to know
    // what this measurement is.
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
 * @param {Record<string, unknown>} summary
 * @returns {{ comparable: boolean, failures: string[] }}
 */
export function comparabilityOf(summary) {
  const failures = (summary.checks ?? [])
    .filter((check) => !check.passed)
    .map((check) => `${check.check}: ${check.detail}`);
  return { comparable: failures.length === 0, failures };
}
