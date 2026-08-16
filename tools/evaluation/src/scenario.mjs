// loading and validating one evaluation scenario's scenario.json.
//
// docs/specs/skill-evaluation.md defines the scenario as a mock project, the
// installed skills, the git history the project starts from, and the
// non-skill harness, together with the task it is asked to perform — this
// module is where that declaration is read off disk and checked, once, so
// probe.mjs and evaluate.mjs both trust the same validated shape rather than
// each re-deriving what a well-formed scenario looks like.
//
// the no-budget rule is enforced here rather than trusted to prose: #392 and
// #395 both state it as a non-goal ("do not estimate cost... in any form"),
// and a rule nothing checks is a rule the next scenario silently breaks.

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

export const PHASES = ["discovery", "outcome", "transcript"];
export const JUDGMENT_METHODS = ["script", "reasoning"];

/**
 * a budget root, matched against the start of one word of a key rather than
 * against the key's text — so `capUsd` is caught, `capture` is not, and the
 * within-word derivations the substring guard this replaces caught, such as
 * `priced` and `costly`, stay caught. see admission.mjs's header.
 */
const FORBIDDEN_PREFIX_RE = /^(?:budget|cost|dollar|price|spend)/i;

/**
 * the two roots too short to be prefixes: `cap` would fire on `capture` and
 * `capability`, and `usd` prefixes nothing English spells. matched whole,
 * with cap's irregular inflections named outright since no ending rule
 * produces a doubled consonant.
 */
const FORBIDDEN_WORDS = new Set(["cap", "caps", "capped", "capping", "usd"]);

/** the words a key is spelled from: camelCase, snake_case, kebab-case, and a run of capitals each break apart. */
function keyWords(key) {
  return key
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter((word) => word.length > 0);
}

/** the forbidden word `key` carries, or null. */
function forbiddenWordIn(key) {
  return (
    keyWords(key).find((word) => FORBIDDEN_PREFIX_RE.test(word) || FORBIDDEN_WORDS.has(word.toLowerCase())) ?? null
  );
}

// the keys this instrument actually reads, per level. A key admitted at one
// level is not implicitly admitted at another — a judgment's own set is
// chosen by its `method`, so `script` is read for a script judgment and
// rejected for a reasoning one, and vice versa for `model`/`instructions`.
// `judgment.expect` is deliberately not reached further down: its keys are
// the judgment script's own vocabulary (`file`, `startMarker`,
// `mustContainAll` today, whatever a new script needs tomorrow), and the
// instrument reads only the `expect` key itself.
const SCENARIO_KEYS = [
  "id",
  "description",
  "mock",
  "targetSkills",
  "peerSkills",
  "patch",
  "harness",
  "task",
  "factors",
];
const HARNESS_KEYS = ["agentsMd"];
const TASK_KEYS = ["prompt"];
const FACTOR_KEYS = ["id", "phase", "description", "judgment"];
const SCRIPT_JUDGMENT_KEYS = ["method", "script", "expect"];
const REASONING_JUDGMENT_KEYS = ["method", "model", "instructions"];

/**
 * fails on any key of `value` that is not in `allowed` — a key the
 * instrument does not read is a mistake (a typo, a leftover field, a
 * property that was removed from the shape) rather than a permitted
 * extension, so it fails at load instead of being admitted and ignored.
 *
 * @param {Record<string, unknown>} value
 * @param {readonly string[]} allowed the exact keys this level reads
 * @param {string} prefix path prefix for an offending key, e.g. "harness" or
 *   "factors[0].judgment" — the empty string at the scenario's own top level
 * @param {(message: string) => never} fail
 */
function assertOnlyKnownKeys(value, allowed, prefix, fail) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      const path = prefix ? `${prefix}.${key}` : key;
      fail(`${path} is not a field this instrument reads (expected one of ${allowed.join(", ")}).`);
    }
  }
}

/**
 * @param {unknown} value
 * @param {string} path for the error message, e.g. "scenario.json" or "factors[0]"
 * @throws {Error} when a key anywhere under `value` names a budget, a cost
 *   ceiling, or a dollar figure
 */
function assertNoBudgetField(value, path) {
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoBudgetField(entry, `${path}[${index}]`));
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    const word = forbiddenWordIn(key);
    if (word !== null) {
      throw new Error(
        `${path}.${key} looks like a budget, a cost ceiling, or a dollar figure (the word "${word}") — ` +
          "a scenario declares no such thing (docs/specs/skill-evaluation.md; the admission bound this " +
          "instrument enforces is a probe count, never a cost).",
      );
    }
    assertNoBudgetField(entry, `${path}.${key}`);
  }
}

/**
 * @param {unknown} scenario the parsed scenario.json
 * @param {string} sourcePath for error messages
 * @throws {Error} on any structural defect — a missing or malformed field, an
 *   unknown factor phase or judgment method, or a forbidden budget-shaped key
 */
