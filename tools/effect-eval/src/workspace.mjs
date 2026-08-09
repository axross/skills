// workspace.mjs — expands a mock project into an isolated, reproducible Git
// working copy for one probe to run inside. setup.mjs is the entry point that
// drives it.
//
// a mock lives under mocks/<name>/ (e.g. mocks/content-site/) as a
// plain, uncommitted-history file tree, plus a history.jsonc that records the
// commits to replay on top of it. this module does the replaying: it copies
// the mock's files into a fresh temporary directory, turns that directory into
// a real Git repository whose commit-by-commit history matches history.jsonc,
// and installs a chosen subset of this repository's own skills into the
// workspace's .claude/skills/ — which is the condition one probe runs under,
// skill-absent when that subset is empty and skill-present when it is not.
//
// reproducibility is the point, and everything below follows from it. two
// materializations of the same mock and the same skill set must produce
// byte-identical trees and byte-identical commit hashes, so a run can be
// diffed against a rerun rather than trusted on faith. that is why the commit
// author/committer identity and both dates are pinned constants below rather
// than read from the ambient environment or the system clock — a real name, a
// real clock, or a real git config would make every materialization's hashes
// different from the last, and this script's own tests would have nothing
// stable to assert against. GIT_CONFIG_GLOBAL and GIT_CONFIG_SYSTEM are
// pointed at /dev/null for the same reason: an ambient ~/.gitconfig (this
// repository's own included — some environments turn on `commit.gpgsign`
// globally) must not leak into a commit this script makes.
//
// history.jsonc is fixture metadata rather than project content. it is
// excluded from the copy below, so a materialized workspace never contains it
// and nothing in the mock ever needs to import or read it.
//
// skills are installed with `dereference: true`, and that is load-bearing, not
// a detail. the skills CLI installs either real directories or symlinks back
// into the source tree, and a symlinked skill directory in the workspace would
// let a write inside it land straight through into this repository's own
// .claude/skills/ — path containment alone cannot catch that, because
// `resolve()` does not follow links. see scripts/discovery-eval/run.mjs's
// buildWorkspace for the same hazard against the same fix.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const MOCKS_ROOT = join(REPO_ROOT, "mocks");
const INSTALLED_SKILLS_ROOT = join(REPO_ROOT, ".claude", "skills");

const HISTORY_FILE = "history.jsonc";
const DEFAULT_MOCK = "content-site";

// pinned commit identity — see this file's header for why these are
// constants rather than read from the environment.
const AUTHOR_NAME = "Effect Eval Fixture";
const AUTHOR_EMAIL = "effect-eval-fixture@example.invalid";
const COMMITTER_NAME = "Effect Eval Fixture";
const COMMITTER_EMAIL = "effect-eval-fixture@example.invalid";
// one synthetic day per commit from a fixed epoch (2023-11-14T22:13:20Z), so
// `git log` reads as an ordered history rather than one instant repeated, and
// every run derives the same dates from nothing but the commit's own index.
const BASE_DATE_EPOCH_SECONDS = 1_700_000_000;
const SECONDS_PER_COMMIT = 24 * 60 * 60;

