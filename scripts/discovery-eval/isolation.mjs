// What the CLI loaded that the workspace did not put there.
//
// `corpus.mjs` fingerprints what a SKILL.md ON DISK says. This module answers a
// different question — what the spawned CLI actually loaded AT RUNTIME — and the
// two are deliberately not the same name.
//
// THE PROBLEM. run.mjs builds a scratch workspace holding exactly this
// repository's installed skills, but the CLI also loads skills from the user
// level and from a managed environment. Measured against CLI 2.1.220 in a Claude
// Code cloud container: 23 foreign skills by default, 17 after
// `--setting-sources project` strips the user-level tier — among them
// `code-review`, `simplify`, `run`, `loop` and `dataviz`, every one of which
// competes for this fixture's prompts. Nothing in the corpus fingerprint could
// see any of it, because the fingerprint only ever covered what the runner
// installed.
//
// FULL ISOLATION IS NOT REACHABLE. Every switch that removes the managed tier —
// `--bare`, `--safe-mode`, `--setting-sources ''`, `--disable-slash-commands` —
// removes the workspace's own skills with it, which measures nothing. So the
// runner isolates the one tier it can and RECORDS the rest.
//
// WHAT THIS CAN AND CANNOT SEE. The signal is the `system`/`init` event's
// `skills` array, which lists USER-INVOCABLE skills only. Every skill in this
// repository carries `user-invocable: false`, so none of them appears there —
// which is exactly why a loaded name that MATCHES one of ours is so
// interesting. The blind spot is the mirror of that: a foreign skill which is
// itself `user-invocable: false` is invisible here, and no signal in the stream
// can see it. Report wording says "user-invocable only" for that reason.

import { INVOCABLE, UNRECOGNISED } from "./corpus.mjs";

/**
 * Sort a set of names into the three things a loaded skill can be.
 *
 * The classification is three-way rather than "ours or not", and each of the two
 * simpler versions was written before it was rejected:
 *
 *   * `foreign = loaded − corpus` looks obviously right and is actively harmful.
 *     A `user-invocable: false` corpus skill can never BE in `loaded`, so the
 *     subtraction only ever fires on a name COLLISION — and a collision is the
 *     worst case, not an exemption. It would have silently dropped a foreign
 *     `code-review`, which is the first contamination this evaluation's own
 *     issue names.
 *   * `foreign = loaded`, with no corpus lookup, misreports one of OUR skills as
 *     foreign the moment it is `user-invocable: true` — a state this
 *     repository's authoring rules REQUIRE for workflow entry-point skills. It
 *     would refuse a selection snapshot on a completely clean run, naming a skill the
 *     reader knows is ours.
 *
 * `UNRECOGNISED` joins `NOT_INVOCABLE` on the colliding side deliberately: only
 * a positively-read `INVOCABLE` may excuse a loaded name, because `own` is the
 * one bucket that suppresses the refusal.
 *
 * @param {string[]} loaded        names the CLI reported loading
 * @param {Record<string, string>} invocability  corpus name → invocability state
 * @returns {{ own: string[], colliding: string[], foreign: string[] }} each sorted
 */
export function classifyLoaded(loaded, invocability) {
  const own = [];
  const colliding = [];
  const foreign = [];

  for (const name of [...new Set(loaded)].sort()) {
    const state = invocability[name];
    if (state === undefined) {
      foreign.push(name);
    } else if (state === INVOCABLE) {
      own.push(name);
    } else {
      // NOT_INVOCABLE — that corpus skill cannot be the one loaded, so
      // something else is wearing its name — or UNRECOGNISED, which fails loud.
      colliding.push(name);
    }
  }

  return { own, colliding, foreign };
}

/**
 * Summarise a whole run: the union of what every probe loaded, classified once.
 *
 * A UNION rather than an intersection or a first-probe sample. Contamination
 * that appears in even one probe of a run is contamination the run's numbers
 * carry, so anything less than a union would under-report it.
 *
 * COVERAGE IS COUNTED, NOT ASSUMED, and this is the whole subtlety. Three states
 * have to stay distinct, because only one of them can back a committed selection snapshot:
 *
 *   * `reported === 0` — no probe reported a list. "Cannot tell", not "clean".
 *   * `0 < reported < total` — a PARTIAL run. The tempting reading is that some
 *     evidence beats none, and it does for a report; it does not for a selection snapshot.
 *     A single probe that saw nothing foreign, out of 145, would otherwise write
 *     the same `foreignSkills: []` as a run where all 145 agreed — and the
 *     contamination this looks for is present in every probe or none, so the
 *     probes that went unobserved are exactly the ones that could have differed.
 *   * `reported === total` — the only shape that supports the claim
 *     `evals/discovery/README.md` makes for `[]`: a MEASURED clean run.
 *
 * That a partial is even reachable is this project's own premise: `parseStream`
 * keeps `null` and `[]` apart precisely because a probe can fail to report, and
 * it parses forgivingly enough that one truncated stream among many is ordinary.
 *
 * @param {Array<string[]|null>} perProbeLoaded  one entry per probe, `null` when unreported
 * @param {Record<string, string>} invocability
 * @returns {{ recorded: boolean, complete: boolean, reported: number, total: number, own: string[], colliding: string[], foreign: string[] }}
 */
