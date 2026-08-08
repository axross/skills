// the two plan scripts .github/workflows/effect-eval.yaml reads before it acts.
//
// THESE EXECUTE THE DERIVATION. that is the whole point of the file, and of
// moving the derivation out of the workflow body. what used to sit in YAML was
// a shell loop that read the fixture and built setup.mjs's arguments; it never
// ran its body, so --skill never reached setup.mjs and the skill-present
// condition installed nothing. it cleared an independent review and three
// planted-violation checks, because every assertion available read the
// workflow's TEXT and a loop that runs zero times passes all of them.
//
// so the skill cases below do not inspect a command line. they materialize a
// real workspace through the real setup.mjs and look for the skill on disk.
// `--install` is never passed, which is what keeps this hermetic — see
// tests/effect-eval/setup.test.mjs, which relies on and asserts the same
// property.

import { readdir, readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it, onTestFinished } from "vitest";

import { repoPath, runScript, SCRIPTS } from "../helpers/run.mjs";

const CASE = "add-unit-tests-for-an-untested-module";

const probePlan = (args) => runScript(SCRIPTS.effectEvalProbePlan, args);
const landingPlan = (args) => runScript(SCRIPTS.effectEvalLandingPlan, args);

/** The declared skills of the fixture's case, so the assertions track the fixture. */
async function declaredSkills() {
  const fixture = JSON.parse(await readFile(repoPath("data/effect-eval/fixture.json"), "utf8"));
  return fixture.cases.find((entry) => entry.id === CASE).skills;
}

/**
 * Runs the probe plan, feeds what it emitted to the real setup.mjs the way the
 * workflow does, and returns the workspace it produced.
 */
function materializeFromPlan(condition) {
  const planned = probePlan(["--case", CASE, "--condition", condition, "--dry-run-input", "true"]);
  expect(planned.code, planned.output).toBe(0);
  const plan = JSON.parse(planned.stdout);

  const args = ["--mock", plan.mock];
  for (const skill of plan.skills) args.push("--skill", skill);

  const result = runScript(SCRIPTS.setup, args);
  const workspace = result.stdout.trim();
  if (result.code === 0 && workspace) {
    onTestFinished(() => rm(workspace, { recursive: true, force: true }));
  }
  return { plan, result, workspace };
}

