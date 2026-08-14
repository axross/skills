// discovery's own on-disk shape: one probe directory per REPEAT rather than
// per condition — discovery has no second condition to pair against, so
// `probe-<id>` replaces the effect side's `<condition>-<id>`.
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
// README, "A discovery probe produces no artifact"). the file names
// themselves, the id generator, and the canonical serializer are shared —
// see tools/evaluation/src/layout.mjs.

import { join } from "node:path";

import { dataRootFor, METADATA_FILE, newId, TRANSCRIPT_FILE } from "../../../src/layout.mjs";

export const DATA_ROOT = dataRootFor("discovery");

/** every probe directory under a case measurement starts with this. */
export const PROBE_PREFIX = "probe";

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