export function summariseIsolation(perProbeLoaded, invocability) {
  const reportedProbes = perProbeLoaded.filter((entry) => Array.isArray(entry));
  const coverage = {
    reported: reportedProbes.length,
    total: perProbeLoaded.length,
  };
  // `complete` demands a non-empty run: zero probes reporting out of zero is
  // vacuous agreement, not confirmation.
  const complete = coverage.total > 0 && coverage.reported === coverage.total;

  if (reportedProbes.length === 0) {
    return {
      recorded: false,
      complete,
      ...coverage,
      own: [],
      colliding: [],
      foreign: [],
    };
  }
  return {
    recorded: true,
    complete,
    ...coverage,
    ...classifyLoaded(reportedProbes.flat(), invocability),
  };
}

/**
 * The names that make a run unfit to record a selection snapshot from.
 *
 * Colliding and foreign, never `own`. A skill of ours that is legitimately
 * user-invocable appears in the loaded list BY DESIGN, so refusing on it would
 * break recording for a corpus state this repository's own authoring rules
 * require of every workflow entry-point skill.
 *
 * A separate function rather than an inline `[...colliding, ...foreign]` at the
 * one call site, so the rule that decides a refusal is testable without
 * spawning a CLI and paying for a fixture's worth of probes.
 *
 * @param {{ colliding: string[], foreign: string[] }} isolation
 * @returns {string[]} sorted; empty means the run may emit a selection snapshot
 */
export function contamination({ colliding, foreign }) {
  return [...colliding, ...foreign].sort();
}

/**
 * Whether a run may record a selection snapshot at all, and why not when it may not.
 *
 * THREE ways to be unfit, and only one of them has names to print. The two
 * quiet ones both look exactly like success, and each was written wrong first:
 *
 *   * CONTAMINATED — the CLI loaded skills the workspace did not install.
 *   * UNCHECKED — no probe reported a skill list, so what the CLI loaded was
 *     never observed. `colliding` and `foreign` are both `[]` here, so a check
 *     that only counts names reads this as a clean run and emits a document
 *     whose `foreignSkills: []` is byte-identical to a verified-clean one.
 *   * PARTIAL — some probes reported and some did not. Counting names does not
 *     catch this either, and neither does a boolean "did anything report":
 *     ONE probe reporting out of 145 satisfies both and writes the same `[]`.
 *     The evidence that would have distinguished a contaminated run from a
 *     clean one is precisely what the unreported probes were carrying.
 *
 * Together those destroy the distinction the field exists to carry: a reader of
 * the committed selection snapshot could no longer tell "measured, and nothing foreign
 * loaded" from "never looked" or "looked at some of it".
 *
 * `report.mjs` keeps all three apart on screen; this is what keeps them apart in
 * the persisted document, which is the only place the distinction has to survive.
 *
 * @param {{ recorded: boolean, complete: boolean, reported: number, total: number, colliding: string[], foreign: string[] }} isolation
 * @returns {{ reason: string, names: string[] }|null} `null` when the run may record
 */
export function selectionSnapshotRefusal(isolation) {
  if (!isolation.recorded) {
    return {
      reason:
        "no probe reported which skills the CLI loaded, so isolation was never checked",
      names: [],
    };
  }
  if (!isolation.complete) {
    return {
      reason: `only ${isolation.reported} of ${isolation.total} probes reported which skills the CLI loaded, so isolation holds for part of the run rather than all of it`,
      names: [],
    };
  }
  const names = contamination(isolation);
  if (names.length > 0) {
    return {
      reason: `the CLI loaded ${names.length} skill(s) this workspace did not install`,
      names,
    };
  }
  return null;
}

/**
 * Corpus skills whose `user-invocable` value could not be read.
 *
 * Named in the report so a false collision is diagnosable. Without this a
 * mistyped field produces a loud, correct-by-design warning about a skill the
 * reader knows perfectly well is theirs, and nothing says why.
 *
 * @param {Record<string, string>} invocability
 * @returns {string[]} sorted
 */
export function unrecognisedInvocability(invocability) {
  return Object.keys(invocability)
    .filter((name) => invocability[name] === UNRECOGNISED)
    .sort();
}
