// Fixture and baseline parsing for the discovery evaluation.
//
// Both files are hand-written JSON that a human is expected to disagree with —
// that is the point of the fixture, since every label in it is a judgment about
// how a prompt SHOULD route. So parsing reports EVERY problem it finds rather
// than throwing on the first: a maintainer fixing a fixture wants the whole list,
// not one error per edit-run cycle.
//
// Validation is deliberately strict about skill names. A label naming a skill
// that no longer exists is the failure mode this repository has already produced
// twice — react-component-development was added, and loop-engineering's
// references were split and then removed. In a fixture that rots silently: the
// case simply stops asserting anything. In a BASELINE it is worse, because every
// subsequent delta is quietly computed against a skill that cannot appear.
// Passing `knownSkills` turns both into a loud failure.

/** The only fixture schema version this parser understands. */
export const FIXTURE_VERSION = 1;

/** The three label tiers a case may carry, in report order. */
export const TIERS = ["mustInclude", "mustExclude", "mayInclude"];

/** Case ids and skill names share one shape: lowercase kebab-case. */
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Raised when a fixture or baseline is malformed. Carries every problem found. */
export class ValidationError extends Error {
  /** @param {string[]} problems */
  constructor(problems) {
    super(problems.join("\n"));
    this.name = "ValidationError";
    this.problems = problems;
  }
}

/** JSON.parse with a message that says which file shape failed. */
function parseJson(text, label, problems) {
  try {
    return JSON.parse(text);
  } catch (error) {
    problems.push(`${label} is not valid JSON: ${error.message}`);
    return null;
  }
}

const isPlainObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Validate a list of skill names, collecting a problem per offender.
 *
 * @param {unknown} value      the raw field
 * @param {string} where       human-readable location, e.g. `case "wf-checkout" mustInclude`
 * @param {Set<string>|null} knownSkills
 * @param {string[]} problems  accumulator
 * @returns {string[]} the names, or `[]` when the field was absent or unusable
 */
function readSkillList(value, where, knownSkills, problems) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    problems.push(`${where} must be an array of skill names.`);
    return [];
  }

  const names = [];
  for (const entry of value) {
    if (typeof entry !== "string" || !ID_RE.test(entry)) {
      problems.push(
        `${where} contains ${JSON.stringify(entry)}, which is not a kebab-case skill name.`,
      );
      continue;
    }
    if (names.includes(entry)) {
      problems.push(`${where} lists "${entry}" twice.`);
      continue;
    }
    if (knownSkills && !knownSkills.has(entry)) {
      problems.push(
        `${where} names "${entry}", which is not a skill in this repository.`,
      );
      continue;
    }
    names.push(entry);
  }
  return names;
}

/** A non-empty string field, or `""` with a problem recorded. */
function readText(value, where, problems) {
  if (typeof value !== "string" || value.trim() === "") {
    problems.push(`${where} must be a non-empty string.`);
    return "";
  }
  return value;
}

/**
 * Parse and validate a fixture document.
 *
 * @param {string} text            raw file contents
 * @param {{ knownSkills?: Iterable<string> }} [options]
 * @returns {{ version: number, expectAlways: string[], cases: object[] }}
 * @throws {ValidationError} carrying every problem found
 */
