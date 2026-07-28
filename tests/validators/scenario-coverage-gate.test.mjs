// Exit-code smoke contract for scenario-coverage-gate.mjs.
//
// Documented contract: 0 when the gate passes, 1 when it fails (an uncovered
// `must` journey, or a structural tag/catalog error), 2 on a bad invocation or
// unreadable/unparseable inputs.
//
// The catalog input is the skill's own `assets/scenarios.example.md`, which is
// exactly what that asset documents itself as — a real catalog the gate parses.
// Only the results side is generated.

import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { tempDir, writeFileIn } from "../helpers/fixtures.mjs";
import { SCRIPTS, repoPath, validator } from "../helpers/run.mjs";

const scenarioCoverageGate = validator(SCRIPTS.scenarioCoverageGate);

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
async function runGate(results, { catalog = CATALOG } = {}) {
  const root = await tempDir();
  const resultsPath = await writeFileIn(
    root,
    "results.json",
    JSON.stringify(results),
  );
  return scenarioCoverageGate("--catalog", catalog, "--results", resultsPath);
}

describe("scenario-coverage-gate.mjs", () => {
  it("exits 0 when every must-priority journey has a passing test", async () => {
    const result = await runGate(MUST_JOURNEYS.map(passing));

    expect(result).toPassCleanly();
    expect(result.stdout).toMatch(/GATE PASSED/);
  });

  it("exits 1 when a must-priority journey has no passing test", async () => {
    const result = await runGate(MUST_JOURNEYS.slice(1).map(passing));

    expect(result).toReportFailure(/cards\.browse/);
  });

  it("exits 1 when a failing test is the only one asserting a must journey", async () => {
    const result = await runGate([
      ...MUST_JOURNEYS.slice(1).map(passing),
      { ...passing("cards.browse"), status: "failed" },
    ]);

    expect(result).toExitWith(1);
  });

  it("exits 1 on a scenario tag with no catalog row", async () => {
    const result = await runGate([
      ...MUST_JOURNEYS.map(passing),
      passing("no.such.journey"),
    ]);

    expect(result).toReportFailure(/no\.such\.journey/);
  });

  it("exits 2 when required arguments are missing", () => {
    const result = scenarioCoverageGate();

    expect(result).toExitWith(2);
    expect(result.stderr).toMatch(/Usage: scenario-coverage-gate\.mjs/);
  });

  it("exits 2 on an unknown argument", () => {
    const result = scenarioCoverageGate("--nope");

    expect(result).toExitWith(2);
    expect(result.stderr).toMatch(/Unknown argument: --nope/);
  });

  it("exits 2 when the catalog cannot be read", async () => {
    const root = await tempDir();
    const result = await runGate(MUST_JOURNEYS.map(passing), {
      catalog: join(root, "no-such-catalog.md"),
    });

    expect(result).toExitWith(2);
    expect(result.stderr).toMatch(/Cannot read catalog file/);
  });

  it("exits 2 when the results file is not a JSON array", async () => {
    const root = await tempDir();
    const resultsPath = await writeFileIn(
      root,
      "results.json",
      '{"not":"an array"}',
    );

    const result = scenarioCoverageGate(
      "--catalog",
      CATALOG,
      "--results",
      resultsPath,
    );

    expect(result).toExitWith(2);
    expect(result.stderr).toMatch(/must be a JSON array/);
  });

  it("prints usage on --help", () => {
    const result = scenarioCoverageGate("--help");

    expect(result).toPassCleanly();
    expect(result.stdout).toMatch(/^Usage: scenario-coverage-gate\.mjs/);
  });
});
