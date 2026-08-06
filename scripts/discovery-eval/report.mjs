// Rendering the discovery report.
//
// Two rules shape everything here.
//
// FIRST, every number carries its denominator. A reader must never have to infer
// whether "wireframe-design" means five runs out of five or one out of five, so
// raw hit counts appear beside every verdict and the repeat count and the
// classification rule are printed in the header rather than assumed.
//
// SECOND, nothing checkout-dependent appears in the body — no timestamps, no
// absolute paths — so two runs diff cleanly and a maintainer can see WHICH case
// moved rather than only that something did. The evaluated head SHA is the one
// varying value that is printed on purpose: a label applied after a later push
// evaluates content the labeller may never have read, and the SHA is how they
// find that out.

import { SELECTION_RATE, VERDICTS } from "./compare.mjs";
import { NOISE_ALPHA, readingFor } from "./noise.mjs";

const RULE_WIDTH = 78;

/**
 * The glyph for a count that was never measured.
 *
 * Never a `0`. A zero is a real measurement with a real reading — a zero prior
 * against a zero run is a STANDING finding — so spelling "unknown" as "0" would
 * make the two indistinguishable in the one place a reader looks.
 */
const NO_COUNT = "—";

/** Width of the corpus notice's bucket labels, so their names line up. */
const BUCKET_LABEL_WIDTH = 12;

const bar = (character = "-") => character.repeat(RULE_WIDTH);

/** `3/5` — always with the denominator. */
const ratio = (hits, repeats) => `${hits}/${repeats}`;

/**
 * The header's foreign-skill count, or an honest admission of what it rests on.
 *
 * THREE renderings, never collapsed into two. "0" means every probe reported and
 * none of them saw anything foreign. "unknown" means no probe reported at all.
 * A partial says so out loud with its coverage, because a count drawn from 1 of
 * 145 probes reads identically to one drawn from 145 unless the denominator is
 * printed beside it.
 *
 * @param {{ recorded: boolean, complete: boolean, reported: number, total: number, colliding: string[], foreign: string[] }|undefined} isolation
 */
function renderForeignCount(isolation) {
  if (!isolation?.recorded) return "unknown (CLI reported no skill list)";
  const total = isolation.foreign.length + isolation.colliding.length;
  const collisions = isolation.colliding.length;
  const counted = `${total} (user-invocable only)${collisions > 0 ? `, ${collisions} colliding with ours` : ""}`;
  if (!isolation.complete) {
    return `${counted} — PARTIAL: only ${isolation.reported} of ${isolation.total} probes reported`;
  }
  return counted;
}

/**
 * The contamination detail — or, when the run was clean, nothing at all.
 *
 * COLLISIONS FIRST. A foreign skill wearing one of our names is the worst case:
 * it competes for exactly the prompts our skill is labelled for, and a reader
 * scanning the plain foreign list would see a familiar name and move on.
 *
 * @param {{ recorded: boolean, own: string[], colliding: string[], foreign: string[] }|undefined} isolation
 * @param {string[]} unrecognised corpus skills whose `user-invocable` could not be read
 */