export function parseFixture(text, { knownSkills } = {}) {
  const problems = [];
  const known = knownSkills ? new Set(knownSkills) : null;
  const raw = parseJson(text, "The fixture", problems);
  if (raw === null) throw new ValidationError(problems);

  if (!isPlainObject(raw)) {
    throw new ValidationError(["The fixture must be a JSON object."]);
  }
  if (raw.version !== FIXTURE_VERSION) {
    problems.push(
      `The fixture's "version" must be ${FIXTURE_VERSION}, not ${JSON.stringify(raw.version)}.`,
    );
  }

  const expectAlways = readSkillList(
    raw.expectAlways,
    'The fixture\'s "expectAlways"',
    known,
    problems,
  );

  if (!Array.isArray(raw.cases) || raw.cases.length === 0) {
    problems.push('The fixture\'s "cases" must be a non-empty array.');
    throw new ValidationError(problems);
  }

  const cases = [];
  const seenIds = new Set();
  for (const [index, entry] of raw.cases.entries()) {
    if (!isPlainObject(entry)) {
      problems.push(`Case at index ${index} must be an object.`);
      continue;
    }

    const id = readText(entry.id, `Case at index ${index} — "id"`, problems);
    if (id && !ID_RE.test(id)) {
      problems.push(`Case "${id}" has an id that is not kebab-case.`);
    }
    if (id && seenIds.has(id)) {
      problems.push(`Case id "${id}" is used more than once.`);
    }
    seenIds.add(id);

    const where = `Case "${id || index}"`;
    const parsed = {
      id,
      prompt: readText(entry.prompt, `${where} — "prompt"`, problems),
      // The rationale is what makes a label reviewable by someone who will not
      // read this code, so it is required rather than optional.
      rationale: readText(entry.rationale, `${where} — "rationale"`, problems),
    };
    for (const tier of TIERS) {
      parsed[tier] = readSkillList(
        entry[tier],
        `${where} — "${tier}"`,
        known,
        problems,
      );
    }

    if (parsed.mustInclude.length === 0 && parsed.mustExclude.length === 0) {
      problems.push(
        `${where} asserts nothing: it needs at least one "mustInclude" or "mustExclude" skill.`,
      );
    }
    for (const name of parsed.mustInclude) {
      if (parsed.mustExclude.includes(name)) {
        problems.push(
          `${where} lists "${name}" as both mustInclude and mustExclude.`,
        );
      }
      if (parsed.mayInclude.includes(name)) {
        problems.push(
          `${where} lists "${name}" as both mustInclude and mayInclude.`,
        );
      }
    }
    for (const name of parsed.mustExclude) {
      if (parsed.mayInclude.includes(name)) {
        problems.push(
          `${where} lists "${name}" as both mustExclude and mayInclude.`,
        );
      }
      if (expectAlways.includes(name)) {
        problems.push(
          `${where} excludes "${name}", which the fixture also lists in "expectAlways".`,
        );
      }
    }

    cases.push(parsed);
  }

  if (problems.length > 0) throw new ValidationError(problems);
  return { version: raw.version, expectAlways, cases };
}

/**
 * Parse and validate a recorded baseline.
 *
 * @param {string} text            raw file contents
 * @param {{ knownSkills?: Iterable<string> }} [options]
 * @returns {{ recordedAt: string, model: string, repeats: number, cases: Record<string, Record<string, number>> }}
 * @throws {ValidationError} carrying every problem found
 */
export function parseBaseline(text, { knownSkills } = {}) {
  const problems = [];
  const known = knownSkills ? new Set(knownSkills) : null;
  const raw = parseJson(text, "The baseline", problems);
  if (raw === null) throw new ValidationError(problems);

  if (!isPlainObject(raw)) {
    throw new ValidationError(["The baseline must be a JSON object."]);
  }

  const recordedAt = readText(raw.recordedAt, 'The baseline\'s "recordedAt"', problems);
  // The model identifier is the field the whole delta hangs on: a baseline
  // recorded on another model makes every comparison meaningless, so it can
  // never be optional.
  const model = readText(raw.model, 'The baseline\'s "model"', problems);

  if (!Number.isInteger(raw.repeats) || raw.repeats < 1) {
    problems.push('The baseline\'s "repeats" must be a positive integer.');
  }

  const cases = {};
  if (!isPlainObject(raw.cases)) {
    problems.push('The baseline\'s "cases" must be an object keyed by case id.');
  } else {
    for (const [id, tallies] of Object.entries(raw.cases)) {
      if (!ID_RE.test(id)) {
        problems.push(`Baseline case id "${id}" is not kebab-case.`);
        continue;
      }
      if (!isPlainObject(tallies)) {
        problems.push(`Baseline case "${id}" must map skill names to hit counts.`);
        continue;
      }
      const entry = {};
      for (const [skill, hits] of Object.entries(tallies)) {
        if (!ID_RE.test(skill)) {
          problems.push(
            `Baseline case "${id}" names "${skill}", which is not a kebab-case skill name.`,
          );
          continue;
        }
        if (known && !known.has(skill)) {
          problems.push(
            `Baseline case "${id}" names "${skill}", which is not a skill in this repository — every delta against it would be computed against a skill that can never appear.`,
          );
          continue;
        }
        if (!Number.isInteger(hits) || hits < 0) {
          problems.push(
            `Baseline case "${id}" gives "${skill}" a hit count that is not a non-negative integer.`,
          );
          continue;
        }
        if (Number.isInteger(raw.repeats) && hits > raw.repeats) {
          problems.push(
            `Baseline case "${id}" gives "${skill}" ${hits} hits out of ${raw.repeats} repeats.`,
          );
          continue;
        }
        entry[skill] = hits;
      }
      cases[id] = entry;
    }
  }

  if (problems.length > 0) throw new ValidationError(problems);
  return { recordedAt, model, repeats: raw.repeats, cases };
}
