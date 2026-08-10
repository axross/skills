// the budget guard, as one decision before the spend — mirrors
// tools/effect-eval/src/admission.mjs's shape, which is not specific to
// either evaluation: projecting from committed measurements where they exist
// and from a declared ceiling where they do not, and refusing before any
// probe is spawned rather than after.
//
// ONE ADDITION THIS INSTRUMENT'S TWO PROBE SHAPES FORCE: the fixture's
// unmeasuredProbeCostCeilingUsd is PER MODE (src/plan.mjs's MODES), not one
// figure. A situated probe (a runaway turn guard, Read/Glob/Grep permitted)
// and a bare probe (one turn, Skill only) cost roughly an order of magnitude
// apart, so projecting either at the other's figure is a category error —
// see data/discovery-eval/README.md's "capUsd and
// unmeasuredProbeCostCeilingUsd". `ceilingFor` resolves the fixture's
// declaration to the single figure that matters: the mode THIS DISPATCH runs
// the case in (src/plan.mjs's `planFor`), never the mode the case merely
// declares — a situated case forced bare under `--head-skills` costs a bare
// probe.
//
// SUPERSEDING IS PER MODE TOO. `historicalCosts` below is trusted to already
// be filtered to measurements taken in `mode` — this module never sees the
// unfiltered history, so a situated measurement can never reach here as
// evidence for a bare projection or the reverse. See evaluate.mjs's and
// .github/scripts/discovery-eval-admit.mjs's own `historicalCostsFor`.
//
// a refusal is a finding, not a prompt to raise the cap. whether to shrink
// the case, raise the cap, or abandon it is a spending decision, and this
// module never sees that choice.

import { MODES } from "./plan.mjs";

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
 * the fixture's declared `unmeasuredProbeCostCeilingUsd` for one mode.
 *
 * the mode argument must be the mode the case will actually run in for THIS
 * dispatch, not the mode it declares — see this module's header.
 *
 * @param {{ situated: number, bare: number }} ceilings the fixture's
 *   `unmeasuredProbeCostCeilingUsd`
 * @param {"situated"|"bare"} mode
 * @returns {number}
 * @throws {Error} when `mode` names neither probe mode, or the fixture
 *   declares no positive ceiling for it
 */
export function ceilingFor(ceilings, mode) {
  if (!MODES.includes(mode)) {
    throw new Error(
      `ceilingFor needs mode ${MODES.map((m) => JSON.stringify(m)).join(" or ")}, got ${JSON.stringify(mode)}.`,
    );
  }
  const value = ceilings?.[mode];
  if (!(value > 0)) {
    throw new Error(`the fixture declares no positive unmeasuredProbeCostCeilingUsd.${mode} (got ${JSON.stringify(value)}).`);
  }
  return value;
}

/**
 * decides whether one case's dispatch may start.
 *
 * with no committed measurement of the case IN THIS MODE it falls back to
 * `ceilingFor`'s figure for that mode, and the first comparable measurement —
 * same case, same mode — supersedes that permanently. `historicalCosts` must
 * already be filtered to `mode`; this function trusts its caller for that
 * filtering rather than re-deriving it (see this module's header).
 *
 * @param {{
 *   caseId: string,
 *   probeCount: number,
 *   declaredCapUsd: number,
 *   requestedCapUsd?: number|null,
 *   historicalCosts?: number[],
 *   mode: "situated"|"bare",
 *   unmeasuredProbeCostCeilingUsd: { situated: number, bare: number },
 * }} input
 * @returns {{
 *   admitted: boolean,
 *   capUsd: number,
 *   perProbeUsd: number,
 *   projectedTotalUsd: number,
 *   mode: "situated"|"bare",
 *   basis: string,
 *   reason: string,
 * }}
 * @throws {Error} when `probeCount` is not a positive integer, when either
 *   cap is not positive, when `mode` names neither probe mode, or when no
 *   per-probe cost can be derived from either a committed measurement or the
 *   fixture's ceiling for that mode
 */
export function admitCase({
  caseId,
  probeCount,
  declaredCapUsd,
  requestedCapUsd = null,
  historicalCosts = [],
  mode,
  unmeasuredProbeCostCeilingUsd,
}) {
  if (!Number.isInteger(probeCount) || probeCount < 1) {
    throw new Error(`${caseId}: probeCount must be a positive integer, got ${probeCount}.`);
  }
  if (!(declaredCapUsd > 0)) {
    throw new Error(`${caseId}: the case declares no positive cap (got ${declaredCapUsd}).`);
  }
  if (!MODES.includes(mode)) {
    throw new Error(
      `${caseId}: mode must be ${MODES.map((m) => JSON.stringify(m)).join(" or ")}, got ${JSON.stringify(mode)}.`,
    );
  }

  // a dispatch may lower the cap and may not raise it — the fixture is
  // reviewed and committed, a dispatch input is typed into a form.
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
  let perProbeUsd;
  if (measured !== null) {
    perProbeUsd = measured;
  } else {
    try {
      perProbeUsd = ceilingFor(unmeasuredProbeCostCeilingUsd, mode);
    } catch (error) {
      throw new Error(
        `${caseId}: no usable per-probe cost — there is no committed ${mode} measurement and ${error.message}`,
      );
    }
  }
  const basis = measured === null ? `the fixture's declared ${mode} ceiling` : `committed ${mode} measurements`;

  const projectedTotalUsd = perProbeUsd * probeCount;
  const admitted = projectedTotalUsd <= capUsd;

  return {
    admitted,
    capUsd,
    perProbeUsd,
    projectedTotalUsd,
    mode,
    basis,
    reason:
      `${probeCount} probe(s) in ${mode} mode at $${perProbeUsd.toFixed(2)} each, projected from ${basis}, ` +
      `comes to $${projectedTotalUsd.toFixed(2)} against a $${capUsd.toFixed(2)} cap${capNote}` +
      (admitted ? " — admitted" : " — REFUSED"),
  };
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
