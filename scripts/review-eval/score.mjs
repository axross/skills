// Turning a case's probes into a verdict.
//
// THE VERDICTS ARE ASYMMETRIC, AND ON PURPOSE. A defect a contract is supposed
// to catch counts as reached if ANY probe anchored it; a false positive counts
// as spurious only if a MAJORITY of probes anchored it. The asymmetry is
// inherited from discovery-eval, where a symmetric rule would report legitimate
// run-to-run variation as failure — and it matters more here, because review
// probes are expensive enough that repeat counts stay small.
//
// THIS IS AN EXISTENCE PROOF, NOT A RATE. "Reached at least once" is the whole
// claim. At the repeat counts this instrument can afford the two are not
// interchangeable: a 95% Wilson interval on 2/2 is [0.342, 1.000] and on 0/2 is
// [0.000, 0.658], overlapping across a third of the range, so any before/after
// rate comparison would have to refuse to render. Reporting a percentage anyway
// would dress an existence proof as a measurement. scripts/discovery-eval/
// determinism.mjs already exports wilsonInterval() for the day repeat counts can
// support a rate; until then nothing here divides.

/** An anchor matches a target of "path" on the path alone, or "path:line" exactly. */
function matches(anchor, target) {
  const [path, line] = splitTarget(target);
  if (anchor.path !== path) return false;
  return line === null || anchor.line === line;
}

/** @returns {[string, number|null]} */
export function splitTarget(target) {
  const at = target.lastIndexOf(":");
  if (at === -1) return [target, null];
  const line = Number(target.slice(at + 1));
  if (!Number.isInteger(line)) return [target, null];
  return [target.slice(0, at), line];
}

/**
 * @param {{anchors: {path: string, line: number|null}[]}[]} probes successful probes for one case
 * @param {string} target a `mustAnchor`/`mustNotAnchor` entry
 * @returns {number} how many probes anchored a finding on it
 */
export function hitCount(probes, target) {
  return probes.filter((probe) => probe.anchors.some((anchor) => matches(anchor, target))).length;
}

/**
 * Score one case.
 *
 * @param {{id: string, mustAnchor?: string[], mustNotAnchor?: string[], expectLensEnumeration?: boolean}} testCase
 * @param {{anchors: {path: string, line: number|null}[], lens: {enumerated: boolean, missing: string[]}}[]} probes
 * @returns {{
 *   id: string,
 *   probes: number,
 *   reached: {target: string, hits: number}[],
 *   missed: {target: string, hits: number}[],
 *   spurious: {target: string, hits: number}[],
 *   lens: {expected: boolean, enumeratedIn: number, missingLenses: string[]}|null,
 *   findings: number,
 * }}
 */
export function scoreCase(testCase, probes) {
  const total = probes.length;
  const reached = [];
  const missed = [];

  for (const target of testCase.mustAnchor ?? []) {
    const hits = hitCount(probes, target);
    // Existence, not frequency: one probe reaching it is reaching it.
    (hits > 0 ? reached : missed).push({ target, hits });
  }

  const spurious = [];
  for (const target of testCase.mustNotAnchor ?? []) {
    const hits = hitCount(probes, target);
    // Majority, so one noisy probe does not condemn a contract.
    if (total > 0 && hits * 2 > total) spurious.push({ target, hits });
  }

  let lens = null;
  if (testCase.expectLensEnumeration) {
    const enumeratedIn = probes.filter((probe) => probe.lens?.enumerated).length;
    // INTERSECTION, not union. A union answers "missing from at least one
    // probe", which is a different question and produces a self-contradicting
    // report: a case where one probe named all five and another named none
    // rendered as "enumerated in 1/2" beside "never named: <all five>". Only a
    // lens no probe named has genuinely never been named.
    const missingLenses = probes.length
      ? (probes[0].lens?.missing ?? []).filter((lens) =>
          probes.every((probe) => (probe.lens?.missing ?? []).includes(lens)),
        )
      : [];
    lens = { expected: true, enumeratedIn, missingLenses };
  }

  return {
    id: testCase.id,
    probes: total,
    reached,
    missed,
    spurious,
    lens,
    findings: missed.length + spurious.length + (lens && lens.enumeratedIn === 0 ? 1 : 0),
  };
}
