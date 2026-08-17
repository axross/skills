// captureWorkspaceDiff: capturing a probe's whole workspace as one unified
// diff against the commit it started from — new file, staged, committed,
// deleted, and binary all reach the stored patch, whatever a mock's own
// ignore rules do or do not exclude, and whatever the ambient `git`
// configuration says.
//
// driven against real temporary Git repositories rather than asserted on an
// argv, for the reason capture.mjs's own header gives: `git diff` (the old
// capture) looks entirely correct and reports a tracked file's unstaged edit
// alone — an argv-equality test would never catch that, only running `git`
// for real does.

import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it, onTestFinished } from "vitest";

import { captureWorkspaceDiff } from "../../tools/evaluation/src/capture.mjs";

/**
 * runs `git`, isolated the same way capture.mjs's own `runGit` is, plus
 * whatever `extraEnv` a case supplies (e.g. an ambient config to prove the
 * isolation holds against it).
 */
function git(args, cwd, extraEnv = {}) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null",
      ...extraEnv,
    },
  });
  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(" ")} (in ${cwd}) exited ${result.status}:\n${result.stderr || result.stdout}`,
    );
  }
  return result.stdout;
}

/**
 * the literal, unisolated command probe-runner.mjs's pre-fix `workspaceDiff`
 * ran — no `GIT_CONFIG_GLOBAL`/`GIT_CONFIG_SYSTEM` override. kept separate
 * from this file's own `git` helper so the one no-regression assertion below
 * compares against exactly what today's capture produces, not against a
 * command this file happens to isolate the same way the fix does.
 */
function bareGitDiff(cwd) {
  const result = spawnSync("git", ["diff"], { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git diff (in ${cwd}) exited ${result.status}:\n${result.stderr}`);
  }
  return result.stdout;
}

async function write(root, relativePath, content) {
  const full = join(root, relativePath);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, content, "utf8");
}

const COMMIT_ENV = ["-c", "user.name=Capture Test", "-c", "user.email=capture-test@example.invalid"];

function commit(root, message) {
  git(["add", "-A"], root);
  git([...COMMIT_ENV, "-c", "commit.gpgsign=false", "commit", "-q", "-m", message], root);
}

/**
 * plants a workspace shaped like one materialize() (mock-workspace.mjs)
 * hands to a probe: a real repository with one commit, and — unless
 * `gitignoresClaude` is false — a `.gitignore` line keeping `.claude/` out of
 * it, the way every mock this repository ships is checked to do
 * (tests/repository/mock-materialization.test.mjs). Returns the repository
 * root and the commit `captureWorkspaceDiff`'s `baseCommit` is compared
 * against — exactly what probe-runner.mjs reads, via `workspaceCommit`,
 * before a probe runs.
 *
 * @param {{ gitignoresClaude?: boolean, installsSkill?: boolean }} [shape]
 * @returns {Promise<{ root: string, baseCommit: string }>}
 */
async function plantRepo({ gitignoresClaude = true, installsSkill = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), "capture-test-"));
  onTestFinished(() => rm(root, { recursive: true, force: true }));

  git(["init", "-q", "-b", "main"], root);
  if (gitignoresClaude) await write(root, ".gitignore", ".claude\n");
  await write(root, "tracked.txt", "hello\n");
  commit(root, "Initial commit");

  const baseCommit = git(["rev-parse", "HEAD"], root).trim();

  // materialize() installs a condition's skills here and never commits them
  // — planted directly, after the commit above, for the same reason.
  if (installsSkill) {
    await write(root, ".claude/skills/unit-testing/SKILL.md", "# unit testing\n");
  }

  return { root, baseCommit };
}

/** collects what a capture wrote to its warning sink. */
function sink() {
  const lines = [];
  return { warn: (message) => lines.push(message), text: () => lines.join("") };
}

