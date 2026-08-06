// Measuring whether repeats are independent draws at all.
//
// Every probability this harness reports assumes the repeats of a case are
// independent samples from a fixed rate. Nothing has ever checked that. The
// probes run SEQUENTIALLY, in one workspace, against a warm prompt cache — so
// they could be correlated in either direction, and the real false-finding rate
// could be better or worse than the arithmetic says. compare.mjs's header has
// refused to choose tuned constants "before the determinism probe has measured
// this corpus's noise floor" since it was written; this is that probe.
//
// WHAT IT DOES NOT DO. It records nothing, commits nothing, and gates nothing.
// It prints one case's behaviour under repetition and names what the result
// does and does not license. Turning its output into a constant is a separate,
// deliberate act by a human reading it.
//
// TWO STATISTICS, AND THE SECOND IS THE POINT. A Wilson score interval says how
// precisely the rate is pinned — useful, but it would look the same whether the
// draws were independent or not. The Wald-Wolfowitz runs test is what actually
// addresses the assumption: it asks whether hits CLUSTER in the probe order.
// Fewer runs than expected means correlation, which is what a warm cache would
// produce.

/**
 * Two-sided 95% normal quantile.
 *
 * Written to six decimals rather than as 1.96 because the interval bounds are
 * pinned to three, and 1.96 moves the third digit.
 */
export const Z_95 = 1.959964;

/** Repeats below this cannot say anything, so the mode refuses to spend on them. */
export const MIN_DETERMINISM_REPEATS = 10;

/** What a determinism run costs by default. Enough for the runs test to mean something. */
export const DEFAULT_DETERMINISM_REPEATS = 30;

/**
 * The Wilson score interval for a binomial proportion.
 *
 * Wilson rather than the textbook normal interval because the rates that matter
 * here sit near the ends: at 0/30 the normal interval is [0, 0], which asserts
 * impossibility from thirty samples. Wilson stays inside [0, 1] and stays
 * informative at zero.
 *
 * @param {number} hits
 * @param {number} repeats
 * @param {number} [z]
 * @returns {{ low: number, high: number }}
 */
export function wilsonInterval(hits, repeats, z = Z_95) {
  if (repeats <= 0) return { low: 0, high: 0 };
  const rate = hits / repeats;
  const denominator = 1 + (z * z) / repeats;
  const centre = (rate + (z * z) / (2 * repeats)) / denominator;
  const spread =
    (z / denominator) *
    Math.sqrt((rate * (1 - rate)) / repeats + (z * z) / (4 * repeats * repeats));
  return { low: Math.max(0, centre - spread), high: Math.min(1, centre + spread) };
}

/**
 * The Wald-Wolfowitz runs test over the probe-ordered sequence.
 *
 * A "run" is a maximal block of identical outcomes. Too few runs means hits
 * clustered — consecutive probes agreeing more than chance allows, which is
 * exactly the correlation a warm prompt cache would create.
 *
 * THREE OUTCOMES, AND THEY ARE NOT THE SAME. A constant sequence has no runs
 * structure at all, so the test is UNDEFINED rather than extreme — reporting
 * `Z = 0` there would read as evidence of independence when it is the absence
 * of any evidence. A non-constant sequence with fewer than ten of either
 * outcome has a defined statistic whose NORMAL APPROXIMATION is not trustworthy,
 * so the expected count is still reported and `Z` alone is withheld. Collapsing
 * the two would hide which is which.
 *
 * @param {boolean[]} sequence  one entry per probe, in the order they ran
 * @returns {{
 *   n1: number, n2: number, runs: number,
 *   expected: number|null, z: number|null,
 *   state: "ok"|"withheld"|"undefined", reason: string|null,
 * }}
 */
export function runsTest(sequence) {
  const n1 = sequence.filter(Boolean).length;
  const n2 = sequence.length - n1;
  const runs = sequence.reduce(
    (count, value, index) => (index > 0 && value === sequence[index - 1] ? count : count + 1),
    0,
  );

  if (n1 === 0 || n2 === 0) {
    return {
      n1,
      n2,
      runs,
      expected: null,
      z: null,
      state: "undefined",
      reason: "sequence is constant; the runs test is undefined",
    };
  }

  const total = n1 + n2;
  const expected = (2 * n1 * n2) / total + 1;
  const variance =
    (2 * n1 * n2 * (2 * n1 * n2 - total)) / (total * total * (total - 1));

  // COMPUTED HERE, WITHHELD BY THE RENDERER. The statistic is perfectly well
  // defined for a non-constant sequence; what fails below ten of either outcome
  // is the NORMAL APPROXIMATION used to read it. Returning null here would
  // conflate "cannot be computed" with "should not be quoted", and would leave
  // the withholding rule untestable apart from the string that reports it.
  const thin = n1 < MIN_DETERMINISM_REPEATS || n2 < MIN_DETERMINISM_REPEATS;
  return {
    n1,
    n2,
    runs,
    expected,
    z: (runs - expected) / Math.sqrt(variance),
    state: thin ? "withheld" : "ok",
    reason: thin
      ? `Z withheld: the normal approximation wants n1,n2 >= ${MIN_DETERMINISM_REPEATS}`
      : null,
  };
}