function renderIsolationNotice(isolation, unrecognised = []) {
  if (!isolation?.recorded) return [];
  const nothingFound =
    isolation.foreign.length === 0 && isolation.colliding.length === 0;
  // A partial run earns the block even when it found nothing, because "nothing
  // found" is the reading a partial most easily fakes. A complete clean run
  // stays silent, as the corpus notice does.
  if (nothingFound && isolation.complete) return [];

  if (nothingFound) {
    return [
      "",
      bar("="),
      "Isolation was only partly observed",
      bar("="),
      `Only ${isolation.reported} of ${isolation.total} probes reported which skills the CLI`,
      "loaded. Nothing foreign was seen in those, but the probes that went",
      "unreported are exactly the ones that could have differed — so this run",
      "cannot record a selection snapshot (--emit-selection-snapshot exits 3).",
    ];
  }

  const lines = [
    "",
    bar("="),
    "Skills the run could not isolate",
    bar("="),
    "The CLI loaded these; the evaluation workspace did not install them. They",
    "compete for every prompt below, and the corpus fingerprint cannot see them.",
  ];

  if (isolation.colliding.length > 0) {
    lines.push(
      "",
      `  colliding with a skill of ours (${isolation.colliding.length}) — same name, different skill:`,
      `    ${isolation.colliding.join(", ")}`,
    );
  }
  if (isolation.foreign.length > 0) {
    lines.push("", `  foreign (${isolation.foreign.length}):`, `    ${isolation.foreign.join(", ")}`);
  }
  if (unrecognised.length > 0) {
    lines.push(
      "",
      "  NOTE — these skills of ours carry a `user-invocable` value this runner",
      "  could not read, so any of their names above is reported as colliding out",
      "  of caution rather than on evidence:",
      `    ${unrecognised.join(", ")}`,
    );
  }

  if (!isolation.complete) {
    lines.push(
      "",
      `  PARTIAL — only ${isolation.reported} of ${isolation.total} probes reported what the CLI loaded,`,
      "  so this list is a lower bound rather than the whole picture.",
    );
  }

  lines.push(
    "",
    "Only the user-level tier can be stripped (--setting-sources project, already",
    "applied). The rest arrive from the managed environment and cannot be removed",
    "without removing the workspace's own skills too. A foreign skill that is",
    "itself `user-invocable: false` is invisible here.",
  );
  return lines;
}

/**
 * The header block: what ran, against what, judged how.
 *
 * @param {object} context
 */
function renderHeader({
  model,
  repeats,
  repeatsNote,
  caseCount,
  corpusSize,
  isolation,
  headSha,
  workspaceNote,
}) {
  const lines = [
    "Skill discovery evaluation",
    bar("="),
    `model            ${model}`,
    // The count is a DEFAULT once cases may declare their own, and every
    // finding below carries its own denominator anyway. Saying "per case"
    // unqualified when some cases ran fewer would misdescribe the run.
    `repeats          ${repeats} per case${repeatsNote ? `, ${repeatsNote}` : ""}`,
    `cases            ${caseCount}`,
    `skills installed ${corpusSize}`,
    // ALWAYS printed, unlike the corpus notice below, which stays silent on a
    // clean run. The asymmetry is deliberate: a corpus notice fires on drift, so
    // silence carries information, whereas here a reader must be able to see a
    // "0" and know the run was checked and clean — an absent line would be
    // indistinguishable from a runner too old to look.
    `foreign skills   ${renderForeignCount(isolation)}`,
  ];
  if (headSha) {
    lines.push(`evaluated head   ${headSha}`);
  }
  if (workspaceNote) {
    lines.push(`workspace        ${workspaceNote}`);
  }
  lines.push(
    "",
    "Classification — a finding is only ever one of these two:",
    "  MISS      a mustInclude skill selected in ZERO of a case's runs   (remedy: widen)",
    `  SPURIOUS  a mustExclude skill selected in more than ${Math.floor(SELECTION_RATE * 100)}% of them  (remedy: narrow)`,
    "",
    "Everything else is informational: a mustInclude skill selected some of the",
    "time is 'weak', not a miss — two skills that legitimately compete split the",
    "distribution, and the per-case coverage line says whether anything was lost.",
    "",
    "Both findings carry the PRIOR the selection snapshot recorded for that skill. Where the",
    "selection snapshot carries a corpus fingerprint they also carry P — the chance of a result",
    "at least this extreme if the rate had not moved, integrating over the",
    `uncertainty in a prior measured from few samples. Below ${Math.round(NOISE_ALPHA * 100)}% the result reads as a`,
    "regression — movement toward what the label calls failure, in either direction;",
    "at or above it the prior cannot resolve the question. Where no outcome could",
    "have cleared the band at all, the line says so instead of carrying a verdict it",
    "could not have avoided — that can only ever replace 'consistent with no change',",
    "never a finding. A recorded tally is always a prior; an absence is one only for",
    "a skill the run tracked, so a skill nobody labelled gets none. Three caveats,",
    "all live:",
    "  - Probes run in sequence against a warm prompt cache, so independence is",
    "    assumed rather than measured. `--determinism` is what measures it.",
    "  - The band is per line; among the lines that can fire it, roughly one clean",
    "    line in twenty reads 'regression' or 'moved' by chance alone.",
    "  - A selection snapshot with no corpus fingerprint gets counts and no P: its tallies may",
    "    have accreted across commits, against a corpus that has since changed.",
  );
  return lines.join("\n");
}