async function isDirectory(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function assertDirectory(path, message) {
  if (!(await isDirectory(path))) throw new Error(message);
}

/**
 * strips `//` and `/* *‍/` comments from JSONC text, respecting string
 * literals (including escaped quotes) so a `//` or `/*` inside a string is
 * left alone. this repository has no JSONC-parsing dependency to reach for —
 * .markdownlint-cli2.jsonc is read only by tools that ship their own parser —
 * so history.jsonc's comments are stripped by hand rather than adding one.
 *
 * @param {string} text
 * @returns {string} JSON text, safe to pass to `JSON.parse`
 */
function stripJsonComments(text) {
  let result = "";
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (inLineComment) {
      if (ch === "\n") {
        inLineComment = false;
        result += ch;
      }
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }
    if (inString) {
      result += ch;
      if (ch === "\\") {
        result += next ?? "";
        i += 1;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      result += ch;
    } else if (ch === "/" && next === "/") {
      inLineComment = true;
      i += 1;
    } else if (ch === "/" && next === "*") {
      inBlockComment = true;
      i += 1;
    } else {
      result += ch;
    }
  }
  return result;
}

/**
 * parses and validates history.jsonc's `{ commits: [{ message, files }] }`
 * shape.
 *
 * @param {string} raw
 * @returns {Array<{ message: string, files: string[] }>}
 * @throws {Error} when `raw` is not valid JSON once its comments are stripped,
 *   when it is not an object with a `commits` array, or when any commit lacks a
 *   non-empty message or a non-empty `files` array of paths
 */
function parseHistory(raw) {
  let data;
  try {
    data = JSON.parse(stripJsonComments(raw));
  } catch (error) {
    throw new Error(
      `${HISTORY_FILE} is not valid JSON once its comments are stripped: ${error.message}`,
    );
  }
  if (data === null || typeof data !== "object" || !Array.isArray(data.commits)) {
    throw new Error(`${HISTORY_FILE} must be an object with a "commits" array.`);
  }
  return data.commits.map((commit, index) => {
    if (typeof commit?.message !== "string" || commit.message.length === 0) {
      throw new Error(`${HISTORY_FILE} commits[${index}] needs a non-empty "message".`);
    }
    if (
      !Array.isArray(commit.files) ||
      commit.files.length === 0 ||
      !commit.files.every((file) => typeof file === "string" && file.length > 0)
    ) {
      throw new Error(
        `${HISTORY_FILE} commits[${index}] needs a non-empty "files" array of paths.`,
      );
    }
    return { message: commit.message, files: commit.files };
  });
}

/** every file under `root`, as POSIX-style paths relative to `root`. skips `.git`. */
async function listFilesRecursively(root, base = root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === ".git") continue;
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursively(full, base)));
    } else if (entry.isFile()) {
      files.push(relative(base, full).split(sep).join("/"));
    }
  }
  return files;
}

/**
 * runs `git`, isolated from the ambient user/system config, and returns stdout.
 *
 * @throws {Error} when `git` cannot be spawned, or when it exits non-zero
 */
function runGit(args, cwd, extraEnv = {}) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      // isolates this call from the calling machine's global/system git
      // config (this repository's own included) — see this file's header.
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null",
      ...extraEnv,
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

/**
 * prepares the materialized workspace's dependencies: the mock's pinned npm
 * tree, and — for a mock that drives one — the browser npm does not carry.
 *
 * the harness does this rather than the model. every probe run before #264
 * spent three to five of its twelve to fifteen turns discovering `node_modules`
 * was absent, running `npm install`, and re-running the tests. that is the
 * harness's own setup showing up inside the measurement: it costs turns and
 * money in both conditions, it puts a network-dependent step in every probe,
 * and it let each run resolve its own dependency versions. a real developer
 * opens a repository whose dependencies are already installed.
 *
 * it is opt-in, and that is deliberate. materialize.test.mjs materializes this
 * mock repeatedly and must stay hermetic and fast, so the default path touches
 * no network at all. the evaluation driver asks for the install explicitly.
 *
 * a failure here fails the materialization rather than warning. handing back a
 * half-prepared workspace would let a probe start against it and spend real
 * money measuring the install rather than the skill, which is the whole defect
 * this exists to remove.
 *
 * `npm ci` rather than `npm install`: it installs exactly what the lockfile
 * pins and fails if the lockfile and `package.json` disagree, which is the
 * property the pin is for. `node_modules` is in the mock's own `.gitignore`,
 * so the workspace's Git tree stays clean and the capture never sees any of it.
 *
 * @throws {Error} when `npm` is absent from PATH, or when `npm ci` exits
 *   non-zero — either way the workspace's dependencies are not installed, and a
 *   half-prepared workspace would let a probe measure the setup rather than the
 *   skill
 */
function installDependencies(workspace) {
  const result = spawnSync("npm", ["ci", "--no-audit", "--no-fund"], {
    cwd: workspace,
    encoding: "utf8",
  });
  if (result.error) {
    if (result.error.code === "ENOENT") {
      throw new Error("npm is not on PATH, so --install cannot prepare the workspace.");
    }
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `npm ci (in ${workspace}) exited ${result.status}; the workspace is not ` +
        `usable for a probe:\n${result.stderr || result.stdout}`,
    );
  }
  installBrowsersIfNeeded(workspace);
}

