// whether two scenario measurements are comparable, and which of a
// scenario's earlier measurements is the comparable predecessor of a later
// one.
//
// the deleted instrument's comparabilityOf() read a summary's own `checks`
// array of `{ check, passed, detail }` entries, deriving one `comparable`
// boolean from them — an INTRA-measurement question: did every probe in this
// one batch actually share a project tree, a skill set, a model. That
// concept does not survive the stored-shape decision that summary.json
// carries no `comparable` field.
//
// docs/specs/skill-evaluation.md's "What makes two measurements comparable"
// asks a CROSS-measurement question instead: which of a scenario's earlier
// measurements, if any, is this one read as a change against. This module
// answers that one — by content, never by the name of what produced either
// side, for the same reason fingerprint.mjs's treeDigest hashes bytes rather
// than trusting a label.

/**
 * @typedef {object} ReasoningJudgeFingerprint
 * @property {string} factor the factor id this judge and prompt belong to
 * @property {string} judgeModel vendor-prefixed, fully-qualified
 * @property {string} prompt the full prompt the judge was given
 */

/**
 * @typedef {object} ConditionFingerprint
 * @property {string} projectTree the materialized mock's own tree digest,
 *   taken before any probe's own diff is applied
 * @property {string} runtimeModel the vendor-prefixed, fully-qualified model
 *   that ran the probes
 * @property {Record<string, string>} skillDigests every installed skill's
 *   own tree digest, keyed by skill name
 * @property {ReasoningJudgeFingerprint[]} reasoningJudges one entry per
 *   reasoning factor the scenario declares — re-judging with a different
 *   judge or a different prompt is a new fingerprint, never a silent update
 *   to the old one, exactly as docs/specs/skill-evaluation.md states
 */

/** @param {Record<string, string>} a @param {Record<string, string>} b */
function sameSkillDigests(a, b) {
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key, index) => key === bKeys[index] && a[key] === b[key]);
}

/** @param {ReasoningJudgeFingerprint[]} a @param {ReasoningJudgeFingerprint[]} b */
function sameReasoningJudges(a, b) {
  if (a.length !== b.length) return false;
  const byFactor = (list) => [...list].sort((x, y) => x.factor.localeCompare(y.factor));
  const sortedA = byFactor(a);
  const sortedB = byFactor(b);
  return sortedA.every(
    (entry, index) =>
      entry.factor === sortedB[index].factor &&
      entry.judgeModel === sortedB[index].judgeModel &&
      entry.prompt === sortedB[index].prompt,
  );
}

/**
 * whether two measurements ran under matching conditions, per
 * docs/specs/skill-evaluation.md's "What makes two measurements comparable"
 * and the condition fingerprint docs/glossary.md defines: the same project
 * tree, the same probe model, the same installed-skill digests, and — for
 * every reasoning factor — the same judge and the same prompt.
 *
 * @param {ConditionFingerprint} a
 * @param {ConditionFingerprint} b
 * @returns {boolean}
 */
export function fingerprintsMatch(a, b) {
  return (
    a.projectTree === b.projectTree &&
    a.runtimeModel === b.runtimeModel &&
    sameSkillDigests(a.skillDigests, b.skillDigests) &&
    sameReasoningJudges(a.reasoningJudges, b.reasoningJudges)
  );
}

/**
 * the most recent of `candidates` whose fingerprint matches `current`'s, or
 * `null` when none does — including the ordinary case where `candidates` is
 * empty because this is the scenario's first measurement.
 *
 * @param {Array<{ id: string, timestamp: string, fingerprint: ConditionFingerprint }>} candidates
 *   every OTHER measurement of the same scenario, in any order
 * @param {ConditionFingerprint} current
 * @returns {{ id: string, timestamp: string } | null}
 */
export function findComparablePredecessor(candidates, current) {
  const matching = candidates.filter((candidate) =>
    fingerprintsMatch(candidate.fingerprint, current),
  );
  if (matching.length === 0) return null;
  const [latest] = [...matching].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return { id: latest.id, timestamp: latest.timestamp };
}
