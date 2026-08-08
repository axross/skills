// Builds a case patch the way a case author would: by mutating a real copy of
// a mock and taking `git diff` over the result.
//
// WHY GENERATED RATHER THAN COMMITTED. A patch rots the moment the mock moves
// under it — that is the drift the declared-patch check exists to catch. A
// hand-written patch committed here as a test fixture would rot the same way,
// against the same mock, and would have to be regenerated every time
// `content-site` changes. Deriving it at test time from whatever the mock ships
// today costs a scratch repository and removes that maintenance entirely.
//
// Nothing here reads a file name out of a mock. The mutations are expressed
// against history.jsonc's own structure — "a commit with more than one file",
// "the file that is alone in its commit" — so a mock that gains, loses, or
// renames files does not silently stop exercising the shape a test asked for.

import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { onTestFinished } from "vitest";

import { repoPath } from "./run.mjs";

export const HISTORY_FILE = "history.jsonc";

/** Pinned identity, so the scratch repository needs no ambient git config. */
const PINNED = [
  "-c",
  "user.name=Patch Fixture",
  "-c",
  "user.email=patch-fixture@example.invalid",
  "-c",
  "commit.gpgsign=false",
];

function git(args, cwd) {
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
    throw new Error(`git ${args.join(" ")} exited ${result.status}:\n${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

/**
 * Strips the whole-line `//` comments a mock's history.jsonc uses and parses
 * the result. Deliberately simpler than the module's own JSONC stripper: the
 * fixtures this reads never put a comment marker inside a string, so a
 * line-based strip is exact for them even though it would not be in general.
 *
 * @param {string} raw
 * @returns {Array<{ message: string, files: string[] }>}
 */
export function parseHistoryFixture(raw) {
  const stripped = raw
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");
  return JSON.parse(stripped).commits;
}

/** The commits a mock's committed history.jsonc declares. */
export async function readMockHistory(mock = "content-site") {
  return parseHistoryFixture(await readFile(repoPath("mocks", mock, HISTORY_FILE), "utf8"));
}

/**
 * Rewrites a scratch tree's history.jsonc from its own parsed commits.
 *
 * The rewrite drops the file's comments, which is fine and is not what a real
 * case patch would do: history.jsonc never reaches the workspace a probe runs
 * in, so what a patch leaves in it only has to parse and to name the tree.
 *
 * @param {string} tree the scratch tree
 * @param {(commits: Array<{ message: string, files: string[] }>) => void} mutate
 */
export async function editHistory(tree, mutate) {
  const path = join(tree, HISTORY_FILE);
  const commits = parseHistoryFixture(await readFile(path, "utf8"));
  mutate(commits);
  await writeFile(path, `${JSON.stringify({ commits }, null, 2)}\n`, "utf8");
}

/**
 * Produces a unified diff against `mocks/<mock>` and returns its path.
 *
 * @param {(tree: string) => Promise<void>} mutate edits the scratch copy in place
 * @param {{ mock?: string }} [options]
 * @returns {Promise<string>} absolute path of the written patch
 */
export async function patchFromMock(mutate, { mock = "content-site" } = {}) {
  const scratch = await mkdtemp(join(tmpdir(), "mock-patch-"));
  onTestFinished(() => rm(scratch, { recursive: true, force: true }));

  const tree = join(scratch, "tree");
  await cp(repoPath("mocks", mock), tree, {
    recursive: true,
    filter: (source) => basename(source) !== "node_modules",
  });

  git(["init", "--quiet", "-b", "main"], tree);
  // `--force`, so a file the mock's own .gitignore covers still reaches the
  // baseline — otherwise a mutation to one would produce an empty diff and the
  // test would pass while exercising nothing.
  git([...PINNED, "add", "-A", "--force"], tree);
  git([...PINNED, "commit", "--quiet", "-m", "baseline"], tree);

  await mutate(tree);

  git([...PINNED, "add", "-A", "--force"], tree);
  const diff = git([...PINNED, "diff", "--cached"], tree);
  if (diff.trim().length === 0) throw new Error("the mutation produced an empty patch");

  const patchPath = join(scratch, "case.patch");
  await writeFile(patchPath, diff, "utf8");
  return patchPath;
}