/** One case's table of skills, plus its coverage line when the case is contested. */
function renderCase(tally, testCase) {
  const lines = [
    "",
    bar(),
    `${tally.id}  —  ${JSON.stringify(testCase.prompt)}`,
    bar(),
  ];

  if (tally.skills.length === 0) {
    lines.push("  (no skills selected, and none labelled)");
  }

  const width = Math.max(0, ...tally.skills.map((skill) => skill.name.length));
  for (const skill of tally.skills) {
    const verdict = VERDICTS[skill.verdict];
    const flag = verdict.finding ? "!" : " ";
    lines.push(
      `  ${flag} ${skill.name.padEnd(width)}  ${ratio(skill.hits, tally.repeats).padStart(6)}  ${verdict.label}`,
    );
  }

  if (tally.coverage) {
    const { covered, repeats, skills } = tally.coverage;
    const missed = repeats - covered;
    lines.push(
      "",
      `  coverage: ${ratio(covered, repeats)} runs selected at least one of ${skills.join(", ")}` +
        (missed > 0 ? ` — ${missed} selected none of them` : ""),
    );
  }

  lines.push("", `  rationale: ${testCase.rationale}`);
  return lines.join("\n");
}

/**
 * `P` to one decimal place — and only ever one.
 *
 * The precision is fixed by field on purpose. `P` is a tail probability read
 * against a 5% band, so a second decimal implies a resolution five probes
 * cannot support; the floor and the test statistics take three because they are
 * compared against each other rather than against a threshold.
 */
const percent = (value) => `${(value * 100).toFixed(1)}%`;

/**
 * The parenthesised annotation both blocks put after a line.
 *
 * ONE FUNCTION, TWO CALL SITES. The findings roll-up and the delta block report
 * the same events from different angles, and a reader who sees them disagree
 * about one line has no way to tell which is wrong. They share this renderer and
 * the precedence behind it, so they cannot.
 *
 * @param {{ hits: number, repeats: number }|null} prior
 * @param {{ hits: number, repeats: number }} run
 * @param {object} options
 * @param {boolean} options.fingerprinted
 * @param {string} [options.noPriorReason]
 * @param {"regression"|"moved"} [options.movedWord]
 * @param {boolean} [options.showPrior]  false in the delta, whose line already prints it
 * @returns {string}
 */
export function annotate(prior, run, { fingerprinted, noPriorReason, movedWord, showPrior = true }) {
  const reading = readingFor({ prior, run, fingerprinted, noPriorReason, movedWord });

  if (reading.kind === "no-prior") {
    // The em dash stands where the count would be, so the absence is visible in
    // the same position a number would have occupied.
    return showPrior ? `(prior ${NO_COUNT}, ${reading.label})` : `(${reading.label})`;
  }

  // A probability is joined to the prior with a comma and to its reading with a
  // dash — "prior 1/5, P 27.3% — consistent with no change". With no
  // probability the reading attaches to the prior directly: "prior 0/5 —
  // standing".
  const body =
    reading.probability === null
      ? reading.label
      : `P ${percent(reading.probability)} — ${reading.label}`;
  if (!showPrior) return `(${body})`;

  const separator = reading.probability === null ? " — " : ", ";
  return `(prior ${ratio(prior.hits, prior.repeats)}${separator}${body})`;
}

