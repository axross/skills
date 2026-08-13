// the derived layer: per-probe summaries, the checks that decide whether a
// case measurement measures anything, the MISS/SPURIOUS/coverage verdicts,
// and the delta against the most recent comparable predecessor.
//
// everything here is a pure function of its arguments — the measured and
// declared files a caller reads in, or the already-derived summaries a caller
// passes in for a cross-measurement comparison. that purity is what makes
// summarize.mjs's `--check` a real drift check: re-deriving a committed
// summary and comparing bytes only means something if the derivation cannot
// consult the clock, the environment, or the live corpus on disk.
//
// COMPARABILITY HAS TWO SCOPES, AND THEY GET DIFFERENT TREATMENT.
//
//   * WITHIN one measurement — `runComparabilityChecks` /
//     `comparabilityOf` — probes that ran under different conditions (a
//     different project tree, a different corpus, a different loaded skill
//     set) cannot be read as one measurement of anything, so a failure here
//     is a hard finding: the case's `comparable` flag goes false and the
//     landing job (a later part of this issue) refuses to commit it.
//   * ACROSS measurements of the same case — `findComparablePredecessor` /
//     `deriveDelta` — a predecessor that differs is ordinary. It is recorded
//     with the reason it is not attributable, never suppressed, and never
//     thrown: a case with no comparable history yet is reported as such.
//     `predecessorMismatches` compares the prompt, the model, the project
//     tree, the tracked skills' `description` digests, AND THE PROBE'S
//     RUNTIME — name, version, and the `maxTurns`/`allowedTools`/
//     `disallowedTools` options a probe actually ran under. A runtime change
//     is exactly the kind of thing that must never be read as a change in a
//     skill: raising `plan.mjs`'s `BARE_TURN_CAP` is the case in point — a
//     bare measurement taken after that raise is not comparable with one
//     taken before it, and without this check it would be judged comparable
//     anyway, silently attributing a wider turn cap's effect to a skill.
//
// VERDICTS CARRY OVER UNCHANGED from the replaced instrument's
// asymmetric rule: `mustInclude` is a finding only at ZERO hits, because a
// skill selected even once is demonstrably reachable and a stray selection of
// a `mustExclude` skill is not itself a defect. `expectAlways` does not
// return — the mandated population it served is now measured and reported as
// its own question, per this instrument's fixture schema. ONE ADDITION: a
// case whose every probe was unreadable (`repeats === 0`) verdicts as
// `UNEVIDENCED_VERDICT`, never `miss` — `hits === 0` used to mean both "asked
// and never selected" and "never readably asked at all", and only the first
// of those is actually a finding. See `verdictFor` and
// `UNEVIDENCED_VERDICT`'s own comment.
//
// AN UNREADABLE PROBE NEVER ENTERS THE TALLY'S DENOMINATOR. A probe whose
// transcript ended in `error_max_turns` with no `Skill` call recorded before
// the cap fired (signals.mjs) is excluded from both the hit count and the
// repeat count a rate is computed over — counting it as a zero-hit repeat
// would be exactly the "selection of nothing" the signal extractor's own
// contract refuses to claim. A probe that ended in `error_max_turns` HAVING
// already selected something is readable and counted exactly as a `success`
// probe's selection would be — see signals.mjs's header for why those two
// truncated cases are not the same evidence.

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { classifyLoaded } from "./isolation.mjs";
import { isProbeName, METADATA_FILE, probePaths } from "./layout.mjs";
import { extractSignals } from "./signals.mjs";

/**
 * @param {string} probeDir
 * @param {string} name the directory's own name
 * @throws {Error} when either file cannot be read, when the metadata is not
 *   valid JSON, or when `name` does not name a probe directory
 */
export async function readProbe(probeDir, name) {
  if (!isProbeName(name)) {
    throw new Error(
      `Probe directory ${JSON.stringify(name)} does not name a probe; expected it to start ` +
        'with "probe-".',
    );
  }
  const paths = probePaths(probeDir);
  const [metadataRaw, transcriptText] = await Promise.all([
    readFile(paths.metadata, "utf8"),
    readFile(paths.transcript, "utf8"),
  ]);

  let metadata;
  try {
    metadata = JSON.parse(metadataRaw);
  } catch (error) {
    throw new Error(`${name}/${METADATA_FILE} is not valid JSON: ${error.message}`);
  }

  return { name, metadata, transcriptText };
}

