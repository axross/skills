// capture.mjs — reading what one probe left in its workspace: the diff, the
// changed paths, and the changed test files. Factored out of probe.mjs so a
// test can drive it against a real temporary Git repository without spawning
// the CLI, which is the same reason spawn.mjs exists.
//
// WHY THIS IS TESTED AGAINST REAL GIT RATHER THAN BY ASSERTING ON ARGV. The
// defect this module was extracted to fix lived in `git`'s BEHAVIOUR given a
// particular argv, not in the argv's shape: `git add -A -- . ':(exclude).claude'`
// looks correct and exits 1, because `git add` refuses a pathspec that
// explicitly names an ignored path. An argv-equality test passes just as
// happily on the broken form. So these functions run `git`.
//
// TWO LAYERS KEEP THE INSTALLED SKILL OUT OF THE MEASUREMENT, AND ONLY ONE OF
// THEM IS HERE. A mock's own `.gitignore` lists `.claude`, so on a well-formed
// fixture Git never stages the skill in the first place. This module is the
// second layer, for the mock whose author forgot that line: it refuses to
// report anything under `.claude` whatever the fixture says.
//
// The layers interfered. The original second layer excluded `.claude` by
// pathspec on the `add`, which is fatal precisely when the first layer is
// doing its job — so it broke on every well-formed mock, and only in the
// skill-present condition, since a skill-absent workspace has no `.claude` at
// all. An instrument that fails asymmetrically between the conditions it
// exists to compare is worse than no backstop.
//
// SO THIS FILTERS AND WARNS; IT NEVER FAILS. Filtering silently would leave no
// evidence anyone ever sees, which is the invisibility the second layer exists
// to prevent. Failing would re-create the original defect — a fatal error
// after the CLI has been spawned and paid for. Every run gets a summary; a run
// that actually had something to filter gets each path named.

import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { isTestFilePath } from "./artifact.mjs";

/** The directory materialize.mjs installs a condition's skills into. */
const INSTALLED_SKILLS_DIR = ".claude";

/** Default sink for the summary and the warning — overridable so a test can read them. */
const writeStderr = (message) => process.stderr.write(message);

/** Runs `git` in `cwd` and returns stdout, throwing on a non-zero exit. */
export function runGitCapture(args, cwd) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(" ")} (in ${cwd}) exited ${result.status}:\n${result.stderr || result.stdout}`,
    );
  }
  return result.stdout;
}

/** Splits `-z` output into entries, dropping the trailing empty one. */
const splitNul = (output) => output.split("\0").filter((entry) => entry.length > 0);

/** Whether a repository-relative path is the installed-skills directory or inside it. */
const isInstalledSkillPath = (path) =>
  path === INSTALLED_SKILLS_DIR || path.startsWith(`${INSTALLED_SKILLS_DIR}/`);

/**
 * Stages everything so a newly added file appears in the diff too, unstages
 * the installed skills, then reads back the full diff and the changed paths.
 *
 * The `add` names no ignored path, which is the whole correction: it stages
 * whatever the mock's own ignore rules permit, and the explicit `reset`
 * afterwards removes the installed skills if they got through. `reset` on an
 * absent path is a no-op that exits 0, so the skill-absent condition needs no
 * separate branch and takes the identical code path.
 *
 * The diff and status reads keep their `:(exclude)` pathspec: unlike `add`,
 * neither consults the ignore rules that way, so neither fails on it, and
 * keeping it makes the exclusion true of the reads even if the `reset` above
 * were ever removed.
 *
 * `--no-renames` keeps every status entry to the single "XY<space>path" shape
 * parsed below — a rename would otherwise emit an "old\0new\0" pair the fixed
 * 3-character prefix strip does not expect. That flag is also why the status
 * code is kept rather than stripped away: it turns a rename into a delete plus
 * an add, so a run that renames a test file yields an entry whose path is no
 * longer on disk, and readChangedTestFiles has to be able to see that.
 *
 * @param {string} workspace
 * @param {{ warn?: (message: string) => void }} [options]
 * @returns {{ diff: string, changedPaths: Array<{ status: string, path: string }>, staged: number, filtered: string[] }}
 */
export function captureDiff(workspace, { warn = writeStderr } = {}) {
  runGitCapture(["add", "-A", "--", "."], workspace);

  // Read the staged set BEFORE unstaging, because the point of the warning is
  // to name what the first layer let through. After the reset there is nothing
  // left to name.
  const stagedPaths = splitNul(
    runGitCapture(["diff", "--cached", "--name-only", "-z"], workspace),
  );
  const filtered = stagedPaths.filter(isInstalledSkillPath);

  runGitCapture(["reset", "-q", "--", INSTALLED_SKILLS_DIR], workspace);

  const outsideSkills = ["--", ".", `:(exclude)${INSTALLED_SKILLS_DIR}`];
  const diff = runGitCapture(
    ["diff", "--cached", "--no-color", ...outsideSkills],
    workspace,
  );
  const changedPaths = splitNul(
    runGitCapture(
      ["status", "--porcelain", "-z", "--no-renames", ...outsideSkills],
      workspace,
    ),
  ).map((entry) => ({ status: entry.slice(0, 2), path: entry.slice(3) }));

  const kept = stagedPaths.length - filtered.length;
  warn(`capture: ${kept} path(s) captured, ${filtered.length} filtered\n`);

  if (filtered.length > 0) {
    warn(
      `warning: ${filtered.length} path(s) under ${INSTALLED_SKILLS_DIR}/ were staged and have been ` +
        "filtered out of this run's capture. The mock's own .gitignore should have kept them " +
        "unstaged; that it did not means the fixture is missing that line, and every condition " +
        "that installs a skill will look as though the model wrote it:\n" +
        filtered.map((path) => `  ${path}\n`).join(""),
    );
  }

  return { diff, changedPaths, staged: kept, filtered };
}

/**
 * Reads every changed path that looks like a test file, straight off the
 * workspace's working tree rather than by reconstructing it from the diff —
 * simpler and exact, since the file already exists on disk after the run.
 *
 * Two things it must never do, both for the same reason: this runs AFTER the
 * CLI has been spawned and paid for, so anything that throws here destroys a
 * probe the budget has already been charged for. So a deleted path is skipped
 * rather than read — `--no-renames` makes a rename look like one, and a model
 * asked to add tests may well tidy the existing spec file while it is there —
 * and a read that fails anyway is dropped with a note rather than allowed to
 * propagate.
 *
 * @param {string} workspace
 * @param {Array<{ status: string, path: string }>} changedPaths
 * @param {{ warn?: (message: string) => void }} [options]
 * @returns {Promise<Array<{ path: string, content: string }>>}
 */
export async function readChangedTestFiles(
  workspace,
  changedPaths,
  { warn = writeStderr } = {},
) {
  const testPaths = changedPaths
    .filter(({ status }) => !status.includes("D"))
    .map(({ path }) => path)
    .filter((path) => isTestFilePath(path));
  const read = await Promise.all(
    testPaths.map(async (path) => {
      try {
        return { path, content: await readFile(join(workspace, path), "utf8") };
      } catch (error) {
        warn(
          `warning: changed test file ${path} could not be read (${error.code ?? error.message}); ` +
            "it is dropped from the artifact extraction, and the run is still recorded\n",
        );
        return null;
      }
    }),
  );
  return read.filter((entry) => entry !== null);
}
