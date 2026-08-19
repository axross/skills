// filenames and small helpers the instrument builds its on-disk layout from:
// what one probe's own directory holds, what one measurement's own directory
// is called, the id generator, and the canonical JSON serializer every
// derived file goes through.
//
// there is one instrument now, not two readings each with their own data
// root — see
// docs/decisions/2026-08-15-rebuild-skill-evaluation-around-scenarios-and-factors.md.
// the old dataRootFor(reading) resolved a
// per-reading root keyed on a reading's name ("discovery" or "effect");
// nothing here reads a reading's name any more, because there is no second
// one to disambiguate from. MEASUREMENTS_ROOT replaces it with the one root
// this instrument writes under.

import { randomBytes } from "node:crypto";

export const METADATA_FILE = "metadata.json";
export const TRANSCRIPT_FILE = "transcript.jsonl";
export const DIFF_FILE = "changes.patch";
export const INVOCATIONS_FILE = "invocations.json";
export const FACTORS_FILE = "factors.json";
export const SUMMARY_FILE = "summary.json";

/**
 * every file probe.mjs writes into one probe's own directory. evaluate.mjs's
 * reconstruction reads all four before it judges anything, so a measurement
 * missing one of them is caught there rather than partway through a
 * judgment — see evaluate.mjs's own header for why that failure is loud
 * rather than a factor silently skipped.
 */
export const PROBE_MEASURED_FILES = [METADATA_FILE, TRANSCRIPT_FILE, DIFF_FILE, INVOCATIONS_FILE];

/** the repository-relative root every measurement this instrument takes is written under. */
export const MEASUREMENTS_ROOT = "tools/evaluation/measurements";

/** an 8-hex-character id, short enough to read in a directory listing. */
export function newId() {
  return randomBytes(4).toString("hex");
}

/**
 * one scenario measurement's directory name: the scenario id plus a short
 * random suffix, so two measurements of the same scenario never collide on
 * disk.
 *
 * @param {string} scenarioId
 * @param {string} [id]
 * @returns {string}
 */
export function measurementDirName(scenarioId, id = newId()) {
  return `${scenarioId}-${id}`;
}

/**
 * one probe's directory name inside a measurement: its condition plus its
 * repetition index. 1-based, so a directory name never reads "repetition 0".
 *
 * @param {"skill-present"|"skill-absent"} condition
 * @param {number} repetition 1-based
 * @returns {string}
 */
export function probeDirName(condition, repetition) {
  return `${condition}-${repetition}`;
}

/**
 * the one serializer for anything this instrument writes and later compares
 * byte-for-byte.
 *
 * one, because `derive.mjs --check` compares a regeneration against what is
 * committed, and that comparison means something only if both went through
 * the same function. `.prettierignore` exempts this instrument's derived
 * surfaces from Prettier's own opinion about `**​/*.json` for the same
 * reason: a reformatted file would fail the check against bytes this
 * serializer never wrote.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
