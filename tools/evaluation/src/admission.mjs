// the two pieces of the budget guard that are the same decision regardless
// of which reading is spending: averaging a case's committed history into a
// per-probe figure, and reporting afterwards how a finished case's actual
// cost compared with what it was admitted under.
//
// deciding whether a case may START — `admitCase` — is not here, because the
// two readings decide it differently: discovery projects per PROBE MODE
// (situated vs. bare cost roughly an order of magnitude apart), effect
// projects per case alone. see each reading's own admission.mjs for that
// decision and for the reasoning behind admitting by refusal, before the
// spend, rather than by a ledger that charges as it goes.

/**
 * @param {number[]} costs every committed probe's reported cost
 * @returns {number|null} `null` when there is no history, so a caller must
 *   fall back deliberately rather than average an empty set to zero
 */
export function meanProbeCost(costs) {
  // a zero means "no cost was reported" rather than "this run was free".
  const usable = costs.filter((cost) => typeof cost === "number" && cost > 0);
  if (usable.length === 0) return null;
  return usable.reduce((sum, cost) => sum + cost, 0) / usable.length;
}

/**
 * compares what a finished case cost against what it was admitted under.
 *
 * reported, never enforced: the money is already spent by the time this
 * runs, so its job is to tell the next admission that its projection was
 * too low.
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
        "projection this case was admitted under is too low",
  };
}
