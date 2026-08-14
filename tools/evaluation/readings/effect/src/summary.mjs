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
//
// the pass/fail reading of `checks` — `comparabilityOf` — is not here: it is
// the same operation regardless of what produced the checks, and lives in
// tools/evaluation/src/comparability.mjs instead.

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { parseTranscript, readBehaviour } from "../../../lib/transcript/index.mjs";
import { METADATA_FILE } from "../../../src/layout.mjs";
import { conditionOf, probePaths } from "./layout.mjs";

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
 * whether a probe's final assistant message reads as putting a decision to a
 * person instead of finishing the work.
 *
 * the heuristic stays narrow on purpose. the message must end on a question
 * mark — the run's very last word is a question, not a report followed by an
 * aside — and that question must use the wording an agent reaches for when it
 * is asking permission to proceed: "want me to", "should I", "do you want",
 * and the like. a looser match would start catching an ordinary clarifying
 * question asked in the middle of otherwise-finished work, which is a
 * different thing from a run that stopped instead of finishing.
 *
 * @param {string|null} text `transcript.finalAssistantText`; `null` reads as
 *   "solicited nothing", the same as everywhere else `null` appears in this
 *   derivation — the stream did not say, not that it disagrees
 * @returns {boolean}
 */
export function solicitsDecision(text) {
  if (typeof text !== "string") return false;
  const trimmed = text.trim();
  if (!trimmed.endsWith("?")) return false;
  return /\b(?:want me to|would you like|do you want|should i|shall i|ok(?:ay)?\s+(?:for me\s+)?to|let me know if|confirm)\b/i.test(
    trimmed,
  );
}

/**
 * an ATX heading marker: 1–6 "#" characters, then required whitespace.
 *
 * the trailing group is CommonMark's optional *closing sequence*, and the two
 * branches are what make it one rather than "strip any trailing hashes". A
 * closing run only closes when whitespace precedes it, so `## C#` is a heading
 * whose text ends in a hash rather than an empty one — `\s+#+` covers the
 * ordinary `## Heading ##`, and the lookbehind branch covers `## ###`, where
 * the single space after the opening run is also the one preceding the closing
 * run and there is no second space for `\s+` to take.
 */
