// the four discovery-eval-*.mjs scripts .github/workflows/discovery-eval.yaml
// reads before it acts.
//
// mirrors effect-eval-dispatch-plan.test.mjs: these execute the derivation
// rather than reading it, so a decision that used to be a shell conditional —
// and the class of bug that follows from one (a loop that parses correctly
// and runs zero times, passing every text-only review) — is exercised instead
// of assumed. See that file's header for the incident that motivated the
// convention on the effect side.
//
// THE SAFETY-PROPERTY-5 TESTS ARE THE ONES THAT MATTER MOST HERE. A dispatch
// naming a pull request must resolve `records: false` no matter which case is
// named — situated or bare makes no difference — and a malformed
// `--pull-request` must refuse outright rather than being silently read as
// "no pull request", which would silently swap a head-mode dispatch for a
// measurement one. Both are asserted below, by running the scripts and
// reading their exit codes and output, not by reading the workflow's prose.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { tempDir } from "../helpers/fixtures.mjs";
import { runScript, SCRIPTS } from "../helpers/run.mjs";

const CASE = "broaden-a-suite-that-only-checks-one-page"; // situated, hosted by tsuzuri
const BARE_CASE = "tighten-a-skill-description-without-losing-routing"; // bare, declares no mock

const admit = (args) => runScript(SCRIPTS.discoveryEvalAdmit, args);
const probePlan = (args) => runScript(SCRIPTS.discoveryEvalProbePlan, args);
const landingPlan = (args) => runScript(SCRIPTS.discoveryEvalLandingPlan, args);
const checkMode = (args) => runScript(SCRIPTS.discoveryEvalCheckMode, args);

/** a minimal scratch fixture, so the cap-refusal path does not depend on the real 59-case fixture. */
async function writeScratchFixture(root, { capUsd, unmeasuredProbeCostCeilingUsd, cases }) {
  await mkdir(root, { recursive: true });
  await writeFile(
    join(root, "fixture.json"),
    JSON.stringify({ capUsd, unmeasuredProbeCostCeilingUsd, cases }, null, 2),
    "utf8",
  );
}

