// tools/effect-eval/src/capture.mjs, driven against real temporary Git
// repositories.
//
// why real Git rather than an argv assertion. spawn.mjs is tested by checking
// the argv it builds, because there the argv is the whole claim. here it is
// not: the defect this module was extracted to fix was `git add -A -- .
// ':(exclude).claude'` exiting 1, and that argv looks entirely correct. an
// argv-equality test passes just as happily on the broken form, so these
// cases plant a repository and run `git` against it. the same is true of the
// HEAD-relative capture defect this file now also covers: `git diff --cached`
// is a perfectly ordinary argv, and only running it against a repository
// whose HEAD a "probe" has moved shows that it reads a committing probe as
// having changed nothing.
//
// the three shapes in plantRepo are the three the instrument actually meets. a
// skill-present workspace on a well-formed mock, where the mock's own
// `.gitignore` keeps the installed skill unstaged; the same workspace on a mock
// that has lost that line, which is the case the second layer exists for; and a
// skill-absent workspace with no `.claude` at all, which must take the
// identical code path. the first and third are the two conditions of every real
// comparison, and the original defect struck exactly one of them.

import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it, onTestFinished } from "vitest";

import { captureDiff, readChangedTestFiles } from "../../tools/effect-eval/src/capture.mjs";

function git(args, cwd) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

async function write(root, relative, content) {
  await mkdir(dirname(join(root, relative)), { recursive: true });
  await writeFile(join(root, relative), content, "utf8");
}

/**
 * plants a workspace shaped like one materialize.mjs hands to a probe: a real
 * repository with one commit, then — separately, via {@link writeModelWork} —
 * whatever the probe itself goes on to do. splitting the two is what lets a
 * test choose how the probe left its work: uncommitted, committed on the
 * branch it started on, or committed on a new branch it created and stayed
 * on. `baseCommit` is the HEAD this returns right after the one commit, i.e.
 * exactly what `evaluate.mjs` reads before spawning a probe — the basis
 * `captureDiff` now compares against instead of whatever HEAD happens to be
 * when the probe finishes.
 *
 * @param {{ gitignoresClaude: boolean, installsSkill: boolean }} shape
 * @returns {Promise<{ root: string, baseCommit: string }>}
 */
async function plantRepo({ gitignoresClaude, installsSkill }) {
  const root = await mkdtemp(join(tmpdir(), "capture-test-"));
  onTestFinished(async () => {
    await rm(root, { recursive: true, force: true });
  });

  git(["init", "-q", "-b", "main"], root);
  git(["config", "user.email", "test@example.invalid"], root);
  git(["config", "user.name", "Capture Test"], root);

  if (gitignoresClaude) await write(root, ".gitignore", ".claude\nnode_modules\n");
  await write(root, "shared/resolve.ts", "export const resolve = () => null;\n");
  git(["add", "-A"], root);
  git(["commit", "-q", "-m", "Initial commit"], root);

  const baseCommit = git(["rev-parse", "HEAD"], root).trim();

  // materialize.mjs installs the condition's skills here and never commits them.
  if (installsSkill) {
    await write(root, ".claude/skills/unit-testing/SKILL.md", "# unit-testing\n");
    await write(root, ".claude/skills/unit-testing/references/naming.md", "# naming\n");
  }

  return { root, baseCommit };
}

/**
 * the model's work: one new test file outside the installed-skills directory,
 * named for the path it writes to.
 *
 * `commit` says how the probe left it: `false` (the default) leaves it
 * uncommitted, exactly like every probe that never touches Git itself.
 * `"current"` commits it on the branch the workspace started on — a probe
 * that ran `git commit` without first branching. any other string creates and
 * checks out a branch of that name before committing — a probe that ran `git
 * checkout -b` and stayed there, which is what `skill-present-632e2800`
 * (`data/effect-eval/README.md`) actually did.
 *
 * @param {string} root
 * @param {{ path?: string, content?: string, commit?: false | "current" | string }} [options]
 */
async function writeModelWork(
  root,
  { path = "shared/resolve.test.ts", content = 'it("resolves", () => {});\n', commit = false } = {},
) {
  await write(root, path, content);
  if (commit === false) return;
  if (commit !== "current") git(["checkout", "-q", "-b", commit], root);
  git(["add", "-A", "--", path], root);
  git(["commit", "-q", "-m", `Add ${path}`], root);
}

