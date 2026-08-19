// whether a run may start, decided by an exact probe count against a
// declared limit — never by a projected cost.
//
// the deleted instrument admitted a case by projecting a dollar figure
// from a mean of past probe costs and refusing when the projection
// cleared a cap. per
// docs/decisions/2026-08-15-rebuild-skill-evaluation-around-scenarios-and-factors.md,
// that estimate was wrong often enough that the limit it fed was not a
// real limit, so it was replaced with a count a caller states up front:
// a probe matrix has an exact size before anything runs, so there is
// nothing left to estimate. nothing here computes a dollar figure, in
// any form — the deleted instrument's meanProbeCost and reconcile() do
// not survive this rework.

/**
 * @param {{ probeCount: number, limit: number|null|undefined }} input
 *   `limit` of `null` or `undefined` means no cap was declared for this run,
 *   which admits unconditionally — a run that names no limit has nothing to
 *   be refused against.
 * @returns {{ admitted: boolean, reason: string }} `reason` explains the
 *   admission either way, so a caller can report why a run proceeded and not
 *   only why it was refused
 */
export function admitDispatch({ probeCount, limit }) {
  if (limit === null || limit === undefined) {
    return {
      admitted: true,
      reason: `${probeCount} probe(s), no limit declared for this run`,
    };
  }
  if (probeCount > limit) {
    return {
      admitted: false,
      reason: `this run would start ${probeCount} probe(s), which exceeds the declared limit of ${limit}`,
    };
  }
  return {
    admitted: true,
    reason: `${probeCount} probe(s), at or under the declared limit of ${limit}`,
  };
}
