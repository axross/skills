// the discovery-eval fixture's own identifier discipline, and the promise
// every declared label makes: that it names a skill this repository actually
// installs.
//
// this is a DATA check, not the evaluation. it makes no model call, costs
// nothing, and is deterministic — the same class of check as the
// installed-copy gate, which is why it belongs in `npm test` while the
// evaluation itself deliberately does not (see
// tests/repository/reporting-tools.test.mjs).
//
// the predecessor this file replaces (tests/repository/discovery-eval-data.test.mjs,
// removed with scripts/discovery-eval/ at 534f58e — see git history) named
// two real incidents this same failure mode had already caused:
// react-component-development was added, and loop-engineering's references
// were split and then removed. A fixture label naming a skill that no longer
// exists stops asserting anything, silently — the case still runs, still
// reports, and has quietly stopped testing its boundary. This rebuild keeps
// that one property and drops the snapshot/tally checks that went with it:
// there is no baseline artifact left to declare a case "unmeasured" against
// (see #280's plan, "There is no baseline, because the measurements are the
// baseline").
//
// three disciplines, mirroring tests/repository/effect-eval-data.test.mjs's
// own "the case fixture" describe block for the same reason that file gives:
// a case id and a skill name share one namespace in a reader's head, so a
// case id must read as a task rather than as a thing, and must never collide
// with the capability it might be measuring.

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  canonicalJson,
  caseIdOf,
  MEASUREMENTS_DIR,
  SUMMARY_FILE,
} from "../../tools/evaluation/discovery/src/layout.mjs";
import { deriveCaseSummary, deriveDelta } from "../../tools/evaluation/discovery/src/summary.mjs";
import { repoPath, runScript, SCRIPTS } from "../helpers/run.mjs";

const DATA = repoPath("tools/evaluation/data/discovery");
const MEASUREMENTS = join(DATA, MEASUREMENTS_DIR);

const readFixture = async () =>
  JSON.parse(await readFile(repoPath("tools/evaluation/data/discovery/fixture.json"), "utf8"));