/** collects what the capture wrote to its warning sink. */
function sink() {
  const messages = [];
  return { warn: (message) => messages.push(message), text: () => messages.join("") };
}

describe("captureDiff", () => {
  it("captures the model's file on a well-formed skill-present workspace", async () => {
    const { root, baseCommit } = await plantRepo({ gitignoresClaude: true, installsSkill: true });
    await writeModelWork(root);
    const log = sink();

    const { diff, changedPaths, filtered } = captureDiff(root, {
      baseCommit,
      warn: log.warn,
    });

    expect(changedPaths.map(({ path }) => path)).toEqual(["shared/resolve.test.ts"]);
    expect(diff).toContain("shared/resolve.test.ts");
    expect(diff).not.toContain(".claude");
    expect(filtered).toEqual([]);
  });

  it("captures the same result when the mock has lost its .gitignore line, and names what it filtered", async () => {
    const { root, baseCommit } = await plantRepo({
      gitignoresClaude: false,
      installsSkill: true,
    });
    await writeModelWork(root);
    const log = sink();

    const { diff, changedPaths, filtered } = captureDiff(root, {
      baseCommit,
      warn: log.warn,
    });

    expect(changedPaths.map(({ path }) => path)).toEqual(["shared/resolve.test.ts"]);
    expect(diff).toContain("shared/resolve.test.ts");
    expect(diff).not.toContain(".claude");

    expect(filtered).toEqual([
      ".claude/skills/unit-testing/SKILL.md",
      ".claude/skills/unit-testing/references/naming.md",
    ]);
    // every filtered path is named, not just counted: a reader has to be able
    // to tell which fixture forgot the line and what it let through.
    for (const path of filtered) expect(log.text()).toContain(path);
    expect(log.text()).toMatch(/warning:/);
  });

  it("takes the identical path on a skill-absent workspace, and warns about nothing", async () => {
    const { root, baseCommit } = await plantRepo({
      gitignoresClaude: true,
      installsSkill: false,
    });
    await writeModelWork(root);
    const log = sink();

    const { diff, changedPaths, filtered } = captureDiff(root, {
      baseCommit,
      warn: log.warn,
    });

    expect(changedPaths.map(({ path }) => path)).toEqual(["shared/resolve.test.ts"]);
    expect(diff).toContain("shared/resolve.test.ts");
    expect(filtered).toEqual([]);
    expect(log.text()).not.toMatch(/warning:/);
  });

  it("summarises every run, whether or not anything was filtered", async () => {
    for (const shape of [
      { gitignoresClaude: true, installsSkill: true },
      { gitignoresClaude: false, installsSkill: true },
      { gitignoresClaude: true, installsSkill: false },
    ]) {
      const { root, baseCommit } = await plantRepo(shape);
      await writeModelWork(root);
      const log = sink();
      captureDiff(root, { baseCommit, warn: log.warn });
      expect(log.text()).toMatch(/capture: \d+ path\(s\) captured, \d+ filtered/);
    }
  });

  it("leaves the installed skill on disk — filtering is about the capture, not the workspace", async () => {
    const { root, baseCommit } = await plantRepo({
      gitignoresClaude: false,
      installsSkill: true,
    });
    await writeModelWork(root);
    captureDiff(root, { baseCommit, warn: () => {} });

    const status = git(["status", "--porcelain"], root);
    expect(status).toContain(".claude/");
  });

  // the defect this file was extended to cover: a probe that commits its own
  // work moves HEAD, and a capture read relative to HEAD then sees nothing
  // between the index and the commit that already contains the work. each of
  // the next three cases is checked against the one basis a probe never
  // controls — the workspace's HEAD before it ran — so a committing probe and
  // a probe that left the identical change uncommitted are captured the same.

  it("captures a probe's work identically whether it left it uncommitted or committed it on the current branch", async () => {
    const uncommitted = await plantRepo({ gitignoresClaude: true, installsSkill: false });
    await writeModelWork(uncommitted.root);
    const uncommittedResult = captureDiff(uncommitted.root, {
      baseCommit: uncommitted.baseCommit,
      warn: () => {},
    });

    const committed = await plantRepo({ gitignoresClaude: true, installsSkill: false });
    await writeModelWork(committed.root, { commit: "current" });
    const committedResult = captureDiff(committed.root, {
      baseCommit: committed.baseCommit,
      warn: () => {},
    });

    expect(committedResult.diff).toBe(uncommittedResult.diff);
    expect(committedResult.changedPaths).toEqual(uncommittedResult.changedPaths);
  });

  it("captures a probe's work identically whether it left it uncommitted or committed it on a new branch it stayed on", async () => {
    const uncommitted = await plantRepo({ gitignoresClaude: true, installsSkill: false });
    await writeModelWork(uncommitted.root);
    const uncommittedResult = captureDiff(uncommitted.root, {
      baseCommit: uncommitted.baseCommit,
      warn: () => {},
    });

    const branched = await plantRepo({ gitignoresClaude: true, installsSkill: false });
    await writeModelWork(branched.root, { commit: "fix/enable-sourcemaps" });
    const branchedResult = captureDiff(branched.root, {
      baseCommit: branched.baseCommit,
      warn: () => {},
    });

    expect(git(["branch", "--show-current"], branched.root).trim()).toBe(
      "fix/enable-sourcemaps",
    );
    expect(branchedResult.diff).toBe(uncommittedResult.diff);
    expect(branchedResult.changedPaths).toEqual(uncommittedResult.changedPaths);
  });

  it("captures a mix of committed and uncommitted work in one probe", async () => {
    const { root, baseCommit } = await plantRepo({
      gitignoresClaude: true,
      installsSkill: false,
    });
    await writeModelWork(root, { path: "shared/resolve.test.ts", commit: "current" });
    await writeModelWork(root, { path: "shared/parse.test.ts", commit: false });

    const { diff, changedPaths } = captureDiff(root, { baseCommit, warn: () => {} });

    expect(changedPaths.map(({ path }) => path).sort()).toEqual([
      "shared/parse.test.ts",
      "shared/resolve.test.ts",
    ]);
    expect(diff).toContain("shared/resolve.test.ts");
    expect(diff).toContain("shared/parse.test.ts");
  });

  it("produces a byte-identical capture for uncommitted work whether or not a base commit is supplied", async () => {
    const { root, baseCommit } = await plantRepo({
      gitignoresClaude: true,
      installsSkill: false,
    });
    await writeModelWork(root);

    // neither call moves HEAD or touches the working tree, only the index —
    // running captureDiff twice against the same uncommitted work is safe and
    // is the whole point: nothing committed means baseCommit equals today's
    // HEAD, so the two reads have to agree byte for byte.
    const headRelative = captureDiff(root, { warn: () => {} });
    const baseRelative = captureDiff(root, { baseCommit, warn: () => {} });

    expect(baseRelative.diff).toBe(headRelative.diff);
    expect(baseRelative.changedPaths).toEqual(headRelative.changedPaths);
  });

  it("falls back to a HEAD-relative capture and warns when no base commit is supplied, without throwing", async () => {
    const { root } = await plantRepo({ gitignoresClaude: true, installsSkill: false });
    await writeModelWork(root, { commit: "current" });
    const log = sink();

    let result;
    expect(() => {
      result = captureDiff(root, { warn: log.warn });
    }).not.toThrow();

    // this is the defect itself, reproduced deliberately rather than fixed
    // away: with no basis, a committing probe still reads as having changed
    // nothing, which is exactly why the fallback has to warn.
    expect(result.changedPaths).toEqual([]);
    expect(result.diff).toBe("");
    expect(log.text()).toMatch(/warning:.*HEAD/i);
  });
});

describe("readChangedTestFiles", () => {
  it("reads a changed test file and skips a deleted one", async () => {
    const { root, baseCommit } = await plantRepo({
      gitignoresClaude: true,
      installsSkill: false,
    });
    await writeModelWork(root);
    const { changedPaths } = captureDiff(root, { baseCommit, warn: () => {} });

    const files = await readChangedTestFiles(
      root,
      [...changedPaths, { status: "D", path: "shared/gone.test.ts" }],
      { warn: () => {} },
    );

    expect(files.map(({ path }) => path)).toEqual(["shared/resolve.test.ts"]);
    expect(files[0].content).toContain("resolves");
  });

  it("drops an unreadable file with a note rather than throwing", async () => {
    const { root } = await plantRepo({ gitignoresClaude: true, installsSkill: false });
    const log = sink();

    const files = await readChangedTestFiles(
      root,
      [{ status: "A", path: "shared/never-written.test.ts" }],
      { warn: log.warn },
    );

    expect(files).toEqual([]);
    expect(log.text()).toMatch(/could not be read/);
  });
});
