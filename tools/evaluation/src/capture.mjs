// capture.mjs — reading what one probe left in its workspace: a single
// unified diff against the commit the probe started from, taken so a probe's
// work is captured whether it left it in the working tree, staged it, or
// committed it.
//
// factored out of probe-runner.mjs so a test can drive it against a real
// temporary Git repository without spawning the CLI. that matters here for
// the same reason it does for mock-workspace.mjs's own git-driving helpers:
// the defect this module exists to fix lives in what `git` does given a
// particular argv, not in the argv's own shape — `git diff` looks entirely
// correct and is wrong, because it reports a tracked file's unstaged edit and
// nothing else. an argv-equality test would pass just as happily on the
// broken form, so this is tested against real Git instead.
//
// switching the capture to a staged read (`git add -A`) introduces or leaves
// standing two hazards this module owns, both handled the same way: warned
// about and filtered out of the stored patch, never allowed to fail the
// capture outright. this runs after the CLI has already been spawned and
// paid for, so a capture problem must cost the diff and nothing else.
//
// - the installed skills under .claude/ are untracked, so the old
//   HEAD-relative `git diff` never saw them; a staged read would, if a mock's
//   own .gitignore ever forgot to exclude them. that failure is asymmetric
//   between the two conditions a probe runs under — a skill-absent workspace
//   has no .claude/ at all — which makes an instrument that mismeasures one
//   arm and not the other worse than no backstop.
// - a binary file renders in a plain diff as `Binary files … differ` unless
//   `--binary` is passed, and `git apply` refuses that form outright. because
//   `git apply` is atomic, one binary file left behind would cost the
//   reconstruction of every text file in the same patch alongside it.

import { spawnSync } from "node:child_process";

/** the directory materialize() (mock-workspace.mjs) installs a condition's skills into. */
const INSTALLED_SKILLS_DIR = ".claude";

/** default sink for a capture warning — overridable so a test can read it. */
const writeStderr = (message) => process.stderr.write(message);

/**
 * runs `git`, isolated from the ambient user/system config — the same
 * isolation mock-workspace.mjs's own `runGit` establishes, and for the same
 * reason: an ambient `~/.gitconfig` (this repository's own included — some
 * environments turn on settings like `diff.noprefix` or `diff.external`
 * globally) must not change the shape of a patch this instrument stores.
 * `git apply` defaults to `-p1` and expects the ordinary `a/`/`b/`
 * prefixing, so a patch shaped by an ambient config would fail to apply
 * later, somewhere the person who set that config is not looking.
 *
 * @throws {Error} when `git` cannot be spawned, or when it exits non-zero
 */
