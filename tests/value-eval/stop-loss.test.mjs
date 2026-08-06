// Offline tests for scripts/value-eval/stop-loss.mjs, entirely over
// synthetic costs — the acceptance bar issue #235 sets for this mechanism:
// "proven by tests over synthetic costs." No CLI is spawned anywhere here.

import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { tempDir } from "../helpers/fixtures.mjs";

import {
  appendLedgerCost,
  averageCostPerRun,
  DEFAULT_BUDGET_USD,
  evaluateStopLoss,
  projectTotalCost,
  readLedger,
} from "../../scripts/value-eval/stop-loss.mjs";

describe("averageCostPerRun", () => {
  it("returns 0 for no runs", () => {
    expect(averageCostPerRun([])).toBe(0);
  });

  it("returns the mean of the reported costs", () => {
    expect(averageCostPerRun([6, 7, 5])).toBe(6);
  });
});

describe("projectTotalCost", () => {
  it("adds the average of what has run to what remains", () => {
    // spent 18 over 3 runs (avg 6), 3 more runs projected at that average -> 36
    expect(projectTotalCost({ costsSoFar: [6, 7, 5], remainingRuns: 3 })).toBe(36);
  });

  it("projects only the already-spent total when nothing remains", () => {
    expect(projectTotalCost({ costsSoFar: [6, 7, 5], remainingRuns: 0 })).toBe(18);
  });
});

describe("evaluateStopLoss", () => {
  it("always permits the first run — there is nothing yet to project from", () => {
    const evaluation = evaluateStopLoss({ costsSoFar: [], remainingRuns: 5, capUsd: 1 });

    expect(evaluation.permitted).toBe(true);
    expect(evaluation.projectedTotal).toBe(0);
    expect(evaluation.reason).toMatch(/first run always proceeds/);
  });

  it("permits the next run when the projected total stays within the cap", () => {
    // avg 6, spent 18, 3 remaining -> projected 36, cap 40
    const evaluation = evaluateStopLoss({
      costsSoFar: [6, 7, 5],
      remainingRuns: 3,
      capUsd: 40,
    });

    expect(evaluation.permitted).toBe(true);
    expect(evaluation.projectedTotal).toBe(36);
    expect(evaluation.reason).toMatch(/within the \$40\.00 cap/);
  });

  it("refuses the next run when the projected total exceeds the cap", () => {
    // avg 10, spent 30, 2 remaining -> projected 50, cap 40
    const evaluation = evaluateStopLoss({
      costsSoFar: [10, 10, 10],
      remainingRuns: 2,
      capUsd: 40,
    });

    expect(evaluation.permitted).toBe(false);
    expect(evaluation.projectedTotal).toBe(50);
    expect(evaluation.reason).toMatch(/exceeds the \$40\.00 cap/);
  });

  it("permits a projection exactly at the cap — only exceeding it refuses", () => {
    // avg 10, spent 30, 1 remaining -> projected exactly 40
    const evaluation = evaluateStopLoss({
      costsSoFar: [10, 10, 10],
      remainingRuns: 1,
      capUsd: 40,
    });

    expect(evaluation.projectedTotal).toBe(40);
    expect(evaluation.permitted).toBe(true);
  });

  it("defaults the cap to $40, issue #235's non-functional requirement", () => {
    expect(DEFAULT_BUDGET_USD).toBe(40);

    const evaluation = evaluateStopLoss({ costsSoFar: [15, 15], remainingRuns: 1 });

    // avg 15, spent 30, 1 remaining -> projected 45, exceeds the default cap
    expect(evaluation.projectedTotal).toBe(45);
    expect(evaluation.permitted).toBe(false);
  });
});

describe("ledger", () => {
  it("reads an empty ledger when no file exists yet", async () => {
    const dir = await tempDir();
    expect(await readLedger(join(dir, "missing.json"))).toEqual([]);
  });

  it("appends a cost and persists it for the next read", async () => {
    const dir = await tempDir();
    const path = join(dir, "ledger.json");

    await appendLedgerCost(path, 3.5);
    const afterFirst = await appendLedgerCost(path, 4.25);

    expect(afterFirst).toEqual([3.5, 4.25]);
    expect(await readLedger(path)).toEqual([3.5, 4.25]);
  });

  it("rejects a ledger file that is not a JSON array of numbers", async () => {
    const dir = await tempDir();
    const path = join(dir, "bad.json");
    await writeFile(path, JSON.stringify({ not: "an array" }), "utf8");

    await expect(readLedger(path)).rejects.toThrow(/not a JSON array of numbers/);
  });

  it("feeds a real ledger straight into evaluateStopLoss", async () => {
    const dir = await tempDir();
    const path = join(dir, "ledger.json");
    await appendLedgerCost(path, 10);
    await appendLedgerCost(path, 10);
    await appendLedgerCost(path, 10);

    const costsSoFar = await readLedger(path);
    const evaluation = evaluateStopLoss({ costsSoFar, remainingRuns: 2, capUsd: 40 });

    expect(evaluation.permitted).toBe(false);
  });
});