/** The findings roll-up — the part a reviewer reads first. */
function renderFindings(tallies, delta) {
  const findings = tallies.flatMap((tally) =>
    tally.findings.map((finding) => ({ ...finding, id: tally.id })),
  );

  const lines = ["", bar("="), "Findings", bar("=")];
  if (findings.length === 0) {
    lines.push(
      "None. Every mustInclude skill was selected at least once and no",
      "mustExclude skill was selected by a majority of runs.",
    );
    return lines.join("\n");
  }

  for (const kind of ["miss", "spurious"]) {
    const group = findings.filter((finding) => finding.kind === kind);
    if (group.length === 0) continue;
    lines.push("", `${VERDICTS[kind].label} (${group.length}) — remedy: ${VERDICTS[kind].remedy} the discovery text`);
    for (const finding of group) {
      const run = { hits: finding.hits, repeats: finding.repeats };
      const reading = annotate(priorIn(delta, finding.id, finding.skill), run, {
        fingerprinted: isFingerprinted(delta),
        noPriorReason: noPriorReasonIn(delta, finding.id),
        movedWord: "regression",
      });
      // The same drift mark the delta lines carry, for the same reason: a
      // prior measured against a corpus that has since changed cannot be
      // attributed to anything in this repository, and a finding is exactly
      // where that matters most.
      lines.push(
        `  ${finding.id}: ${finding.skill} ${ratio(finding.hits, finding.repeats)}  ${reading}${
          isUnattributable(delta, finding.id) ? "  (unattributable)" : ""
        }`,
      );
    }
  }
  return lines.join("\n");
}

/**
 * Whether the selection snapshot fingerprinted the corpus it measured.
 *
 * Read from the corpus comparison rather than mirrored into a field of its own.
 * A second copy would be a second thing to keep in step, and two flags that can
 * disagree about one selection snapshot is exactly the failure the annotation exists to
 * prevent one level up — a line claiming "no corpus recorded" beside a drift
 * notice that names the drifted skills.
 */
const isFingerprinted = (delta) => delta?.corpus?.recorded ?? false;

/**
 * The prior the selection snapshot recorded for one skill in one case, or `null`.
 *
 * Read out of the delta rather than recomputed: the two blocks must agree about
 * one event, and the only way to guarantee that is for both to read the same
 * record.
 */
function priorIn(delta, caseId, skill) {
  if (!delta?.usable) return null;
  const entry = delta.cases.find((item) => item.id === caseId);
  return entry?.priors?.[skill] ?? null;
}

/** Whether this case's comparisons were measured against a corpus that has since drifted. */
function isUnattributable(delta, caseId) {
  if (!delta?.usable) return false;
  return delta.cases.find((item) => item.id === caseId)?.unattributable ?? false;
}

/** Which of the four reasons a line has no prior to claim. */
function noPriorReasonIn(delta, caseId) {
  if (!delta) return "no selection snapshot recorded";
  // A model mismatch and a missing file both arrive as an unusable delta, and
  // the delta already phrases each of them.
  if (!delta.usable) return delta.reason;
  const entry = delta.cases.find((item) => item.id === caseId);
  if (entry?.isNew) {
    return entry.isUnmeasured
      ? "case declared unmeasured, awaiting the next re-record"
      : "case is not in the selection snapshot";
  }
  return "not tracked, and nothing recorded";
}

/**
 * The three drift buckets, indented and aligned.
 *
 * Exported because `--dry-run` prints the same comparison outside the report:
 * one owner for the layout means the two cannot describe the same drift
 * differently.
 *
 * @param {{ added: string[], removed: string[], changed: string[] }} corpus
 * @returns {string[]} one line per non-empty bucket
 */
export function renderCorpusBuckets(corpus) {
  return [
    ["added", corpus.added],
    ["removed", corpus.removed],
    ["text-changed", corpus.changed],
  ]
    .filter(([, names]) => names.length > 0)
    .map(
      ([label, names]) =>
        `  ${label.padEnd(BUCKET_LABEL_WIDTH)}  ${names.join(", ")}`,
    );
}

/**
 * The dry-run's cost estimate.
 *
 * The per-probe RATE is the measured constant and the total is always derived
 * from it, never written down. A total recorded as a property of "a full run" is
 * really a property of the fixture that was current when someone paid for it, so
 * it starts contradicting the probe count beside it the moment a case is added —
 * which is exactly what happened to the figure this replaced.
 *
 * Takes the rate as an argument rather than reading it here: the caller owns what
 * a probe costs, this owns how the estimate reads.
 *
 * @param {number} runs           probes the run would spawn
 * @param {number} costPerProbe   measured dollars per probe
 * @param {string} [subject]      what the total is for; a determinism probe is
 *                                one case, not the fixture
 * @returns {string} the estimate line, total rounded to cents
 */
export function renderProbeBudget(runs, costPerProbe, subject = "this fixture") {
  const total = (runs * costPerProbe).toFixed(2);
  return `Would spawn ${runs} one-turn probe(s); ~$${costPerProbe} each, so ~$${total} for ${subject}.`;
}