/** Skill directory names installed into a workspace, or [] when none is. */
async function installedSkills(workspace) {
  try {
    const entries = await readdir(join(workspace, ".claude", "skills"), { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

describe("the probe plan", () => {
  it("exits 0 on --help and prints usage", () => {
    const result = probePlan(["--help"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/Usage: effect-eval-probe-plan\.mjs/);
  });

  it("installs every skill the case declares under skill-present", async () => {
    // the case this file exists for. asserted against the workspace rather than
    // the plan, so it fails whether the plan is wrong or the plumbing is.
    const { result, workspace } = materializeFromPlan("skill-present");
    expect(result.code, result.output).toBe(0);
    expect(await installedSkills(workspace)).toEqual([...(await declaredSkills())].sort());
  });

  it("materializes a real skill directory, not an empty one", async () => {
    // "the directory exists" would still pass if nothing were copied into it.
    const { workspace } = materializeFromPlan("skill-present");
    for (const skill of await declaredSkills()) {
      const entry = join(workspace, ".claude", "skills", skill, "SKILL.md");
      expect((await stat(entry)).size, `${skill}/SKILL.md is empty`).toBeGreaterThan(0);
    }
  });

  it("installs nothing under skill-absent", async () => {
    const { plan, workspace } = materializeFromPlan("skill-absent");
    expect(plan.skills).toEqual([]);
    expect(await installedSkills(workspace)).toEqual([]);
  });

  it("resolves a case's patch against the fixture that declares it", async () => {
    // the declared path is relative to the fixture, and the workflow has no
    // idea where that is — so the resolution belongs here, and is asserted
    // here. no case declares a patch today, which is the second half of what
    // this checks: the field is present and empty rather than absent, so the
    // workflow's `jq -er` has something to read either way.
    const fixture = JSON.parse(await readFile(repoPath("data/effect-eval/fixture.json"), "utf8"));
    const declared = fixture.cases.find((entry) => entry.id === CASE);

    for (const condition of ["skill-absent", "skill-present"]) {
      const plan = JSON.parse(
        probePlan(["--case", CASE, "--condition", condition, "--dry-run-input", "true"]).stdout,
      );
      expect(plan).toHaveProperty("patch");
      expect(
        plan.patch,
        "a patch is per case, so both conditions of one case get the same one",
      ).toBe(declared.patch ? repoPath("data/effect-eval", declared.patch) : "");
    }
  });

  it("passes --dry-run only when the dispatch is a rehearsal", () => {
    const flags = (input) =>
      JSON.parse(
        probePlan(["--case", CASE, "--condition", "skill-absent", "--dry-run-input", input]).stdout,
      ).evaluateFlags;
    expect(flags("true")).toEqual(["--dry-run"]);
    expect(flags("false")).toEqual([]);
  });

  it("refuses an unknown condition rather than treating it as skill-absent", () => {
    const result = probePlan([
      "--case",
      CASE,
      "--condition",
      "skill-maybe",
      "--dry-run-input",
      "true",
    ]);
    expect(result.code).toBe(2);
    expect(result.output).toMatch(/Unknown condition "skill-maybe"/);
  });

  it("refuses an unknown case", () => {
    const result = probePlan([
      "--case",
      "no-such-case",
      "--condition",
      "skill-present",
      "--dry-run-input",
      "true",
    ]);
    expect(result.code).toBe(2);
    expect(result.output).toMatch(/declares no case "no-such-case"/);
  });
});

describe("the landing plan", () => {
  it("exits 0 on --help and prints usage", () => {
    const result = landingPlan(["--help"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/Usage: effect-eval-landing-plan\.mjs/);
  });

  const plan = (input) => {
    const result = landingPlan(["--case", CASE, "--dry-run-input", input, "--run-id", "4242"]);
    expect(result.code, result.output).toBe(0);
    return JSON.parse(result.stdout);
  };

  it("names a rehearsal as one, and opens it as a draft", () => {
    const rehearsal = plan("true");
    expect(rehearsal.branch).toBe("effect-eval/dry-run/4242");
    expect(rehearsal.title).toMatch(/^DRY RUN — do not merge:/);
    expect(rehearsal.prFlags).toEqual(["--draft"]);
    expect(rehearsal.expect).toBe("dry-run");
    expect(rehearsal.bodyPreamble).toMatch(/Close it; do not merge it/);
  });

  it("names a measurement as one, and does not draft it", () => {
    // the half no rehearsal reaches: a dry run executes only the branch above,
    // so without this the measurement path first runs when money is spent.
    const measurement = plan("false");
    expect(measurement.branch).toBe("effect-eval/measurement/4242");
    expect(measurement.title).toBe(`data(effect-eval): record a case measurement of ${CASE}`);
    expect(measurement.prFlags).toEqual([]);
    expect(measurement.expect).toBe("measurement");
    expect(measurement.bodyPreamble).not.toMatch(/rehearsal/i);
  });

  it("gives the mode check the same mode the branch was named for", () => {
    // one resolution, not two. the check's argument used to come from a second
    // reading of the dispatch's input, which could disagree with this one.
    for (const [input, expected] of [
      ["true", "dry-run"],
      ["false", "measurement"],
    ]) {
      const resolved = plan(input);
      expect(resolved.expect).toBe(expected);
      expect(resolved.branch).toContain(expected);
    }
  });

  it("refuses an unknown case rather than landing an untraceable branch", () => {
    const result = landingPlan([
      "--case",
      "no-such-case",
      "--dry-run-input",
      "true",
      "--run-id",
      "1",
    ]);
    expect(result.code).toBe(2);
    expect(result.output).toMatch(/declares no case "no-such-case"/);
  });
});

describe("the dry-run input", () => {
  // an inputs.<name> that does not resolve interpolates the EMPTY STRING rather
  // than erroring, and every looser reading of that selects the paid path. both
  // scripts take the two literals and nothing else, so an unresolved input is
  // an exit code before a probe spawns rather than a bill.
  it.each([
    ["an empty value, which is what an unresolved expression yields", ""],
    ["a differently cased literal", "TRUE"],
    ["a plausible synonym", "yes"],
    ["a numeric truth", "1"],
  ])("refuses %s", (_label, input) => {
    const probe = probePlan(["--case", CASE, "--condition", "skill-absent", "--dry-run-input", input]);
    expect(probe.code).toBe(2);
    expect(probe.output).toMatch(/must be "true" or "false"/);

    const landing = landingPlan(["--case", CASE, "--dry-run-input", input, "--run-id", "1"]);
    expect(landing.code).toBe(2);
    expect(landing.output).toMatch(/must be "true" or "false"/);
  });
});
