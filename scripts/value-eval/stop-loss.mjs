// stop-loss.mjs — the cumulative dollar guard for one value-eval CASE (a
// fixed number of planned runs across both conditions).
//
// A MECHANISM, NOT A DECISION-MAKER. Issue #235's non-functional requirements
// state the rule this implements: "accumulate each probe's reported
// total_cost_usd, and before starting the next run project the total for the
// remaining runs. If the projection exceeds the cap, stop, report the
// measured figures, and return for a decision." The stopping is this
// module's job; deciding whether to raise the cap, change the plan, or
// abandon the case belongs to whoever is spending the money — this module
// never sees that choice, only whether the next run is safe to start.
//
// THE FIRST RUN IS ALWAYS PERMITTED. There is nothing yet to project an
// average FROM, and refusing it would refuse the one measurement issue
// #235's own verification strategy asks be captured before anything else:
// "Capture one probe before running the remaining five... it is placed
// before the money is spent deliberately."
//
// THE PROJECTION IS THE MEAN OF WHAT HAS ALREADY BEEN SPENT, CARRIED
// FORWARD. A run yet to start has no cost of its own to read, so the only
// honest estimate for it is the average of the runs that already reported
// one — not the fixed one-turn discovery-probe rate discovery-eval/run.mjs
// uses, which measures a structurally different, one-turn probe and would
// misprice a run that may take up to 100.

import { readFile, writeFile } from "node:fs/promises";

/** Cumulative cap in US dollars — issue #235's non-functional requirement. */
export const DEFAULT_BUDGET_USD = 40;

/**
 * @param {number[]} costsSoFar reported `total_cost_usd` for every run
 *   completed so far in this case
 * @returns {number} the mean; `0` when nothing has been measured yet
 */
export function averageCostPerRun(costsSoFar) {
  if (costsSoFar.length === 0) return 0;
  return costsSoFar.reduce((sum, cost) => sum + cost, 0) / costsSoFar.length;
}

/**
 * Projects the case's total spend if `remainingRuns` more runs each cost the
 * average of what has been measured so far.
 *
 * @param {{ costsSoFar: number[], remainingRuns: number }} input
 * @returns {number}
 */
export function projectTotalCost({ costsSoFar, remainingRuns }) {
  const spent = costsSoFar.reduce((sum, cost) => sum + cost, 0);
  return spent + averageCostPerRun(costsSoFar) * remainingRuns;
}

/**
 * Whether the next run may start.
 *
 * @param {{ costsSoFar: number[], remainingRuns: number, capUsd?: number }} input
 * @returns {{
 *   permitted: boolean,
 *   spentSoFar: number,
 *   averagePerRun: number,
 *   projectedTotal: number,
 *   capUsd: number,
 *   reason: string,
 * }}
 */
export function evaluateStopLoss({
  costsSoFar,
  remainingRuns,
  capUsd = DEFAULT_BUDGET_USD,
}) {
  const spentSoFar = costsSoFar.reduce((sum, cost) => sum + cost, 0);
  const averagePerRun = averageCostPerRun(costsSoFar);

  if (costsSoFar.length === 0) {
    return {
      permitted: true,
      spentSoFar,
      averagePerRun,
      projectedTotal: spentSoFar,
      capUsd,
      reason:
        "no run has reported a cost yet, so nothing can be projected from — the first run always proceeds",
    };
  }

  const projectedTotal = spentSoFar + averagePerRun * remainingRuns;
  const permitted = projectedTotal <= capUsd;

  return {
    permitted,
    spentSoFar,
    averagePerRun,
    projectedTotal,
    capUsd,
    reason: permitted
      ? `projected total $${projectedTotal.toFixed(2)} is within the $${capUsd.toFixed(2)} cap`
      : `projected total $${projectedTotal.toFixed(2)} exceeds the $${capUsd.toFixed(2)} cap`,
  };
}

// --- Ledger -----------------------------------------------------------
//
// How a stop-loss check accumulates cost ACROSS separate probe.mjs
// invocations, since each run is its own process and nothing else here
// persists between them. The format is the whole idea: a JSON array of
// numbers, one entry per completed run's reported `total_cost_usd`, in the
// order runs completed — deliberately not NDJSON like record.mjs, because a
// ledger is read and rewritten whole on every append (it is never more than
// a handful of numbers for one case) and a bare array needs no per-line
// framing to serve that.

/**
 * @param {string} path
 * @returns {Promise<number[]>} `[]` when the ledger does not exist yet
 */
export async function readLedger(path) {
  let raw;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every((value) => typeof value === "number")) {
    throw new Error(`${path} is not a JSON array of numbers.`);
  }
  return parsed;
}

/**
 * Appends one completed run's cost to the ledger, creating it if absent.
 *
 * @param {string} path
 * @param {number} cost
 * @returns {Promise<number[]>} the ledger's new full contents
 */
export async function appendLedgerCost(path, cost) {
  const existing = await readLedger(path);
  const updated = [...existing, cost];
  await writeFile(path, `${JSON.stringify(updated)}\n`, "utf8");
  return updated;
}
