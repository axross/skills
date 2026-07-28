// The repository-wide gates, as data.
//
// Each of these used to be its own npm run-script enumerated by hand in both
// package.json's `check` chain and merge-checks.yaml, with a consistency test
// holding the two lists together. They now run inside `npm test`, and this
// module is the one place their invocations live: the test that runs a gate and
// the test that asserts something about how a gate is invoked read the same
// record, so neither can describe a command the other does not run.
//
// Each gate targets the SOURCE tier under `skills/` rather than the installed
// copies under `.claude/skills/`. The two are identical whenever the
// installed-copy gate passes, so the choice only matters mid-edit — and there,
// checking what was just edited is the useful answer.

import { SCRIPTS } from "../helpers/run.mjs";

/**
 * @typedef {object} Gate
 * @property {string} name    what the gate was called as an npm run-script
 * @property {string} script  repository-relative path to the validator
 * @property {string[]} args  arguments, relative to the repository root
 * @property {RegExp} passes  a pattern the passing report must match
 */

/** @type {Gate[]} */
export const GATES = [
  {
    name: "links",
    script: SCRIPTS.checkLinks,
    // No arguments: the whole tree, dot-directories included.
    args: [],
    passes: /links OK \(\d+ links across \d+ Markdown files checked\)/,
  },
  {
    name: "skill-structure",
    script: SCRIPTS.checkSkill,
    // `--require-claude-code-fields` is what REVIEW.md's do-not-report list
    // depends on; gate-consistency.test.mjs pins it here rather than in prose.
    args: ["--require-claude-code-fields", "skills", ".claude/skills"],
    passes: /All \d+ skill\(s\) passed structural checks\./,
  },
  {
    name: "installed-copies",
    script: SCRIPTS.checkInstalledCopies,
    // No arguments: both roots default to this repository's own.
    args: [],
    passes: /All \d+ distributable skill\(s\) match their installed copies\./,
  },
];

/** One gate by name. Throws rather than returning undefined, so a rename fails loudly. */
export function gate(name) {
  const found = GATES.find((candidate) => candidate.name === name);
  if (!found) {
    throw new Error(
      `No gate named "${name}". Known gates: ${GATES.map((g) => g.name).join(", ")}.`,
    );
  }
  return found;
}