/**
 * @param {Awaited<ReturnType<typeof readProbe>>} probe
 * @returns {Record<string, unknown>}
 * @throws {Error} when the transcript contradicts what `metadata.json` declared
 */
export function deriveProbeSummary(probe) {
  const { name, metadata, transcriptText } = probe;
  const configuration = metadata?.configuration;
  if (!configuration) {
    throw new Error(`${name}/${METADATA_FILE} carries no "configuration" object.`);
  }

  const signals = extractSignals(transcriptText);

  // a value the transcript contradicts fails the derivation; one it is
  // silent about does not — see tools/evaluation/lib/transcript's null-means-did-not-say
  // convention, which signals.mjs follows.
  const disagreements = [];
  if (signals.model !== null && signals.model !== configuration.model?.model) {
    disagreements.push(
      `declared model ${JSON.stringify(configuration.model?.model)} but the transcript ` +
        `reports ${JSON.stringify(signals.model)}`,
    );
  }
  if (
    signals.runtimeVersion !== null &&
    configuration.runtime?.version !== null &&
    signals.runtimeVersion !== configuration.runtime?.version
  ) {
    disagreements.push(
      `declared runtime version ${JSON.stringify(configuration.runtime?.version)} but the ` +
        `transcript reports ${JSON.stringify(signals.runtimeVersion)}`,
    );
  }
  if (disagreements.length > 0) {
    throw new Error(`${name}: ${disagreements.join("; ")}.`);
  }

  return {
    probe: name,
    mode: configuration.workspace?.mode ?? null,
    turns: signals.turns,
    terminalReason: signals.terminalReason,
    readable: signals.readable,
    pathsBeforeSelection: signals.pathsBeforeSelection,
    selectedSkills: signals.selectedSkills,
    loadedSkills: signals.loadedSkills,
    isolation:
      signals.loadedSkills === null
        ? null
        : classifyLoaded(signals.loadedSkills, configuration.invocability ?? {}),
    costUsd: signals.costUsd,
  };
}

/**
 * @param {Array<Awaited<ReturnType<typeof readProbe>>>} probes
 * @param {Array<Record<string, unknown>>} derived one per probe, same order
 * @param {number|null} declaredRepeats the case's declared `repeats`
 * @returns {Array<{ check: string, passed: boolean, detail: string }>}
 */
export function runComparabilityChecks(probes, derived, declaredRepeats) {
  const checks = [];
  const record = (check, passed, detail) => checks.push({ check, passed, detail });
  const configurationOf = (probe) => probe.metadata.configuration;
  const distinct = (values) => [...new Set(values.map((value) => JSON.stringify(value)))];

  const prompts = distinct(probes.map((probe) => configurationOf(probe).case?.prompt));
  record(
    "one prompt",
    prompts.length === 1,
    prompts.length === 1 ? "every probe shares the same prompt" : "probes disagree on the prompt",
  );

  for (const [label, read] of [
    ["model", (config) => config.model?.model],
    ["runtime version", (config) => config.runtime?.version],
    ["probe mode", (config) => config.workspace?.mode],
    ["project tree", (config) => config.workspace?.tree],
  ]) {
    const values = distinct(probes.map((probe) => read(configurationOf(probe))));
    record(
      `one ${label}`,
      values.length === 1,
      values.length === 1
        ? `every probe shares ${values[0]}`
        : `probes disagree: ${values.join(" vs ")}`,
    );
  }

  const skillMaps = distinct(probes.map((probe) => configurationOf(probe).skills));
  record(
    "one corpus digest",
    skillMaps.length === 1,
    skillMaps.length === 1
      ? "every probe installed the same set of description digests"
      : "probes disagree on which description digests they installed",
  );

  // identical, not empty — no available flag guarantees the CLI loads
  // nothing (see spawn.mjs's SETTING_SOURCES), so the achievable invariant is
  // that whatever loaded outside the workspace's own install is the same
  // across every probe of this measurement. order is not signal, so compare
  // sorted, mirroring tools/evaluation/effect/src/summary.mjs's identical check.
  const loaded = distinct(
    derived.map((summary) =>
      Array.isArray(summary.loadedSkills) ? [...summary.loadedSkills].sort() : summary.loadedSkills,
    ),
  );
  record(
    "one loaded skill set",
    loaded.length === 1,
    loaded.length === 1
      ? `every probe loaded ${loaded[0]}`
      : `probes disagree, so contamination does not cancel between them: ${loaded.join(" vs ")}`,
  );

  if (declaredRepeats !== null) {
    record(
      "declared repeat count",
      probes.length === declaredRepeats,
      probes.length === declaredRepeats
        ? `${declaredRepeats} repeat(s), ${probes.length} probe director${probes.length === 1 ? "y" : "ies"}`
        : `the case declares ${declaredRepeats} repeat(s) but ${probes.length} probe ` +
          `director${probes.length === 1 ? "y" : "ies"} are present`,
    );
  }

  return checks;
}

