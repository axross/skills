// filenames and small helpers both readings build their own on-disk layout
// from: the file names inside a data root, the id/name generator, the
// canonical JSON serializer every derived file goes through, and the
// reading-keyed data root a reading resolves its own `DATA_ROOT` from.
//
// what one PROBE directory is called — `probe-<id>` on the discovery side,
// `<condition>-<id>` on the effect side — and what files live inside one
// stay with the reading, in its own layout.mjs: that shape follows from how
// many conditions a reading compares, which is a reading decision rather
// than a filename.

import { randomBytes } from "node:crypto";

export const METADATA_FILE = "metadata.json";
export const TRANSCRIPT_FILE = "transcript.jsonl";
export const SUMMARY_FILE = "summary.json";
export const FIXTURE_FILE = "fixture.json";
export const MEASUREMENTS_DIR = "measurements";

export function newId() {
  return randomBytes(4).toString("hex");
}

export function caseMeasurementName(caseId, id = newId()) {
  return `${caseId}-${id}`;
}

/**
 * the one serializer for anything either evaluation writes and later
 * compares.
 *
 * one, because a drift check compares a regeneration against a commit, and
 * that means something only if both went through the same function. it is
 * also why a reading's derived surfaces are excluded from this repository's
 * Prettier config in `.prettierignore`: the formatter covers `**​/*.json`,
 * and a reformatted summary would fail the check against bytes this
 * serializer never wrote.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/**
 * one reading's data root, resolved from its name rather than hardcoded per
 * reading.
 *
 * the deferred fix from #385's review: `DATA_ROOT` was hardcoded twelve
 * times across five test files, deferred to whichever step merged the two
 * data roots into one tree — this one.
 *
 * @param {string} reading e.g. "discovery" or "effect"
 * @returns {string} the reading's data root, repository-relative
 */
export function dataRootFor(reading) {
  return `tools/evaluation/data/${reading}`;
}
