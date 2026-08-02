// Loading and validating evals/review/fixture.json.
//
// Validation is the whole of `--dry-run`, so it runs with no CLI, no secret, and
// no network. A fixture is a judgment product — every case carries a written
// rationale precisely so a human can disagree with a label without reading code
// — and the cheapest failure is a malformed fixture caught before a run spends.

import { readFileSync } from "node:fs";

/** A probe reads a diff, so a case is identified by commits and never by a URL. */
const REQUIRED = ["id", "baseSha", "headSha", "rationale"];
const SHA = /^[0-9a-f]{7,40}$/;

/**
 * @param {string} path
 * @returns {{version: number, cases: object[]}}
 * @throws {Error} with every problem found, not just the first
 */
export function loadFixture(path) {
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch (error) {
    throw new Error(`Cannot read fixture at ${path}: ${error.message}`);
  }

  let fixture;
  try {
    fixture = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Fixture at ${path} is not valid JSON: ${error.message}`);
  }

  const problems = validate(fixture);
  if (problems.length > 0) {
    throw new Error(`Fixture at ${path} is invalid:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  }
  return fixture;
}

/**
 * @param {unknown} fixture
 * @returns {string[]} every problem, so one run fixes them all
 */
export function validate(fixture) {
  const problems = [];
  if (typeof fixture !== "object" || fixture === null) return ["fixture is not an object"];
  if (!Array.isArray(fixture.cases)) return ["fixture has no `cases` array"];
  if (fixture.cases.length === 0) problems.push("`cases` is empty");

  const seen = new Set();
  for (const [index, testCase] of fixture.cases.entries()) {
    const where = `case ${index}${testCase?.id ? ` (${testCase.id})` : ""}`;

    for (const field of REQUIRED) {
      if (typeof testCase?.[field] !== "string" || testCase[field] === "") {
        problems.push(`${where}: missing \`${field}\``);
      }
    }
    if (testCase?.id) {
      if (seen.has(testCase.id)) problems.push(`${where}: duplicate id`);
      seen.add(testCase.id);
    }
    for (const field of ["baseSha", "headSha"]) {
      const value = testCase?.[field];
      if (typeof value === "string" && !SHA.test(value)) {
        problems.push(`${where}: \`${field}\` is not a commit sha`);
      }
    }

    const anchors = testCase?.mustAnchor;
    if (!Array.isArray(anchors) || anchors.length === 0) {
      problems.push(`${where}: \`mustAnchor\` must list at least one target`);
    }
    for (const field of ["mustAnchor", "mustNotAnchor"]) {
      const list = testCase?.[field];
      if (list !== undefined && !Array.isArray(list)) {
        problems.push(`${where}: \`${field}\` must be an array`);
        continue;
      }
      for (const target of list ?? []) {
        if (typeof target !== "string" || target === "") {
          problems.push(`${where}: \`${field}\` holds a non-string target`);
        }
      }
    }

    const repeats = testCase?.repeats;
    if (!Number.isInteger(repeats) || repeats < 1) {
      problems.push(`${where}: \`repeats\` must be a positive integer`);
    }

    // The contamination rule, enforced rather than documented: #166's own thread
    // now spells out all four of its defects with fixes attached, so a probe
    // that can reach the pull request is reading the answer key.
    for (const [field, value] of Object.entries(testCase ?? {})) {
      if (typeof value === "string" && /github\.com\/[^\s]*\/pull\//.test(value)) {
        problems.push(`${where}: \`${field}\` contains a pull-request URL; probes are diff-only`);
      }
    }
  }
  return problems;
}

/**
 * What a fixture will cost to run, from a per-probe estimate.
 *
 * Printed by --dry-run because cost is the reason this tool is dispatch-only. A
 * review probe reads a whole diff over many turns, so it is far dearer than a
 * discovery probe's single turn.
 *
 * @param {{cases: {repeats: number}[]}} fixture
 * @param {number} perProbeUsd
 * @param {number} contracts how many REVIEW.md revisions the run compares
 */
export function estimateCost(fixture, perProbeUsd, contracts = 1) {
  const probes = fixture.cases.reduce((sum, testCase) => sum + testCase.repeats, 0) * contracts;
  return { probes, usd: probes * perProbeUsd };
}
