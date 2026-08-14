// effect's own on-disk shape: one probe directory per `<condition>-<id>`,
// pairing a repetition against the condition it ran under, and the one
// extra measured file — `changes.patch` — a discovery probe never produces
// (the editing tools are denied there; see the discovery reading's own
// layout.mjs). the file names it shares with discovery, the id generator,
// and the canonical serializer live in tools/evaluation/src/layout.mjs.

import { join } from "node:path";

import { dataRootFor, METADATA_FILE, newId, TRANSCRIPT_FILE } from "../../../src/layout.mjs";

/** the two conditions one case measurement compares. */
export const CONDITIONS = ["skill-absent", "skill-present"];

export const CHANGES_FILE = "changes.patch";

export const DATA_ROOT = dataRootFor("effect");

/**
 * `<condition>-<id>`, not `<condition>-<index>`.
 *
 * repetitions of one condition have no ordering — they are not a series — and
 * they are not paired across conditions, so `skill-absent-0` and
 * `skill-present-0` are not two halves of anything. an index would imply both.
 *
 * @throws {Error} when `condition` is not one of the known conditions
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
