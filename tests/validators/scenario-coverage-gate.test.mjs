// Exit-code smoke contract for scenario-coverage-gate.mjs.
//
// Documented contract: 0 when the gate passes, 1 when it fails (an uncovered
// `must` journey, or a structural tag/catalog error), 2 on a bad invocation or
// unreadable/unparseable inputs.
//
// The catalog input is the skill's own `assets/scenarios.example.md`, which is
// exactly what that asset documents itself as — a real catalog the gate parses.
// Only the results side is generated.

import assert from "node:assert/strict";
import { join } from "node:path";
import { describe, it } from "node:test";

import { tempDir, writeFileIn } from "./helpers/fixtures.mjs";
import { SCRIPTS, repoPath, runNodeScript } from "./helpers/run.mjs";

const CATALOG = repoPath(
  "skills/end-to-end-testing/assets/scenarios.example.md",
);

/** Every `must`-priority journey in the example catalog. */
const MUST_JOURNEYS = ["cards.browse", "cards.detail", "checkout.payment.ok"];

const passing = (id) => ({
  title: `covers ${id}`,
  tags: [`@scenario:${id}`],
  status: "passed",
});

/** Run the gate against the example catalog and a generated results file. */
async function runGate(t, results, { catalog = CATALOG } = {}) {
  const root = await tempDir(t);
  const resultsPath = await writeFileIn(
    root,
    "results.json",
    JSON.stringify(results),
  );
  return runNodeScript(SCRIPTS.scenarioCoverageGate, [
    "--catalog",
    catalog,
    "--results",
    resultsPath,
  ]);
}

describe("scenario-coverage-gate.mjs", () => {
  it("exits 0 when every must-priority journey has a passing test", async (t) => {
    const result = await runGate(t, MUST_JOURNEYS.map(passing));

    assert.equal(result.code, 0, result.output);
    assert.match(result.stdout, /GATE PASSED/);
  });

  it("exits 1 when a must-priority journey has no passing test", async (t) => {
    const result = await runGate(t, MUST_JOURNEYS.slice(1).map(passing));

    assert.equal(result.code, 1);
    assert.match(result.stdout, /cards\.browse/);
  });

  it("exits 1 when a failing test is the only one asserting a must journey", async (t) => {
    const result = await runGate(t, [
      ...MUST_JOURNEYS.slice(1).map(passing),
      { ...passing("cards.browse"), status: "failed" },
    ]);

    assert.equal(result.code, 1);
  });

  it("exits 1 on a scenario tag with no catalog row", async (t) => {
    const result = await runGate(t, [
      ...MUST_JOURNEYS.map(passing),
      passing("no.such.journey"),
    ]);

    assert.equal(result.code, 1);
    assert.match(result.stdout, /no\.such\.journey/);
  });

  it("exits 2 when required arguments are missing", () => {
    const result = runNodeScript(SCRIPTS.scenarioCoverageGate, []);

    assert.equal(result.code, 2);
    assert.match(result.stderr, /Usage: scenario-coverage-gate\.mjs/);
  });

  it("exits 2 on an unknown argument", () => {
    const result = runNodeScript(SCRIPTS.scenarioCoverageGate, ["--nope"]);

    assert.equal(result.code, 2);
    assert.match(result.stderr, /Unknown argument: --nope/);
  });

  it("exits 2 when the catalog cannot be read", async (t) => {
    const root = await tempDir(t);
    const result = await runGate(t, MUST_JOURNEYS.map(passing), {
      catalog: join(root, "no-such-catalog.md"),
    });

    assert.equal(result.code, 2);
    assert.match(result.stderr, /Cannot read catalog file/);
  });

  it("exits 2 when the results file is not a JSON array", async (t) => {
    const root = await tempDir(t);
    const resultsPath = await writeFileIn(root, "results.json", '{"not":"an array"}');

    const result = runNodeScript(SCRIPTS.scenarioCoverageGate, [
      "--catalog",
      CATALOG,
      "--results",
      resultsPath,
    ]);

    assert.equal(result.code, 2);
    assert.match(result.stderr, /must be a JSON array/);
  });
});
