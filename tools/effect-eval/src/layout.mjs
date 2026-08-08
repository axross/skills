// where a case measurement's files live, and what they are called.
//
// three kinds of file, three rules, and the design turns on keeping them apart:
//
//   measured   transcript.jsonl, changes.patch   never regenerated; re-acquiring
//                                                them costs a paid probe
//   declared   metadata.json                     what was set; the argv is
//                                                derived from it
//   derived    summary.json                      regenerable; a drift check
//                                                re-derives and fails on a
//                                                mismatch
//
// a file in the wrong category is the failure this prevents: a derived value
// stored as measured is a value nothing can check, and a measured value treated
// as derived is one something will cheerfully regenerate as empty.

import { randomBytes } from "node:crypto";
import { join } from "node:path";

/** the two conditions one case measurement compares. */
export const CONDITIONS = ["skill-absent", "skill-present"];

export const METADATA_FILE = "metadata.json";
export const TRANSCRIPT_FILE = "transcript.jsonl";
export const CHANGES_FILE = "changes.patch";
export const SUMMARY_FILE = "summary.json";
export const FIXTURE_FILE = "fixture.json";
export const MEASUREMENTS_DIR = "measurements";
export const DATA_ROOT = "data/effect-eval";

export function newId() {
  return randomBytes(4).toString("hex");
}

export function caseMeasurementName(caseId, id = newId()) {
  return `${caseId}-${id}`;
}

/**
 * `<condition>-<id>`, not `<condition>-<index>`.
 *
 * repetitions of one condition have no ordering — they are not a series — and
 * they are not paired across conditions, so `skill-absent-0` and
 * `skill-present-0` are not two halves of anything. an index would imply both.
 */
export function probeName(condition, id = newId()) {
  if (!CONDITIONS.includes(condition)) {
    throw new Error(
      `Unknown condition ${JSON.stringify(condition)} — expected one of ${CONDITIONS.join(", ")}.`,
    );
  }
  return `${condition}-${id}`;
}

/**
 * @param {string} name a probe directory name
 * @returns {string|null} `null` when the name names no condition
 */
export function conditionOf(name) {
  return CONDITIONS.find((condition) => name.startsWith(`${condition}-`)) ?? null;
}

export function probePaths(probeDir) {
  return {
    metadata: join(probeDir, METADATA_FILE),
    transcript: join(probeDir, TRANSCRIPT_FILE),
    changes: join(probeDir, CHANGES_FILE),
  };
}

/**
 * the one serializer for anything this instrument writes and later compares.
 *
 * one, because the drift check compares a regeneration against a commit, and
 * that means something only if both went through the same function. it is also
 * why the derived surfaces are in .prettierignore: this repository's formatter
 * covers `**​/*.json`, and a reformatted summary would fail the check against
 * bytes this instrument never wrote.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