/** every case measurement directory committed under `measurements/`, sorted. */
async function measurementNames() {
  return (await readdir(MEASUREMENTS, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** every installed skill's directory name. */
async function installedSkills() {
  return new Set(
    (await readdir(repoPath(".agents/skills"), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name),
  );
}

/** kebab-case, opening on a bare word — the shape a verb phrase has. */
const VERB_FIRST = /^[a-z]+(?:-[a-z0-9]+)*$/;

/**
 * every verb this fixture's 40 case ids open on today. grows with the
 * fixture: a new case opening on a verb not yet in this set fails loud
 * rather than passing silently, which is the point of enumerating rather
 * than guessing at a part-of-speech test — extend this set when the new verb
 * is genuinely a verb, the same discipline effect-eval-data.test.mjs's own
 * VERB_FIRST list applies for its narrower, task-shaped vocabulary.
 */
const KNOWN_VERBS = new Set([
  "accept",
  "adopt",
  "agree",
  "block",
  "break",
  "broaden",
  "choose",
  "clean",
  "decide",
  "edit",
  "explain",
  "find",
  "get",
  "invalidate",
  "judge",
  "keep",
  "map",
  "open",
  "pin",
  "publish",
  "pull",
  "reconcile",
  "record",
  "render",
  "replace",
  "review",
  "say",
  "stop",
  "tighten",
  "turn",
  "write",
]);

/**
 * every discipline violation this check enforces, over one already-parsed
 * fixture. pure — no filesystem access — so the negative control below can
 * exercise it against a fixture built to fail without writing a real one.
 *
 * @param {{ cases: object[] }} fixture
 * @param {Set<string>} installed every installed skill's directory name
 * @returns {{
 *   notVerbPhrase: string[],
 *   collidesWithSkill: string[],
 *   namesMissingSkill: string[],
 * }}
 */
function violationsIn(fixture, installed) {
  const notVerbPhrase = [];
  const collidesWithSkill = [];
  const namesMissingSkill = [];

  for (const declared of fixture.cases) {
    const opensOnKnownVerb =
      VERB_FIRST.test(declared.id) && KNOWN_VERBS.has(declared.id.split("-")[0]);
    if (!opensOnKnownVerb) notVerbPhrase.push(declared.id);

    if (installed.has(declared.id)) collidesWithSkill.push(declared.id);

    for (const skill of [
      ...(declared.mustInclude ?? []),
      ...(declared.mustExclude ?? []),
      ...(declared.mayInclude ?? []),
    ]) {
      if (!installed.has(skill)) namesMissingSkill.push(`${declared.id}: ${skill}`);
    }
  }

  return { notVerbPhrase, collidesWithSkill, namesMissingSkill };
}

describe("the discovery-eval fixture", () => {
  it("declares at least one case", async () => {
    // guards the walk itself: an empty fixture would make every check below
    // pass vacuously, which is indistinguishable from a check that has
    // stopped reading the fixture at all.
    expect((await readFixture()).cases.length).toBeGreaterThan(0);
  });

  it("gives every case a verb-phrase id, names only installed skills, and collides with none of them", async () => {
    const { notVerbPhrase, collidesWithSkill, namesMissingSkill } = violationsIn(
      await readFixture(),
      await installedSkills(),
    );
    expect(
      notVerbPhrase,
      "a case id must open on a recognised verb, so it reads as a task rather than as a " +
        "thing — extend KNOWN_VERBS above if this is genuinely a new verb",
    ).toEqual([]);
    expect(
      collidesWithSkill,
      "a case id and a skill name share one namespace in a reader's head; a case id equal " +
        "to a skill name is the collision that namespace forbids",
    ).toEqual([]);
    expect(
      namesMissingSkill,
      "mustInclude/mustExclude/mayInclude name a skill that is not installed — a case " +
        "labelled against a skill that no longer exists has quietly stopped testing its " +
        "boundary",
    ).toEqual([]);
  });

  it("pairs every declared case patch with a file under patches/, and every file with a case", async () => {
    // both halves are silent failures of a different kind. a patch a case
    // declares but which is not on disk fails at materialization — after a
    // dispatch has been admitted and paid for, rather than here for nothing.
    // a patch file no case declares is the reverse: dead weight that reads
    // as instrument, which is exactly what levelling the fixture nearly left
    // behind (see
    // docs/decisions/2026-08-10-cover-every-skill-with-at-most-two-discovery-cases.md,
    // "One case patch was deleted with the case that declared it").
    const declared = new Set(
      (await readFixture()).cases.filter((entry) => entry.patch).map((entry) => entry.patch),
    );
    const onDisk = new Set(
      (await readdir(repoPath("tools/evaluation/data/discovery/patches")))
        .filter((name) => name.endsWith(".patch"))
        .map((name) => `patches/${name}`),
    );
    expect(
      [...declared].filter((path) => !onDisk.has(path)).sort(),
      "a case declares a patch that is not under tools/evaluation/data/discovery/patches/ — materialization " +
        "would fail mid-dispatch instead of here",
    ).toEqual([]);
    expect(
      [...onDisk].filter((path) => !declared.has(path)).sort(),
      "a patch file no case declares — dead weight that reads as instrument",
    ).toEqual([]);
  });
});

describe("the derived layer", () => {
  // README.md states that `npm test` re-derives every committed summary under
  // tools/evaluation/data/discovery/ and fails on a mismatch. Until this block existed it
  // did not: the independent review on #318 found the claim standing on
  // nothing, invisible only because measurements/ is still empty. The effect
  // axis has carried the same property since #278 — offline over committed
  // files, and again inside the measurement workflow before anything is
  // committed. One derivation, two callers, now on both axes.

  it("derives the top-level summary from exactly the measurements on disk", async () => {
    // the guard against a walk that has quietly stopped reading. the two
    // checks below iterate measurements/, which is empty today, so each would
    // pass vacuously and go on passing if the directory stopped being found
    // at all. this one is an equality rather than a loop, so it means the
    // same thing at zero measurements as at fifty.
    const names = await measurementNames();
    const root = JSON.parse(await readFile(join(DATA, SUMMARY_FILE), "utf8"));
    expect(root.measurementCount).toBe(names.length);
    expect(root.measurements).toHaveLength(names.length);
  });

  it("has not drifted from the measured files it derives from", async () => {
    // mirrors summarize.mjs's own two passes, because the delta is not a pure
    // function of one measurement: it compares against that case's other
    // measurements, so every summary has to exist before any delta does.
    const declaredRepeats = new Map(
      (await readFixture()).cases.map((entry) => [entry.id, entry.repeats ?? null]),
    );
    const names = await measurementNames();

    const derivations = [];
    for (const name of names) {
      const caseId = caseIdOf(name);
      derivations.push({
        name,
        caseId,
        summary: await deriveCaseSummary(join(MEASUREMENTS, name), {
          declaredRepeats: declaredRepeats.get(caseId) ?? null,
          measurementName: name,
        }),
      });
    }
    for (const entry of derivations) {
      entry.summary.delta = deriveDelta(
        entry.summary,
        derivations
          .filter((other) => other.caseId === entry.caseId && other.name !== entry.name)
          .map((other) => other.summary),
      );
    }

    for (const { name, summary } of derivations) {
      const committed = await readFile(join(MEASUREMENTS, name, SUMMARY_FILE), "utf8");
      expect(
        committed,
        `${name}/${SUMMARY_FILE} is not what its measured files derive — regenerate with ` +
          "`node tools/evaluation/discovery/summarize.mjs` and commit the result",
      ).toBe(canonicalJson(summary));
    }
  });

  it("passes summarize.mjs --check over whatever is committed", () => {
    // the same property through the real entry point, so the command a
    // contributor is told to run is the one exercised. this one also covers
    // the top-level summary.json, which the loop above does not reach.
    const result = runScript(SCRIPTS.discoveryEvalSummarize, ["--check", "--quiet"]);
    expect(result.code, result.output).toBe(0);
  });
});

describe("the fixture check's own teeth", () => {
  // a negative control, exercised against synthetic fixtures rather than the
  // committed one: tools/evaluation/data/discovery/fixture.json's content is settled
  // (#280's non-goals), so the demonstration that this check can fail lives
  // here instead of by editing and reverting the real file.
  const installed = new Set(["real-skill", "open-the-door"]);

  it("catches a case id that is not a verb phrase", () => {
    const violations = violationsIn(
      { cases: [{ id: "widget-configuration", mustInclude: ["real-skill"] }] },
      installed,
    );
    expect(violations.notVerbPhrase).toEqual(["widget-configuration"]);
    expect(violations.collidesWithSkill).toEqual([]);
    expect(violations.namesMissingSkill).toEqual([]);
  });

  it("catches a case id that collides with an installed skill name", () => {
    // "open-the-door" is itself shaped like a verb phrase (opens on the
    // known verb "open"), so this isolates the collision from the
    // verb-phrase check rather than tripping both at once.
    const violations = violationsIn(
      { cases: [{ id: "open-the-door", mustInclude: ["real-skill"] }] },
      installed,
    );
    expect(violations.collidesWithSkill).toEqual(["open-the-door"]);
    expect(violations.notVerbPhrase).toEqual([]);
    expect(violations.namesMissingSkill).toEqual([]);
  });

  it("catches a case naming a skill that is not installed", () => {
    const violations = violationsIn(
      { cases: [{ id: "adopt-a-widget", mustInclude: ["not-a-real-skill"] }] },
      installed,
    );
    expect(violations.namesMissingSkill).toEqual(["adopt-a-widget: not-a-real-skill"]);
    expect(violations.notVerbPhrase).toEqual([]);
    expect(violations.collidesWithSkill).toEqual([]);
  });

  it("passes a case built to satisfy all three at once — the check does not always fail", () => {
    const violations = violationsIn(
      { cases: [{ id: "adopt-a-widget", mustInclude: ["real-skill"], mustExclude: [], mayInclude: [] }] },
      installed,
    );
    expect(violations).toEqual({ notVerbPhrase: [], collidesWithSkill: [], namesMissingSkill: [] });
  });
});
