#!/usr/bin/env node
// materialize.mjs — expands a value-eval mock project into an isolated,
// reproducible Git working copy, and prints its path.
//
// A mock lives under mocks/<name>/ (e.g. mocks/content-site/) as a
// plain, uncommitted-history file tree, plus a history.jsonc that records the
// commits to replay on top of it. This script does the replaying: it copies
// the mock's files into a fresh temporary directory, turns that directory into
// a real Git repository whose commit-by-commit history matches history.jsonc,
// and optionally installs a chosen subset of this repository's OWN skills into
// the workspace's .claude/skills/ — the experimental condition a value-eval
// probe (elsewhere) varies from run to run.
//
// REPRODUCIBILITY IS THE POINT. Two materializations of the same mock and the
// same skill set must produce byte-identical trees and byte-identical commit
// hashes, so a run can be diffed against a rerun rather than trusted on faith.
// That is why the commit author/committer identity and both dates are PINNED
// constants below rather than read from the ambient environment or the system
// clock — a real name, a real clock, or a real git config would make every
// materialization's hashes different from the last, and this script's own
// tests would have nothing stable to assert against. GIT_CONFIG_GLOBAL and
// GIT_CONFIG_SYSTEM are pointed at /dev/null for the same reason: an ambient
// ~/.gitconfig (this repository's own included — some environments turn on
// `commit.gpgsign` globally) must not leak into a commit this script makes.
//
// history.jsonc ITSELF IS FIXTURE METADATA, NOT PROJECT CONTENT. It is
// excluded from the copy below, so a materialized workspace never contains it
// and nothing in the mock ever needs to import or read it.
//
// Skills are installed with `dereference: true`, and that is load-bearing, not
// a detail. The skills CLI installs either real directories or SYMLINKS back
// into the source tree, and a symlinked skill directory in the workspace would
// let a write inside it land straight through into THIS repository's own
// .claude/skills/ — path containment alone cannot catch that, because
// `resolve()` does not follow links. See scripts/discovery-eval/run.mjs's
// buildWorkspace for the same hazard against the same fix.
//
// Usage:
//   node scripts/value-eval/materialize.mjs [options]
//
// Exit codes:
//   0  the workspace path was printed to stdout
//   2  bad invocation, a malformed mock, or a git failure

import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MOCKS_ROOT = join(REPO_ROOT, "mocks");
const INSTALLED_SKILLS_ROOT = join(REPO_ROOT, ".claude", "skills");

const HISTORY_FILE = "history.jsonc";
const DEFAULT_MOCK = "content-site";

// Pinned commit identity — see this file's header for why these are
// constants rather than read from the environment.
const AUTHOR_NAME = "Value Eval Fixture";
const AUTHOR_EMAIL = "value-eval-fixture@example.invalid";
const COMMITTER_NAME = "Value Eval Fixture";
const COMMITTER_EMAIL = "value-eval-fixture@example.invalid";
// One synthetic day per commit from a fixed epoch (2023-11-14T22:13:20Z), so
// `git log` reads as an ordered history rather than one instant repeated, and
// every run derives the same dates from nothing but the commit's own index.
const BASE_DATE_EPOCH_SECONDS = 1_700_000_000;
const SECONDS_PER_COMMIT = 24 * 60 * 60;

const USAGE = `Usage: materialize.mjs [options]

Expand a value-eval mock project (mocks/<mock>) into an isolated,
git-backed temporary directory and print its path.

  --mock <name>    which mocks/ fixture to materialize (default: ${DEFAULT_MOCK})
  --skill <name>   a skill to install into the workspace's .claude/skills/<name>,
                    copied from this repository's OWN installed skills;
                    repeatable
  --install        run \`npm ci\` in the workspace once it is materialized, so a
                    probe starts from installed dependencies rather than
                    spending its own turns on them. Off by default: the default
                    path touches no network, which is what keeps this script's
                    own tests hermetic. Needs npm on PATH and a network.
  --help           this text

Exit codes: 0 the workspace path was printed, 2 bad invocation or a fixture
that failed to materialize.`;