const ATX_HEADING_RE = /^(#{1,6})\s+(.*?)(?:\s+#+|(?<=\s)#+)?\s*$/;

/** the opening (or matching closing) delimiter of a fenced code block. */
const FENCE_RE = /^(`{3,}|~{3,})/;

/**
 * the Markdown ATX headings of a probe's final assistant message, as plain
 * text — the leading "#" markers, any closing "#" sequence, and surrounding
 * whitespace all stripped — in document order.
 *
 * heading level is deliberately not recorded. this field exists to answer
 * "which sections did the document carry", not how they nest — a reader
 * checking that a generated PRD carries a Background and an Acceptance
 * criteria section has no use for whether one is "##" and the other "###",
 * and a caller who does can still re-derive it from `finalAssistantText`
 * itself.
 *
 * ATX headings only ("# Heading"). setext headings (a line of prose followed
 * by a line of "===" or "---") are not recognized — a known gap, in the same
 * register `artifact.mjs`'s header states its own regex reader's gaps in,
 * and one the PRD-shaped answers this field exists to read do not lean on:
 * every case measured so far writes ATX-style.
 *
 * a line inside a fenced code block is never read as a heading, even when it
 * starts with "#" — a shell comment or a Python comment in a fenced snippet
 * is not a section of the document, and the PRD-shaped final messages this
 * field exists to read do contain fenced blocks (a system-design diagram, a
 * sample command). fence state is tracked line by line: a line whose trimmed
 * text starts with three or more backticks or tildes opens a fence (using
 * that character) or, when already inside one opened with the same
 * character, closes it — mirroring how a Markdown renderer reads it. an
 * unclosed fence is read as running to the end of the message, so nothing
 * after it is read as a heading either.
 *
 * @param {string|null} text `transcript.finalAssistantText`
 * @returns {string[]|null} in document order; `[]` when there is text but no
 *   heading; `null` when `text` is `null` — the stream did not say, the same
 *   convention every other field in this module follows
 */
export function finalMessageHeadings(text) {
  if (typeof text !== "string") return null;
  const headings = [];
  let fence = null; // the fence character currently open, or null outside one
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    const fenceMatch = FENCE_RE.exec(trimmed);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (fence === null) fence = marker;
      else if (fence === marker) fence = null;
      continue;
    }
    if (fence !== null) continue;
    const headingMatch = ATX_HEADING_RE.exec(trimmed);
    if (headingMatch) headings.push(headingMatch[2]);
  }
  return headings;
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
 * a probe's own declared skills that its own loaded set actually contains.
 *
 * pure function of one probe's own files, on purpose: this is the local
 * reading `deriveProbeSummary` is limited to. the case-level judgement of
 * what that local fact means — confirmed, contradicted, or unavailable —
 * belongs to `runComparabilityChecks`, which is the only place that sees
 * every probe in the measurement at once.
 *
 * @param {Record<string, unknown>} configuration this probe's own declared configuration
 * @param {string[]|null} loadedSkills this probe's own loaded set
 * @returns {string[]|null} sorted; `null` when `loadedSkills` is `null` — the
 *   stream did not say, not that it disagrees; `[]` when the probe declares
 *   no skills, or none of what it declares shows up loaded
 */
function declaredSkillsLoadedOf(configuration, loadedSkills) {
  if (loadedSkills === null) return null;
  const declared = new Set(Object.keys(configuration?.skills ?? {}));
  return loadedSkills.filter((name) => declared.has(name)).sort();
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
  const changed = changedPaths(changesText);

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
    // the local half of the outcome-based confirmation that the treatment
    // arrived: which of *this* probe's own declared skills its own loaded set
    // actually contains. `runComparabilityChecks` turns this into a
    // case-level judgement across every probe.
    declaredSkillsLoaded: declaredSkillsLoadedOf(configuration, transcript.loadedSkills),
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
    changedPaths: changed,
    // gated on an empty diff, deliberately: this field exists to split that
    // bucket into "asked a person and stopped" and "produced nothing and did
    // not say why" — not to flag every probe whose last word is a question. a
    // probe that did the work and then asked a follow-up ("want the same
    // change applied to the other module too?") is not the failure mode being
    // tracked here, and folding it in would blur two different outcomes into
    // one boolean.
    endedAwaitingDecision: changed.length === 0 && solicitsDecision(transcript.finalAssistantText),
    // which sections a document delivered in the final message carries, not
    // how good it is. see `finalMessageHeadings`'s own doc comment for what
    // this does and does not read.
    finalMessageHeadings: finalMessageHeadings(transcript.finalAssistantText),
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

  // contamination, not the raw loaded set. no available flag can guarantee
  // the CLI loads nothing: `--setting-sources project` strips the user-level
  // skills, but the ones a managed environment injects cannot be stripped
  // without also stripping the workspace's own, which are the treatment. so
  // the achievable invariant is that whatever contamination exists is the
  // same on both sides, where it cancels — and the treatment itself must not
  // be part of what gets subtracted out, or this check would fail the one
  // measurement it exists to allow. each probe's own declared skills (the
  // keys of its own `configuration.skills`) are subtracted from its own
  // loaded set before comparing; on every record where the runtime reports no
  // workspace skill at all, that subtraction is a no-op and this check reads
  // exactly as it did before. order is not signal, so compare sorted. `null`
  // passes through unchanged — the stream did not say, and subtracting from
  // "did not say" cannot turn it into "said empty".
  const contaminationOf = (probe, summary) => {
    if (summary.loadedSkills === null) return null;
    const declared = new Set(Object.keys(configurationOf(probe).skills ?? {}));
    return [...summary.loadedSkills].filter((name) => !declared.has(name)).sort();
  };
  const loaded = distinct(probes.map((probe, index) => contaminationOf(probe, derived[index])));
  record(
    "one loaded skill set",
    loaded.length === 1,
    loaded.length === 1
      ? `every probe's contamination is ${loaded[0]}`
      : `probes disagree, so contamination does not cancel between the conditions: ${loaded.join(" vs ")}`,
  );

  // the outcome-based confirmation that the treatment actually reached the
  // skill-present condition — resolved here, not in `deriveProbeSummary`,
  // because it is a judgement across every probe in the measurement, not a
  // fact about any one of them.
  const declaredLoadedByProbe = probes.map((probe, index) => ({
    probe,
    declaredSkills: Object.keys(configurationOf(probe).skills ?? {}),
    declaredSkillsLoaded: derived[index].declaredSkillsLoaded,
  }));
  const anyDeclaredSkillReported = declaredLoadedByProbe.some(
    (entry) => Array.isArray(entry.declaredSkillsLoaded) && entry.declaredSkillsLoaded.length > 0,
  );
  if (!anyDeclaredSkillReported) {
    // unavailable, and that passes, deliberately. failing here would mark
    // every measurement this runtime ever produces incomparable for missing
    // information the runtime never offered — a finding about the runtime,
    // not about the measurement. the gap still belongs in the record, so it
    // is named in the detail rather than swallowed by a passing check with
    // nothing to say.
    record(
      "the treatment reached the skill-present condition",
      true,
      "no probe reported a declared skill in its loaded set, so this runtime does not announce " +
        "workspace skills and this measurement cannot confirm the treatment arrived",
    );
  } else {
    const missingInPresent = declaredLoadedByProbe.filter(
      (entry) =>
        entry.probe.condition === "skill-present" &&
        entry.declaredSkills.some((name) => !(entry.declaredSkillsLoaded ?? []).includes(name)),
    );
    const leakedInAbsent = declaredLoadedByProbe.filter(
      (entry) => entry.probe.condition === "skill-absent" && (entry.declaredSkillsLoaded ?? []).length > 0,
    );
    const offending = [...missingInPresent, ...leakedInAbsent].map((entry) => entry.probe.name);
    record(
      "the treatment reached the skill-present condition",
      offending.length === 0,
      offending.length === 0
        ? "every skill-present probe's loaded set carries every declared skill, and no " +
          "skill-absent probe's carries one"
        : `the runtime reports declared skills, but not where expected: ${offending.join(", ")}`,
    );
  }

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
