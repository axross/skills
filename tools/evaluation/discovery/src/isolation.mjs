// what the CLI loaded that a workspace did not install, sorted into the one
// classification that makes contamination reportable: own, colliding, or
// foreign.
//
// rebuilt from the replaced instrument's own classification rather
// than moved into tools/lib — the plan's own accounting of what the second
// consumer proves is that the loaded-skill classification does NOT belong
// there: the effect side reads `loadedSkills` only to assert set equality
// across probes and never asks whether a name is own, foreign or colliding.
// See tools/discovery-eval/README.md.
//
// THE THREE-WAY SPLIT, NOT "OURS OR NOT". Each simpler version was written
// before it was rejected:
//
//   * `foreign = loaded − corpus` looks obviously right and is actively
//     harmful. a skill carrying `user-invocable: false` can never appear in
//     `loaded` on its own account, and nearly the whole corpus carries it, so
//     for those the subtraction only ever fires on a name COLLISION — which
//     is the worst case, not an exemption.
//   * `foreign = loaded`, with no corpus lookup, misreports a legitimately
//     `user-invocable: true` skill of ours as foreign — a state this
//     repository's authoring rules require of every workflow entry-point
//     skill, and one the corpus is in today, so it is not hypothetical.
//
// `UNRECOGNISED` joins `NOT_INVOCABLE` on the colliding side deliberately:
// only a positively-read `INVOCABLE` may excuse a loaded name.

import { INVOCABLE } from "./fingerprint.mjs";

/**
 * sort a set of loaded skill names into the three things a loaded skill can be.
 *
 * @param {string[]} loaded names the CLI reported loading
 * @param {Record<string, string>} invocability corpus name → invocability state
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
 * the names that make a probe's isolation worth flagging: colliding and
 * foreign, never own. a skill of ours that is legitimately user-invocable
 * appears in the loaded list by design.
 *
 * @param {{ colliding: string[], foreign: string[] }} classification
 * @returns {string[]} sorted
 */
export function contamination({ colliding, foreign }) {
  return [...colliding, ...foreign].sort();
}