/**
 * whether the materialized workspace drives a browser, read from the
 * package.json `npm ci` just installed from.
 *
 * by declaration rather than by mock name: a second mock that adds an
 * end-to-end suite gets the browser without this file learning its name, and a
 * mock that has none pays nothing.
 *
 * exported so a test can hold the coupling this reads across: a mock whose
 * end-to-end command needs a browser, paired with a harness that provisions
 * one. break either half and the command fails only where nothing is watching
 * — inside a paid probe — so the pairing is asserted offline instead.
 *
 * @param {string} workspace
 * @returns {boolean}
 */
export function declaresPlaywright(workspace) {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(workspace, "package.json"), "utf8"));
  } catch {
    // a mock with no readable package.json cannot have declared anything, and
    // `npm ci` above would already have failed on it.
    return false;
  }
  return Object.hasOwn(
    { ...manifest.dependencies, ...manifest.devDependencies },
    "@playwright/test",
  );
}

/**
 * downloads the browser a workspace's end-to-end command needs.
 *
 * this is the harness's job for the same reason `npm ci` above is, applied to
 * the one dependency npm does not carry: Playwright ships its browsers out of
 * band, so a workspace prepared by `npm ci` alone has `@playwright/test` and no
 * browser to run it with, and the end-to-end command fails with
 * `browserType.launch: Executable doesn't exist`. left to the probe, that is a
 * several-hundred-megabyte download inside the measured turns — the defect
 * `--install` exists to remove — and one a model would pay in both conditions.
 *
 * the download lands in Playwright's own shared cache rather than in the
 * workspace, so it is paid once per machine and not once per probe. that is
 * also why nothing here cleans it up: the next workspace wants it.
 *
 * only chromium is fetched, deliberately. `playwright install` with no browser
 * named fetches the full set, which is several times the cost for browsers no
 * mock here drives. a mock whose config declares another browser needs this
 * widened along with it; that is a visible edit rather than a silent shortfall,
 * because the run then fails naming the browser it could not launch.
 *
 * `--with-deps` is left off: it shells out to the system package manager and
 * needs root, which a materialization has no business assuming. a host missing
 * the shared libraries reports that when a probe launches the browser.
 *
 * @param {string} workspace
 * @throws {Error} when `npx` is absent from PATH, or when the download exits
 *   non-zero — either way the workspace's end-to-end command cannot run, and a
 *   half-prepared workspace would let a probe measure the setup rather than the
 *   skill
 */
function installBrowsersIfNeeded(workspace) {
  if (!declaresPlaywright(workspace)) return;

  const result = spawnSync("npx", ["playwright", "install", "chromium"], {
    cwd: workspace,
    encoding: "utf8",
  });
  if (result.error) {
    if (result.error.code === "ENOENT") {
      throw new Error("npx is not on PATH, so --install cannot provision a browser.");
    }
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `playwright install chromium (in ${workspace}) exited ${result.status}; the ` +
        `workspace's end-to-end command could not run:\n${result.stderr || result.stdout}`,
    );
  }
}

/** the pinned author/committer env for the commit at `index`. */
function commitEnv(index) {
  const date = `@${BASE_DATE_EPOCH_SECONDS + index * SECONDS_PER_COMMIT} +0000`;
  return {
    GIT_AUTHOR_NAME: AUTHOR_NAME,
    GIT_AUTHOR_EMAIL: AUTHOR_EMAIL,
    GIT_AUTHOR_DATE: date,
    GIT_COMMITTER_NAME: COMMITTER_NAME,
    GIT_COMMITTER_EMAIL: COMMITTER_EMAIL,
    GIT_COMMITTER_DATE: date,
  };
}