/**
 * @param {Record<string, unknown>} summary
 * @returns {{ comparable: boolean, failures: string[] }}
 */
export function comparabilityOf(summary) {
  const failures = (summary.checks ?? [])
    .filter((check) => !check.passed)
    .map((check) => `${check.check}: ${check.detail}`);
  return { comparable: failures.length === 0, failures };
}

/** a skill counts once per repeat above this rate to be `SPURIOUS`. */
export const SELECTION_RATE = 0.5;

/**
 * the verdict for a skill this case tracks when every probe of the case was
 * unreadable — `repeats === 0`. Deliberately not one of the tier verdicts
 * below and, just as deliberately, not in `FINDING_VERDICTS`: a case with no
 * readable probe has produced no evidence about the skill one way or the
 * other, and reporting `miss` (the old behaviour at `hits === 0`, which never
 * distinguished "zero readable hits" from "zero readable probes") would
 * assert a conclusion the case never reached. It must still surface
 * somewhere a reader looks, or the absence reads as "fine" — which is worse
 * than the wrong MISS it replaces — so callers that render a report must
 * check `repeats`/`readableCount` rather than trust `findings` to say
 * everything.
 */
export const UNEVIDENCED_VERDICT = "unevidenced";

/** @returns {"mustInclude"|"mustExclude"|"mayInclude"|null} */
function tierOf(testCase, skill) {
  if (testCase.mustInclude?.includes(skill)) return "mustInclude";
  if (testCase.mustExclude?.includes(skill)) return "mustExclude";
  if (testCase.mayInclude?.includes(skill)) return "mayInclude";
  return null;
}

/**
 * classify one skill's tally. carried over from the replaced instrument's own
 * verdict rule, minus the retired `expectAlways` tier, plus one addition this
 * instrument's own defect required: `repeats === 0` is answered before the
 * tier switch, for every tier, because a case with no readable probe has not
 * demonstrated a miss (or a clear, or anything else) — it has demonstrated
 * nothing. See `UNEVIDENCED_VERDICT`'s own comment for why that must be a
 * distinct outcome rather than falling through to whatever `hits === 0`
 * already returned for the tier.
 *
 * @param {"mustInclude"|"mustExclude"|"mayInclude"|null} tier
 * @param {number} hits readable repeats in which the skill was selected
 * @param {number} repeats readable repeats total
 * @returns {"miss"|"clear"|"weak"|"spurious"|"occasional"|"optional"|"unlabelled"|"unevidenced"}
 */
export function verdictFor(tier, hits, repeats) {
  if (repeats === 0) return UNEVIDENCED_VERDICT;
  const rate = hits / repeats;
  switch (tier) {
    case "mustInclude":
      // zero, not a majority: a skill selected even once is demonstrably
      // reachable, and calling that a miss would misreport a contested case.
      if (hits === 0) return "miss";
      return rate > SELECTION_RATE ? "clear" : "weak";
    case "mustExclude":
      if (hits === 0) return "clear";
      return rate > SELECTION_RATE ? "spurious" : "occasional";
    case "mayInclude":
      return "optional";
    default:
      return "unlabelled";
  }
}

