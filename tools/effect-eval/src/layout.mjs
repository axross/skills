// layout.mjs — where a case measurement's files live, and what they are called.
//
// THREE KINDS OF FILE, THREE RULES. The whole storage design turns on keeping
// them apart, because they answer different questions when something goes
// wrong:
//
//   measured   transcript.jsonl, changes.patch   never regenerated; re-acquiring
//                                                them costs a paid probe
//   declared   metadata.json                     what was SET; the argv is
//                                                derived from it
//   derived    summary.json                      regenerable; a drift check
//                                                re-derives and fails on a
//                                                mismatch
//
// A file in the wrong category is the failure this layout exists to prevent: a
// derived value stored as measured is a value nothing can check, and a measured
// value treated as derived is a value something will cheerfully regenerate as
// empty.
//
// PROBE DIRECTORIES ARE NAMED `<condition>-<id>`, NOT `<condition>-<index>`.
// Repetitions of one condition have no ordering — they are not a series — and
// they are not paired across conditions, so `skill-absent-0` and
// `skill-present-0` are not two halves of anything. An index would imply both.
// Eight random hex digits imply neither.

import { randomBytes } from "node:crypto";
import { join } from "node:path";

/** The two conditions one case measurement compares. */
export const CONDITIONS = ["skill-absent", "skill-present"];

export const METADATA_FILE = "metadata.json";
export const TRANSCRIPT_FILE = "transcript.jsonl";
export const CHANGES_FILE = "changes.patch";
export const SUMMARY_FILE = "summary.json";
export const FIXTURE_FILE = "fixture.json";
export const MEASUREMENTS_DIR = "measurements";

/** Eight random hex digits — see this module's header on why not an index. */
export function newId() {
  return randomBytes(4).toString("hex");
}

/** `<case>-<id>`, the directory one case measurement occupies. */
export function caseMeasurementName(caseId, id = newId()) {
  return `${caseId}-${id}`;
}

/** `<condition>-<id>`, the directory one probe occupies. */
export function probeName(condition, id = newId()) {
  if (!CONDITIONS.includes(condition)) {
    throw new Error(
      `Unknown condition ${JSON.stringify(condition)} — expected one of ${CONDITIONS.join(", ")}.`,
    );
  }
  return `${condition}-${id}`;
}

/**
 * The condition a probe directory name declares.
 *
 * @param {string} name a probe directory name
 * @returns {string|null} the condition, or `null` when the name is not one
 */
export function conditionOf(name) {
  return CONDITIONS.find((condition) => name.startsWith(`${condition}-`)) ?? null;
}

/** Paths inside one probe directory. */
export function probePaths(probeDir) {
  return {
    metadata: join(probeDir, METADATA_FILE),
    transcript: join(probeDir, TRANSCRIPT_FILE),
    changes: join(probeDir, CHANGES_FILE),
  };
}

/**
 * Canonical JSON bytes for anything this instrument writes and later compares.
 *
 * TWO PROPERTIES, BOTH LOAD-BEARING. Two-space indent and a trailing newline
 * are what a text tool expects; and the bytes are produced by exactly one
 * function, so the drift check compares a regeneration against a commit rather
 * than comparing two formatters' opinions. `data/*​/measurements/` is in
 * .prettierignore for the same reason: this repository's own formatter covers
 * `**​/*.json`, and a reformatted summary would fail the drift check against
 * bytes this instrument never wrote.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