/** How many probes of the sequence are shown before it is elided. */
const SEQUENCE_PREVIEW = 10;

const three = (value) => value.toFixed(3);

/**
 * Which skills the probe reports on.
 *
 * Everything selected at least once, plus everything the case LABELS, plus
 * every `expectAlways` skill — the last of which is why a zero row is printed
 * at all. `professional-behavior` claims to apply in every session and the
 * committed selection snapshot records it selected in none of its probes; a report that
 * silently omitted a zero row would be unable to say so.
 *
 * @param {string[][]} runs
 * @param {string[]} tracked
 * @returns {string[]}
 */
export function reportedSkills(runs, tracked) {
  const selected = new Set(runs.flat());
  return [...new Set([...selected, ...tracked])].sort();
}

/**
 * Render the determinism report.
 *
 * @param {object} input
 * @param {object} input.testCase
 * @param {string[][]} input.runs      per probe, the skills it selected
 * @param {string[]} input.tracked     skills reported even at zero hits
 * @param {object} input.context       model, corpus size
 * @param {string[]} [input.unisolated]  skills the CLI loaded that the workspace
 *                                       did not install
 * @returns {string}
 */
export function renderDeterminism({ testCase, runs, tracked, context, unisolated = [] }) {
  const repeats = runs.length;
  const names = reportedSkills(runs, tracked);
  const width = Math.max(0, ...names.map((name) => name.length));

  const sequences = new Map(
    names.map((name) => [name, runs.map((run) => run.includes(name))]),
  );

  const lines = [
    "Skill discovery determinism probe",
    "=".repeat(78),
    `model            ${context.model}`,
    `case             ${testCase.id}  ${JSON.stringify(testCase.prompt)}`,
    // "unchanged" is a claim about the WORKSPACE, which is all this can honestly
    // assert. Whether the corpus the model actually saw was the installed one is
    // a separate question, answered by the line below when the answer is no.
    `repeats          ${repeats} sequential probes, one workspace, unchanged throughout`,
    `skills installed ${context.corpusSize}`,
    ...(unisolated.length > 0
      ? [
          `NOT ISOLATED     ${unisolated.length} skill(s) the CLI loaded that this workspace did not install:`,
          `                 ${unisolated.join(", ")}`,
          "                 They competed in every probe below, so a clustered",
          "                 sequence may be their doing rather than the cache's.",
        ]
      : []),
    "",
    `  ${"skill".padEnd(width)}  hits    rate   95% CI          sequence`,
  ];

  for (const name of names) {
    const sequence = sequences.get(name);
    const hits = sequence.filter(Boolean).length;
    const { low, high } = wilsonInterval(hits, repeats);
    const drawn = sequence
      .slice(0, SEQUENCE_PREVIEW)
      .map((value) => (value ? "X" : "."))
      .join("");
    lines.push(
      `  ${name.padEnd(width)}  ${`${hits}/${repeats}`.padStart(5)}  ${three(hits / repeats)}   ` +
        `${`${three(low)}-${three(high)}`.padEnd(14)}  ${drawn}${repeats > SEQUENCE_PREVIEW ? "…" : ""}`,
    );
  }

  lines.push("");
  for (const name of names) {
    const test = runsTest(sequences.get(name));
    if (test.state === "undefined") {
      lines.push(`  ${name.padEnd(width)}  ${test.reason}`);
      continue;
    }
    lines.push(
      `  ${name.padEnd(width)}  n1 ${test.n1}, n2 ${test.n2}, runs ${test.runs}, expected ${three(test.expected)}`,
    );
    lines.push(
      `  ${"".padEnd(width)}  ${test.state === "ok" ? `Z ${three(test.z)}` : test.reason}`,
    );
  }

  lines.push(
    "",
    "What this licenses. A runs count near its expectation is consistent with the",
    "probes being independent draws; it does not prove they are, and one case says",
    "nothing about the others. What it CANNOT do is justify a tuned constant on its",
    "own — that needs several cases and a deliberate decision by a human reading",
    "them. Nothing here is recorded, and nothing here gates.",
    "",
  );
  return lines.join("\n");
}