export function validateScenario(scenario, sourcePath) {
  const fail = (message) => {
    throw new Error(`${sourcePath}: ${message}`);
  };

  if (scenario === null || typeof scenario !== "object") fail("must be a JSON object.");
  assertNoBudgetField(scenario, sourcePath);
  assertOnlyKnownKeys(scenario, SCENARIO_KEYS, "", fail);
  if (typeof scenario.id !== "string" || scenario.id.length === 0) fail('"id" must be a non-empty string.');
  if (typeof scenario.description !== "string" || scenario.description.length === 0) {
    fail(
      '"description" must be a non-empty string stating what this scenario measures and why — ' +
        "a rationale a reader can disagree with without reading its factors.",
    );
  }
  if (typeof scenario.mock !== "string" || scenario.mock.length === 0) {
    fail('"mock" must be a non-empty string.');
  }
  if (!Array.isArray(scenario.targetSkills) || scenario.targetSkills.length === 0) {
    fail('"targetSkills" must be a non-empty array of skill names.');
  }
  if (!Array.isArray(scenario.peerSkills)) fail('"peerSkills" must be an array of skill names (may be empty).');
  if (!("patch" in scenario) || (scenario.patch !== null && typeof scenario.patch !== "string")) {
    fail('"patch" must be present, and either null or a path to a unified diff.');
  }
  if (scenario.harness === null || typeof scenario.harness !== "object") {
    fail('"harness" must be an object.');
  }
  assertOnlyKnownKeys(scenario.harness, HARNESS_KEYS, "harness", fail);
  if (typeof scenario.harness.agentsMd !== "boolean") {
    fail('"harness.agentsMd" must be a boolean.');
  }
  if (scenario.task === null || typeof scenario.task !== "object") {
    fail('"task" must be an object.');
  }
  assertOnlyKnownKeys(scenario.task, TASK_KEYS, "task", fail);
  if (typeof scenario.task.prompt !== "string") {
    fail('"task.prompt" must be a string.');
  }
  if (!Array.isArray(scenario.factors) || scenario.factors.length === 0) {
    fail('"factors" must be a non-empty array.');
  }

  const factorIds = new Set();
  for (const [index, factor] of scenario.factors.entries()) {
    const at = `factors[${index}]`;
    if (factor === null || typeof factor !== "object") fail(`${at} must be an object.`);
    assertOnlyKnownKeys(factor, FACTOR_KEYS, at, fail);
    if (typeof factor.id !== "string" || factor.id.length === 0) fail(`${at}.id must be a non-empty string.`);
    if (factorIds.has(factor.id)) fail(`${at}.id "${factor.id}" duplicates an earlier factor's id.`);
    factorIds.add(factor.id);
    if (typeof factor.description !== "string" || factor.description.length === 0) {
      fail(
        `${at}.description must be a non-empty string stating what this factor expects and why — ` +
          "a rationale a reader can disagree with without reading the judgment script.",
      );
    }
    if (!PHASES.includes(factor.phase)) {
      fail(`${at}.phase must be one of ${PHASES.join(", ")}, got ${JSON.stringify(factor.phase)}.`);
    }
    if (!factor.judgment || !JUDGMENT_METHODS.includes(factor.judgment.method)) {
      fail(`${at}.judgment.method must be one of ${JUDGMENT_METHODS.join(", ")}.`);
    }
    if (factor.judgment.method === "script") {
      assertOnlyKnownKeys(factor.judgment, SCRIPT_JUDGMENT_KEYS, `${at}.judgment`, fail);
      if (typeof factor.judgment.script !== "string") {
        fail(`${at}.judgment.script must name a script relative to the scenario directory.`);
      }
    }
    if (factor.judgment.method === "reasoning") {
      assertOnlyKnownKeys(factor.judgment, REASONING_JUDGMENT_KEYS, `${at}.judgment`, fail);
      if (typeof factor.judgment.model !== "string" || factor.judgment.model.length === 0) {
        fail(`${at}.judgment.model must be a vendor-prefixed, fully-qualified model id.`);
      }
      if (typeof factor.judgment.instructions !== "string" || factor.judgment.instructions.length === 0) {
        fail(`${at}.judgment.instructions must be a non-empty string.`);
      }
    }
  }
}

/**
 * @param {string} scenarioDir absolute path to one scenario's own directory
 * @returns {Promise<{ dir: string, path: string } & Record<string, unknown>>}
 *   the validated scenario, plus its own directory (so a caller can resolve
 *   `patch` and every factor's `judgment.script` relative to it) and the
 *   path it was read from (for error messages downstream)
 * @throws {Error} when scenario.json is missing, is not valid JSON, or fails
 *   {@link validateScenario}
 */
export async function loadScenario(scenarioDir) {
  const path = join(scenarioDir, "scenario.json");
  let raw;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    throw new Error(`No scenario.json at ${path}.`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${path} is not valid JSON: ${error.message}`);
  }
  validateScenario(parsed, path);
  return { ...parsed, dir: scenarioDir, path };
}

/**
 * every scenario under `scenariosRoot`, sorted by id.
 *
 * @param {string} scenariosRoot absolute path to tools/evaluation/scenarios
 * @returns {Promise<Array<Awaited<ReturnType<typeof loadScenario>>>>}
 */
export async function loadAllScenarios(scenariosRoot) {
  let entries;
  try {
    entries = await readdir(scenariosRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  const dirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  const scenarios = await Promise.all(dirs.map((name) => loadScenario(join(scenariosRoot, name))));
  return scenarios.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * the skills one condition installs, per docs/specs/skill-evaluation.md: the
 * skill-present condition installs `targetSkills` plus `peerSkills`; the
 * skill-absent condition installs `peerSkills` only.
 *
 * @param {{ targetSkills: string[], peerSkills: string[] }} scenario
 * @param {"skill-present"|"skill-absent"} condition
 * @returns {string[]}
 */
export function skillsForCondition(scenario, condition) {
  if (condition === "skill-present") return [...scenario.targetSkills, ...scenario.peerSkills];
  if (condition === "skill-absent") return [...scenario.peerSkills];
  throw new Error(`Unknown condition ${JSON.stringify(condition)}; expected "skill-present" or "skill-absent".`);
}