/**
 * verdicts that are themselves a finding worth surfacing.
 *
 * `UNEVIDENCED_VERDICT` is deliberately excluded: it is a claim about the
 * probes, not the skill, so folding it into `findings` would report "this
 * case has a problem" for a case that may be fine and simply went unread.
 * `deriveCaseSummary`'s `readableCount` (and this tally's own `repeats`) is
 * where a reader finds that condition instead.
 */
const FINDING_VERDICTS = new Set(["miss", "spurious"]);

/** the skills a case tracks: the union of its mustInclude and mustExclude tiers. */
export function trackedSkillsOf(testCase) {
  return [...new Set([...(testCase.mustInclude ?? []), ...(testCase.mustExclude ?? [])])];
}

/**
 * tally a case's READABLE selections and classify every skill that appeared
 * or was labelled.
 *
 * @param {{ mustInclude?: string[], mustExclude?: string[], mayInclude?: string[] }} testCase
 * @param {string[][]} readableSelections one entry per readable probe, that
 *   probe's `selectedSkills`
 * @returns {{
 *   repeats: number,
 *   tracked: string[],
 *   skills: Array<{ name: string, hits: number, rate: number, tier: string|null, verdict: string }>,
 *   coverage: { covered: number, repeats: number, skills: string[] } | null,
 *   findings: Array<{ kind: string, skill: string, hits: number, repeats: number }>,
 * }}
 */
export function tallyVerdicts(testCase, readableSelections) {
  const repeats = readableSelections.length;

  const hitsBySkill = new Map();
  for (const selection of readableSelections) {
    for (const skill of new Set(selection)) {
      hitsBySkill.set(skill, (hitsBySkill.get(skill) ?? 0) + 1);
    }
  }

  const tracked = trackedSkillsOf(testCase);
  // labelled-but-never-selected skills must still appear, or a MISS would be
  // invisible.
  const names = new Set([...hitsBySkill.keys(), ...tracked]);

  const skills = [...names]
    .map((name) => {
      const hits = hitsBySkill.get(name) ?? 0;
      const tier = tierOf(testCase, name);
      return {
        name,
        hits,
        rate: repeats === 0 ? 0 : hits / repeats,
        tier,
        verdict: verdictFor(tier, hits, repeats),
      };
    })
    .sort((a, b) => b.hits - a.hits || a.name.localeCompare(b.name));

  // the coverage line: across the readable repeats, how often did the case
  // get ANY of its mustInclude skills — only meaningful once two compete.
  const coverage =
    (testCase.mustInclude?.length ?? 0) >= 2
      ? {
          covered: readableSelections.filter((selection) =>
            selection.some((skill) => testCase.mustInclude.includes(skill)),
          ).length,
          repeats,
          skills: [...testCase.mustInclude],
        }
      : null;

  const findings = skills
    .filter((skill) => FINDING_VERDICTS.has(skill.verdict))
    .map((skill) => ({ kind: skill.verdict, skill: skill.name, hits: skill.hits, repeats }));

  return { repeats, tracked, skills, coverage, findings };
}

/**
 * @param {string} caseDir a `<case-id>-<id>` measurement directory
 * @param {{ declaredRepeats?: number|null, measurementName?: string|null }} [options]
 * @returns {Promise<Record<string, unknown>>}
 * @throws {Error} when `caseDir` cannot be read or holds no probe
 *   directories, or when any probe in it fails to read or to summarize
 */
