// tools/effect-eval/src/capture.mjs, driven against real temporary Git
// repositories.
//
// why real Git rather than an argv assertion. spawn.mjs is tested by checking
// the argv it builds, because there the argv is the whole claim. here it is
// not: the defect this module was extracted to fix was `git add -A -- .
// ':(exclude).claude'` exiting 1, and that argv looks entirely correct. an
// argv-equality test passes just as happily on the broken form, so these
// cases plant a repository and run `git` against it.
//
// the three shapes here are the three the instrument actually meets. a
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
 * repository with one commit, then the model's own uncommitted work on top.
 *
 * @param {{ gitignoresClaude: boolean, installsSkill: boolean }} shape
 */
async function plantWorkspace({ gitignoresClaude, installsSkill }) {
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

  // the model's work: one new test file outside the installed-skills directory.
  await write(root, "shared/resolve.test.ts", 'it("resolves", () => {});\n');

  // materialize.mjs installs the condition's skills here and never commits them.
  if (installsSkill) {
    await write(root, ".claude/skills/unit-testing/SKILL.md", "# unit-testing\n");
    await write(root, ".claude/skills/unit-testing/references/naming.md", "# naming\n");
  }

  return root;
}

/** collects what the capture wrote to its warning sink. */
function sink() {
  const messages = [];
  return { warn: (message) => messages.push(message), text: () => messages.join("") };
}

describe("captureDiff", () => {
  it("captures the model's file on a well-formed skill-present workspace", async () => {
    const root = await plantWorkspace({ gitignoresClaude: true, installsSkill: true });
    const log = sink();

    const { diff, changedPaths, filtered } = captureDiff(root, { warn: log.warn });

    expect(changedPaths.map(({ path }) => path)).toEqual(["shared/resolve.test.ts"]);
    expect(diff).toContain("shared/resolve.test.ts");
    expect(diff).not.toContain(".claude");
    expect(filtered).toEqual([]);
  });

  it("captures the same result when the mock has lost its .gitignore line, and names what it filtered", async () => {
    const root = await plantWorkspace({ gitignoresClaude: false, installsSkill: true });
    const log = sink();

    const { diff, changedPaths, filtered } = captureDiff(root, { warn: log.warn });

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
    const root = await plantWorkspace({ gitignoresClaude: true, installsSkill: false });
    const log = sink();

    const { diff, changedPaths, filtered } = captureDiff(root, { warn: log.warn });

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
      const root = await plantWorkspace(shape);
      const log = sink();
      captureDiff(root, { warn: log.warn });
      expect(log.text()).toMatch(/capture: \d+ path\(s\) captured, \d+ filtered/);
    }
  });

  it("leaves the installed skill on disk — filtering is about the capture, not the workspace", async () => {
    const root = await plantWorkspace({ gitignoresClaude: false, installsSkill: true });
    captureDiff(root, { warn: () => {} });

    const status = git(["status", "--porcelain"], root);
    expect(status).toContain(".claude/");
  });
});

describe("readChangedTestFiles", () => {
  it("reads a changed test file and skips a deleted one", async () => {
    const root = await plantWorkspace({ gitignoresClaude: true, installsSkill: false });
    const { changedPaths } = captureDiff(root, { warn: () => {} });

    const files = await readChangedTestFiles(
      root,
      [...changedPaths, { status: " D", path: "shared/gone.test.ts" }],
      { warn: () => {} },
    );

    expect(files.map(({ path }) => path)).toEqual(["shared/resolve.test.ts"]);
    expect(files[0].content).toContain("resolves");
  });

  it("drops an unreadable file with a note rather than throwing", async () => {
    const root = await plantWorkspace({ gitignoresClaude: true, installsSkill: false });
    const log = sink();

    const files = await readChangedTestFiles(
      root,
      [{ status: "??", path: "shared/never-written.test.ts" }],
      { warn: log.warn },
    );

    expect(files).toEqual([]);
    expect(log.text()).toMatch(/could not be read/);
  });
});