/**
 * The corpus notice — or, when the corpus matches, nothing at all.
 *
 * SILENT ON A CLEAN RUN, on purpose. This harness runs rarely and costs real
 * money, so a line printed on every run is a line skipped on the run that
 * matters. "Corpus unchanged" would be exactly that line.
 *
 * @param {object|undefined} corpus  the comparison from `deltaAgainst`
 * @param {string[]} expectAlways    fixture-level skills tracked on every case
 */
function renderCorpusNotice(corpus, expectAlways) {
  if (!corpus?.recorded) {
    return [
      "Corpus not recorded — this selection snapshot predates corpus fingerprinting, so a",
      "skill added, removed, or reworded since it was taken is invisible here.",
      "Re-record with --emit-selection-snapshot to gain the check.",
      "",
    ];
  }
  if (!corpus.drifted) return [];

  const lines = [
    "Corpus drift — the selection snapshot was recorded against a different skill corpus.",
    ...renderCorpusBuckets(corpus),
  ];

  // An expectAlways skill is tracked on EVERY case, so its discovery text
  // changing degrades every comparison rather than some. That is the exact
  // instance this field was added to catch, so it is said out loud instead of
  // being left for a reader to infer from the fixture.
  for (const name of corpus.changed.filter((skill) =>
    expectAlways.includes(skill),
  )) {
    lines.push(
      `  ${"note".padEnd(BUCKET_LABEL_WIDTH)}  ${name} is an expectAlways skill, tracked on every case,`,
      `  ${"".padEnd(BUCKET_LABEL_WIDTH)}  so its text change degrades every comparison, not some.`,
    );
  }

  lines.push(
    "",
    "Every probe runs against the whole corpus, so any of these could have moved",
    "a result. Comparisons below are marked (unattributable) rather than read as",
    "regressions.",
    "",
  );
  return lines;
}

/**
 * The delta block, or the reason there is not one.
 *
 * @param {object} delta
 * @param {string[]} [expectAlways]
 */
function renderDelta(delta, expectAlways = []) {
  const lines = ["", bar("="), "Change against the recorded selection snapshot", bar("=")];

  if (!delta.usable) {
    lines.push(
      `NO DELTA — ${delta.reason}.`,
      "",
      "Absolute counts above stand on their own; the comparison does not.",
      "A selection snapshot recorded on a different model makes every delta meaningless,",
      "so none is shown. Re-record it with --emit-selection-snapshot on this model.",
    );
    return lines.join("\n");
  }

  lines.push(...renderCorpusNotice(delta.corpus, expectAlways));

  const changed = delta.cases.filter(
    (entry) => entry.isNew || entry.changes.length > 0,
  );
  if (changed.length === 0 && delta.removed.length === 0) {
    lines.push("No change: every case matched the selection snapshot, rate for rate.");
    return lines.join("\n");
  }

  for (const entry of changed) {
    if (entry.isNew) {
      // Two different states, deliberately worded so neither reads as the
      // other: a declared case is waiting for a run somebody has planned, an
      // undeclared one is a recording nobody took.
      lines.push(
        entry.isUnmeasured
          ? `  ${entry.id}: declared unmeasured, awaiting the next re-record`
          : `  ${entry.id}: new case, not in the selection snapshot`,
      );
      continue;
    }
    // Per line, not per case: the drifted skills are named once above, and what
    // a reader needs beside a number is whether THIS number can be trusted.
    const mark = entry.unattributable ? "  (unattributable)" : "";
    for (const change of entry.changes) {
      // Both denominators are printed because they can differ: a selection snapshot
      // recorded at 5 repeats compared against a 10-repeat run would otherwise
      // read as every skill doubling.
      const wasRepeats = change.wasRepeats ?? delta.selectionSnapshotRepeats;
      const was = change.was === null ? NO_COUNT : change.was;
      const reading = annotate(
        change.prior,
        { hits: change.now, repeats: entry.repeats },
        {
          fingerprinted: isFingerprinted(delta),
          noPriorReason: "not tracked, and nothing recorded",
          // A delta line reports movement; only the verdict rule calls
          // something a regression, and it has not been applied here.
          movedWord: "moved",
          showPrior: false,
        },
      );
      lines.push(
        `  ${entry.id}: ${change.skill} ${was}/${wasRepeats} -> ${ratio(change.now, entry.repeats)}  ${reading}${mark}`,
      );
    }
  }
  for (const id of delta.removed) {
    lines.push(`  ${id}: in the selection snapshot, absent from the fixture`);
  }
  return lines.join("\n");
}

