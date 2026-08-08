// tools/effect-eval/setup.mjs, exercised as a real child process —
// same convention as every other bundled validator (see
// tests/helpers/run.mjs's header): importing it would run its own `main()`
// and call `process.exit`.
//
// what is asserted here is exactly the acceptance bar this script exists to
// meet: materializing the same mock twice produces identical trees and
// identical commit histories (including messages and their order), the
// requested skills arrive as real files rather than symlinks, and
// history.jsonc — fixture metadata, not project content — never appears in
// the result.

import { spawnSync } from "node:child_process";
import { readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it, onTestFinished } from "vitest";

import { declaresPlaywright } from "../../tools/effect-eval/src/workspace.mjs";
import { repoPath, runScript, SCRIPTS } from "../helpers/run.mjs";

/**
 * strips the whole-line `//` comments history.jsonc uses and parses the
 * result. deliberately simpler than workspace.mjs's own JSONC stripper: the
 * fixture this reads never puts a comment marker inside a string or a
 * trailing comment after real content, so a line-based strip is exact for it,
 * even though it would not be for JSONC in general.
 *
 * @param {string} raw
 */
function parseHistoryFixture(raw) {
  const stripped = raw
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");
  return JSON.parse(stripped).commits;
}

/** `git log`, oldest first, as `{ hash, message }` pairs. */
function gitLog(workspace) {
  const proc = spawnSync("git", ["log", "--reverse", "--format=%H%x1f%s"], {
    cwd: workspace,
    encoding: "utf8",
  });
  if (proc.status !== 0) throw new Error(proc.stderr || "git log failed");
  return proc.stdout
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => {
      const [hash, message] = line.split("\x1f");
      return { hash, message };
    });
}

/** every path under `root`, relative and POSIX-style, skipping `.git`. */
async function listFiles(root, base = root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === ".git") continue;
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(full, base)));
    } else {
      files.push(full.slice(base.length + 1));
    }
  }
  return files.sort();
}

/** every symlink under `root`, relative and POSIX-style. */
async function listSymlinks(root, base = root) {
  const entries = await readdir(root, { withFileTypes: true });
  const links = [];
  for (const entry of entries) {
    const full = join(root, entry.name);
    if (entry.isSymbolicLink()) {
      links.push(full.slice(base.length + 1));
      continue;
    }
    if (entry.isDirectory()) {
      links.push(...(await listSymlinks(full, base)));
    }
  }
  return links;
}

/** materializes content-site and registers cleanup; returns the workspace path. */
function materialize(args = []) {
  const result = runScript(SCRIPTS.setup, args);
  const workspace = result.stdout.trim();
  if (result.code === 0 && workspace) {
    onTestFinished(() => rm(workspace, { recursive: true, force: true }));
  }
  return { result, workspace };
}

