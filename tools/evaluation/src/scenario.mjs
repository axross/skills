// loading and validating one evaluation scenario's scenario.json.
//
// docs/specs/skill-evaluation.md defines the scenario as a mock project, the
// installed skills, the git history the project starts from, and the
// non-skill harness, together with the task it is asked to perform — this
// module is where that declaration is read off disk and checked, once, so
// probe.mjs and evaluate.mjs both trust the same validated shape rather than
// each re-deriving what a well-formed scenario looks like.
//
// what a well-formed scenario looks like is declared in
// ../scenario.schema.json and nowhere else. this module evaluates that
// schema; it does not restate it. a shape stated twice drifts, and the
// schema is the copy an editor, a reviewer, or a tool outside this
// repository can also read.
//
// two things this module still does by hand, each for a reason:
//
//   - factor-id uniqueness. standard JSON Schema has no uniqueness-by-
//     property keyword — `uniqueItems` compares whole objects, so two
//     factors sharing an id but differing elsewhere pass it — and the
//     non-standard keyword that can would stop the file being a portable
//     JSON Schema, which is the point of writing one. it is the residual,
//     checked below, and the only rule the schema does not carry.
//   - error messages. a validator's own message names a keyword; the
//     rationale a scenario author needs is in the schema's `description`,
//     so failureMessage walks from the failing keyword back to the
//     subschema that owns it and surfaces that prose instead.
//
// the no-budget rule is in the schema rather than here, as
// `nonBudgetKey`, applied at every level including recursively inside a
// judgment's `input` — the one open subtree in the document and
// therefore the one place a budget-shaped key could otherwise hide. see
// docs/decisions/2026-08-18-validate-scenarios-with-a-zero-dependency-validator.md,
// which also names why this validator and not ajv, the better-known one.

import { readFileSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import { Validator } from "@cfworker/json-schema";

const SCHEMA = JSON.parse(readFileSync(new URL("../scenario.schema.json", import.meta.url), "utf8"));

/** one compiled validator for the process, since the schema never changes under it. */
const validator = new Validator(SCHEMA, "2020-12");

export const PHASES = SCHEMA.$defs.factor.properties.phase.enum;
export const JUDGMENT_METHODS = SCHEMA.$defs.judgment.properties.method.enum;

/**
 * the keywords that only report that something below them failed. dropping
 * them leaves the keyword that actually rejected the document, which is the
 * one whose subschema carries the explanation.
 */
const PASS_THROUGH_KEYWORDS = new Set(["$ref", "allOf", "anyOf", "oneOf", "properties", "items", "if", "false"]);

/** "#/factors/0/judgment/method" -> "factors[0].judgment.method" */
function dottedPath(instanceLocation) {
  const segments = instanceLocation
    .replace(/^#\/?/, "")
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));
  return segments.reduce(
    (path, segment) => (/^\d+$/.test(segment) ? `${path}[${segment}]` : path === "" ? segment : `${path}.${segment}`),
    "",
  );
}

