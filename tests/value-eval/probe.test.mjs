// CLI-level tests for scripts/value-eval/probe.mjs, run as a real child
// process — same convention as every other bundled validator (see
// tests/helpers/run.mjs's header): importing it would run its own `main()`
// and call `process.exit`.
//
// NOTHING HERE SPAWNS THE claude CLI. Every case exercises --help or
// --dry-run, and the decisive proof is the PATH-stripped case below: dry-run
// must still succeed with no `claude` binary reachable at all, which it can
// only do by never attempting a real spawn.

import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { tempDir } from "../helpers/fixtures.mjs";
import { repoPath, runScript, SCRIPTS } from "../helpers/run.mjs";

const REQUIRED_ARGS = (workspace) => [
  "--workspace",
  workspace,
  "--arm",
  "control",
  "--run-index",
  "0",
];

describe("probe.mjs", () => {
  it("prints usage and exits 0 for --help", () => {
    const result = runScript(SCRIPTS.probe, ["--help"]);

    expect(result).toPassCleanly();
    expect(result.stdout).toMatch(/Usage: probe\.mjs/);
  });

  it("fails clearly for an unknown option", () => {
    const result = runScript(SCRIPTS.probe, ["--nonsense"]);

    expect(result).toExitWith(2);
    expect(result.output).toMatch(/Unknown option "--nonsense"/);
  });

  it("requires --workspace", () => {
    const result = runScript(SCRIPTS.probe, ["--arm", "control", "--run-index", "0"]);

    expect(result).toExitWith(2);
    expect(result.output).toMatch(/--workspace is required/);
  });

  it("requires --arm", () => {
    const result = runScript(SCRIPTS.probe, ["--workspace", "/tmp", "--run-index", "0"]);

    expect(result).toExitWith(2);
    expect(result.output).toMatch(/--arm is required/);
  });

  it("requires --run-index", () => {
    const result = runScript(SCRIPTS.probe, ["--workspace", "/tmp", "--arm", "control"]);

    expect(result).toExitWith(2);
    expect(result.output).toMatch(/--run-index is required/);
  });

  it("rejects a non-integer --run-index", () => {
    const result = runScript(SCRIPTS.probe, [
      "--workspace",
      "/tmp",
      "--arm",
      "control",
      "--run-index",
      "abc",
    ]);

    expect(result).toExitWith(2);
    expect(result.output).toMatch(/--run-index must be a non-negative integer/);
  });

  it("fails clearly when the workspace directory does not exist", () => {
    const result = runScript(SCRIPTS.probe, REQUIRED_ARGS("/no/such/workspace-directory"));

    expect(result).toExitWith(2);
    expect(result.output).toMatch(/No workspace directory at/);
  });

  describe("--dry-run", () => {
    it("validates and prints the plan without requiring the claude CLI to exist", async () => {
      const workspace = await tempDir();
      // PATH stripped entirely: if this ever attempted a real spawn, the
      // ENOENT branch would report "not on PATH" and exit 2 — this can only
      // pass 0 by never reaching spawnSync("claude", …) at all.
      const result = spawnSync(
        process.execPath,
        [repoPath(SCRIPTS.probe), ...REQUIRED_ARGS(workspace), "--dry-run"],
        { encoding: "utf8", env: { ...process.env, PATH: "" } },
      );

      expect(result.status).toBe(0);
      expect(result.stdout).toMatch(/DRY RUN — no CLI would be spawned/);
    });

    it("prints the exact spawn flags this task's acceptance criteria require", async () => {
      const workspace = await tempDir();
      const result = runScript(SCRIPTS.probe, [...REQUIRED_ARGS(workspace), "--dry-run"]);

      expect(result).toPassCleanly();
      expect(result.stdout).toMatch(/--setting-sources project/);
      expect(result.stdout).toMatch(/--max-turns 100/);
    });

    it("echoes the arm, run index, and prompt back in the plan", async () => {
      const workspace = await tempDir();
      const result = runScript(SCRIPTS.probe, [
        "--workspace",
        workspace,
        "--arm",
        "treatment",
        "--run-index",
        "2",
        "--prompt",
        "a custom prompt",
        "--dry-run",
      ]);

      expect(result).toPassCleanly();
      expect(result.stdout).toMatch(/arm:\s+treatment/);
      expect(result.stdout).toMatch(/run index:\s+2/);
      expect(result.stdout).toMatch(/a custom prompt/);
    });

    it("reports 'not evaluated' when no --ledger is given", async () => {
      const workspace = await tempDir();
      const result = runScript(SCRIPTS.probe, [...REQUIRED_ARGS(workspace), "--dry-run"]);

      expect(result.stdout).toMatch(/no --ledger given, not evaluated/);
    });

    it("previews the stop-loss decision from a real ledger, without touching it", async () => {
      const workspace = await tempDir();
      const dir = await tempDir();
      const ledgerPath = join(dir, "ledger.json");
      await writeFile(ledgerPath, JSON.stringify([15, 15]), "utf8");

      const result = runScript(SCRIPTS.probe, [
        ...REQUIRED_ARGS(workspace),
        "--ledger",
        ledgerPath,
        "--total-runs",
        "3",
        "--budget-usd",
        "40",
        "--dry-run",
      ]);

      expect(result).toPassCleanly();
      // avg 15, spent 30, 1 remaining -> projected 45, exceeds a $40 cap
      expect(result.stdout).toMatch(/would REFUSE/);

      const ledgerAfter = JSON.parse(await readFile(ledgerPath, "utf8"));
      expect(ledgerAfter).toEqual([15, 15]);
    });
  });
});
