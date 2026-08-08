// what the three effect-eval-*.mjs steps of .github/workflows/effect-eval.yaml
// each need before they can decide anything: the case the fixture declares, and
// the mode the dispatch was started in.
//
// it lives beside them rather than under tools/effect-eval/src/ because both
// are shaped by the dispatch. the fixture is the dispatch's data — which cases
// exist, what each may spend — and the mode is a workflow_dispatch input. the
// instrument has no notion of either, and teaching it one would stop setup.mjs
// and evaluate.mjs being usable against an arbitrary mock and skill set.

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { DATA_ROOT, FIXTURE_FILE } from "../../../tools/effect-eval/src/layout.mjs";

export const DEFAULT_ROOT = DATA_ROOT;

/**
 * the fixture's declaration for one case.
 *
 * throws rather than exiting, so each caller renders the message through its
 * own usage text and its own exit code.
 *
 * @param {string} root the data root holding fixture.json
 * @param {string} caseId
 * @returns {Promise<object>} the declared case
 */
export async function readDeclaredCase(root, caseId) {
  const fixturePath = join(root, FIXTURE_FILE);
  let fixture;
  try {
    fixture = JSON.parse(await readFile(fixturePath, "utf8"));
  } catch (error) {
    throw new Error(`Could not read ${fixturePath}: ${error.message}`);
  }

  const declared = (fixture.cases ?? []).find((entry) => entry.id === caseId);
  if (!declared) {
    const known = (fixture.cases ?? []).map((entry) => entry.id).join(", ") || "(none)";
    throw new Error(`${fixturePath} declares no case ${JSON.stringify(caseId)}. Known: ${known}`);
  }
  return declared;
}

/**
 * the dispatch's mode, from the raw text of its `dry-run` input.
 *
 * the two literals and nothing else, which is the point rather than pedantry.
 * an `inputs.<name>` that does not resolve interpolates the empty string rather
 * than erroring, and every looser reading of that — truthiness, a shell
 * `[ "$X" = "true" ]`, a default applied at input-binding time — quietly
 * selects the paid path. refusing anything but `true` and `false` turns an
 * unresolved input into an exit code before a probe spawns.
 *
 * @param {string|undefined} value
 * @returns {boolean}
 */
export function parseDryRunInput(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(
    `--dry-run-input must be "true" or "false", got ${JSON.stringify(value ?? null)}. ` +
      "An empty value means the dispatch's inputs.dry-run did not resolve; refusing is " +
      "cheaper than falling through to the paid path.",
  );
}
