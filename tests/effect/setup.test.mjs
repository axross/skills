// tools/evaluation/readings/effect/setup.mjs, exercised as a real child process — same
// convention as every other bundled validator (see tests/helpers/run.mjs's
// header): importing it would run its own `main()` and call `process.exit`. it
// is the interface every real caller uses to reach
// tools/evaluation/lib/mock-workspace.mjs, the workflow included, so the patch
// cases at the bottom of this file drive the mechanism through it rather than
// around it.
//
// what is asserted here is exactly the acceptance bar this script exists to
// meet: materializing the same mock twice produces identical trees and
// identical commit histories (including messages and their order), the
// requested skills arrive as real files rather than symlinks, history.jsonc —
// fixture metadata, not project content — never appears in the result, and a
// case's patch reaches the tree before the history is replayed over it.

import { spawnSync } from "node:child_process";
import { mkdir, readdir, readFile, rm, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { describe, expect, it, onTestFinished } from "vitest";

import { declaresPlaywright } from "../../tools/evaluation/lib/mock-workspace.mjs";
import { tempDir } from "../helpers/fixtures.mjs";
import { editHistory, patchFromMock, readMockHistory } from "../helpers/mock-patch.mjs";
import { repoPath, runScript, SCRIPTS } from "../helpers/run.mjs";

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

/**
 * materializes a mock — tsuzuri unless `args` names another — and
 * registers cleanup; returns the workspace path.
 */
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
  // workspace that has the driver package and nothing to launch. --install
  // covers that gap, but only for a mock it recognizes as needing it — and
  // both halves of that coupling are invisible from either file alone. broken,
  // it surfaces where nothing is watching: inside a paid probe, as the
  // browser-driving command failing to launch a browser. so it is asserted
  // here, against a materialized workspace and with no network touched.
  it("recognizes a materialized mock whose end-to-end command needs a browser", async () => {
    const { result, workspace } = materialize();

    expect(result.code).toBe(0);
    expect(declaresPlaywright(workspace)).toBe(true);
    expect(await listFiles(workspace)).toContain("playwright.config.ts");
  });

  // the second shape of the same coupling, and the one the check originally
  // missed. a Vitest browser-mode project reaches a browser through
  // `playwright` and never depends on `@playwright/test`, so a check keyed on
  // the test runner alone reported "no browser needed" for a mock whose own
  // `npm test` cannot run without one. the two assertions below are what make
  // this a regression test rather than a restatement: inkwell is recognized,
  // AND it is recognized without declaring the package tsuzuri declares.
  it("recognizes a mock that drives a browser through Vitest rather than @playwright/test", async () => {
    const { result, workspace } = materialize(["--mock", "inkwell"]);

    expect(result.code).toBe(0);
    const manifest = JSON.parse(await readFile(join(workspace, "package.json"), "utf8"));
    const declared = { ...manifest.dependencies, ...manifest.devDependencies };
    expect(Object.hasOwn(declared, "@playwright/test")).toBe(false);
    expect(Object.hasOwn(declared, "playwright")).toBe(true);
    expect(declaresPlaywright(workspace)).toBe(true);
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

      const commits = await readMockHistory();

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

  it("reproduces the mock byte for byte when no patch is declared", async () => {
    // the no-patch path is what every committed measurement was taken against,
    // so the patch step must not move it. history.jsonc is now copied in and
    // removed again rather than filtered out at the copy, and this is what says
    // the removal is complete and nothing else came with it.
    const { result, workspace } = materialize();
    expect(result).toPassCleanly();

    const materialized = await listFiles(workspace);
    const shipped = (await listFiles(repoPath("tools/evaluation/mocks/tsuzuri"))).filter(
      (file) => file !== "history.jsonc" && !file.startsWith("node_modules/"),
    );
    expect(materialized).toEqual(shipped);

    for (const file of materialized) {
      const [got, want] = await Promise.all([
        readFile(join(workspace, file), "utf8"),
        readFile(repoPath("tools/evaluation/mocks/tsuzuri", file), "utf8"),
      ]);
      expect(got, `${file} differs from what the mock ships`).toBe(want);
    }

    expect(gitLog(workspace).map((entry) => entry.message)).toEqual(
      (await readMockHistory()).map((commit) => commit.message),
    );
  });
});

// a case whose prompt describes a defect needs that defect to be real, and the
// mock must not be the thing that carries it — see
// tools/evaluation/mocks/README.md and
// docs/decisions/2026-08-08-ship-mocks-sound-and-patch-in-defects-per-case.md.
// every patch below is generated from the real mock at test time rather than
// committed; tests/helpers/mock-patch.mjs says why.
describe("setup.mjs --patch", () => {
  /** materializes with a generated patch, asserting the run succeeded. */
  function materializePatched(patchPath, args = []) {
    const outcome = materialize(["--patch", patchPath, ...args]);
    expect(outcome.result.code, outcome.result.output).toBe(0);
    return outcome;
  }

  /** `git ls-files`, so what the replay committed is compared, not what is on disk. */
  function tracked(workspace) {
    return spawnSync("git", ["ls-files"], { cwd: workspace, encoding: "utf8" })
      .stdout.trim()
      .split("\n")
      .filter((line) => line.length > 0)
      .sort();
  }

  /**
   * the workspace is clean, and every file on disk is one the replay committed.
   *
   * `.claude/` is excluded because an installed skill is deliberately untracked
   * — the mock's own .gitignore covers it. no case here installs one, but the
   * exclusion keeps this helper honest for one that does.
   */
  async function expectCleanAndConsistent(workspace) {
    const status = spawnSync("git", ["status", "--porcelain"], {
      cwd: workspace,
      encoding: "utf8",
    });
    expect(status.stdout.trim(), "a patched workspace must be as clean as an unpatched one").toBe(
      "",
    );
    const onDisk = (await listFiles(workspace)).filter((file) => !file.startsWith(".claude/"));
    expect(tracked(workspace)).toEqual(onDisk);
  }

  it("applies a patch that deletes a file, and commits the history around it", async () => {
    const history = await readMockHistory();
    const [doomed] = history.find((commit) => commit.files.length > 1).files;

    const patch = await patchFromMock(async (tree) => {
      await unlink(join(tree, doomed));
      await editHistory(tree, (commits) => {
        for (const commit of commits) {
          commit.files = commit.files.filter((file) => file !== doomed);
        }
      });
    });

    const { workspace } = materializePatched(patch);

    await expect(stat(join(workspace, doomed))).rejects.toThrow();
    expect(tracked(workspace)).not.toContain(doomed);
    await expectCleanAndConsistent(workspace);
    expect(gitLog(workspace).map((entry) => entry.message)).toEqual(
      history.map((commit) => commit.message),
    );
  });

  it("applies a patch that adds a file the history then names", async () => {
    const added = "shared/site-name.ts";

    const patch = await patchFromMock(async (tree) => {
      await mkdir(dirname(join(tree, added)), { recursive: true });
      await writeFile(join(tree, added), 'export const SITE_NAME = "Field Notes";\n', "utf8");
      await editHistory(tree, (commits) => {
        commits[commits.length - 1].files.push(added);
      });
    });

    const { workspace } = materializePatched(patch);

    expect(await readFile(join(workspace, added), "utf8")).toContain("SITE_NAME");
    expect(tracked(workspace)).toContain(added);
    await expectCleanAndConsistent(workspace);
  });

  it("applies a patch that only modifies a file, leaving history.jsonc alone", async () => {
    const history = await readMockHistory();
    const [target] = history.find((commit) => commit.files.length > 0).files;

    const patch = await patchFromMock(async (tree) => {
      const path = join(tree, target);
      await writeFile(path, `${await readFile(path, "utf8")}\n// patched by the case\n`, "utf8");
    });
    expect(await readFile(patch, "utf8"), "a modifying patch must not touch the history").not.toMatch(
      /history\.jsonc/,
    );

    const { workspace } = materializePatched(patch);

    expect(await readFile(join(workspace, target), "utf8")).toMatch(/patched by the case/);
    await expectCleanAndConsistent(workspace);
    expect(gitLog(workspace).map((entry) => entry.message)).toEqual(
      history.map((commit) => commit.message),
    );
  });

  it("skips a commit the patch emptied, and says which one it dropped", async () => {
    const history = await readMockHistory();
    const emptied = history.find((commit) => commit.files.length === 1);

    const patch = await patchFromMock(async (tree) => {
      await unlink(join(tree, emptied.files[0]));
      await editHistory(tree, (commits) => {
        for (const commit of commits) {
          commit.files = commit.files.filter((file) => file !== emptied.files[0]);
        }
      });
    });

    const { result, workspace } = materializePatched(patch);

    // reported rather than passed over: `git commit` would have aborted the
    // whole materialization, and a silent skip is a history quietly missing a
    // commit nobody asked it to drop.
    expect(result.stderr).toContain(`skips it: ${JSON.stringify(emptied.message)}`);
    expect(gitLog(workspace).map((entry) => entry.message)).toEqual(
      history.filter((commit) => commit !== emptied).map((commit) => commit.message),
    );
    await expectCleanAndConsistent(workspace);
  });

  it("materializes identically twice with the same patch", async () => {
    const patch = await patchFromMock(async (tree) => {
      const path = join(tree, "README.md");
      await writeFile(path, `${await readFile(path, "utf8")}\n<!-- patched -->\n`, "utf8");
    });

    const first = materializePatched(patch);
    const second = materializePatched(patch);

    const [filesA, filesB] = await Promise.all([
      listFiles(first.workspace),
      listFiles(second.workspace),
    ]);
    expect(filesA).toEqual(filesB);
    // hashes, not messages: a patched materialization has to be as reproducible
    // as an unpatched one, or two probes of one case are not comparable.
    expect(gitLog(first.workspace)).toEqual(gitLog(second.workspace));
  });

  it("aborts, applying nothing, when the patch no longer fits the mock", async () => {
    const root = await tempDir();
    const patch = join(root, "rotted.patch");
    await writeFile(
      patch,
      [
        "diff --git a/README.md b/README.md",
        "--- a/README.md",
        "+++ b/README.md",
        "@@ -1,2 +1,2 @@",
        "-a line this mock has never contained",
        " and another",
        "+a replacement",
        "",
      ].join("\n"),
      "utf8",
    );

    const result = runScript(SCRIPTS.setup, ["--patch", patch]);

    expect(result).toExitWith(2);
    expect(result.output).toMatch(/did not apply to the mock, so nothing was applied/);
    expect(result.output, "the failing patch has to be nameable").toContain(patch);
    // no half-built workspace is left behind for a probe to find.
    expect(result.stdout.trim()).toBe("");
  });

  it("fails when a patch changes the file set without maintaining history.jsonc", async () => {
    const history = await readMockHistory();
    const [doomed] = history.find((commit) => commit.files.length > 1).files;

    const patch = await patchFromMock(async (tree) => {
      await unlink(join(tree, doomed));
    });

    const result = runScript(SCRIPTS.setup, ["--patch", patch]);

    expect(result).toExitWith(2);
    expect(result.output).toMatch(/names files tsuzuri does not ship/);
    // the message names the patch, so a rotted patch does not read as a mock
    // somebody broke.
    expect(result.output).toContain(patch);
    expect(result.output).toContain(doomed);
  });

  it("fails clearly when the declared patch is not there at all", () => {
    const result = runScript(SCRIPTS.setup, ["--patch", "no/such/case.patch"]);

    expect(result).toExitWith(2);
    expect(result.output).toMatch(/No patch at .*no\/such\/case\.patch/);
  });
});
