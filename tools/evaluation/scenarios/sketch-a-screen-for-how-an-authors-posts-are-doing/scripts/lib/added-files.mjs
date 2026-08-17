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

import { readFileSync } from "node:fs";

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

/**
 * every `.html`/`.htm` path this diff added, sorted, read back from the
 * reconstructed workspace (this process's own cwd) where possible. Returns
 * raw data only — no printing, no exit — so each caller keeps its own
 * evidence text and its own `fail()` for the two situations that differ
 * per factor: no candidate at all (a real, judgeable false, worded
 * differently by each factor) and a candidate the diff names but the
 * workspace does not actually contain (a refusal, worded identically
 * today but each script's own to phrase).
 *
 * @param {string} diffText
 * @returns {{
 *   candidates: string[],
 *   readable: Array<{ path: string, content: string }>,
 *   unreadable: string[],
 * }} `unreadable` entries read "<path> (<error message>)"
 */
export function readAddedHtmlFiles(diffText) {
  const addedFiles = [...addedFilesFromDiff(diffText)];
  const candidates = addedFiles.filter((path) => /\.html?$/i.test(path)).sort();
  const readable = [];
  const unreadable = [];
  for (const path of candidates) {
    try {
      readable.push({ path, content: readFileSync(path, "utf8") });
    } catch (error) {
      unreadable.push(`${path} (${error.message})`);
    }
  }
  return { candidates, readable, unreadable };
}