/**
 * Render the whole report.
 *
 * @param {object} input
 * @param {object} input.fixture   the parsed fixture
 * @param {object[]} input.tallies one entry per case, in fixture order
 * @param {object} input.delta     the result of `deltaAgainst`
 * @param {object} input.context   header facts
 * @returns {string}
 */
export function renderReport({ fixture, tallies, delta, context }) {
  const byId = new Map(fixture.cases.map((entry) => [entry.id, entry]));
  return [
    renderHeader({ ...context, caseCount: fixture.cases.length }),
    ...renderIsolationNotice(context.isolation, context.unrecognisedInvocability),
    ...tallies.map((tally) => renderCase(tally, byId.get(tally.id))),
    renderFindings(tallies, delta),
    renderDelta(delta, fixture.expectAlways ?? []),
    "",
    "This evaluation reports; it does not gate. It exits 0 whatever it finds.",
    "",
  ].join("\n");
}

/**
 * The line that introduces an emitted selection snapshot on stdout.
 *
 * Exported because it is a boundary, not a caption. `extract-selection-snapshot.mjs`
 * slices the proposed document out of a captured report at exactly this line, so
 * a maintainer dispatching the workflow can download the result as an artifact
 * instead of transcribing ~90 lines of JSON out of a log viewer. Both sides
 * import this constant rather than spelling it twice, so rewording the line
 * cannot leave the extractor cutting at text that no longer appears.
 */
export const SELECTION_SNAPSHOT_MARKER = "Proposed selection snapshot — commit this deliberately:";

/**
 * Render a selection-snapshot document for a human to commit.
 *
 * Printed to stdout rather than written to the tree: adopting a new selection snapshot
 * should be a deliberate reviewable act, not a side effect of running a report.
 *
 * @param {object[]} tallies
 * @param {{ model: string, repeats: number, recordedAt: string, corpus?: Record<string, string>|null, foreignSkills?: string[] }} context
 * @returns {string}
 */
export function renderSelectionSnapshot(
  tallies,
  { model, repeats, recordedAt, corpus = null, foreignSkills = [] },
) {
  const cases = {};
  // Sparse on purpose: only the cases that did NOT run at the document's
  // default. Recording every case's count would restate `repeats` 38 times and
  // bury the one line a reader needs to notice.
  const caseRepeats = {};
  for (const tally of tallies) {
    const entry = {};
    for (const skill of [...tally.skills].sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      if (skill.hits > 0) entry[skill.name] = skill.hits;
    }
    cases[tally.id] = entry;
    if (tally.repeats !== repeats) caseRepeats[tally.id] = tally.repeats;
  }

  const document = { recordedAt, model, repeats };
  if (corpus) {
    // Sorted, so re-recording a selection snapshot diffs line by line against the one it
    // replaces instead of as a reshuffled block.
    document.corpus = Object.fromEntries(
      Object.keys(corpus)
        .sort()
        .map((name) => [name, corpus[name]]),
    );
  }
  // UNCONDITIONAL, including as `[]`, and deliberately unlike `corpus` and
  // `caseRepeats` above. Those two are omitted when empty because an empty value
  // cannot occur for them, so absence unambiguously means "not recorded". Here
  // `[]` is a REAL state — "recorded, and nothing foreign was loaded" — which
  // absence cannot express: a selection snapshot predating this field would look
  // identical. Do not "fix" this into an `if`; it would destroy the distinction.
  document.foreignSkills = [...foreignSkills].sort();

  if (Object.keys(caseRepeats).length > 0) {
    document.caseRepeats = Object.fromEntries(
      Object.keys(caseRepeats)
        .sort()
        .map((id) => [id, caseRepeats[id]]),
    );
  }
  document.cases = cases;

  return `${JSON.stringify(document, null, 2)}\n`;
}
