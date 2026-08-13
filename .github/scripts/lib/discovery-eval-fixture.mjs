// what the discovery-eval-*.mjs steps of .github/workflows/discovery-eval.yaml
// each need before they can decide anything: the fixture the dispatch reads,
// one case's declaration inside it, and the two raw dispatch inputs that only
// resolve to one of two literal strings.
//
// it lives beside them rather than under tools/evaluation/discovery/src/ for
// the same reason .github/scripts/lib/effect-eval-fixture.mjs does: the fixture
// and the dispatch's mode are the dispatch's data, not the instrument's. the
// instrument has no notion of a "pull request" or a "dry-run input string" —
// those are workflow_dispatch concepts, and teaching the instrument about them
// would stop evaluate.mjs being usable against an arbitrary case with no
// workflow at all.

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { DATA_ROOT, FIXTURE_FILE } from "../../../tools/evaluation/discovery/src/layout.mjs";
import { MODES } from "../../../tools/evaluation/discovery/src/plan.mjs";

export const DEFAULT_ROOT = DATA_ROOT;

/**
 * the fixture itself — every declared case, plus `capUsd` and
 * `unmeasuredProbeCostCeilingUsd`.
 *
 * throws rather than exiting, so each caller renders the message through its
 * own usage text and its own exit code.
 *
 * @param {string} root the data root holding fixture.json
 * @returns {Promise<{
 *   cases: object[],
 *   capUsd: number,
 *   unmeasuredProbeCostCeilingUsd: { situated: number, bare: number },
 * }>}
 */
export async function readFixture(root) {
  const fixturePath = join(root, FIXTURE_FILE);
  let fixture;
  try {
    fixture = JSON.parse(await readFile(fixturePath, "utf8"));
  } catch (error) {
    throw new Error(`Could not read ${fixturePath}: ${error.message}`);
  }
  if (!Array.isArray(fixture.cases) || fixture.cases.length === 0) {
    throw new Error(`${fixturePath} declares no "cases".`);
  }
  if (!(fixture.capUsd > 0)) {
    throw new Error(`${fixturePath} declares no positive "capUsd".`);
  }
  // per mode, not one figure — a situated and a bare probe cost roughly an
  // order of magnitude apart. see
  // tools/evaluation/discovery/src/admission.mjs's header.
  for (const mode of MODES) {
    if (!(fixture.unmeasuredProbeCostCeilingUsd?.[mode] > 0)) {
      throw new Error(`${fixturePath} declares no positive "unmeasuredProbeCostCeilingUsd.${mode}".`);
    }
  }
  return fixture;
}

/**
 * the fixture's declaration for one case.
 *
 * @param {string} root the data root holding fixture.json
 * @param {string} caseId
 * @returns {Promise<object>} the declared case
 */
export async function readDeclaredCase(root, caseId) {
  const fixture = await readFixture(root);
  const declared = fixture.cases.find((entry) => entry.id === caseId);
  if (!declared) {
    const known = fixture.cases.map((entry) => entry.id).join(", ") || "(none)";
    throw new Error(`${join(root, FIXTURE_FILE)} declares no case ${JSON.stringify(caseId)}. Known: ${known}`);
  }
  return declared;
}

/**
 * the dispatch's `dry_run` input, from the raw text of its typed boolean.
 *
 * the two literals and nothing else — matching
 * effect-eval-fixture.mjs's own `parseDryRunInput`, and the same reasoning: an
 * `inputs.<name>` that does not resolve interpolates the empty string rather
 * than erroring, and every looser reading of that quietly selects the paid
 * path. refusing anything but `true` and `false` turns an unresolved input
 * into an exit code before a probe spawns.
 *
 * @param {string|undefined} value
 * @returns {boolean}
 */
export function parseDryRunInput(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(
    `--dry-run-input must be "true" or "false", got ${JSON.stringify(value ?? null)}. ` +
      "An empty value means the dispatch's inputs.dry_run did not resolve; refusing is " +
      "cheaper than falling through to the paid path.",
  );
}

/**
 * the dispatch's `pull_request` input, parsed into a positive integer or
 * `null`.
 *
 * this is the guard that keeps a malformed reference from being silently
 * treated as "no pull request" — which would silently swap a head-mode
 * dispatch for a measurement one, the one thing safety property 5 exists to
 * prevent. an untyped `workflow_dispatch` input reads as `""` when omitted, and
 * `""` is the only string this accepts as "absent"; anything else must parse as
 * a positive integer or the whole dispatch refuses before a probe spawns.
 *
 * @param {string|undefined} value
 * @returns {number|null}
 * @throws {Error} when `value` is non-empty and is not a positive integer
 */
export function parsePullRequestInput(value) {
  if (value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(
      `--pull-request must be empty or a positive integer, got ${JSON.stringify(value)}. ` +
        "A malformed reference is refused rather than silently treated as absent, which would " +
        "silently swap a head-mode dispatch for a measurement one.",
    );
  }
  return n;
}

/**
 * the dispatch's `prompt` input: the literal override text, or `null` when
 * absent.
 *
 * mirrors `parsePullRequestInput`'s "an unfilled workflow_dispatch input
 * interpolates the empty string, and that means absent" convention, but
 * there is no format to validate — a prompt is free text — so this never
 * throws.
 *
 * @param {string|undefined} value
 * @returns {string|null}
 */
export function parsePromptInput(value) {
  if (value === undefined || value === "") return null;
  return value;
}
