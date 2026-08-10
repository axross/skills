// the committed contents of data/effect-eval, judged against this repository.
//
// these read the real fixture and the real committed measurements, which is
// what catches a hand-edited derived file and a case identifier that has
// drifted into colliding with a skill name. no amount of testing against
// synthetic trees would see either.

import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { READING_KINDS } from "../../tools/effect-eval/src/artifact.mjs";
import { canonicalJson } from "../../tools/effect-eval/src/layout.mjs";
import { deriveCaseSummary } from "../../tools/effect-eval/src/summary.mjs";
import { repoPath, runScript, SCRIPTS } from "../helpers/run.mjs";

const DATA_ROOT = repoPath("data/effect-eval");
const MEASUREMENTS = join(DATA_ROOT, "measurements");
const COVERAGE_PATH = join(DATA_ROOT, "coverage.md");

/** the three group headings coverage.md carries, verbatim — the spec's own names. */
const COVERAGE_GROUPS = [
  "Skills whose surface is not the working tree",
  "Skills whose effect is a judgement rather than an artifact",
  "Skills that need a stack the mock does not have",
];

const readFixture = async () => JSON.parse(await readFile(join(DATA_ROOT, "fixture.json"), "utf8"));

/**
 * parses coverage.md for the skills listed under its three fixed group
 * headings. a line shaped `- \`skill-name\` — reason` under a "## <group>"
 * heading names that skill as out of range for that group; anything outside
 * the three known headings (this file's own opening prose, its "## " group
 * headings themselves) contributes nothing.
 *
 * @returns {Promise<Map<string, string>>} skill name → the group heading it sits under
 */
