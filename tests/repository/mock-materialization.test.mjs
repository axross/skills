// every mock under tools/evaluation/mocks/, materialized twice, held to the
// contract tools/evaluation/src/mock-workspace.mjs enforces.
//
// this calls materialize() directly rather than through a spawned CLI. the
// old instrument's own entry point was removed with the rest of the deleted
// subsystem, and mock-workspace.mjs has no CLI of its own yet — see its own
// header. the contract under test is unchanged: one call in, one workspace
// or one thrown error out.
//
// this is mock-agnostic on purpose, and proves the materializer against every
// mock this repository ships — so a mock whose history.jsonc and tree
// disagree is caught here rather than by whichever probe first materializes
// it. the bijection is not a formality at that size: a mock ships dozens of
// files, every one has to be named in exactly one commit, and the failure
// surfaces where nothing is watching — inside a paid probe, as a
// materialization that aborts before the model gets a workspace at all.
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
import { readdir, rm, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";

import { describe, expect, it, onTestFinished } from "vitest";

import { materialize as materializeMock } from "../../tools/evaluation/src/mock-workspace.mjs";
import { repoPath } from "../helpers/run.mjs";

/** the two paths a mock's own working agreement occupies — see materialize()'s `agentsMd` option. */
const AGENTS_MD_FILES = ["AGENTS.md", "CLAUDE.md"];

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
 * every path any commit in `workspace`'s history ever touched, deduped —
 * used to confirm a withheld path was never named by a commit, not merely
 * absent from the final tree.
 */
function gitCommittedFiles(workspace) {
  const proc = spawnSync("git", ["log", "--name-only", "--pretty=format:"], {
    cwd: workspace,
    encoding: "utf8",
  });
  if (proc.status !== 0) throw new Error(proc.stderr || "git log --name-only failed");
  return new Set(
    proc.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  );
}

/**
 * materializes `mock`, registers cleanup, and returns a `{ result, workspace }`
 * pair shaped like this suite's other spawn-based helpers do: `result.code`
 * is 0 on success and 2 on a materialization error — mirroring the exit
 * codes the deleted setup.mjs CLI used to report — with the thrown error's
 * message as `result.output`. That keeps the assertions below, and the
 * `toPassCleanly()` matcher they use, reading exactly as they did when this
 * called a spawned CLI.
 *
 * @param {string} mock
 * @param {{ skills?: string[], agentsMd?: boolean }} [options] `agentsMd` is
 *   omitted rather than passed as `undefined` when not given, so a case that
 *   wants the default keeps exercising materialize()'s own default rather
 *   than this helper's.
 */
async function materialize(mock, { skills = [], agentsMd } = {}) {
  try {
    const workspace = await materializeMock({
      mock,
      skills,
      ...(agentsMd === undefined ? {} : { agentsMd }),
    });
    onTestFinished(() => rm(workspace, { recursive: true, force: true }));
    return { result: { code: 0, output: "" }, workspace };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { result: { code: 2, output: message }, workspace: null };
  }
}

const mocks = (await readdir(repoPath("tools/evaluation/mocks"), { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

describe("every mock under tools/evaluation/mocks/", () => {
  // guards the walk itself: an empty tools/evaluation/mocks/ would make every
  // case below pass vacuously, which is indistinguishable from a walk that
  // has stopped working.
  it("is a non-empty set, so the cases below are not vacuous", () => {
    expect(mocks.length).toBeGreaterThan(0);
  });

  it.each(mocks)("materializes: %s", async (mock) => {
    const { result } = await materialize(mock);

    expect(result, `${mock} does not satisfy the materializer's contract`).toPassCleanly();
  });

  it.each(mocks)("materializes reproducibly: %s", async (mock) => {
    const first = await materialize(mock);
    const second = await materialize(mock);

    expect(first.result.code).toBe(0);
    expect(second.result.code).toBe(0);
    expect(await listFiles(second.workspace)).toEqual(await listFiles(first.workspace));
    // hashes, not just messages — a commit whose date or identity moved would
    // otherwise pass, and that is exactly what the pinning exists to prevent.
    expect(gitLog(second.workspace)).toEqual(gitLog(first.workspace));
  });

  it.each(mocks)("leaves no fixture metadata and nothing uncommitted: %s", async (mock) => {
    const { workspace } = await materialize(mock);

    // history.jsonc is fixture metadata, not project content: a model working
    // in the workspace must never find it.
    expect(await listFiles(workspace)).not.toContain("history.jsonc");
    expect(spawnSync("git", ["status", "--porcelain"], { cwd: workspace, encoding: "utf8" }).stdout)
      .toBe("");
  });

  // a mock's own .gitignore should keep an installed skill out of Git
  // entirely — the old effect evaluation's capture step relied on this as the
  // first of two layers, with a second filter of its own catching whatever
  // slipped past it. behavioural rather than a grep of the .gitignore text: a
  // textual check passes just as happily on an entry that is present but
  // ineffective, e.g. one placed under a `!` negation or in a file git does
  // not read here.
  it.each(mocks)(
    "leaves nothing for git to report once a skill is installed: %s",
    async (mock) => {
      const { result, workspace } = await materialize(mock, { skills: ["unit-testing"] });

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

  // a `true` declaration claims a mock ships its working agreement — see
  // scenario.schema.json's own agentsMd description — and nothing inside
  // materialize() asserts that; this is the check that claim is checkable
  // against, and where a mock added without either file would fail rather
  // than pass quietly.
  it.each(mocks)("ships an AGENTS.md and a CLAUDE.md, so agentsMd: true claims nothing missing: %s", async (mock) => {
    for (const file of AGENTS_MD_FILES) {
      await expect(
        stat(repoPath(`tools/evaluation/mocks/${mock}/${file}`)),
        `${mock} has no ${file}`,
      ).resolves.toBeDefined();
    }
  });
});

describe("materialize()'s agentsMd option", () => {
  it.each(mocks)("withholds the working agreement when declared false: %s", async (mock) => {
    const { result, workspace } = await materialize(mock, { agentsMd: false });

    expect(result, `${mock} does not satisfy the materializer's contract with agentsMd: false`).toPassCleanly();

    const files = await listFiles(workspace);
    for (const file of AGENTS_MD_FILES) {
      expect(files, `${mock}'s workspace still ships ${file}`).not.toContain(file);
    }

    const committed = gitCommittedFiles(workspace);
    for (const file of AGENTS_MD_FILES) {
      expect(committed, `${mock}'s replayed history still names ${file}`).not.toContain(file);
    }

    expect(
      spawnSync("git", ["status", "--porcelain"], { cwd: workspace, encoding: "utf8" }).stdout,
      `${mock}'s workspace has something uncommitted after withholding the working agreement`,
    ).toBe("");
  });

  it.each(mocks)(
    "keeps the working agreement when declared true, identical to the default: %s",
    async (mock) => {
      const withDefault = await materialize(mock);
      const withTrue = await materialize(mock, { agentsMd: true });

      expect(withDefault.result, `${mock} does not materialize under the default option`).toPassCleanly();
      expect(withTrue.result, `${mock} does not materialize with agentsMd: true`).toPassCleanly();

      const filesDefault = await listFiles(withDefault.workspace);
      const filesTrue = await listFiles(withTrue.workspace);
      for (const file of AGENTS_MD_FILES) {
        expect(filesTrue, `${mock}'s workspace is missing ${file} with agentsMd: true`).toContain(file);
      }
      expect(filesTrue, `${mock}'s agentsMd: true tree differs from its default one`).toEqual(filesDefault);
      expect(
        gitLog(withTrue.workspace),
        `${mock}'s agentsMd: true history differs from its default one`,
      ).toEqual(gitLog(withDefault.workspace));
    },
  );

  it.each(mocks)("materializes reproducibly when declared false: %s", async (mock) => {
    const first = await materialize(mock, { agentsMd: false });
    const second = await materialize(mock, { agentsMd: false });

    expect(first.result.code).toBe(0);
    expect(second.result.code).toBe(0);
    expect(await listFiles(second.workspace)).toEqual(await listFiles(first.workspace));
    expect(gitLog(second.workspace)).toEqual(gitLog(first.workspace));
  });
});
