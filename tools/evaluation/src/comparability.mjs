// the pass/fail reading of a case's own comparability checks — shared
// because deriving "comparable" from a `checks` array of
// `{ check, passed, detail }` entries is the same operation regardless of
// what produced them. each reading's own `runComparabilityChecks`, in its
// own summary.mjs, builds that array on its own terms and stays there.

/**
 * @param {Record<string, unknown>} summary
 * @returns {{ comparable: boolean, failures: string[] }}
 */
export function comparabilityOf(summary) {
  const failures = (summary.checks ?? [])
    .filter((check) => !check.passed)
    .map((check) => `${check.check}: ${check.detail}`);
  return { comparable: failures.length === 0, failures };
}
