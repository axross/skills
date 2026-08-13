// evaluate.mjs driven as a real child process, on its --dry-run path only.
//
// it materializes a real workspace (situated: a real mock; bare: a real
// scratch directory), takes a real fingerprint, builds the real argv, and
// writes real probe records — spawning no model and reaching no network.
// nothing here drives the real CLI.

import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runScript, SCRIPTS } from "../helpers/run.mjs";

const SITUATED_CASE = "invalidate-a-stale-list-after-a-write";
const BARE_CASE = "tighten-a-skill-description-without-losing-routing";

const outDirs = [];
async function freshOutDir() {
  const dir = await mkdtemp(join(tmpdir(), "discovery-eval-out-"));
  outDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(outDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const evaluate = (args) => runScript(SCRIPTS.discoveryEvalEvaluate, args);

const probeDirsIn = async (dir) => (await readdir(dir)).sort();
const metadataOf = async (dir, name) => JSON.parse(await readFile(join(dir, name, "metadata.json"), "utf8"));

describe("--help", () => {
  it("prints usage and exits 0, without needing any other flag", () => {
    const result = evaluate(["--help"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/Usage: evaluate\.mjs/);
  });
});

describe("--dry-run with no --case: the whole-fixture preview", () => {
  it("completes for all three seeded cases, spawning nothing, and prints the projected count and cost", () => {
    const result = evaluate(["--dry-run"]);
    expect(result.code, result.output).toBe(0);
    expect(result.stdout).toContain(SITUATED_CASE);
    expect(result.stdout).toContain(BARE_CASE);
    expect(result.stdout).toContain("agree-a-plan-before-writing-code");
    expect(result.stdout).toMatch(/Projected: \d+ probe\(s\), \$\d+\.\d\d total/);
    expect(result.stdout).toContain("No process was spawned; no network was reached.");
  });
});

describe("a situated dry run", () => {
  it("writes one probe directory per declared repeat, each with both files", async () => {
    const out = await freshOutDir();
    const result = evaluate([
      "--case",
      SITUATED_CASE,
      "--out",
      out,
      "--probe-id",
      "aaaaaaaa",
      "--probe-id",
      "bbbbbbbb",
      "--dry-run",
    ]);
    expect(result.code, result.output).toBe(0);
    expect(await probeDirsIn(out)).toEqual(["probe-aaaaaaaa", "probe-bbbbbbbb"]);
    for (const name of await probeDirsIn(out)) {
      expect((await readdir(join(out, name))).sort()).toEqual(["metadata.json", "transcript.jsonl"]);
    }
  });

  it("reports a probe plan whose permitted tools are exactly Read, Glob, Grep, Skill", async () => {
    const out = await freshOutDir();
    evaluate(["--case", SITUATED_CASE, "--out", out, "--probe-id", "cccccccc", "--dry-run"]);
    const metadata = await metadataOf(out, "probe-cccccccc");
    expect(metadata.configuration.runtime.options.allowedTools).toEqual([
      "Read",
      "Glob",
      "Grep",
      "Skill",
    ]);
    expect(metadata.configuration.workspace.mode).toBe("situated");
    expect(metadata.configuration.workspace.mock).toBe("inkwell");
    expect(metadata.configuration.workspace.tree).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("marks the record as a dry run, so it cannot be mistaken for a measurement", async () => {
    const out = await freshOutDir();
    evaluate(["--case", SITUATED_CASE, "--out", out, "--probe-id", "dddddddd", "--dry-run"]);
    const metadata = await metadataOf(out, "probe-dddddddd");
    expect(metadata.trigger).toEqual({ kind: "dry-run", url: null });
  });

  it("installs the whole library corpus's description digests, not only the tracked skills", async () => {
    const out = await freshOutDir();
    evaluate(["--case", SITUATED_CASE, "--out", out, "--probe-id", "eeeeeeee", "--dry-run"]);
    const metadata = await metadataOf(out, "probe-eeeeeeee");
    const skillNames = Object.keys(metadata.configuration.skills);
    expect(skillNames).toContain("tanstack-query-development");
    expect(skillNames).toContain("next-app-development");
    expect(skillNames.length).toBeGreaterThan(10);
  });
}, 30_000);

describe("a bare dry run", () => {
  it("reports Skill only and the bare turn cap, with no project tree", async () => {
    const out = await freshOutDir();
    const result = evaluate(["--case", BARE_CASE, "--out", out, "--probe-id", "11111111", "--dry-run"]);
    expect(result.code, result.output).toBe(0);
    const metadata = await metadataOf(out, "probe-11111111");
    expect(metadata.configuration.runtime.options.allowedTools).toEqual(["Skill"]);
    // 2, not 1: a bare probe that calls Skill spends its first turn doing so
    // and reports num_turns: 2, so a 1-turn cap could only ever terminate a
    // probe that selected nothing. See plan.mjs's BARE_TURN_CAP.
    expect(metadata.configuration.runtime.options.maxTurns).toBe(2);
    expect(metadata.configuration.runtime.options.disallowedTools).toContain("ToolSearch");
    expect(metadata.configuration.workspace).toEqual({ mode: "bare", mock: null, tree: null });
  });
}, 15_000);

describe("--head-skills's mode refusals", () => {
  it("forces a situated case bare", async () => {
    const headSkills = await freshOutDir(); // an empty staging directory is a valid, if uninteresting, overlay
    const result = evaluate(["--case", SITUATED_CASE, "--head-skills", headSkills, "--dry-run"]);
    expect(result.code, result.output).toBe(0);
    expect(result.output).toContain("bare");
  });

  it("refuses a request to record — --head-skills together with --out exits non-zero", async () => {
    const out = await freshOutDir();
    const headSkills = await freshOutDir();
    const result = evaluate(["--case", SITUATED_CASE, "--out", out, "--head-skills", headSkills, "--dry-run"]);
    expect(result.code).not.toBe(0);
    expect(result.output).toMatch(/--head-skills evaluates untrusted head text; it reports, it never records/);
    expect(await readdir(out)).toEqual([]);
  });
}, 15_000);

describe("--prompt overrides the resolved case's prompt and never records", () => {
  const OVERRIDDEN = "This is a deliberately reworded prompt for the override run.";

  it("runs a situated case situated — --prompt never forces bare the way --head-skills does", async () => {
    const result = evaluate(["--case", SITUATED_CASE, "--prompt", OVERRIDDEN, "--dry-run"]);
    expect(result.code, result.output).toBe(0);
    const records = result.stdout
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(records).toHaveLength(2); // SITUATED_CASE's fixture-declared repeat count
    for (const record of records) {
      expect(record.metadata.configuration.workspace.mode).toBe("situated");
      // the prompt is the only variable: every probe's own metadata.json
      // carries the overridden prompt, never the fixture's declared one.
      expect(record.metadata.configuration.case.prompt).toBe(OVERRIDDEN);
      expect(record.metadata.configuration.case.id).toBe(SITUATED_CASE);
      expect(typeof record.terminalReason).toBe("string");
    }
  });

  it("runs a bare case bare, unchanged", async () => {
    const result = evaluate(["--case", BARE_CASE, "--prompt", OVERRIDDEN, "--dry-run"]);
    expect(result.code, result.output).toBe(0);
    const record = JSON.parse(result.stdout.trim().split("\n")[0]);
    expect(record.metadata.configuration.workspace.mode).toBe("bare");
    expect(record.metadata.configuration.case.prompt).toBe(OVERRIDDEN);
  });

  it("reaches the probe's argv — the dry-run command line carries the overridden text", () => {
    const result = evaluate(["--case", SITUATED_CASE, "--prompt", OVERRIDDEN, "--dry-run"]);
    expect(result.code, result.output).toBe(0);
    expect(result.stderr).toContain(OVERRIDDEN);
  });

  it("writes no measurement: --prompt with --out exits non-zero", async () => {
    const out = await freshOutDir();
    const result = evaluate(["--case", SITUATED_CASE, "--out", out, "--prompt", OVERRIDDEN, "--dry-run"]);
    expect(result.code).not.toBe(0);
    expect(result.output).toMatch(/--prompt overrides a case's prompt.*comparability key/s);
    expect(await readdir(out)).toEqual([]);
  });

  it("refuses --head-skills together with --prompt — two different threat models must not meet", async () => {
    const headSkills = await freshOutDir();
    const result = evaluate(["--case", SITUATED_CASE, "--prompt", OVERRIDDEN, "--head-skills", headSkills, "--dry-run"]);
    expect(result.code).not.toBe(0);
    expect(result.output).toMatch(/two different threat models and two different\s+workspaces must not meet/i);
  });
}, 15_000);

describe("other refusals", () => {
  it("refuses an unknown case rather than inventing a task", () => {
    const result = evaluate(["--case", "no-such-case", "--out", "/tmp/wont-be-used", "--dry-run"]);
    expect(result.code).toBe(2);
    expect(result.output).toMatch(/declares no case "no-such-case"/);
  });

  it("refuses --case with neither --out nor --head-skills", () => {
    const result = evaluate(["--case", SITUATED_CASE, "--dry-run"]);
    expect(result.code).toBe(2);
    expect(result.output).toMatch(/--out is required/);
  });

  it("refuses with no --case and no --dry-run", () => {
    const result = evaluate([]);
    expect(result.code).toBe(2);
    expect(result.output).toMatch(/--case is required/);
  });
});