function runGit(args, cwd) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null",
    },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(" ")} (in ${cwd}) exited ${result.status}:\n${result.stderr || result.stdout}`,
    );
  }
  return result.stdout;
}

/** splits `-z`-terminated `git` output into entries, dropping the trailing empty one. */
const splitNul = (output) => output.split("\0").filter((entry) => entry.length > 0);

/** whether a repository-relative path is the installed-skills directory or inside it. */
const isInstalledSkillPath = (path) =>
  path === INSTALLED_SKILLS_DIR || path.startsWith(`${INSTALLED_SKILLS_DIR}/`);

/**
 * parses `git diff --numstat -z` output into `{ added, deleted, path }`
 * entries. `added`/`deleted` are the literal string `"-"` for a binary path
 * rather than a number — `git`'s own way of telling a binary change apart
 * from a text one, including a text change that happens to add and remove
 * the same number of lines.
 *
 * @param {string} output
 * @returns {Array<{ added: string, deleted: string, path: string }>}
 */
function parseNumstat(output) {
  return splitNul(output).map((entry) => {
    const firstTab = entry.indexOf("\t");
    const secondTab = entry.indexOf("\t", firstTab + 1);
    return {
      added: entry.slice(0, firstTab),
      deleted: entry.slice(firstTab + 1, secondTab),
      path: entry.slice(secondTab + 1),
    };
  });
}

/**
 * captures a probe's whole workspace as one unified diff against
 * `baseCommit` — the workspace's own HEAD as read before the probe ran, so
 * the result does not depend on whatever the probe went on to do to HEAD
 * itself.
 *
 * stages everything the mock's own ignore rules permit (`git add -A -- .`),
 * so a file the probe created reaches the diff exactly as a tracked file's
 * edit does, and reads the patch back as `git diff --cached` against
 * `baseCommit` — content compared against content, not ref against ref, so a
 * probe that committed the same work (on the branch it started on, or on one
 * it created and stayed on) is captured identically to one that left it
 * uncommitted.
 *
 * `baseCommit` is required, not optional. Its one caller (probe-runner.mjs)
 * reads it from `workspaceCommit`, which throws rather than returning null,
 * and reads it before the CLI is spawned — so a workspace with no readable
 * HEAD fails before any money is spent, and a missing-basis fallback branch
 * here would be unreachable code carrying a warning nobody could trigger.
 *
 * two hazards a staged read introduces or leaves standing are handled here —
 * see this module's header — rather than left for the stored patch or
 * `git apply` to fail on later. neither ever throws: both are warned about
 * and excluded from the patch, since this runs after the CLI has already
 * been paid for.
 *
 * - **installed skills.** the staged set under `.claude/` is read before it
 *   is unstaged, so a run whose mock forgot to `.gitignore` it can name every
 *   path that slipped through on stderr. the unstage (`git reset -q --
 *   .claude`) then drops it from the index, and every read below still
 *   carries an `:(exclude).claude` pathspec so the exclusion holds even if
 *   the unstage were ever removed — including a path already on `HEAD`
 *   because the probe committed it there itself, which the unstage alone
 *   cannot reach.
 * - **binary files.** `git diff --cached --numstat` marks a binary path with
 *   `-` for both its added and deleted counts. every such path is excluded
 *   from the patch with an added `:(exclude,literal)` pathspec and named in
 *   its own warning, so the returned diff stays text-only and always
 *   applies. `--no-renames` is passed to both this scan and the patch read,
 *   so a rename cannot render as a `similarity index` hunk in the patch that
 *   the scan — read without that flag — never saw: the two stay on one basis,
 *   at the cost of a rename reading as a delete plus an add.
 *
 * @param {string} workspace
 * @param {{ baseCommit: string, warn?: (message: string) => void }} options
 * @returns {string} a unified diff, always text — a binary path the probe
 *   left behind is omitted from it and named on stderr rather than included
 * @throws {Error} when `git` cannot be spawned, or exits non-zero for a
 *   reason this function does not itself handle
 */
export function captureWorkspaceDiff(workspace, { baseCommit, warn = writeStderr }) {
  runGit(["add", "-A", "--", "."], workspace);

  // read against baseCommit, and before the unstage, so the warning below can
  // name what the mock's own ignore rules let through — including a path the
  // probe already committed to HEAD itself, where the index and an
  // implicit-HEAD read would agree and see nothing to name. after the reset
  // there is nothing staged left to name.
  const stagedPaths = splitNul(
    runGit(["diff", "--cached", "--name-only", "-z", baseCommit], workspace),
  );
  const claudePaths = stagedPaths.filter(isInstalledSkillPath);
  runGit(["reset", "-q", "--", INSTALLED_SKILLS_DIR], workspace);

  if (claudePaths.length > 0) {
    warn(
      `warning: ${claudePaths.length} path(s) under ${INSTALLED_SKILLS_DIR}/ were staged and ` +
        "have been filtered out of this run's capture. The mock's own .gitignore should have " +
        "kept them unstaged; that it did not means the fixture is missing that line, and every " +
        "condition that installs a skill will look as though the model wrote it:\n" +
        claudePaths.map((path) => `  ${path}\n`).join(""),
    );
  }

  const excludeClaude = `:(exclude)${INSTALLED_SKILLS_DIR}`;
  const outsideClaude = ["--", ".", excludeClaude];

  const binaryPaths = parseNumstat(
    runGit(
      ["diff", "--cached", "--numstat", "-z", "--no-renames", baseCommit, ...outsideClaude],
      workspace,
    ),
  )
    .filter(({ added, deleted }) => added === "-" && deleted === "-")
    .map(({ path }) => path);

  if (binaryPaths.length > 0) {
    warn(
      `warning: ${binaryPaths.length} binary path(s) were left out of this run's capture — a ` +
        "unified diff cannot represent one without --binary, and git apply refuses that form " +
        "outright, which would otherwise cost the reconstruction of every other file in the " +
        "same patch too:\n" + binaryPaths.map((path) => `  ${path}\n`).join(""),
    );
  }

  const binaryExcludes = binaryPaths.map((path) => `:(exclude,literal)${path}`);
  return runGit(
    ["diff", "--cached", "--no-color", "--no-renames", baseCommit, ...outsideClaude, ...binaryExcludes],
    workspace,
  );
}