describe("setup.mjs", () => {
  it("prints usage and exits 0 for --help", () => {
    const result = runScript(SCRIPTS.setup, ["--help"]);

    expect(result).toPassCleanly();
    expect(result.stdout).toMatch(/Usage: setup\.mjs/);
    expect(result.stdout).toMatch(/--install/);
  });

  // the install is opt-in precisely so this file stays hermetic: every case
  // here materializes the mock, and a default that reached the network would
  // make the whole suite slow and flaky. asserting the absence is what keeps
  // "off by default" a property rather than an intention — a future change
  // that flipped the default would be caught here rather than in CI's timing.
  it("installs nothing unless asked, so the default path needs no network", async () => {
    const { result, workspace } = materialize();

    expect(result.code).toBe(0);
    await expect(stat(join(workspace, "node_modules"))).rejects.toThrow();
    // the lockfile still ships, so the install the flag performs is pinned
    // rather than resolved afresh — it is only deferred, not absent.
    expect(await listFiles(workspace)).toContain("package-lock.json");
  });

  // Playwright ships its browsers out of band, so `npm ci` alone leaves a
  // workspace that has @playwright/test and nothing to launch. --install
  // covers that gap, but only for a mock it recognizes as needing it — and
  // both halves of that coupling are invisible from either file alone. broken,
  // it surfaces where nothing is watching: inside a paid probe, as the
  // end-to-end command failing to launch a browser. so it is asserted here,
  // against a materialized workspace and with no network touched.
  it("recognizes a materialized mock whose end-to-end command needs a browser", async () => {
    const { result, workspace } = materialize();

    expect(result.code).toBe(0);
    expect(declaresPlaywright(workspace)).toBe(true);
    expect(await listFiles(workspace)).toContain("playwright.config.ts");
  });

  it("asks for no browser where the mock declares none", async () => {
    const { workspace } = materialize();
    const manifestPath = join(workspace, "package.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    delete manifest.devDependencies["@playwright/test"];
    await writeFile(manifestPath, JSON.stringify(manifest));

    expect(declaresPlaywright(workspace)).toBe(false);
  });

  it("fails clearly for an unknown skill name", () => {
    const result = runScript(SCRIPTS.setup, ["--skill", "not-a-real-skill"]);

    expect(result).toExitWith(2);
    expect(result.output).toMatch(/No installed skill named "not-a-real-skill"/);
  });

  it("fails clearly for an unknown mock name", () => {
    const result = runScript(SCRIPTS.setup, ["--mock", "not-a-real-mock"]);

    expect(result).toExitWith(2);
    expect(result.output).toMatch(/No mock named "not-a-real-mock"/);
  });

  describe("a single materialization", () => {
    async function setup() {
      const { result, workspace } = materialize([]);
      expect(result).toPassCleanly();
      return workspace;
    }

    it("replays history.jsonc as a real Git history, in order", async () => {
      const workspace = await setup();

      const historyRaw = await readFile(
        repoPath("mocks/content-site/history.jsonc"),
        "utf8",
      );
      const commits = parseHistoryFixture(historyRaw);

      const log = gitLog(workspace);

      expect(log.map((entry) => entry.message)).toEqual(
        commits.map((commit) => commit.message),
      );
    });

    it("omits history.jsonc from the materialized tree", async () => {
      const workspace = await setup();

      await expect(stat(join(workspace, "history.jsonc"))).rejects.toThrow();
    });

    it("leaves the working tree clean once history.jsonc has been replayed", async () => {
      const workspace = await setup();

      const status = spawnSync("git", ["status", "--porcelain"], {
        cwd: workspace,
        encoding: "utf8",
      });

      expect(status.stdout.trim()).toBe("");
    });
  });

  it("leaves the working tree clean even once a skill is installed", () => {
    // regression. the installed skill lands in .claude/ after the history is
    // replayed and is never committed, so for a while a materialized
    // skill-present workspace stood dirty at `?? .claude/`. that is not
    // untidiness — probe.mjs captures the model's work with `git add -A` plus
    // `git diff --cached`, so the whole installed skill was staged and
    // reported as something the model produced: 8 files and 660 insertions
    // before any model had run.
    //
    // it also landed on skill-present runs and no others, because a
    // skill-absent run installs none. a systematic difference between the
    // conditions, caused by the instrument rather than by the thing it
    // measures, is the one defect this whole apparatus exists to avoid — and
    // the model saw it too, since only one condition's `git status` was dirty.
    const { result, workspace } = materialize(["--skill", "unit-testing"]);
    expect(result).toPassCleanly();

    const status = spawnSync("git", ["status", "--porcelain"], {
      cwd: workspace,
      encoding: "utf8",
    });

    expect(
      status.stdout.trim(),
      "a materialized workspace must look identical to the model in both conditions",
    ).toBe("");
  });

  it("installs a requested skill as real files, not a symlink", async () => {
    const { result, workspace } = materialize(["--skill", "unit-testing"]);
    expect(result).toPassCleanly();

    const skillRoot = join(workspace, ".claude", "skills", "unit-testing");
    const skillStat = await stat(skillRoot);
    expect(skillStat.isDirectory()).toBe(true);

    const symlinks = await listSymlinks(skillRoot);
    expect(symlinks).toEqual([]);

    // a faithful copy, not merely "some directory": the installed SKILL.md
    // must match this repository's own installed copy byte for byte.
    const [installed, sourceOfTruth] = await Promise.all([
      readFile(join(skillRoot, "SKILL.md"), "utf8"),
      readFile(repoPath(".claude/skills/unit-testing/SKILL.md"), "utf8"),
    ]);
    expect(installed).toBe(sourceOfTruth);
  });

  it("installs no skills when none are requested", async () => {
    const { result, workspace } = materialize([]);
    expect(result).toPassCleanly();

    await expect(stat(join(workspace, ".claude"))).rejects.toThrow();
  });

  it("materializing the mock twice produces identical trees and identical commit histories", async () => {
    const first = materialize(["--skill", "unit-testing"]);
    const second = materialize(["--skill", "unit-testing"]);
    expect(first.result).toPassCleanly();
    expect(second.result).toPassCleanly();
    expect(first.workspace).not.toBe(second.workspace);

    const [filesA, filesB] = await Promise.all([
      listFiles(first.workspace),
      listFiles(second.workspace),
    ]);
    expect(filesA).toEqual(filesB);

    const contentsA = await Promise.all(
      filesA.map((file) => readFile(join(first.workspace, file), "utf8")),
    );
    const contentsB = await Promise.all(
      filesB.map((file) => readFile(join(second.workspace, file), "utf8")),
    );
    expect(contentsA).toEqual(contentsB);

    const logA = gitLog(first.workspace);
    const logB = gitLog(second.workspace);
    expect(logA).toEqual(logB);
    // the hashes are identical, not merely the messages — proof the pinned
    // identity, dates, and tree content produced byte-identical commits.
    expect(logA.map((entry) => entry.hash)).toEqual(logB.map((entry) => entry.hash));
  });
});
