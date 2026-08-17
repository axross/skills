// added-files.mjs — reading which paths a probe's own diff added, shared by
// check-self-contained-sketch.mjs and check-low-fidelity-palette.mjs.
//
// Extracted rather than copy-pasted (as an earlier version of both scripts
// did) to remove the duplication, the same way this repository's other
// scenario, give-every-screen-one-loading-and-error-treatment, consolidated
// its own two scripts' shared parsing into ./lib/route-imports.mjs. This
// module is scoped to THIS scenario's own scripts/lib/ rather than shared
// across the two scenario directories — each scenario stays self-contained,
// so a change to one never has to be reasoned about against the other's
// tree.
//
// factor-judgment.mjs invokes a judgment script as
// `spawnSync(process.execPath, [resolve(scriptPath), contextPath], { cwd: workspace })`
// — the script runs from its own path in this repository, so an ordinary
// relative ESM import of a sibling module resolves normally. This file is
// never invoked directly by factor-judgment.mjs and carries no
// `#!/usr/bin/env node` shebang for that reason.

/**
 * every path a unified diff ADDED, read from its "--- /dev/null" /
 * "+++ b/<path>" pair — the shape `git diff` always writes for a new file,
 * regardless of how the hunks inside are shaped.
 *
 * @param {string} diffText
 * @returns {Set<string>}
 */
export function addedFilesFromDiff(diffText) {
  const added = new Set();
  const lines = diffText.split("\n");
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i] === "--- /dev/null" && lines[i + 1].startsWith("+++ ")) {
      added.add(lines[i + 1].slice(4).replace(/^b\//, "").trim());
    }
  }
  return added;
}
