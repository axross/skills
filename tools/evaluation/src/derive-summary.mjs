// computing the derived tier for one scenario measurement: each factor's
// differential, and the comparable-predecessor link — from
// the measured tier (every probe's metadata.json and factors.json) and the
// declared tier (the scenario's own factor declarations, already folded
// into each factors.json entry).
//
// pure and filesystem-free on purpose: derive.mjs's CLI does the reading and
// writing, so this function's every branch — a clean differential, an
// errored factor, a condition with no probes at all — can be driven directly
// from in-memory fixtures rather than through a committed tree.

/** @typedef {"skill-present"|"skill-absent"} Condition */

/**
 * @typedef {object} ProbeRecord
 * @property {Condition} condition
 * @property {number} repetition
 * @property {Array<{ id: string, phase: string, result: true|false|{error:string} }>} factors
 * @property {number|null} [costUsd] the probe's own recorded spend
 *   (metadata.json's `costUsd`), or `null`/absent when the probe carries
 *   none — see {@link deriveCost}.
 */

/**
 * @param {true|false|{error:string}} result
 * @returns {boolean} whether `result` is the errored shape
 */
function isErrored(result) {
  return result !== null && typeof result === "object";
}

/**
 * one factor's derived record: its differential — or, when either condition
 * recorded no result for it or any result errored, `null`, distinguishable
 * from a differential of zero by being the JSON literal `null` rather than
 * the number `0`.
 *
 * the differential is computed from each condition's own pass rate, exactly
 * as before, but the rates themselves stay internal to this function —
 * docs/specs/skill-evaluation.md's "What a measurement stores" narrows
 * summary.json to the aggregate alone, so a per-condition pass rate is no
 * longer part of what this returns.
 *
 * a condition whose results include an error contributes no pass rate either,
 * for the same reason the differential reports none: docs/specs/skill-evaluation.md
 * says a pass rate cannot be computed over a result that was never reached.
 * computing one over the results that did come back would put an unjudged
 * probe in the denominator, and reporting the quotient — 0 when every result
 * errored, 0.667 when one of three did — reads as measurement rather than as
 * "not judged". That protection stays exactly as strict now that the rate
 * itself is never written out: a wrongly-computed rate would still corrupt
 * the differential built from it, which is the value this function does emit.
 *
 * docs/specs/skill-evaluation.md, "The differential": a discovery factor's
 * differential is read as the skill-present pass rate alone, because the
 * skill-absent condition cannot pass one by construction; every other phase
 * differential is the skill-present rate minus the skill-absent rate.
 *
 * @param {string} factorId
 * @param {string} phase
 * @param {Record<Condition, ProbeRecord[]>} probesByCondition
 * @returns {{
 *   id: string, phase: string,
 *   differential: number|null, reason: string|null,
 * }}
 */
function deriveFactor(factorId, phase, probesByCondition) {
  /** @type {Record<Condition, number|null>} */
  const passRates = { "skill-present": null, "skill-absent": null };
  let blocked = null;

  for (const condition of /** @type {Condition[]} */ (["skill-present", "skill-absent"])) {
    const results = (probesByCondition[condition] ?? [])
      .map((probe) => probe.factors.find((factor) => factor.id === factorId)?.result)
      .filter((result) => result !== undefined);

    if (results.length === 0) {
      blocked ??= `no ${condition} probe recorded a result for "${factorId}"`;
      continue;
    }
    const errored = results.filter(isErrored);
    if (errored.length > 0) {
      blocked ??=
        `${errored.length} of ${results.length} ${condition} probe(s) errored for "${factorId}": ` +
        errored[0].error;
      continue;
    }
    const trueCount = results.filter((result) => result === true).length;
    passRates[condition] = trueCount / results.length;
  }

  const differential =
    blocked !== null
      ? null
      : phase === "discovery"
        ? passRates["skill-present"]
        : passRates["skill-present"] - passRates["skill-absent"];

  return {
    id: factorId,
    phase,
    differential,
    reason: blocked,
  };
}

/**
 * the measurement's actual total spend — the other half of
 * docs/decisions/2026-08-15-rebuild-skill-evaluation-around-scenarios-and-factors.md's
 * "no cost estimate": "The dispatch is bounded by an exact probe count
 * instead, and actual spend is recorded after." Each probe's own `costUsd` is measured
 * (probe-runner.mjs, from the CLI's own reported total); this sums it, the
 * same regenerable step every other field in this file goes through.
 *
 * a probe with no recorded cost is not the same as one that cost nothing —
 * exactly the distinction the pass rates above already draw between "not
 * judged" and "judged false" — so ANY probe missing its own `costUsd` makes
 * the whole aggregate `null` rather than a sum that silently omits it. A
 * partial sum would read as the full spend while quietly under-reporting
 * it, which is worse than reporting nothing: `null` cannot be mistaken for
 * a small total the way a partial sum can.
 *
 * @param {ProbeRecord[]} probes
 * @returns {number|null}
 */
function deriveCost(probes) {
  if (probes.some((probe) => typeof probe.costUsd !== "number")) return null;
  return probes.reduce((total, probe) => total + probe.costUsd, 0);
}

/**
 * @param {{
 *   scenarioId: string,
 *   measurementId: string,
 *   factorDeclarations: Array<{ id: string, phase: string }>,
 *   probes: ProbeRecord[],
 *   comparablePredecessor: { id: string, timestamp: string } | null,
 * }} input
 * @returns {Record<string, unknown>} the measurement-level summary.json
 *   value — the aggregate and nothing else, per docs/specs/skill-evaluation.md's
 *   "What a measurement stores": no `comparable` field, no per-probe result
 *   or rate, and no per-condition pass rate.
 */
export function computeDerivedSummary({
  scenarioId,
  measurementId,
  factorDeclarations,
  probes,
  comparablePredecessor,
}) {
  /** @type {Record<Condition, ProbeRecord[]>} */
  const probesByCondition = { "skill-present": [], "skill-absent": [] };
  for (const probe of probes) {
    (probesByCondition[probe.condition] ??= []).push(probe);
  }

  return {
    scenario: scenarioId,
    measurement: measurementId,
    probeCount: probes.length,
    probeCountByCondition: {
      "skill-present": probesByCondition["skill-present"].length,
      "skill-absent": probesByCondition["skill-absent"].length,
    },
    costUsd: deriveCost(probes),
    factors: factorDeclarations.map(({ id, phase }) => deriveFactor(id, phase, probesByCondition)),
    comparablePredecessor,
  };
}
