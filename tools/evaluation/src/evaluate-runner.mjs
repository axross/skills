// evaluating a stored measurement's factors: reconstructing each probe's
// workspace from what it stored, judging every factor its scenario
// declares, and returning each probe's own factors.json content.
//
// docs/specs/skill-evaluation.md, "The factor": "A judgment is made against
// the stored measurement and nothing else. The probe workspace is
// reconstructed from what the measurement holds, never reused from the run
// that produced it." Every artefact PROBE_MEASURED_FILES names is read
// before anything is judged, so a measurement missing one of them fails
// loudly here — see readProbeArtifacts — rather than a factor silently
// being judged on what remains.
//
// writing factors.json to disk is the CLI layer's job (evaluate.mjs), not
// this module's: everything here is filesystem-read-only plus one
// throwaway reconstructed workspace per probe, so a test can run this
// module's whole orchestration against a temporary measurement directory
// and a stub `fetchImpl`, with nothing written outside a directory it owns.

import { readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";

import { judgeFactor } from "./factor-judgment.mjs";
import { DIFF_FILE, INVOCATIONS_FILE, METADATA_FILE, PROBE_MEASURED_FILES, TRANSCRIPT_FILE } from "./layout.mjs";
import { reconstructWorkspace } from "./reconstruct.mjs";
import { loadScenario } from "./scenario.mjs";

/**
 * reads one probe's four measured files, failing loudly and by name when
 * any is absent — the property the reconstruction-path negative control
 * exercises.
 *
 * @param {string} probeDir
 * @returns {Promise<Record<string, string>>} keyed by filename
 * @throws {Error} naming every missing file, when at least one is missing
 */
async function readProbeArtifacts(probeDir) {
  const missing = [];
  const values = {};
  for (const file of PROBE_MEASURED_FILES) {
    try {
      values[file] = await readFile(join(probeDir, file), "utf8");
    } catch {
      missing.push(file);
    }
  }
  if (missing.length > 0) {
    throw new Error(`${probeDir} is missing required artefact(s): ${missing.join(", ")}.`);
  }
  return values;
}

/**
 * judges every probe under `measurementDir` against its scenario's factors.
 *
 * @param {{
 *   measurementDir: string,
 *   scenariosRoot: string,
 *   apiKey?: string,
 *   fetchImpl?: typeof fetch,
 * }} options
 * @returns {Promise<Array<{
 *   probeDirName: string, scenarioId: string, condition: string, repetition: number,
 *   factors: Array<{ id: string, phase: string, method: string, result: unknown }>,
 * }>>}
 * @throws {Error} when `measurementDir` holds no probe directories, a probe
 *   is missing a required artefact, or its scenario cannot be loaded
 */
export async function evaluateMeasurement({ measurementDir, scenariosRoot, apiKey, fetchImpl }) {
  const entries = await readdir(measurementDir, { withFileTypes: true });
  const probeDirNames = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  if (probeDirNames.length === 0) {
    throw new Error(`${measurementDir} holds no probe directories to judge.`);
  }

  const results = [];
  let scenario = null;

  for (const probeDirName of probeDirNames) {
    const probeDir = join(measurementDir, probeDirName);
    const raw = await readProbeArtifacts(probeDir);
    const metadata = JSON.parse(raw[METADATA_FILE]);
    const invocations = JSON.parse(raw[INVOCATIONS_FILE]);

    if (scenario === null || scenario.id !== metadata.scenario) {
      scenario = await loadScenario(join(scenariosRoot, metadata.scenario));
    }

    const workspace = await reconstructWorkspace({
      scenario,
      condition: metadata.condition,
      diffText: raw[DIFF_FILE],
    });

    let factors;
    try {
      const probe = {
        skillsInvoked: invocations.skillsInvoked,
        diff: raw[DIFF_FILE],
        task: metadata.task,
        transcript: raw[TRANSCRIPT_FILE],
      };
      factors = [];
      // sequential, not Promise.all: more than one script judgment can run
      // against the same reconstructed workspace, and nothing here promises
      // a scenario's scripts are read-only of it.
      for (const factor of scenario.factors) {
        factors.push(
          await judgeFactor(factor, { scenarioDir: scenario.dir, workspace, probe, apiKey, fetchImpl }),
        );
      }
    } finally {
      try {
        await rm(workspace, { recursive: true, force: true });
      } catch (error) {
        // a cleanup that cannot complete must never discard the factor
        // judgments this call already produced. the leak is reported, not
        // swallowed, so an unremovable workspace on a runner is still
        // visible.
        process.stderr.write(`  warning: could not remove ${workspace}: ${error.message}\n`);
      }
    }

    results.push({
      probeDirName,
      scenarioId: metadata.scenario,
      condition: metadata.condition,
      repetition: metadata.repetition,
      factors,
    });
  }

  return results;
}
