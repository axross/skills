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

/** matches a key this instrument was told never to add — see admission.mjs's header. */
const FORBIDDEN_KEY_RE = /budget|dollar|(?:cost|price)(?:usd)?|usdcap|\bcap\b/i;

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
    if (FORBIDDEN_KEY_RE.test(key)) {
      throw new Error(
        `${path}.${key} looks like a budget, a cost ceiling, or a dollar figure — a scenario ` +
          "declares no such thing (docs/specs/skill-evaluation.md; the admission bound this " +
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
  if (typeof scenario.id !== "string" || scenario.id.length === 0) fail('"id" must be a non-empty string.');
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
  if (typeof scenario.harness.agentsMd !== "boolean") {
    fail('"harness.agentsMd" must be a boolean.');
  }
  if (scenario.task === null || typeof scenario.task !== "object" || typeof scenario.task.prompt !== "string") {
    fail('"task.prompt" must be a string.');
  }
  if (!Array.isArray(scenario.factors) || scenario.factors.length === 0) {
    fail('"factors" must be a non-empty array.');
  }

  const factorIds = new Set();
  for (const [index, factor] of scenario.factors.entries()) {
    const at = `factors[${index}]`;
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
    if (factor.judgment.method === "script" && typeof factor.judgment.script !== "string") {
      fail(`${at}.judgment.script must name a script relative to the scenario directory.`);
    }
    if (factor.judgment.method === "reasoning") {
      if (typeof factor.judgment.model !== "string" || factor.judgment.model.length === 0) {
        fail(`${at}.judgment.model must be a vendor-prefixed, fully-qualified model id.`);
      }
      if (typeof factor.judgment.instructions !== "string" || factor.judgment.instructions.length === 0) {
        fail(`${at}.judgment.instructions must be a non-empty string.`);
      }
    }
  }

  assertNoBudgetField(scenario, sourcePath);
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
