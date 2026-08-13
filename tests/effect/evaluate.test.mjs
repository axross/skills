// evaluate.mjs driven as a real child process on its dry-run path.
//
// it materializes a real workspace, takes a real fingerprint, builds the real
// argv, and writes a real probe record, spawning no model and running no
// `npm ci`. only the chargeable step is replaced.

import { readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildArgv } from "../../tools/effect-eval/src/spawn.mjs";
import { deriveCaseSummary } from "../../tools/effect-eval/src/summary.mjs";
import { runScript, SCRIPTS } from "../helpers/run.mjs";

const CASE = "add-unit-tests-for-an-untested-module";

/** the probe records, and the two workspaces they run against. */
let out;
let workspaces = [];

const setup = (args) => {
  const result = runScript(SCRIPTS.setup, args);
  expect(result.code, result.output).toBe(0);
  const path = result.stdout.trim();
  workspaces.push(path);
  return path;
};

beforeAll(async () => {
  const { mkdtemp } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  out = await mkdtemp(join(tmpdir(), "case-dry-run-"));

  const absent = setup(["--mock", "tsuzuri"]);
  const present = setup(["--mock", "tsuzuri", "--skill", "unit-testing"]);

  // matching what the fixture declares, so the repetition check has something
  // real to agree with.
  for (const repeat of [1, 2, 3]) {
    for (const [condition, workspace] of [
      ["skill-absent", absent],
      ["skill-present", present],
    ]) {
      const result = runScript(SCRIPTS.evaluate, [
        "--workspace",
        workspace,
        "--case",
        CASE,
        "--condition",
        condition,
        "--out",
        out,
        "--probe-id", // fixed, so the tree is reproducible across runs
        `${condition === "skill-absent" ? "a" : "b"}000000${repeat}`,
        "--runtime-version",
        "2.1.220",
        "--dry-run",
      ]);
      expect(result.code, result.output).toBe(0);
    }
  }
}, 120_000);

afterAll(async () => {
  await Promise.all(
    [out, ...workspaces].filter(Boolean).map((path) => rm(path, { recursive: true, force: true })),
  );
});

const probeDirs = async () => (await readdir(out)).sort();
const metadataOf = async (name) =>
  JSON.parse(await readFile(join(out, name, "metadata.json"), "utf8"));

describe("a dry-run case measurement", () => {
  it("writes one directory per declared probe", async () => {
    expect(await probeDirs()).toEqual([
      "skill-absent-a0000001",
      "skill-absent-a0000002",
      "skill-absent-a0000003",
      "skill-present-b0000001",
      "skill-present-b0000002",
      "skill-present-b0000003",
    ]);
  });

  it("gives each probe all three of its files", async () => {
    for (const name of await probeDirs()) {
      expect((await readdir(join(out, name))).sort()).toEqual([
        "changes.patch",
        "metadata.json",
        "transcript.jsonl",
      ]);
    }
  });

  it("marks the record as a dry run, so it cannot be mistaken for a measurement", async () => {
    expect((await metadataOf("skill-absent-a0000001")).trigger).toEqual({
      kind: "dry-run",
      url: null,
    });
  });

  it("records a real project commit, not a placeholder", async () => {
    // diagnostic only, but a field hardcoded to null can never do that job.
    const { project } = (await metadataOf("skill-absent-a0000001")).configuration;
    expect(project.commit).toMatch(/^[0-9a-f]{40}$/);
  });

  it("gives both conditions the same project commit and the same tree", async () => {
    // both follow from the history replaying reproducibly and the installed
    // skill being gitignored and excluded from the digest.
    const absent = (await metadataOf("skill-absent-a0000001")).configuration.project;
    const present = (await metadataOf("skill-present-b0000001")).configuration.project;
    expect(present.tree).toBe(absent.tree);
    expect(present.commit).toBe(absent.commit);
  });

  it("digests the installed skill in one condition and not the other", async () => {
    expect((await metadataOf("skill-absent-a0000001")).configuration.skills).toEqual({});
    expect(
      Object.keys((await metadataOf("skill-present-b0000001")).configuration.skills),
    ).toEqual(["unit-testing"]);
  });

  it("reproduces the argv from the stored configuration", async () => {
    // against a record that actually went to disk, not one built in memory.
    const { configuration } = await metadataOf("skill-present-b0000001");
    expect(buildArgv(configuration)).toContain(configuration.task.prompt);
    expect(buildArgv(configuration)).toEqual(buildArgv(JSON.parse(JSON.stringify(configuration))));
  });

  it("derives to a comparable measurement, repetition count included", async () => {
    // through the library rather than the command, which takes a data root
    // where this tree is a bare case directory.
    const summary = await deriveCaseSummary(out, { declaredRepetitions: 3 });
    const failed = summary.checks.filter((check) => !check.passed);
    expect(failed.map((check) => `${check.check}: ${check.detail}`)).toEqual([]);
    expect(summary.comparable).toBe(true);
    expect(summary.probeCount).toBe(6);
  });
});

describe("evaluate.mjs's refusals", () => {
  it("refuses when the condition and the workspace disagree", async () => {
    // it would record a condition that never happened. caught before the
    // spawn, so it costs nothing.
    const result = runScript(SCRIPTS.evaluate, [
      "--workspace",
      workspaces[0], // the skill-absent workspace
      "--case",
      CASE,
      "--condition",
      "skill-present",
      "--out",
      out,
      "--dry-run",
    ]);
    expect(result.code).toBe(2);
    expect(result.output).toMatch(/no skill installed, but --condition skill-present/);
  });

  it("refuses an unknown case rather than inventing a task", async () => {
    const result = runScript(SCRIPTS.evaluate, [
      "--workspace",
      workspaces[0],
      "--case",
      "no-such-case",
      "--condition",
      "skill-absent",
      "--out",
      out,
      "--dry-run",
    ]);
    expect(result.code).toBe(2);
    expect(result.output).toMatch(/declares no case "no-such-case"/);
  });
});
