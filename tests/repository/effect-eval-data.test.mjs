// The committed contents of data/effect-eval, judged against this repository.
//
// Unlike the unit tests beside the instrument, these read the REAL fixture and
// the REAL committed measurements. They are what catches a hand-edited derived
// file and a case identifier that has drifted into colliding with a skill name
// — neither of which any amount of testing against synthetic trees would see.

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { canonicalJson } from "../../tools/effect-eval/src/layout.mjs";
import { deriveCaseSummary } from "../../tools/effect-eval/src/summary.mjs";
import { repoPath, runScript, SCRIPTS } from "../helpers/run.mjs";

const DATA_ROOT = repoPath("data/effect-eval");
const MEASUREMENTS = join(DATA_ROOT, "measurements");

const readFixture = async () => JSON.parse(await readFile(join(DATA_ROOT, "fixture.json"), "utf8"));

/** Directory names under measurements/, or [] when nothing has been measured yet. */
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
    // An evaluation case names a TASK, and a skill names a capability. The two
    // live in the same namespace in a reader's head, so the convention keeps
    // them apart: a case starts with a bare verb, a skill does not.
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
    // Asserted rather than assumed. Every skill name is a noun phrase and every
    // case id a verb phrase, so the two cannot collide — but that is a
    // convention, and a convention nothing checks is one edit from being false.
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

  it("declares a positive cap and estimate for every case", async () => {
    for (const declared of (await readFixture()).cases) {
      expect(declared.capUsd, `${declared.id} has no positive capUsd`).toBeGreaterThan(0);
      expect(
        declared.estimatedCostUsdPerProbe,
        `${declared.id} has no positive estimatedCostUsdPerProbe to seed admission from`,
      ).toBeGreaterThan(0);
      expect(declared.repetitionsPerCondition).toBeGreaterThan(0);
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
});

describe("the derived layer", () => {
  it("has not drifted from the measured files it derives from", async () => {
    // THE DRIFT CHECK. It runs here, offline, over committed files, and again
    // inside the measurement workflow before anything is committed — one
    // derivation, two callers. A hand-edited summary.json fails here.
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
    // The same property through the real entry point, so the command a
    // contributor is told to run is the command that is exercised.
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
  // .github/scripts/effect-eval-admit.mjs is the workflow's property rather
  // than the instrument's — everything in it that is not a library call is
  // shaped by GitHub. It is still tested, because the library call it makes
  // decides whether money is spent.
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
    // Reimplementing `<case>-<id>` in the land job's shell is what this
    // replaced; the name comes from layout.mjs's caseMeasurementName.
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
    // The refusal is a finding, not a prompt to raise the cap.
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
