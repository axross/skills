// expanding one or more scenarios into the probe matrix a run would take:
// every (scenario, condition, repetition) triple, in a stable order.
//
// this is deliberately the one place that multiplies scenarios by
// conditions by repetitions. admission.mjs is handed only the resulting
// count — never the scenarios themselves — so the count a run is refused
// against is always the same count the matrix would actually walk.

export const CONDITIONS = ["skill-present", "skill-absent"];

/** the repetitions per condition docs/specs/skill-evaluation.md sets as a dispatch default. */
export const DEFAULT_REPETITIONS = 3;

/**
 * @typedef {object} ProbePlan
 * @property {string} scenarioId
 * @property {"skill-present"|"skill-absent"} condition
 * @property {number} repetition 1-based
 */

/**
 * @param {Array<{ id: string }>} scenarios
 * @param {{ conditions?: Array<"skill-present"|"skill-absent">, repetitions?: number }} [options]
 * @returns {ProbePlan[]}
 * @throws {Error} when `repetitions` is not a positive integer, or
 *   `conditions` names anything other than "skill-present"/"skill-absent"
 */
export function expandMatrix(scenarios, { conditions = CONDITIONS, repetitions = DEFAULT_REPETITIONS } = {}) {
  if (!Number.isInteger(repetitions) || repetitions < 1) {
    throw new Error(`repetitions must be a positive integer, got ${JSON.stringify(repetitions)}.`);
  }
  for (const condition of conditions) {
    if (!CONDITIONS.includes(condition)) {
      throw new Error(`Unknown condition ${JSON.stringify(condition)}; expected one of ${CONDITIONS.join(", ")}.`);
    }
  }

  const plan = [];
  for (const scenario of scenarios) {
    for (const condition of conditions) {
      for (let repetition = 1; repetition <= repetitions; repetition += 1) {
        plan.push({ scenarioId: scenario.id, condition, repetition });
      }
    }
  }
  return plan;
}
