// where a discovery case measurement's files live, and what they are called.
//
// mirrors tools/evaluation/effect/src/layout.mjs's three-kinds-of-file split,
// with one probe directory per repeat rather than per condition — discovery has
// no second condition to pair against, so `probe-<id>` replaces
// `<condition>-<id>`:
//
//   measured   transcript.jsonl        never regenerated; re-acquiring it
//                                       costs a paid probe
//   declared   metadata.json           what was set; the argv is derived
//                                       from it
//   derived    summary.json            regenerable; a drift check re-derives
//                                       and fails on a mismatch
//
// no changes.patch here: the editing tools are denied in both probe modes, so
// a discovery probe produces no artifact to capture (see this instrument's
// README, "A discovery probe produces no artifact").

import { randomBytes } from "node:crypto";
import { join } from "node:path";

export const METADATA_FILE = "metadata.json";
export const TRANSCRIPT_FILE = "transcript.jsonl";
export const SUMMARY_FILE = "summary.json";
export const FIXTURE_FILE = "fixture.json";
export const MEASUREMENTS_DIR = "measurements";
export const DATA_ROOT = "tools/evaluation/data/discovery";

/** every probe directory under a case measurement starts with this. */
export const PROBE_PREFIX = "probe";

export function newId() {
  return randomBytes(4).toString("hex");
}

export function caseMeasurementName(caseId, id = newId()) {
  return `${caseId}-${id}`;
}

/**
 * `probe-<id>`, not `probe-<index>`.
 *
 * repeats of one case have no ordering — they are not a series — so an index
 * would imply one. a random id implies neither ordering nor pairing, matching
 * the effect side's `<condition>-<id>` for the same reason.
 */
export function probeName(id = newId()) {
  return `${PROBE_PREFIX}-${id}`;
}

/**
 * @param {string} name a probe directory name
 * @returns {boolean} whether `name` names a probe directory at all
 */
export function isProbeName(name) {
  return typeof name === "string" && name.startsWith(`${PROBE_PREFIX}-`);
}

/** `<case-id>-<id>` directories are everything before the trailing `-<8 hex>`. */
export function caseIdOf(directoryName) {
  const match = /^(.*)-[0-9a-f]{8}$/.exec(directoryName);
  return match ? match[1] : null;
}

export function probePaths(probeDir) {
  return {
    metadata: join(probeDir, METADATA_FILE),
    transcript: join(probeDir, TRANSCRIPT_FILE),
  };
}

/**
 * the one serializer for anything this instrument writes and later compares.
 *
 * one, for the same reason as the effect side's: the drift check compares a
 * regeneration against a commit, and that means something only if both went
 * through the same function. `tools/evaluation/data/discovery/`'s derived
 * surfaces are excluded from this repository's Prettier config for the same
 * reason — the generic summary.json and measurements-directory globs in
 * .prettierignore already cover this instrument's data root, so nothing here
 * needs to widen it.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