export async function deriveCaseSummary(
  caseDir,
  { declaredRepeats = null, measurementName = null } = {},
) {
  const entries = await readdir(caseDir, { withFileTypes: true });
  const names = entries
    .filter((entry) => entry.isDirectory() && isProbeName(entry.name))
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
  const checks = runComparabilityChecks(probes, derived, declaredRepeats);

  const configuration = probes[0].metadata.configuration;
  const testCase = configuration.case;

  const readable = derived.filter((summary) => summary.readable);
  const verdict = tallyVerdicts(testCase, readable.map((summary) => summary.selectedSkills ?? []));

  const totalCost = derived.reduce(
    (sum, summary) => (typeof summary.costUsd === "number" ? sum + summary.costUsd : sum),
    0,
  );
  const timestamps = probes
    .map((probe) => probe.metadata.timestamp)
    .filter((value) => typeof value === "string")
    .sort();

  return {
    measurement: measurementName,
    // lifted out of the probes so a reader does not have to open one to know
    // what this measurement is.
    case: testCase,
    workspace: configuration.workspace,
    runtime: configuration.runtime,
    model: configuration.model,
    skills: configuration.skills,
    timestamp: timestamps.at(-1) ?? null,
    comparable: checks.every((check) => check.passed),
    checks,
    probeCount: probes.length,
    readableCount: readable.length,
    totalCostUsd: totalCost,
    verdict,
    probes: derived,
  };
}

/**
 * every `runtime` field a predecessor comparison must agree on: the CLI name
 * and version, plus the three options a probe's tool posture and turn budget
 * come from. Compared field by field, named individually, for the same
 * reason the tracked-skill digests below are — a reader should not have to
 * diff two whole `runtime` objects by hand to learn what actually moved.
 *
 * @param {Record<string, unknown>|undefined} current a summary's `runtime`
 * @param {Record<string, unknown>|undefined} prior the predecessor's `runtime`
 * @returns {string[]}
 */
function runtimeMismatches(current, prior) {
  const mismatches = [];
  const fields = [
    ["name", (r) => r?.name ?? null],
    ["version", (r) => r?.version ?? null],
    ["maxTurns", (r) => r?.options?.maxTurns ?? null],
    ["allowedTools", (r) => r?.options?.allowedTools ?? null],
    ["disallowedTools", (r) => r?.options?.disallowedTools ?? null],
  ];
  for (const [label, read] of fields) {
    const now = read(current);
    const then = read(prior);
    // arrays (allowedTools/disallowedTools) compare by value, not identity —
    // JSON.stringify is enough here because plan.mjs/spawn.mjs always build
    // these in a fixed order, never assembled from a Set or object keys.
    if (JSON.stringify(now) !== JSON.stringify(then)) {
      mismatches.push(`runtime ${label} differs: now ${JSON.stringify(now)}, then ${JSON.stringify(then)}`);
    }
  }
  return mismatches;
}

/**
 * why `prior` cannot serve as `current`'s comparable predecessor — empty
 * means it can.
 *
 * @param {Record<string, unknown>} current
 * @param {Record<string, unknown>} prior
 * @param {string[]} tracked the current case's tracked skills
 * @returns {string[]}
 */
function predecessorMismatches(current, prior, tracked) {
  const mismatches = [];
  if (current.case?.prompt !== prior.case?.prompt) {
    mismatches.push("prompt differs");
  }
  if (current.model?.model !== prior.model?.model) {
    mismatches.push(
      `model differs: now ${JSON.stringify(current.model?.model)}, then ${JSON.stringify(prior.model?.model)}`,
    );
  }
  if (current.workspace?.tree !== prior.workspace?.tree) {
    mismatches.push("project tree differs");
  }
  // name, version, and the tool/turn options a probe actually ran under — a
  // change here (raising BARE_TURN_CAP, denying a new tool) must never be
  // read as a change in a skill. see this module's header.
  mismatches.push(...runtimeMismatches(current.runtime, prior.runtime));
  // named individually rather than as "the tracked set differs", so the
  // reason points at the skill that actually moved rather than making a
  // reader diff the two measurements by hand to find it.
  const changedTracked = [...tracked]
    .sort()
    .filter((name) => (current.skills?.[name] ?? null) !== (prior.skills?.[name] ?? null));
  if (changedTracked.length > 0) {
    mismatches.push(`description digest differs for tracked skill(s): ${changedTracked.join(", ")}`);
  }
  return mismatches;
}

