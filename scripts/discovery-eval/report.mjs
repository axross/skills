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

const RULE_WIDTH = 78;

const bar = (character = "-") => character.repeat(RULE_WIDTH);

/** `3/5` — always with the denominator. */
const ratio = (hits, repeats) => `${hits}/${repeats}`;

/**
 * The header block: what ran, against what, judged how.
 *
 * @param {object} context
 */
function renderHeader({
  model,
  repeats,
  caseCount,
  corpusSize,
  headSha,
  workspaceNote,
}) {
  const lines = [
    "Skill discovery evaluation",
    bar("="),
    `model            ${model}`,
    `repeats          ${repeats} per case`,
    `cases            ${caseCount}`,
    `skills installed ${corpusSize}`,
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
    `  MISS      a mustInclude skill selected in ZERO of the ${repeats} runs   (remedy: widen)`,
    `  SPURIOUS  a mustExclude skill selected in more than ${Math.floor(SELECTION_RATE * 100)}% of runs  (remedy: narrow)`,
    "",
    "Everything else is informational: a mustInclude skill selected some of the",
    "time is 'weak', not a miss — two skills that legitimately compete split the",
    "distribution, and the per-case coverage line says whether anything was lost.",
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

/** The findings roll-up — the part a reviewer reads first. */
function renderFindings(tallies) {
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
      lines.push(
        `  ${finding.id}: ${finding.skill} ${ratio(finding.hits, finding.repeats)}`,
      );
    }
  }
  return lines.join("\n");
}

/** The delta block, or the reason there is not one. */
function renderDelta(delta) {
  const lines = ["", bar("="), "Change against the recorded baseline", bar("=")];

  if (!delta.usable) {
    lines.push(
      `NO DELTA — ${delta.reason}.`,
      "",
      "Absolute counts above stand on their own; the comparison does not.",
      "A baseline recorded on a different model makes every delta meaningless,",
      "so none is shown. Re-record it with --emit-baseline on this model.",
    );
    return lines.join("\n");
  }

  const changed = delta.cases.filter(
    (entry) => entry.isNew || entry.changes.length > 0,
  );
  if (changed.length === 0 && delta.removed.length === 0) {
    lines.push("No change: every case matched the baseline rate for rate.");
    return lines.join("\n");
  }

  for (const entry of changed) {
    if (entry.isNew) {
      lines.push(`  ${entry.id}: new case, not in the baseline`);
      continue;
    }
    for (const change of entry.changes) {
      // Both denominators are printed because they can differ: a baseline
      // recorded at 5 repeats compared against a 10-repeat run would otherwise
      // read as every skill doubling.
      lines.push(
        `  ${entry.id}: ${change.skill} ${ratio(change.was, delta.baselineRepeats)} -> ${ratio(change.now, entry.repeats)}`,
      );
    }
  }
  for (const id of delta.removed) {
    lines.push(`  ${id}: in the baseline, absent from the fixture`);
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
    ...tallies.map((tally) => renderCase(tally, byId.get(tally.id))),
    renderFindings(tallies),
    renderDelta(delta),
    "",
    "This evaluation reports; it does not gate. It exits 0 whatever it finds.",
    "",
  ].join("\n");
}

/**
 * Render a baseline document for a human to commit.
 *
 * Printed to stdout rather than written to the tree: adopting a new baseline
 * should be a deliberate reviewable act, not a side effect of running a report.
 *
 * @param {object[]} tallies
 * @param {{ model: string, repeats: number, recordedAt: string }} context
 * @returns {string}
 */
export function renderBaseline(tallies, { model, repeats, recordedAt }) {
  const cases = {};
  for (const tally of tallies) {
    const entry = {};
    for (const skill of [...tally.skills].sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      if (skill.hits > 0) entry[skill.name] = skill.hits;
    }
    cases[tally.id] = entry;
  }
  return `${JSON.stringify({ recordedAt, model, repeats, cases }, null, 2)}\n`;
}
