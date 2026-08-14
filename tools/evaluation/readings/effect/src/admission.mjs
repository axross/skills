// the budget guard, as one decision before the spend.
//
// what it replaces: a cumulative ledger that charged after each probe and
// projected the remainder before the next. that only works if the probes are
// serial, and serial is worse for the measurement than a matrix — probes strung
// out over an hour let service drift land unevenly across the conditions, where
// probes in one window let it land on both alike. the ledger existed only to
// support the thing that was hurting the measurement.
//
// so the cap binds by refusal rather than by exhaustion. what is lost is the
// ability to stop at probe three; `max-parallel` bounds that if it is ever
// wanted. what is gained is that the budget question is answered while it is
// still a question.
//
// a refusal is a finding, not a prompt to raise the cap. whether to shrink the
// case, raise the cap, or abandon it is a spending decision, and this module
// never sees that choice.
//
// `meanProbeCost` and `reconcile` are not here: neither is specific to this
// reading, and both live in tools/evaluation/src/admission.mjs instead.

import { meanProbeCost } from "../../../src/admission.mjs";

/**
 * decides whether one case measurement may start.
 *
 * with no committed measurement for the case it falls back to the fixture's
 * per-probe ceiling, and the first committed measurement supersedes that
 * permanently — so the fixture's figure governs only a case's first run.
 *
 * why that figure is a ceiling rather than an estimate, and which way to err
 * when declaring one, is in tools/evaluation/data/effect/README.md's `capUsd`
 * section.
 *
 * @param {{
 *   caseId: string,
 *   probeCount: number,
 *   declaredCapUsd: number,
 *   requestedCapUsd?: number|null,
 *   historicalCosts?: number[],
 *   unmeasuredProbeCostCeilingUsd: number,
 * }} input
 * @returns {{
 *   admitted: boolean,
 *   capUsd: number,
 *   perProbeUsd: number,
 *   projectedTotalUsd: number,
 *   basis: "committed measurements"|"the fixture's declared ceiling",
 *   reason: string,
 * }}
 * @throws {Error} when `probeCount` is not a positive integer, when either cap
 *   is not positive, or when no per-probe cost can be derived from either a
 *   committed measurement or the fixture's ceiling. a case refused on budget is
 *   not a throw — it returns `admitted: false`, so a caller can tell an input
 *   it cannot act on from a case it may not start
 */
export function admitCase({
  caseId,
  probeCount,
  declaredCapUsd,
  requestedCapUsd = null,
  historicalCosts = [],
  unmeasuredProbeCostCeilingUsd,
}) {
  if (!Number.isInteger(probeCount) || probeCount < 1) {
    throw new Error(`${caseId}: probeCount must be a positive integer, got ${probeCount}.`);
  }
  if (!(declaredCapUsd > 0)) {
    throw new Error(`${caseId}: the case declares no positive cap (got ${declaredCapUsd}).`);
  }

  // a dispatch may lower the cap and may not raise it. the fixture is reviewed
  // and committed; a dispatch input is typed into a form. letting the second
  // exceed the first would make the reviewed number advisory.
  let capUsd = declaredCapUsd;
  let capNote = "";
  if (requestedCapUsd !== null) {
    if (!(requestedCapUsd > 0)) {
      throw new Error(`${caseId}: the requested cap must be positive, got ${requestedCapUsd}.`);
    }
    if (requestedCapUsd <= declaredCapUsd) {
      capUsd = requestedCapUsd;
      capNote = ` (lowered from the declared $${declaredCapUsd.toFixed(2)})`;
    } else {
      capNote =
        ` (the requested $${requestedCapUsd.toFixed(2)} was ignored: a dispatch may lower the ` +
        "declared cap and may not raise it)";
    }
  }

  const measured = meanProbeCost(historicalCosts);
  const perProbeUsd = measured ?? unmeasuredProbeCostCeilingUsd;
  const basis =
    measured === null ? "the fixture's declared ceiling" : "committed measurements";

  if (!(perProbeUsd > 0)) {
    throw new Error(
      `${caseId}: no usable per-probe cost — there is no committed measurement and the ` +
        `fixture's unmeasuredProbeCostCeilingUsd is ${unmeasuredProbeCostCeilingUsd}.`,
    );
  }

  const projectedTotalUsd = perProbeUsd * probeCount;
  const admitted = projectedTotalUsd <= capUsd;

  return {
    admitted,
    capUsd,
    perProbeUsd,
    projectedTotalUsd,
    basis,
    reason:
      `${probeCount} probe(s) at $${perProbeUsd.toFixed(2)} each, projected from ${basis}, ` +
      `comes to $${projectedTotalUsd.toFixed(2)} against a $${capUsd.toFixed(2)} cap${capNote}` +
      (admitted ? " — admitted" : " — REFUSED"),
  };
}
