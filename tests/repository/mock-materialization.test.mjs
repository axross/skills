// every mock under mocks/, materialized twice, held to the contract
// tools/lib/mock-workspace.mjs enforces.
//
// this is mock-agnostic on purpose. tests/effect-eval/setup.test.mjs proves
// the materializer works, and proves it against one mock — so a second mock
// whose history.jsonc and tree disagree is caught by nothing here. the
// bijection is not a formality at that size: a mock ships dozens of files,
// every one has to be named in exactly one commit, and the failure surfaces
// where nothing is watching — inside a paid probe, as a materialization that
// aborts before the model gets a workspace at all.
//
// reproducibility is asserted alongside it because the two share a walk and
// because it is the property the pinned commit identity and dates exist for:
// two materializations of one mock produce identical trees AND identical
// commit hashes, so a probe run can be diffed against a rerun rather than
// trusted. a mock that introduced anything clock- or environment-derived
// would pass the bijection and fail here.
//
// no network is touched: the dependency install is opt-in and this walk never
// asks for it.
//
// one failure mode is worth naming because it looks like a bug in a mock and
// is not. the copy filters out `node_modules` and nothing else, so a build
// artifact left behind by running a mock's own commands in place — `dist/`, a
// `*.db` file, a coverage directory — is copied into the workspace and then
// fails the bijection as a file no commit names. the fix is to clean the mock
// directory, not to edit its history.jsonc.

import { spawnSync } from "node:child_process";
import { readdir, rm } from "node:fs/promises";
import { join, relative, sep } from "node:path";

import { describe, expect, it, onTestFinished } from "vitest";

import { repoPath, runScript, SCRIPTS } from "../helpers/run.mjs";

/** every file under `root`, POSIX-style and relative, skipping `.git`. */
async function listFiles(root, base = root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === ".git") continue;
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(full, base)));
    } else {
      files.push(relative(base, full).split(sep).join("/"));
    }
  }
  return files.sort();
}

/** `git log` as `<hash>\x1f<subject>` lines, oldest first. */
function gitLog(workspace) {
  const proc = spawnSync("git", ["log", "--reverse", "--format=%H%x1f%s"], {
    cwd: workspace,
    encoding: "utf8",
  });
  if (proc.status !== 0) throw new Error(proc.stderr || "git log failed");
  return proc.stdout.trim().split("\n").filter(Boolean);
}

/**
 * materializes `mock` with `skills` installed, registers cleanup, and returns
 * the run and its workspace.
 */
function materialize(mock, skills = []) {
  const args = ["--mock", mock, ...skills.flatMap((skill) => ["--skill", skill])];
  const result = runScript(SCRIPTS.setup, args);
  const workspace = result.stdout.trim();
  if (result.code === 0 && workspace) {
    onTestFinished(() => rm(workspace, { recursive: true, force: true }));
  }
  return { result, workspace };
}

const mocks = (await readdir(repoPath("mocks"), { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

describe("every mock under mocks/", () => {
  // guards the walk itself: an empty mocks/ would make every case below pass
  // vacuously, which is indistinguishable from a walk that has stopped
  // working. this repository has had at least one mock since #281.
  it("is a non-empty set, so the cases below are not vacuous", () => {
    expect(mocks.length).toBeGreaterThan(0);
  });

  it.each(mocks)("materializes: %s", (mock) => {
    const { result } = materialize(mock);

    expect(result, `${mock} does not satisfy the materializer's contract`).toPassCleanly();
  });

  it.each(mocks)("materializes reproducibly: %s", async (mock) => {
    const first = materialize(mock);
    const second = materialize(mock);

    expect(first.result.code).toBe(0);
    expect(second.result.code).toBe(0);
    expect(await listFiles(second.workspace)).toEqual(await listFiles(first.workspace));
    // hashes, not just messages — a commit whose date or identity moved would
    // otherwise pass, and that is exactly what the pinning exists to prevent.
    expect(gitLog(second.workspace)).toEqual(gitLog(first.workspace));
  });

  it.each(mocks)("leaves no fixture metadata and nothing uncommitted: %s", async (mock) => {
    const { workspace } = materialize(mock);

    // history.jsonc is fixture metadata, not project content: a model working
    // in the workspace must never find it.
    expect(await listFiles(workspace)).not.toContain("history.jsonc");
    expect(spawnSync("git", ["status", "--porcelain"], { cwd: workspace, encoding: "utf8" }).stdout)
      .toBe("");
  });

  // the first of the two layers tools/effect-eval/src/capture.mjs's header
  // describes: a mock's own .gitignore should keep an installed skill out of
  // Git entirely, so the capture's `.claude` filter — the second layer — never
  // has anything to catch. behavioural rather than a grep of the .gitignore
  // text, for the reason capture.mjs's own header gives for running real git
  // rather than asserting on argv: a textual check passes just as happily on
  // an entry that is present but ineffective, e.g. one placed under a `!`
  // negation or in a file git does not read here.
  it.each(mocks)(
    "leaves nothing for git to report once a skill is installed: %s",
    (mock) => {
      const { result, workspace } = materialize(mock, ["unit-testing"]);

      expect(
        result,
        `${mock} does not satisfy the materializer's contract with a skill installed`,
      ).toPassCleanly();
      expect(
        spawnSync("git", ["status", "--porcelain"], { cwd: workspace, encoding: "utf8" }).stdout,
        `${mock}'s .gitignore should keep an installed skill out of git entirely`,
      ).toBe("");
    },
  );
});