describe("captureWorkspaceDiff", () => {
  it("captures a new file the probe created", async () => {
    const { root, baseCommit } = await plantRepo();
    await write(root, "newfile.txt", "brand new\n");

    const diff = captureWorkspaceDiff(root, { baseCommit, warn: () => {} });

    expect(diff).toContain("newfile.txt");
    expect(diff).toContain("brand new");
  });

  it("captures staged work identically to the same work left unstaged", async () => {
    const unstaged = await plantRepo();
    await write(unstaged.root, "newfile.txt", "brand new\n");
    const unstagedDiff = captureWorkspaceDiff(unstaged.root, {
      baseCommit: unstaged.baseCommit,
      warn: () => {},
    });
    expect(unstagedDiff).toContain("newfile.txt");

    const staged = await plantRepo();
    await write(staged.root, "newfile.txt", "brand new\n");
    git(["add", "-A"], staged.root);
    const stagedDiff = captureWorkspaceDiff(staged.root, {
      baseCommit: staged.baseCommit,
      warn: () => {},
    });
    // asserted on its own, not only via the equality below: under the old,
    // pre-fix capture (a bare `git diff`) this comes back empty too, exactly
    // like the unstaged case above — so an equality check alone would pass
    // vacuously on two equally-broken empty strings.
    expect(stagedDiff).toContain("newfile.txt");

    expect(stagedDiff).toBe(unstagedDiff);
  });

  it("captures work committed on the branch it started on identically to the same work left uncommitted", async () => {
    const uncommitted = await plantRepo();
    await write(uncommitted.root, "newfile.txt", "brand new\n");
    const uncommittedDiff = captureWorkspaceDiff(uncommitted.root, {
      baseCommit: uncommitted.baseCommit,
      warn: () => {},
    });
    expect(uncommittedDiff).toContain("newfile.txt");

    const committed = await plantRepo();
    await write(committed.root, "newfile.txt", "brand new\n");
    commit(committed.root, "Probe work");
    const committedDiff = captureWorkspaceDiff(committed.root, {
      baseCommit: committed.baseCommit,
      warn: () => {},
    });
    // see the staged case's own note: asserted on its own so an equality
    // check cannot pass vacuously on two empty strings.
    expect(committedDiff).toContain("newfile.txt");

    expect(committedDiff).toBe(uncommittedDiff);
  });

  it("captures work committed on a new branch the probe created and stayed on, identically to the same work left uncommitted", async () => {
    const uncommitted = await plantRepo();
    await write(uncommitted.root, "newfile.txt", "brand new\n");
    const uncommittedDiff = captureWorkspaceDiff(uncommitted.root, {
      baseCommit: uncommitted.baseCommit,
      warn: () => {},
    });

    const branched = await plantRepo();
    git(["checkout", "-q", "-b", "fix/enable-sourcemaps"], branched.root);
    await write(branched.root, "newfile.txt", "brand new\n");
    commit(branched.root, "Probe work");
    const branchedDiff = captureWorkspaceDiff(branched.root, {
      baseCommit: branched.baseCommit,
      warn: () => {},
    });
    expect(branchedDiff).toContain("newfile.txt");

    expect(git(["branch", "--show-current"], branched.root).trim()).toBe("fix/enable-sourcemaps");
    expect(branchedDiff).toBe(uncommittedDiff);
  });

  // the one no-regression assertion this file makes: a tracked file edited
  // and left unstaged — the one shape the old, pre-fix capture read
  // correctly — must still come back byte-identical to what that old capture
  // (a bare `git diff`) produces, so the claim is checked rather than stated.
  it("produces a patch byte-identical to a bare `git diff` when a tracked file is edited and left unstaged", async () => {
    const { root, baseCommit } = await plantRepo();
    await write(root, "tracked.txt", "hello world\n");

    const bareDiff = bareGitDiff(root);
    const captured = captureWorkspaceDiff(root, { baseCommit, warn: () => {} });

    expect(captured).toBe(bareDiff);
  });

  it("captures a deleted tracked file", async () => {
    const { root, baseCommit } = await plantRepo();
    await rm(join(root, "tracked.txt"));

    const diff = captureWorkspaceDiff(root, { baseCommit, warn: () => {} });

    expect(diff).toContain("tracked.txt");
    expect(diff).toContain("deleted file mode");
  });

  it("keeps a properly gitignored .claude out of the patch, and warns about nothing", async () => {
    const { root, baseCommit } = await plantRepo({ gitignoresClaude: true, installsSkill: true });
    await write(root, "newfile.txt", "brand new\n");
    const log = sink();

    const diff = captureWorkspaceDiff(root, { baseCommit, warn: log.warn });

    expect(diff).not.toContain(".claude");
    expect(log.text()).toBe("");
  });

  it("keeps .claude out of the patch even when the workspace's ignore rules do not exclude it, and names what it filtered", async () => {
    const { root, baseCommit } = await plantRepo({ gitignoresClaude: false, installsSkill: true });
    await write(root, "newfile.txt", "brand new\n");
    const log = sink();

    const diff = captureWorkspaceDiff(root, { baseCommit, warn: log.warn });

    expect(diff).not.toContain(".claude");
    expect(log.text()).toContain(".claude/skills/unit-testing/SKILL.md");
  });

  // the staged-but-not-committed case above does not reach this: once the
  // probe commits .claude directly, the index and HEAD agree on it, so a
  // staged-path read taken against implicit HEAD (rather than baseCommit)
  // sees nothing to name — the stored patch stays correct either way, since
  // the :(exclude).claude pathspec on the reads below does not depend on this
  // read at all, but the diagnostic goes silent in exactly the combination it
  // exists to catch.
  it("names a .claude path the probe committed directly, even though the index and HEAD already agree on it", async () => {
    const { root, baseCommit } = await plantRepo({ gitignoresClaude: false, installsSkill: true });
    await write(root, "newfile.txt", "brand new\n");
    commit(root, "Probe work, .claude swept in with it");
    const log = sink();

    const diff = captureWorkspaceDiff(root, { baseCommit, warn: log.warn });

    expect(diff).not.toContain(".claude");
    expect(diff).toContain("newfile.txt");
    expect(log.text()).toContain(".claude/skills/unit-testing/SKILL.md");
  });

  it("excludes a binary file from the patch, keeps every text change, names the omission on stderr, and leaves the rest git apply accepts", async () => {
    const { root, baseCommit } = await plantRepo();
    await write(root, "tracked.txt", "hello world\n");
    await writeFile(join(root, "image.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0x02, 0x03]));
    const log = sink();

    const diff = captureWorkspaceDiff(root, { baseCommit, warn: log.warn });

    expect(diff).not.toContain("image.png");
    expect(diff).toContain("tracked.txt");
    expect(diff).toContain("hello world");
    expect(log.text()).toContain("image.png");

    // the property the exclusion exists for: the returned patch is one
    // `git apply` accepts, applied to a fresh checkout of the same base.
    const target = await mkdtemp(join(tmpdir(), "capture-apply-"));
    onTestFinished(async () => {
      git(["worktree", "remove", "--force", target], root);
      await rm(target, { recursive: true, force: true });
    });
    git(["worktree", "add", "-q", "--detach", target, baseCommit], root);
    const applied = spawnSync("git", ["apply", "--whitespace=nowarn"], {
      cwd: target,
      input: diff,
      encoding: "utf8",
    });
    expect(applied.status, applied.stderr).toBe(0);
    expect(await readFile(join(target, "tracked.txt"), "utf8")).toBe("hello world\n");
  });

  it("does not change when the ambient global git configuration sets diff.noprefix", async () => {
    const { root, baseCommit } = await plantRepo();
    await write(root, "tracked.txt", "hello world\n");

    const configDir = await mkdtemp(join(tmpdir(), "capture-ambient-config-"));
    onTestFinished(() => rm(configDir, { recursive: true, force: true }));
    const ambientConfig = join(configDir, "gitconfig");
    await writeFile(ambientConfig, "[diff]\n\tnoprefix = true\n", "utf8");

    const isolated = captureWorkspaceDiff(root, { baseCommit, warn: () => {} });

    // positive control: proves the ambient config really does change `git
    // diff`'s output when nothing isolates it, so the assertion below is
    // checking something the fixture can actually fail.
    const unisolated = spawnSync("git", ["diff"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, GIT_CONFIG_GLOBAL: ambientConfig },
    }).stdout;
    expect(unisolated).not.toBe(isolated);

    const originalGitConfigGlobal = process.env.GIT_CONFIG_GLOBAL;
    process.env.GIT_CONFIG_GLOBAL = ambientConfig;
    try {
      const withAmbientConfigSet = captureWorkspaceDiff(root, { baseCommit, warn: () => {} });
      expect(withAmbientConfigSet).toBe(isolated);
    } finally {
      if (originalGitConfigGlobal === undefined) delete process.env.GIT_CONFIG_GLOBAL;
      else process.env.GIT_CONFIG_GLOBAL = originalGitConfigGlobal;
    }
  });
});
