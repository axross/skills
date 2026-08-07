// record.mjs — the raw per-run record a value-eval probe writes, and nothing
// more.
//
// MEASUREMENT STAYS SEPARATE FROM JUDGMENT, THROUGHOUT THIS AXIS. Issue
// #235's system design mirrors the existing run.mjs -> compare.mjs ->
// report.mjs split on purpose: because probes are expensive here, that
// separation is what lets a later threshold be re-derived from stored
// records rather than re-bought. So this record carries no verdict field and
// no field that reduces the data to a judgment — not a pass/fail, not a
// score, not "worth its tokens". `RECORD_FIELDS` below is the complete field
// set, spelled out once so a stray key added later is easy to catch (see
// `buildRunRecord`'s own guard) and easy to read against that claim.
//
// SERIALISATION: newline-delimited JSON (NDJSON), one record per line,
// appended rather than rewritten. Chosen over a single JSON array because:
//   - runs accumulate one at a time, across SEPARATE probe.mjs invocations —
//     each run is its own process, and the cumulative stop-loss in
//     stop-loss.mjs is exactly this shape ("after each run") — so appending
//     one line needs no re-parse of everything recorded so far, where a JSON
//     array would have to be read, extended, and rewritten whole every time;
//   - every line is independently valid JSON, so a reviewer or a later
//     analysis script can process one run at a time (grep, jq, a streaming
//     read) without holding the whole file in memory;
//   - a file half-written when something reads it costs at most the one
//     record in progress — the same forgiving shape stream.mjs documents for
//     the CLI's own JSONL output, and for the same reason: a partial line at
//     the end is ordinary, not corruption.
//
// WHAT IS PERSISTED IS THE EXTRACTED SIGNAL, NOT THE RAW STREAM. probe.mjs's
// full per-tool-call list exists transiently while extracting; this record
// keeps only transcript.mjs's and artifact.mjs's outputs, plus the raw diff
// (named explicitly in issue #235's functional requirements as something a
// probe captures). That mirrors discovery-eval/run.mjs's own precedent:
// nothing there persists the raw JSONL either, only parseStream's narrower
// extraction. A future re-derivation this axis's stated goal is built around
// — "a later threshold... re-derived from stored data rather than
// re-bought" — is a threshold over the SIGNAL already extracted here, the
// same shape discovery-eval's compare.mjs re-derives tallies from run.mjs's
// stored selections rather than from a stored transcript.

import { appendFile, readFile } from "node:fs/promises";

/** The record's complete field set — see this module's header. */
const RECORD_FIELDS = [
  "arm",
  "runIndex",
  "mock",
  "skills",
  "prompt",
  "targetModule",
  "turns",
  "costUsd",
  "truncated",
  "loadedSkills",
  "cliExitCode",
  "transcript",
  "artifact",
  "diff",
  "recordedAt",
];

/**
 * Builds one run's record from already-extracted, already-mechanical data —
 * nothing here interprets any of it.
 *
 * @param {{
 *   arm: string,
 *   runIndex: number,
 *   mock: string,
 *   skills: string[],
 *   prompt: string,
 *   targetModule: string,
 *   cliExitCode: number|null,
 *   transcript: ReturnType<typeof import("./transcript.mjs").extractTranscript>,
 *   artifact: ReturnType<typeof import("./artifact.mjs").extractArtifact>,
 *   diff: string|null,
 *   recordedAt?: string,
 * }} input
 * @returns {Readonly<Record<string, unknown>>} frozen; keys are exactly `RECORD_FIELDS`
 */
export function buildRunRecord({
  arm,
  runIndex,
  mock,
  skills,
  prompt,
  targetModule,
  cliExitCode,
  transcript,
  artifact,
  diff,
  // Truncated to whole seconds, matching discovery-eval/run.mjs's own
  // snapshot timestamp: a run takes minutes, so millisecond precision would
  // claim precision the measurement does not have.
  recordedAt = `${new Date().toISOString().slice(0, 19)}Z`,
}) {
  const record = {
    arm,
    runIndex,
    mock,
    skills: [...skills],
    prompt,
    targetModule,
    turns: transcript.turns,
    costUsd: transcript.cost,
    truncated: transcript.truncated,
    loadedSkills: transcript.loadedSkills,
    cliExitCode,
    transcript,
    artifact,
    diff,
    recordedAt,
  };

  // Defensive, not decorative: a field added above without updating
  // RECORD_FIELDS is exactly the drift "no verdict field" depends on staying
  // visible, so this fails loudly rather than shipping a record nobody
  // checked against the list they read as authoritative.
  const unexpected = Object.keys(record).filter((key) => !RECORD_FIELDS.includes(key));
  if (unexpected.length > 0) {
    throw new Error(`buildRunRecord produced unexpected field(s): ${unexpected.join(", ")}`);
  }

  return Object.freeze(record);
}

/** @param {Record<string, unknown>} record @returns {string} one NDJSON line, newline-terminated */
export function serializeRunRecord(record) {
  return `${JSON.stringify(record)}\n`;
}

/**
 * Appends one run's record to a records file, creating it if absent.
 *
 * @param {string} path
 * @param {Record<string, unknown>} record
 */
export async function appendRunRecord(path, record) {
  await appendFile(path, serializeRunRecord(record), "utf8");
}

/**
 * Reads every record already accumulated in a records file.
 *
 * @param {string} path
 * @returns {Promise<Record<string, unknown>[]>} `[]` when the file does not exist yet
 */
export async function readRunRecords(path) {
  let raw;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line));
}