async function parseCoverage() {
  const text = await readFile(COVERAGE_PATH, "utf8");
  const bySkill = new Map();
  let currentGroup = null;
  for (const line of text.split("\n")) {
    const heading = line.match(/^## (.+)$/);
    if (heading) {
      currentGroup = COVERAGE_GROUPS.includes(heading[1]) ? heading[1] : null;
      continue;
    }
    if (!currentGroup) continue;
    const bullet = line.match(/^- `([a-z0-9-]+)`/);
    if (bullet) bySkill.set(bullet[1], currentGroup);
  }
  return bySkill;
}

/** directory names under measurements/, or [] when nothing has been measured yet. */
async function measurementNames() {
  try {
    const entries = await readdir(MEASUREMENTS, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

describe("the case fixture", () => {
  it("declares at least one case", async () => {
    expect((await readFixture()).cases.length).toBeGreaterThan(0);
  });

  it("gives every case a verb-phrase identifier", async () => {
    // a case names a task and a skill names a capability. the two live in one
    // namespace in a reader's head, so the convention keeps them apart: a case
    // starts with a bare verb, a skill does not.
    const VERB_FIRST = /^[a-z]+(?:-[a-z0-9]+)*$/;
    for (const declared of (await readFixture()).cases) {
      expect(declared.id, `${declared.id} is not a kebab-case identifier`).toMatch(VERB_FIRST);
      expect(
        declared.id.split("-")[0],
        `${declared.id} does not open with a verb, so it reads as a thing rather than a task`,
      ).toMatch(/^(add|write|fix|refactor|migrate|remove|rename|extract|document|update)$/);
    }
  });

  it("collides with no installed skill name", async () => {
    // asserted rather than assumed: a convention nothing checks is one edit
    // from being false.
    const installed = new Set(
      (await readdir(repoPath(".agents/skills"), { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name),
    );
    for (const declared of (await readFixture()).cases) {
      expect(installed.has(declared.id), `case ${declared.id} collides with a skill name`).toBe(
        false,
      );
    }
  });

  it("declares a positive cap and pre-measurement ceiling for every case", async () => {
    for (const declared of (await readFixture()).cases) {
      expect(declared.capUsd, `${declared.id} has no positive capUsd`).toBeGreaterThan(0);
      expect(
        declared.unmeasuredProbeCostCeilingUsd,
        `${declared.id} has no positive unmeasuredProbeCostCeilingUsd for admission to ` +
          "project from before the case has been measured",
      ).toBeGreaterThan(0);
      expect(declared.repetitionsPerCondition).toBeGreaterThan(0);
    }
  });

  it("no longer declares the key that field was renamed from", async () => {
    // a half-applied rename is the failure worth catching: admitCase would
    // read `undefined` for the ceiling, and on a case with no committed
    // measurement that is the path where money is gated. it throws rather than
    // admitting, so the dispatch is loud — but it is loud at the fixture's
    // expense rather than the renamer's, and this says which.
    for (const declared of (await readFixture()).cases) {
      expect(
        declared,
        `${declared.id} still declares estimatedCostUsdPerProbe; the rename is half applied`,
      ).not.toHaveProperty("estimatedCostUsdPerProbe");
    }
  });

  it("names a mock that exists and skills that are installed", async () => {
    const mocks = new Set(
      (await readdir(repoPath("mocks"), { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name),
    );
    const installed = new Set(
      (await readdir(repoPath(".agents/skills"), { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name),
    );
    for (const declared of (await readFixture()).cases) {
      expect(mocks.has(declared.mock), `${declared.id} names a missing mock`).toBe(true);
      for (const skill of declared.skills) {
        expect(installed.has(skill), `${declared.id} names an uninstalled skill ${skill}`).toBe(
          true,
        );
      }
    }
  });

  it("pairs every declared case patch with a file under patches/, and every file with a case", async () => {
    // both halves are silent failures of a different kind, and this axis has
    // patch files for the first time with this fixture. a patch a case
    // declares but which is not on disk fails at materialization — after a
    // dispatch has been admitted and paid for, rather than here for nothing.
    // a patch file no case declares is the reverse: dead weight that reads as
    // instrument, which is what the discovery side nearly left behind when a
    // case was trimmed and its patch was not. declared-patches.test.mjs walks
    // the declared half only, so nothing else here would see an orphan.
    const declared = new Set(
      (await readFixture()).cases.filter((entry) => entry.patch).map((entry) => entry.patch),
    );
    let onDisk;
    try {
      onDisk = new Set(
        (await readdir(join(DATA_ROOT, "patches")))
          .filter((name) => name.endsWith(".patch"))
          .map((name) => `patches/${name}`),
      );
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      onDisk = new Set();
    }

    expect(
      [...declared].filter((path) => !onDisk.has(path)).sort(),
      "a case declares a patch that is not under data/effect-eval/patches/ — materialization " +
        "would fail mid-dispatch instead of here",
    ).toEqual([]);
    expect(
      [...onDisk].filter((path) => !declared.has(path)).sort(),
      "a patch file no case declares — dead weight that reads as instrument",
    ).toEqual([]);
  });
});

describe("the coverage policy", () => {
  it("gives every case a non-empty prediction", async () => {
    // the prediction is prose no other check reads — this is the one
    // assertion standing between "every case carries one" and a case that
    // silently does not, which the rest of the fixture's structure would
    // never catch.
    for (const declared of (await readFixture()).cases) {
      expect(
        typeof declared.prediction === "string" && declared.prediction.trim().length > 0,
        `${declared.id} has no non-empty prediction`,
      ).toBe(true);
    }
  });

  it("marks exactly one case as the negative control", async () => {
    // two controls would mean the fixture no longer has one measurement of
    // its own noise floor but two, silently averaged together by anyone who
    // reads negativeControl as a single flag; zero would mean the axis has
    // no measured floor at all and nothing would say so.
    const controls = (await readFixture()).cases.filter((entry) => entry.negativeControl === true);
    expect(
      controls.map((entry) => entry.id),
      "expected exactly one case with negativeControl: true",
    ).toHaveLength(1);
  });

  it("draws the control's skill from the not-the-working-tree group, not from any other", async () => {
    // the plan settles this deliberately: a control drawn from the
    // judgement-rather-than-artifact group would assume the very answer an
    // LLM judge exists to decide, and one from the contingent stack group
    // could stop being a control the day somebody adds a matching mock.
    const [control] = (await readFixture()).cases.filter((entry) => entry.negativeControl === true);
    expect(control, "no case declares negativeControl: true").toBeDefined();
    expect(control.skills).toEqual(["github-operation"]);

    const coverage = await parseCoverage();
    expect(coverage.get("github-operation")).toBe(COVERAGE_GROUPS[0]);
  });

  it("holds every installed skill to being named by a case or listed in coverage.md, and nothing else", async () => {
    // the property coverage.md's own README section states: the in-range half
    // is installed-minus-out-of-range, computed rather than restated, so
    // there is one list to keep true rather than two that could drift apart.
    // this is the check that makes that true — in both directions, since a
    // coverage.md entry naming an uninstalled (renamed or removed) skill
    // would silently under-count the in-range half the same way a case
    // naming one would.
    const installed = new Set(
      (await readdir(repoPath(".agents/skills"), { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name),
    );
    const namedByACase = new Set((await readFixture()).cases.flatMap((entry) => entry.skills));
    const coverage = await parseCoverage();

    const unaccountedFor = [...installed].filter(
      (skill) => !namedByACase.has(skill) && !coverage.has(skill),
    );
    expect(
      unaccountedFor,
      "installed but named by no case and listed in no coverage.md group",
    ).toEqual([]);

    const coverageNamesAnUninstalledSkill = [...coverage.keys()].filter(
      (skill) => !installed.has(skill),
    );
    expect(
      coverageNamesAnUninstalledSkill,
      "coverage.md lists a skill that is not installed",
    ).toEqual([]);
  });

  it("names a reading.kind the extractor knows, for every case that declares one", async () => {
    // extractArtifact's own READING_KINDS is the one list of kinds it can
    // serve; a fixture case naming any other value would fail only once
    // something tried to wire the reading in, which is exactly the silent
    // failure this catches before that day.
    for (const declared of (await readFixture()).cases) {
      if (!declared.reading) continue;
      expect(
        READING_KINDS.includes(declared.reading.kind),
        `${declared.id} declares reading.kind ${JSON.stringify(declared.reading.kind)}, which extractArtifact does not know (knows: ${READING_KINDS.join(", ")})`,
      ).toBe(true);
    }
  });
});

describe("the derived layer", () => {
  it("has not drifted from the measured files it derives from", async () => {
    // the drift check: offline, over committed files, and again inside the
    // measurement workflow before anything is committed. one derivation, two
    // callers.
    const names = await measurementNames();
    const repetitions = new Map(
      (await readFixture()).cases.map((entry) => [entry.id, entry.repetitionsPerCondition ?? null]),
    );

    for (const name of names) {
      const caseId = name.replace(/-[0-9a-f]{8}$/, "");
      const derived = canonicalJson(
        await deriveCaseSummary(join(MEASUREMENTS, name), {
          declaredRepetitions: repetitions.get(caseId) ?? null,
        }),
      );
      const committed = await readFile(join(MEASUREMENTS, name, "summary.json"), "utf8");
      expect(
        committed,
        `${name}/summary.json is not what its measured files derive — regenerate with ` +
          "`node tools/effect-eval/summarize.mjs` and commit the result",
      ).toBe(derived);
    }
  });

  it("passes summarize.mjs --check over whatever is committed", async () => {
    // the same property through the real entry point, so the command a
    // contributor is told to run is the one exercised.
    const result = runScript(SCRIPTS.summarize, ["--check", "--quiet"]);
    expect(result.code, result.output).toBe(0);
  });
});

describe("the instrument's entry points", () => {
  it.each([
    ["setup", SCRIPTS.setup],
    ["evaluate", SCRIPTS.evaluate],
    ["summarize", SCRIPTS.summarize],
  ])("%s.mjs exits 0 on --help and prints usage", (name, script) => {
    const result = runScript(script, ["--help"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(new RegExp(`Usage: ${name}\\.mjs`));
  });
});

describe("the dispatch's admit step", () => {
  // the workflow's property rather than the instrument's, and still tested,
  // because the library call it makes decides whether money is spent.
  const admit = (args) => runScript(SCRIPTS.effectEvalAdmit, args);

  it("admits the declared case and emits the matrix's two dimensions", async () => {
    const [declared] = (await readFixture()).cases;
    const result = admit(["--case", declared.id]);
    expect(result.code, result.output).toBe(0);

    const outputs = JSON.parse(result.stdout);
    expect(JSON.parse(outputs.conditions)).toEqual(["skill-absent", "skill-present"]);
    // GitHub cross-products the two dimensions, so the repeats array alone
    // carries the per-condition count the fixture declares.
    expect(JSON.parse(outputs.repeats)).toHaveLength(declared.repetitionsPerCondition);
  });

  it("names the measurement directory with the instrument's own shape", async () => {
    // this replaced a shell reimplementation of `<case>-<id>` in the land job.
    const [declared] = (await readFixture()).cases;
    const outputs = JSON.parse(admit(["--case", declared.id]).stdout);
    expect(outputs["measurement-dir"]).toMatch(
      new RegExp(`^${declared.id}-[0-9a-f]{8}$`),
    );
  });

  it("refuses, with exit 4, when a lowered cap cannot cover the projection", async () => {
    const [declared] = (await readFixture()).cases;
    const result = admit(["--case", declared.id, "--cap-usd", "1"]);
    expect(result.code).toBe(4);
    expect(result.output).toMatch(/REFUSED/);
    // a finding, not a prompt to raise the cap.
    expect(result.output).toMatch(/not a threshold to adjust/);
  });

  it("ignores a dispatch trying to raise the declared cap", async () => {
    const [declared] = (await readFixture()).cases;
    const result = admit(["--case", declared.id, "--cap-usd", String(declared.capUsd * 100)]);
    expect(result.code).toBe(0);
    expect(result.output).toMatch(/may lower the declared cap and may not raise it/);
    expect(JSON.parse(result.stdout)["cap-usd"]).toBe(declared.capUsd);
  });

  it("refuses an unknown case rather than admitting nothing", async () => {
    const result = admit(["--case", "no-such-case"]);
    expect(result.code).toBe(2);
    expect(result.output).toMatch(/declares no case "no-such-case"/);
  });
});

describe("the dispatch's mode check", () => {
  // it compares the dispatch's mode against each record's stamp. the two
  // directions guard different accidents, so both are exercised here.
  const checkMode = (args) => runScript(SCRIPTS.effectEvalCheckMode, args);

  let dir;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "mode-check-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const writeProbe = async (name, kind) => {
    await mkdir(join(dir, name), { recursive: true });
    await writeFile(
      join(dir, name, "metadata.json"),
      JSON.stringify({ trigger: { kind, url: null } }, null, 2),
      "utf8",
    );
  };

  it("passes a rehearsal whose records are all stamped", async () => {
    await writeProbe("skill-absent-aaaaaaaa", "dry-run");
    await writeProbe("skill-present-bbbbbbbb", "dry-run");
    expect(checkMode(["--dir", dir, "--expect", "dry-run"]).code).toBe(0);
  });

  it("passes a measurement whose records are not stamped", async () => {
    await writeProbe("skill-absent-aaaaaaaa", "github-actions");
    await writeProbe("skill-present-bbbbbbbb", "github-actions");
    expect(checkMode(["--dir", dir, "--expect", "measurement"]).code).toBe(0);
  });

  it("refuses a rehearsal whose records are not stamped", async () => {
    // the flag never reached the probe, so a rehearsal spawned models and was
    // billed. this is the expensive direction.
    await writeProbe("skill-absent-aaaaaaaa", "dry-run");
    await writeProbe("skill-present-bbbbbbbb", "github-actions");
    const result = checkMode(["--dir", dir, "--expect", "dry-run"]);
    expect(result.code).toBe(3);
    expect(result.output).toMatch(/skill-present-bbbbbbbb/);
    expect(result.output).toMatch(/spawned models and was billed/);
  });

  it("refuses a measurement carrying a stamped record", async () => {
    // a probe wrote a synthetic transcript, so what the measurement reports is
    // fiction.
    await writeProbe("skill-absent-aaaaaaaa", "github-actions");
    await writeProbe("skill-present-bbbbbbbb", "dry-run");
    const result = checkMode(["--dir", dir, "--expect", "measurement"]);
    expect(result.code).toBe(3);
    expect(result.output).toMatch(/skill-present-bbbbbbbb/);
    expect(result.output).toMatch(/fiction/);
  });

  it("refuses an empty directory rather than passing vacuously", async () => {
    // every probe failing would otherwise reach the commit and be caught only
    // by the repetition count, afterwards.
    const result = checkMode(["--dir", dir, "--expect", "dry-run"]);
    expect(result.code).toBe(3);
    expect(result.output).toMatch(/no probe directories/);
  });

  it("rejects a mode it does not know", async () => {
    expect(checkMode(["--dir", dir, "--expect", "sort-of"]).code).toBe(2);
  });
});

describe("what is committed to the repository", () => {
  it("carries no dry-run record", async () => {
    // a rehearsal's pull request looks like a measurement's and lands in the one
    // place merge-checks deliberately does not look. the draft status and the
    // loud title are what stop it; this is what notices if they did not.
    //
    // it reads the files Git tracks rather than the working tree, which is both
    // what "committed" means and what keeps it from firing during a rehearsal's
    // own `npm run check` — at that point the tree is written and nothing is
    // committed yet.
    const tracked = execFileSync(
      "git",
      ["ls-files", "-z", "--", "data/*/measurements/*/*/metadata.json"],
      { cwd: repoPath("."), encoding: "utf8" },
    )
      .split("\0")
      .filter(Boolean);

    for (const path of tracked) {
      const metadata = JSON.parse(await readFile(repoPath(path), "utf8"));
      expect(
        metadata?.trigger?.kind,
        `${path} is a dry-run record and must not be committed — a rehearsal's pull ` +
          "request is closed, never merged",
      ).not.toBe("dry-run");
    }
  });
});