function fail2(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

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
 * Strips `//` and `/* *‍/` comments from JSONC text, respecting string
 * literals (including escaped quotes) so a `//` or `/*` inside a string is
 * left alone. This repository has no JSONC-parsing dependency to reach for —
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
 * Parses and validates history.jsonc's `{ commits: [{ message, files }] }`
 * shape.
 *
 * @param {string} raw
 * @returns {Array<{ message: string, files: string[] }>}
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

/** Every file under `root`, as POSIX-style paths relative to `root`. Skips `.git`. */
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

/** Runs `git`, isolated from the ambient user/system config, and returns stdout. */
function runGit(args, cwd, extraEnv = {}) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      // Isolates this call from the calling machine's global/system git
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
 * Installs the mock's pinned dependencies into the materialized workspace.
 *
 * WHY THE HARNESS DOES THIS AND NOT THE MODEL. Every probe run before #264
 * spent three to five of its twelve to fifteen turns discovering `node_modules`
 * was absent, running `npm install`, and re-running the tests. That is the
 * harness's own setup showing up inside the measurement: it costs turns and
 * money in both conditions, it puts a network-dependent step in every probe,
 * and it let each run resolve its own dependency versions. A real developer
 * opens a repository whose dependencies are already installed.
 *
 * IT IS OPT-IN, AND THAT IS DELIBERATE. materialize.test.mjs materializes this
 * mock repeatedly and must stay hermetic and fast, so the default path touches
 * no network at all. The evaluation driver asks for the install explicitly.
 *
 * A FAILURE HERE IS A MATERIALIZATION FAILURE, NOT A WARNING. Handing back a
 * half-prepared workspace would let a probe start against it and spend real
 * money measuring the install rather than the skill, which is the whole defect
 * this exists to remove.
 *
 * `npm ci` rather than `npm install`: it installs exactly what the lockfile
 * pins and fails if the lockfile and `package.json` disagree, which is the
 * property the pin is for. `node_modules` is in the mock's own `.gitignore`,
 * so the workspace's Git tree stays clean and the capture never sees any of it.
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
}

/** The pinned author/committer env for the commit at `index`. */
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
 * Expands `mocks/<mock>` into a fresh temporary directory: every file the
 * mock ships except history.jsonc, replayed as a real Git history that
 * matches history.jsonc commit for commit, plus the requested skills copied
 * (as real files — see this file's header) into `.claude/skills/`.
 *
 * @param {{ mock?: string, skills?: string[] }} [options]
 * @returns {Promise<string>} the materialized workspace's absolute path
 */
async function materialize({ mock = DEFAULT_MOCK, skills = [], install = false } = {}) {
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

  // Validated before anything is written to disk, so an unknown skill name
  // fails fast rather than leaking a half-built temporary workspace.
  const skillSources = skills.map((name) => join(INSTALLED_SKILLS_ROOT, name));
  for (const [index, source] of skillSources.entries()) {
    await assertDirectory(
      source,
      `No installed skill named ${JSON.stringify(skills[index])} at ${source}.`,
    );
  }

  const workspace = await mkdtemp(join(tmpdir(), "value-eval-"));
  try {
    // Every file the mock ships, except its own fixture metadata
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

    // Last, so the history replay above saw exactly the files the mock ships
    // and the bijection check was unaffected by anything this writes.
    if (install) installDependencies(workspace);

    return workspace;
  } catch (error) {
    await rm(workspace, { recursive: true, force: true });
    throw error;
  }
}

function parseArgv(argv) {
  const options = { mock: DEFAULT_MOCK, skills: [], install: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--mock") {
      const value = argv[i + 1];
      if (value === undefined) fail2(`--mock needs a value.\n${USAGE}`);
      options.mock = value;
      i += 1;
    } else if (arg === "--skill") {
      const value = argv[i + 1];
      if (value === undefined) fail2(`--skill needs a value.\n${USAGE}`);
      options.skills.push(value);
      i += 1;
    } else if (arg === "--install") {
      options.install = true;
    } else {
      fail2(`Unknown option ${JSON.stringify(arg)}.\n${USAGE}`);
    }
  }
  return options;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${USAGE}\n`);
    process.exit(0);
  }

  const options = parseArgv(argv);
  try {
    const workspace = await materialize(options);
    process.stdout.write(`${workspace}\n`);
  } catch (error) {
    fail2(error instanceof Error ? error.message : String(error));
  }
}

main();