/** the node a JSON Pointer addresses within `SCHEMA`, or null. */
function atPointer(pointer) {
  const segments = pointer.replace(/^#\/?/, "").split("/").filter(Boolean);
  let node = SCHEMA;
  for (const segment of segments) {
    if (node === null || typeof node !== "object") return null;
    node = node[segment.replace(/~1/g, "/").replace(/~0/g, "~")];
  }
  return node ?? null;
}

/**
 * walks a keywordLocation and reports two schemas along it. a keywordLocation
 * names every step taken to reach the failing keyword, `$ref` included — so a
 * `$ref` segment means the reference was followed, and resolving it is what
 * keeps the walk on the schema the validator was actually evaluating.
 *
 * `keyword` is the schema holding the failing keyword, which is what an
 * `additionalProperties` or `required` failure needs, since only that schema
 * knows the property set it was checking against.
 *
 * `property` is the innermost schema reached through a `properties/<name>`
 * step. that is the one carrying prose written for a scenario author: a
 * failure inside a shared `$def` — `scenarioRelativePath`, say, which both
 * `patch` and a judgment's `script` reuse — would otherwise report the
 * definition's generic wording instead of the field's own.
 *
 * @param {string} keywordLocation e.g. "#/properties/factors/items/$ref/properties/phase/enum"
 * @returns {{ keyword: Record<string, unknown> | null, property: Record<string, unknown> | null }}
 */
function schemasAlong(keywordLocation) {
  const segments = keywordLocation.replace(/^#\/?/, "").split("/").filter(Boolean);
  segments.pop(); // the keyword itself
  let node = SCHEMA;
  let property = null;
  let afterProperties = false;
  for (const segment of segments) {
    if (node === null || typeof node !== "object") return { keyword: null, property };
    node = segment === "$ref" ? atPointer(node.$ref) : node[segment.replace(/~1/g, "/").replace(/~0/g, "~")];
    if (afterProperties && node !== null && typeof node === "object") property = node;
    afterProperties = segment === "properties";
  }
  return { keyword: node !== null && typeof node === "object" ? node : null, property };
}

/** the property name a validator quoted in its own message, or null. */
function quotedName(message) {
  return /"([^"]+)"/.exec(message)?.[1] ?? null;
}

/**
 * turns one validation failure into the sentence a scenario author needs.
 *
 * @param {{ instanceLocation: string, keyword: string, keywordLocation: string, error: string }} error
 * @param {string} sourcePath
 * @returns {string}
 */
function failureMessage(error, sourcePath) {
  const { keyword: owner, property } = schemasAlong(error.keywordLocation);
  const path = dottedPath(error.instanceLocation);
  const at = path === "" ? sourcePath : `${sourcePath}: ${path}`;

  // a budget-shaped key is refused by name rather than by position, and its
  // message reads as the guard it replaces did — the path, the key, and why.
  if (error.keyword === "propertyNames") {
    const key = quotedName(error.error);
    const reason = atPointer("#/$defs/nonBudgetKey")?.description ?? error.error;
    return `${sourcePath}${path === "" ? "" : `.${path}`}.${key} ${reason} The offending key is "${key}".`;
  }

  if (error.keyword === "additionalProperties") {
    const key = quotedName(error.error);
    const known = Object.keys(owner?.properties ?? {});
    const where = path === "" ? key : `${path}.${key}`;
    return `${sourcePath}: ${where} is not a field this instrument reads (expected one of ${known.join(", ")}).`;
  }

  if (error.keyword === "required") {
    const key = quotedName(error.error);
    const missing = owner?.properties?.[key]?.description;
    const where = path === "" ? key : `${path}.${key}`;
    return `${sourcePath}: ${where} is required — ${missing ?? error.error}`;
  }

  return `${at} — ${owner?.description ?? property?.description ?? error.error}`;
}

/**
 * @param {unknown} scenario the parsed scenario.json
 * @param {string} sourcePath for error messages
 * @throws {Error} on any structural defect — a missing or malformed field, an
 *   unknown factor phase or judgment method, a duplicate factor id, or a
 *   forbidden budget-shaped key
 */
export function validateScenario(scenario, sourcePath) {
  const outcome = validator.validate(scenario);
  if (!outcome.valid) {
    // a budget-shaped key is also an unknown key, and the guard gets first
    // refusal so the author is told the real reason rather than the
    // incidental one. otherwise the last non-structural failure is the one
    // that actually rejected the document.
    const errors = outcome.errors;
    const chosen =
      errors.find((error) => error.keyword === "propertyNames") ??
      [...errors].reverse().find((error) => !PASS_THROUGH_KEYWORDS.has(error.keyword)) ??
      errors[errors.length - 1];
    throw new Error(failureMessage(chosen, sourcePath));
  }

  // the residual: see this module's header for why it is not in the schema.
  const seen = new Set();
  for (const [index, factor] of scenario.factors.entries()) {
    if (seen.has(factor.id)) {
      throw new Error(`${sourcePath}: factors[${index}].id "${factor.id}" duplicates an earlier factor's id.`);
    }
    seen.add(factor.id);
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