/**
 * look back through a case's other measurements for the most recent
 * comparable one — same prompt, same model, same project tree, same
 * `runtime` (name, version, `maxTurns`, `allowedTools`, `disallowedTools`),
 * and the same `description` digest for the skills this case tracks.
 *
 * "look back" is literal: a candidate is considered only when it is
 * timestamped strictly before `current`. Without that filter a case's
 * earliest measurement could pick a LATER sibling as its own "predecessor" —
 * `priors` here is simply every other measurement of the case, with no
 * ordering guarantee, so recency has to be enforced rather than assumed.
 *
 * @param {Record<string, unknown>} current the measurement to find a
 *   predecessor for
 * @param {Array<Record<string, unknown>>} priors this case's OTHER committed
 *   measurements, in any order — some may be chronologically AFTER `current`
 * @param {string[]} tracked `trackedSkillsOf(current.case)`
 * @returns {{ usable: true, predecessor: Record<string, unknown> } | { usable: false, reason: string }}
 */
export function findComparablePredecessor(current, priors, tracked) {
  if (priors.length === 0) {
    return { usable: false, reason: "no prior measurement of this case exists yet" };
  }

  const earlier =
    typeof current.timestamp === "string"
      ? priors.filter(
          (prior) => typeof prior.timestamp === "string" && prior.timestamp < current.timestamp,
        )
      : [];
  const byRecency = [...earlier].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  if (byRecency.length === 0) {
    return {
      usable: false,
      reason: "no measurement of this case is timestamped earlier than this one",
    };
  }

  for (const prior of byRecency) {
    if (predecessorMismatches(current, prior, tracked).length === 0) {
      return { usable: true, predecessor: prior };
    }
  }

  // none comparable: name the closest miss — the most recent earlier one —
  // rather than an aggregate nobody could act on.
  const closest = byRecency[0];
  const mismatches = predecessorMismatches(current, closest, tracked);
  return {
    usable: false,
    reason:
      `the most recent prior measurement (${closest.measurement ?? "unrecorded"}) is not ` +
      `comparable: ${mismatches.join("; ")}`,
  };
}

/**
 * derive a delta by comparing `current`'s verdict tally against its most
 * recent comparable predecessor. never suppressed and never thrown: a case
 * with no comparable history reports why instead.
 *
 * @param {Record<string, unknown>} current
 * @param {Array<Record<string, unknown>>} priors
 * @returns {{ usable: true, predecessor: string|null, changes: Array<{
 *   skill: string, now: number, nowRepeats: number, was: number|null, wasRepeats: number|null,
 * }> } | { usable: false, reason: string }}
 */
export function deriveDelta(current, priors) {
  const tracked = trackedSkillsOf(current.case ?? {});
  const found = findComparablePredecessor(current, priors, tracked);
  if (!found.usable) return { usable: false, reason: found.reason };

  const { predecessor } = found;
  const names = new Set([
    ...current.verdict.skills.map((skill) => skill.name),
    ...predecessor.verdict.skills.map((skill) => skill.name),
  ]);

  const changes = [...names]
    .map((name) => {
      const now = current.verdict.skills.find((skill) => skill.name === name)?.hits ?? 0;
      const before = predecessor.verdict.skills.find((skill) => skill.name === name);
      return {
        skill: name,
        now,
        nowRepeats: current.verdict.repeats,
        was: before ? before.hits : null,
        wasRepeats: before ? predecessor.verdict.repeats : null,
      };
    })
    .filter((change) => {
      // rates, not raw hits: a predecessor recorded at a different repeat
      // count must not report every skill as doubled or halved.
      if (change.was === null) return change.now > 0;
      const beforeRate = change.wasRepeats > 0 ? change.was / change.wasRepeats : 0;
      const nowRate = change.nowRepeats > 0 ? change.now / change.nowRepeats : 0;
      return beforeRate !== nowRate;
    })
    .sort((a, b) => a.skill.localeCompare(b.skill));

  return { usable: true, predecessor: predecessor.measurement ?? null, changes };
}