/**
 * expands `mocks/<mock>` into a fresh temporary directory: every file the
 * mock ships except history.jsonc, replayed as a real Git history that
 * matches history.jsonc commit for commit, plus the requested skills copied
 * (as real files — see this file's header) into `.claude/skills/`.
 *
 * @param {{ mock?: string, skills?: string[] }} [options]
 * @returns {Promise<string>} the materialized workspace's absolute path
 * @throws {Error} when the mock directory, its history.jsonc, or a named
 *   installed skill is missing, when history.jsonc is invalid, when it and the
 *   copied tree do not name exactly the same files, or when replaying it leaves
 *   the workspace dirty — and, under `install`, whatever the dependency install
 *   throws. the temporary workspace is removed before any of these propagate,
 *   so a failed call leaves nothing behind to clean up
 */
export async function materialize({ mock = DEFAULT_MOCK, skills = [], install = false } = {}) {
  const mockDir = join(MOCKS_ROOT, mock);
  await assertDirectory(
    mockDir,
    `No mock named ${JSON.stringify(mock)} — expected a directory at ${mockDir}.`,
  );

  const historyPath = join(mockDir, HISTORY_FILE);
  let historyRaw;
  try {
    historyRaw = await readFile(historyPath, "utf8");
  } catch {
    throw new Error(`${mock} has no ${HISTORY_FILE} at ${historyPath}.`);
  }
  const commits = parseHistory(historyRaw);

  // validated before anything is written to disk, so an unknown skill name
  // fails fast rather than leaking a half-built temporary workspace.
  const skillSources = skills.map((name) => join(INSTALLED_SKILLS_ROOT, name));
  for (const [index, source] of skillSources.entries()) {
    await assertDirectory(
      source,
      `No installed skill named ${JSON.stringify(skills[index])} at ${source}.`,
    );
  }

  const workspace = await mkdtemp(join(tmpdir(), "effect-eval-"));
  try {
    // every file the mock ships, except its own fixture metadata
    // (history.jsonc) and a defensive exclusion of node_modules, in case the
    // mock was exercised locally (as this repository's own README's "own
    // toolchain" verification does) without cleaning up afterward.
    await cp(mockDir, workspace, {
      recursive: true,
      filter: (source) => {
        const name = basename(source);
        return name !== HISTORY_FILE && name !== "node_modules";
      },
    });

    // history.jsonc and the copied tree must name exactly the same files, or
    // either replaying it would leave files uncommitted, or it would try to
    // `git add` something that was never copied.
    const treeFiles = new Set(await listFilesRecursively(workspace));
    const historyFiles = new Set(commits.flatMap((commit) => commit.files));

    const namedButMissing = [...historyFiles].filter((file) => !treeFiles.has(file));
    if (namedButMissing.length > 0) {
      throw new Error(
        `${HISTORY_FILE} names files ${mock} does not ship: ${namedButMissing.join(", ")}`,
      );
    }
    const shippedButUnnamed = [...treeFiles].filter((file) => !historyFiles.has(file));
    if (shippedButUnnamed.length > 0) {
      throw new Error(
        `${mock} ships files no commit in ${HISTORY_FILE} names, so they would be left ` +
          `uncommitted: ${shippedButUnnamed.join(", ")}`,
      );
    }

    runGit(["init", "--quiet", "-b", "main"], workspace);
    commits.forEach((commit, index) => {
      runGit(["add", "--", ...commit.files], workspace, commitEnv(index));
      runGit(
        ["-c", "commit.gpgsign=false", "commit", "--quiet", "-m", commit.message],
        workspace,
        commitEnv(index),
      );
    });

    const leftover = runGit(["status", "--porcelain"], workspace);
    if (leftover.trim().length > 0) {
      throw new Error(
        `Replaying ${HISTORY_FILE} left uncommitted changes in the workspace:\n${leftover}`,
      );
    }

    for (const [index, name] of skills.entries()) {
      const destination = join(workspace, ".claude", "skills", name);
      await mkdir(dirname(destination), { recursive: true });
      // dereference: true is load-bearing — see this file's header.
      await cp(skillSources[index], destination, { recursive: true, dereference: true });
    }

    // last, so the history replay above saw exactly the files the mock ships
    // and the bijection check was unaffected by anything this writes.
    if (install) installDependencies(workspace);

    return workspace;
  } catch (error) {
    await rm(workspace, { recursive: true, force: true });
    throw error;
  }
}
