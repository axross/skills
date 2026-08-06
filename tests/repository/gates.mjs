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

import { readdirSync } from "node:fs";

import { REPO_ROOT, SCRIPTS } from "../helpers/run.mjs";

/**
 * @typedef {object} Gate
 * @property {string} name    what the gate was called as an npm run-script
 * @property {string} script  repository-relative path to the validator
 * @property {string[]} args  arguments, relative to the repository root
 * @property {RegExp} passes  a pattern the passing report must match
 */

/**
 * Every top-level entry of this repository the links gate should walk: the
 * whole tree, dot-directories included, MINUS the mock fixtures under
 * `examples/` (self-contained projects with their own toolchain, never
 * covered by this repository's own gates — see .prettierignore) and the two
 * entries a bare "." sweep would already prune internally as it descended
 * into them.
 *
 * check-links.mjs has no ignore-file mechanism of its own — its only
 * scoping lever is which roots it is handed — and a root named directly on
 * its command line bypasses its internal pruning (that only filters a
 * directory's CHILDREN as they're discovered mid-walk, not a root passed in
 * outright), which is why `.git` and `node_modules` are excluded here rather
 * than left for it to skip on its own. Computed from the real directory
 * listing, not a literal list, so a new top-level entry is covered without
 * anyone remembering to add it here.
 */
function linksGateRoots() {
  const excluded = new Set(["examples", ".git", "node_modules"]);
  return readdirSync(REPO_ROOT)
    .filter((name) => !excluded.has(name))
    .sort();
}

/** @type {Gate[]} */
export const GATES = [
  {
    name: "links",
    script: SCRIPTS.checkLinks,
    args: linksGateRoots(),
    passes: /links OK \(\d+ links across \d+ Markdown files checked\)/,
  },
  // The skill-structure gate is three commands rather than one: each answers
  // for one kind of edit, so an author who changed a reference file is not made
  // to read findings about frontmatter. They share `skill-documents.mjs`, which
  // is what keeps them from disagreeing about what a skill is made of.
  //
  // `.agents/skills` is the tier holding real files; `.claude/skills` is
  // symlinks into it, so checking both would report one verdict twice.
  {
    name: "skill-frontmatter",
    script: SCRIPTS.checkSkillFrontmatter,
    args: ["skills", ".agents/skills"],
    passes: /All \d+ skill\(s\) passed structural checks\./,
  },
  {
    name: "skill-body",
    script: SCRIPTS.checkSkillBody,
    args: ["skills", ".agents/skills"],
    passes: /All \d+ skill\(s\) passed structural checks\./,
  },
  {
    name: "skill-references",
    script: SCRIPTS.checkSkillReferences,
    args: ["skills", ".agents/skills"],
    passes: /All \d+ skill\(s\) passed structural checks\./,
  },
  {
    name: "installed-copies",
    script: SCRIPTS.checkInstalledCopies,
    // Both roots are named rather than defaulted. The script ships inside
    // agent-skill-management now, where "two levels up from the script" would
    // resolve to `.claude/` instead of a repository root — and a root that
    // matches nothing reports no drift, which reads exactly like a pass.
    //
    // The INSTALLED root named here is `.claude/skills`, the symlink tier,
    // rather than `.agents/skills` where the bytes actually live. Comparing
    // through the links checks both invariants at once: that the install still
    // matches its source, AND that all 28 symlinks resolve. Pointed at
    // `.agents/skills` it would only ever check the first.
    args: ["skills", ".claude/skills"],
    passes: /All \d+ distributable skill\(s\) match their installed copies\./,
  },
  // The five checks living-product-specification bundles, run over this
  // repository's own corpus. They are deliberately five commands rather than
  // one: each answers for one kind of edit, so an author who wrote a decision
  // record is not made to read findings about the glossary.
  //
  // Each names `docs` rather than leaning on the same default, so the argument
  // is visible here alongside every other gate's — and so a teeth case can
  // plant a corpus under a throwaway root and run this exact invocation with
  // nothing but `cwd` changed.
  {
    name: "corpus-index",
    script: SCRIPTS.checkIndex,
    args: ["docs"],
    passes: /Every document is listed in index\.md \(\d+ indexed/,
  },
  {
    name: "corpus-references",
    script: SCRIPTS.checkReferences,
    args: ["docs"],
    passes: /Every relative link resolves \(\d+ across \d+ documents\)\./,
  },
  {
    // Vacuous today, and the pattern says so rather than pretending otherwise:
    // the corpus has no `specs/` yet, so this reports "Nothing to check". The
    // teeth case is what establishes it can fail meanwhile. Tighten the pattern
    // to the spec-counting form once #247 adds the first spec.
    name: "corpus-glossary",
    script: SCRIPTS.checkGlossary,
    args: ["docs"],
    passes: /Every spec has a heading in glossary\.md \(\d+ checked\)\.|No specs\/ under docs\./,
  },
  {
    name: "decision-naming",
    script: SCRIPTS.checkDecisionNaming,
    args: ["docs"],
    passes: /Every decision filename conforms \(\d+ checked\)\./,
  },
  {
    name: "decision-supersede",
    script: SCRIPTS.checkDecisionSupersede,
    args: ["docs"],
    passes: /The supersede chain is sound and nothing cites replaced rationale/,
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
