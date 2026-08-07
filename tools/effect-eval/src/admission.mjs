// admission.mjs — the budget guard, as one decision before the spend rather
// than a running total during it.
//
// WHAT THIS REPLACES, AND WHY THE OLD SHAPE HAD TO GO. The instrument this
// supersedes kept a cumulative ledger: each probe appended its reported cost,
// and before the next probe started it projected the remaining total and
// refused if the projection exceeded the cap. That works only if the probes are
// SERIAL — a read-modify-write on one file, one runner, one at a time. And
// serial execution is worse for the measurement than a matrix, not merely
// slower: probes strung out over an hour let service drift land unevenly across
// the conditions, where probes in one window let it land on both alike. The
// ledger existed only to support the thing that was hurting the measurement.
//
// SO THE CAP BINDS BY REFUSAL, NOT BY EXHAUSTION. Admission runs ONCE, before
// the fan-out, and decides whether the whole case may proceed. What is lost is
// the ability to stop at probe three; `max-parallel` bounds that blast radius
// if it is ever wanted. What is gained is that the budget question is answered
// while it is still a question — before any money is spent, rather than after
// some of it is.
//
// A REFUSAL IS A FINDING, NOT A PROMPT TO RAISE THE CAP. This module reports
// that the case as declared does not fit the budget. Whether to shrink the
// case, raise the cap, or abandon it is a spending decision, and belongs to
// whoever is spending. This module never sees that choice.
//
// THE PROJECTION'S SEED IS DECLARED, NOT MEASURED, AND THAT IS SOUND. The first
// case to run has no committed measurement to project from, so its estimate
// comes from the fixture's own `estimatedCostUsdPerProbe`. That is a weaker
// number than a measurement and it does not need to be a stronger one: a COST
// ESTIMATE does not require measurement comparability, which is the property
// that makes measured data expensive to produce. Once a case has a committed
// measurement, that measurement supersedes the declared estimate.

/**
 * Mean cost per probe across whatever history is available.
 *
 * @param {number[]} costs every committed probe's reported cost, any case
 * @returns {number|null} `null` when there is no history to average
 */
export function meanProbeCost(costs) {
  const usable = costs.filter((cost) => typeof cost === "number" && cost > 0);
  if (usable.length === 0) return null;
  return usable.reduce((sum, cost) => sum + cost, 0) / usable.length;
}

/**
 * Decides whether one case measurement may start.
 *
 * @param {{
 *   caseId: string,
 *   probeCount: number,
 *   declaredCapUsd: number,
 *   requestedCapUsd?: number|null,
 *   historicalCosts?: number[],
 *   estimatedCostUsdPerProbe: number,
 * }} input
 * @returns {{
 *   admitted: boolean,
 *   capUsd: number,
 *   perProbeUsd: number,
 *   projectedTotalUsd: number,
 *   basis: "committed measurements"|"the fixture's declared estimate",
 *   reason: string,
 * }}
 */
export function admitCase({
  caseId,
  probeCount,
  declaredCapUsd,
  requestedCapUsd = null,
  historicalCosts = [],
  estimatedCostUsdPerProbe,
}) {
  if (!Number.isInteger(probeCount) || probeCount < 1) {
    throw new Error(`${caseId}: probeCount must be a positive integer, got ${probeCount}.`);
  }
  if (!(declaredCapUsd > 0)) {
    throw new Error(`${caseId}: the case declares no positive cap (got ${declaredCapUsd}).`);
  }

  // A DISPATCH MAY LOWER THE CAP AND MAY NOT RAISE IT. The fixture is reviewed
  // and committed; a dispatch input is typed into a form by whoever is running
  // the workflow. Letting the second exceed the first would make the reviewed
  // number advisory, which is the opposite of what committing it was for.
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
  const perProbeUsd = measured ?? estimatedCostUsdPerProbe;
  const basis = measured === null ? "the fixture's declared estimate" : "committed measurements";

  if (!(perProbeUsd > 0)) {
    throw new Error(
      `${caseId}: no usable per-probe cost — there is no committed measurement and the ` +
        `fixture's estimatedCostUsdPerProbe is ${estimatedCostUsdPerProbe}.`,
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

/**
 * Compares what a finished case actually cost against what it was admitted
 * under.
 *
 * Post-hoc and reported, never enforced: the money is already spent by the time
 * this runs, so its job is to say whether the projection was any good — an
 * overrun is what tells the next admission its estimate is too low.
 *
 * @param {{ capUsd: number, projectedTotalUsd: number, actualTotalUsd: number }} input
 * @returns {{ withinCap: boolean, overrunUsd: number, projectionErrorUsd: number, reason: string }}
 */
export function reconcile({ capUsd, projectedTotalUsd, actualTotalUsd }) {
  const withinCap = actualTotalUsd <= capUsd;
  const overrunUsd = withinCap ? 0 : actualTotalUsd - capUsd;
  const projectionErrorUsd = actualTotalUsd - projectedTotalUsd;

  return {
    withinCap,
    overrunUsd,
    projectionErrorUsd,
    reason: withinCap
      ? `spent $${actualTotalUsd.toFixed(2)} against a $${capUsd.toFixed(2)} cap; the ` +
        `projection was off by $${projectionErrorUsd.toFixed(2)}`
      : `spent $${actualTotalUsd.toFixed(2)}, OVER the $${capUsd.toFixed(2)} cap by ` +
        `$${overrunUsd.toFixed(2)}; admission projected $${projectedTotalUsd.toFixed(2)}, so the ` +
        "estimate this case was admitted under is too low",
  };
}