describe("discovery-eval-admit.mjs", () => {
  it("exits 0 on --help and prints usage", () => {
    const result = admit(["--help"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/Usage: discovery-eval-admit\.mjs/);
  });

  it("resolves mode=measurement and records=true with no pull request", () => {
    const result = admit(["--case", CASE, "--dry-run-input", "false"]);
    expect(result.code, result.output).toBe(0);
    const plan = JSON.parse(result.stdout);
    expect(plan.mode).toBe("measurement");
    expect(plan.records).toBe("true");
    // `cases` is JSON-encoded a second time in the output, matching
    // effect-eval-admit.mjs's own `conditions`/`repeats` outputs — the shape
    // `fromJSON()` on a `strategy.matrix` expects.
    expect(JSON.parse(plan.cases)).toEqual([CASE]);
  });

  it("resolves the whole fixture's case ids when --case is omitted", async () => {
    // a scratch fixture, not the real 59-case one: the real fixture's
    // full-run projection legitimately REFUSES against its own cap (see the
    // dedicated cap test below and this workflow's own header on why the
    // first post-merge dispatch is a single case) — this test is about case
    // *resolution*, not admission.
    const root = await tempDir();
    await writeScratchFixture(root, {
      capUsd: 1000,
      unmeasuredProbeCostCeilingUsd: 0.01,
      cases: [
        { id: "case-a", repeats: 2 },
        { id: "case-b", repeats: 2 },
        { id: "case-c", repeats: 2 },
      ],
    });
    const result = admit(["--root", root, "--dry-run-input", "true"]);
    expect(result.code, result.output).toBe(0);
    const plan = JSON.parse(result.stdout);
    expect(JSON.parse(plan.cases)).toEqual(["case-a", "case-b", "case-c"]);
  });

  describe("safety property 5", () => {
    it.each([
      ["a situated case", CASE],
      ["a bare case", BARE_CASE],
    ])("resolves mode=head and records=false for a pull request naming %s", (_label, caseId) => {
      const result = admit(["--case", caseId, "--pull-request", "42", "--dry-run-input", "false"]);
      expect(result.code, result.output).toBe(0);
      const plan = JSON.parse(result.stdout);
      expect(plan.mode).toBe("head");
      expect(plan.records).toBe("false");
    });

    it("refuses a malformed pull request reference rather than treating it as absent", () => {
      const result = admit(["--case", CASE, "--pull-request", "abc", "--dry-run-input", "false"]);
      expect(result.code).toBe(2);
      expect(result.output).toMatch(/--pull-request must be empty or a positive integer/);
    });

    it("refuses a zero or negative pull request reference", () => {
      for (const bad of ["0", "-1"]) {
        const result = admit(["--case", CASE, "--pull-request", bad, "--dry-run-input", "false"]);
        expect(result.code).toBe(2);
      }
    });
  });

  it("refuses a case the fixture does not declare", () => {
    const result = admit(["--case", "no-such-case", "--dry-run-input", "false"]);
    expect(result.code).toBe(2);
    expect(result.output).toMatch(/declares no case "no-such-case"/);
  });

  it.each([
    ["an empty value, which is what an unresolved expression yields", ""],
    ["a differently cased literal", "TRUE"],
  ])("refuses %s for --dry-run-input", (_label, input) => {
    const result = admit(["--case", CASE, "--dry-run-input", input]);
    expect(result.code).toBe(2);
    expect(result.output).toMatch(/must be "true" or "false"/);
  });

  it("admits a dispatch whose projected cost fits a scratch fixture's cap", async () => {
    const root = await tempDir();
    await writeScratchFixture(root, {
      capUsd: 10,
      unmeasuredProbeCostCeilingUsd: 0.35,
      cases: [{ id: "a-case", repeats: 2 }],
    });
    const result = admit(["--root", root, "--case", "a-case", "--dry-run-input", "false"]);
    expect(result.code, result.output).toBe(0);
    const plan = JSON.parse(result.stdout);
    expect(plan["projected-usd"]).toBeCloseTo(0.7, 5);
  });

  it("refuses before the fan-out when the projected total exceeds the fixture's cap", async () => {
    const root = await tempDir();
    await writeScratchFixture(root, {
      capUsd: 1,
      unmeasuredProbeCostCeilingUsd: 0.35,
      cases: [
        { id: "case-a", repeats: 2 },
        { id: "case-b", repeats: 2 },
      ],
    });
    // no --case: both cases are matrixed, projecting 4 * $0.35 = $1.40 against a $1 cap.
    const result = admit(["--root", root, "--dry-run-input", "false"]);
    expect(result.code).toBe(4);
    expect(result.output).toMatch(/REFUSED/);
  });

  it("lets an explicit --repeats override every selected case's declared count", async () => {
    const root = await tempDir();
    await writeScratchFixture(root, {
      capUsd: 100,
      unmeasuredProbeCostCeilingUsd: 1,
      cases: [{ id: "a-case", repeats: 2 }],
    });
    const result = admit(["--root", root, "--case", "a-case", "--repeats", "5", "--dry-run-input", "false"]);
    expect(result.code, result.output).toBe(0);
    const plan = JSON.parse(result.stdout);
    expect(plan["projected-usd"]).toBeCloseTo(5, 5);
  });
});

describe("discovery-eval-probe-plan.mjs", () => {
  it("exits 0 on --help and prints usage", () => {
    const result = probePlan(["--help"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/Usage: discovery-eval-probe-plan\.mjs/);
  });

  it("resolves a measurement plan with a fresh measurement directory", () => {
    const result = probePlan(["--case", CASE, "--dry-run-input", "false"]);
    expect(result.code, result.output).toBe(0);
    const plan = JSON.parse(result.stdout);
    expect(plan.mode).toBe("measurement");
    expect(plan.measurementDir).toMatch(new RegExp(`^${CASE}-[0-9a-f]{8}$`));
    expect(plan.args).toEqual(["--case", CASE]);
    expect(plan.headSkillsNeeded).toBe(false);
  });

  it("two resolutions of the same case get two different measurement directories", () => {
    const a = JSON.parse(probePlan(["--case", CASE, "--dry-run-input", "false"]).stdout);
    const b = JSON.parse(probePlan(["--case", CASE, "--dry-run-input", "false"]).stdout);
    expect(a.measurementDir).not.toBe(b.measurementDir);
  });

  it("carries --repeats and --dry-run into args when given", () => {
    const result = probePlan(["--case", CASE, "--repeats", "3", "--dry-run-input", "true"]);
    const plan = JSON.parse(result.stdout);
    expect(plan.args).toEqual(["--case", CASE, "--repeats", "3", "--dry-run"]);
  });

  describe("safety property 5", () => {
    it.each([
      ["a situated case", CASE],
      ["a bare case", BARE_CASE],
    ])("resolves measurementDir=null and headSkillsNeeded=true for a pull request naming %s", (_label, caseId) => {
      const result = probePlan(["--case", caseId, "--pull-request", "7", "--dry-run-input", "false"]);
      expect(result.code, result.output).toBe(0);
      const plan = JSON.parse(result.stdout);
      expect(plan.mode).toBe("head");
      expect(plan.measurementDir).toBeNull();
      expect(plan.headSkillsNeeded).toBe(true);
    });

    it("never emits --out or --head-skills itself in either mode — the workflow adds those", () => {
      for (const pullRequest of [null, "7"]) {
        const args = pullRequest ? ["--pull-request", pullRequest] : [];
        const result = probePlan(["--case", CASE, "--dry-run-input", "false", ...args]);
        const plan = JSON.parse(result.stdout);
        expect(plan.args).not.toContain("--out");
        expect(plan.args).not.toContain("--head-skills");
      }
    });

    it("refuses a malformed pull request reference rather than treating it as absent", () => {
      const result = probePlan(["--case", CASE, "--pull-request", "not-a-number", "--dry-run-input", "false"]);
      expect(result.code).toBe(2);
      expect(result.output).toMatch(/--pull-request must be empty or a positive integer/);
    });
  });

  it("refuses a case the fixture does not declare", () => {
    const result = probePlan(["--case", "no-such-case", "--dry-run-input", "false"]);
    expect(result.code).toBe(2);
    expect(result.output).toMatch(/declares no case "no-such-case"/);
  });
});

describe("discovery-eval-landing-plan.mjs", () => {
  it("exits 0 on --help and prints usage", () => {
    const result = landingPlan(["--help"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/Usage: discovery-eval-landing-plan\.mjs/);
  });

  const plan = (dryRunInput, cases) => {
    const result = landingPlan([
      "--cases",
      JSON.stringify(cases),
      "--dry-run-input",
      dryRunInput,
      "--run-id",
      "4242",
    ]);
    expect(result.code, result.output).toBe(0);
    return JSON.parse(result.stdout);
  };

  it("names a rehearsal as one, and opens it as a draft", () => {
    const rehearsal = plan("true", [CASE]);
    expect(rehearsal.branch).toBe("discovery-eval/dry-run/4242");
    expect(rehearsal.title).toMatch(/^DRY RUN — do not merge:/);
    expect(rehearsal.prFlags).toEqual(["--draft"]);
    expect(rehearsal.expect).toBe("dry-run");
    expect(rehearsal.bodyPreamble).toMatch(/rehearsal/i);
  });

  it("names a single-case measurement plainly", () => {
    const measurement = plan("false", [CASE]);
    expect(measurement.branch).toBe("discovery-eval/measurement/4242");
    expect(measurement.title).toBe(`data(discovery-eval): record a case measurement of ${CASE}`);
    expect(measurement.prFlags).toEqual([]);
    expect(measurement.expect).toBe("measurement");
    expect(measurement.bodyPreamble).not.toMatch(/rehearsal/i);
  });

  it("names a multi-case measurement by count", () => {
    const measurement = plan("false", [CASE, BARE_CASE, "a-third-case"]);
    expect(measurement.title).toBe("data(discovery-eval): record a case measurement (3 cases)");
    expect(measurement.bodyPreamble).toContain("3 case measurement(s)");
  });

  it("gives the mode check the same mode the branch was named for", () => {
    for (const [input, expected] of [
      ["true", "dry-run"],
      ["false", "measurement"],
    ]) {
      const resolved = plan(input, [CASE]);
      expect(resolved.expect).toBe(expected);
      expect(resolved.branch).toContain(expected);
    }
  });

  it("refuses an empty or malformed --cases", () => {
    for (const bad of ["[]", "not json", "{}"]) {
      const result = landingPlan(["--cases", bad, "--dry-run-input", "true", "--run-id", "1"]);
      expect(result.code).toBe(2);
    }
  });
});

describe("discovery-eval-check-mode.mjs", () => {
  /** a case-measurement directory holding one probe stamped with `kind`. */
  async function writeCaseMeasurement(root, kind) {
    const dir = join(root, "a-case-abcd1234");
    const probe = join(dir, "probe-11112222");
    await mkdir(probe, { recursive: true });
    await writeFile(
      join(probe, "metadata.json"),
      JSON.stringify({ trigger: { kind } }),
      "utf8",
    );
    await writeFile(join(probe, "transcript.jsonl"), "", "utf8");
    return dir;
  }

  it("exits 0 on --help and prints usage", () => {
    const result = checkMode(["--help"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/Usage: discovery-eval-check-mode\.mjs/);
  });

  it("passes when every record's stamp matches a measurement dispatch", async () => {
    const root = await tempDir();
    const dir = await writeCaseMeasurement(root, "github-actions");
    const result = checkMode(["--expect", "measurement", "--dir", dir]);
    expect(result.code, result.output).toBe(0);
  });

  it("passes when every record's stamp matches a dry-run dispatch", async () => {
    const root = await tempDir();
    const dir = await writeCaseMeasurement(root, "dry-run");
    const result = checkMode(["--expect", "dry-run", "--dir", dir]);
    expect(result.code, result.output).toBe(0);
  });

  it("refuses a measurement dispatch whose record is stamped dry-run", async () => {
    // a stamped record on a paid run means a probe wrote a synthetic
    // transcript, so what it reports is fiction.
    const root = await tempDir();
    const dir = await writeCaseMeasurement(root, "dry-run");
    const result = checkMode(["--expect", "measurement", "--dir", dir]);
    expect(result.code).toBe(3);
    expect(result.output).toMatch(/trigger\.kind is "dry-run"/);
  });

  it("refuses a dry-run dispatch whose record is not stamped dry-run", async () => {
    // an unstamped record on a rehearsal means --dry-run never reached the
    // probe, so this rehearsal spawned models and was billed.
    const root = await tempDir();
    const dir = await writeCaseMeasurement(root, "github-actions");
    const result = checkMode(["--expect", "dry-run", "--dir", dir]);
    expect(result.code).toBe(3);
  });

  it("checks every given directory, naming only the one that disagrees", async () => {
    const root = await tempDir();
    const good = await writeCaseMeasurement(join(root, "good"), "github-actions");
    const bad = await writeCaseMeasurement(join(root, "bad"), "dry-run");
    const result = checkMode(["--expect", "measurement", "--dir", good, "--dir", bad]);
    expect(result.code).toBe(3);
    expect(result.output).toContain(bad);
    expect(result.output).not.toMatch(new RegExp(`${good}/probe-\\S+: trigger`));
  });

  it("refuses an empty directory list rather than passing vacuously", () => {
    const result = checkMode(["--expect", "measurement"]);
    expect(result.code).toBe(3);
  });

  it("refuses a directory holding no probe subdirectories", async () => {
    const root = await tempDir();
    await mkdir(join(root, "empty-case"), { recursive: true });
    const result = checkMode(["--expect", "measurement", "--dir", join(root, "empty-case")]);
    expect(result.code).toBe(3);
    expect(result.output).toMatch(/holds no probe directories/);
  });
});
