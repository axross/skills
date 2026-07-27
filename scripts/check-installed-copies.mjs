#!/usr/bin/env node
// check-installed-copies.mjs — installed-skill drift check for THIS repository.
//
// Distributable skills are authored under `skills/<name>/` and installed into
// `.claude/skills/<name>/` with the vercel-labs/skills CLI. README.md calls the
// installed copies tracked artifacts rather than build output, and warns that a
// hand-edit to one is silently discarded by the next install. Nothing verified
// that claim, so the two roots matched by luck. This makes the mismatch fail.
//
// It lives at the repository root rather than inside a skill's `scripts/`
// because the invariant is repository-only: a project that installs these
// skills has no second copy to compare against.
//
// `skills-lock.json` is deliberately NOT consulted. Every entry records an
// absolute `source` path, so the lockfile is not portable across checkouts and
// is a poor authority for what should exist; directory contents are the truth.
//
// Usage:
//   node scripts/check-installed-copies.mjs [<source-root> [<installed-root>]]
//
//     Both default to this repository's `skills` and `.claude/skills`, resolved
//     from the script's own location so the cwd does not matter. The arguments
//     exist so the check can be exercised against fixtures.
//
// Exit codes:
//   0  every distributable skill's installed copy matches its source
//   1  drift — a content mismatch, a missing installed copy, or an installed
//      skill with neither a source nor repository-local status
//   2  bad invocation, or a root that is not a directory

import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Skills committed directly under the installed root and hand-edited in place,
 * so they legitimately have no source under `skills/`. Kept explicit rather
 * than inferred from "installed with no source": inferring it would let a
 * deleted source pass silently as repository-local.
 */
const REPOSITORY_LOCAL = new Set(["github-operation"]);

function fail2(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

async function isDir(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/** Immediate subdirectory names of `root`, sorted. */
async function skillNames(root) {
  const entries = await readdir(root, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/**
 * Every file under `dir`, as paths relative to it, sorted.
 * @param {string} dir
 * @param {string} [prefix]
 * @returns {Promise<string[]>}
 */
async function listFiles(dir, prefix = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await listFiles(join(dir, entry.name), relative)));
    } else {
      files.push(relative);
    }
  }
  return files;
}

/**
 * Compare one skill's source directory against its installed copy.
 * @returns {Promise<string[]>} one message per difference; empty when identical
 */
async function compareSkill(sourceDir, installedDir) {
  const [sourceFiles, installedFiles] = await Promise.all([
    listFiles(sourceDir),
    listFiles(installedDir),
  ]);
  const differences = [];

  const installedSet = new Set(installedFiles);
  const sourceSet = new Set(sourceFiles);
  for (const file of sourceFiles) {
    if (!installedSet.has(file)) differences.push(`missing from the installed copy: ${file}`);
  }
  for (const file of installedFiles) {
    if (!sourceSet.has(file)) differences.push(`present only in the installed copy: ${file}`);
  }

  for (const file of sourceFiles) {
    if (!installedSet.has(file)) continue;
    const [source, installed] = await Promise.all([
      readFile(join(sourceDir, file)),
      readFile(join(installedDir, file)),
    ]);
    if (!source.equals(installed)) differences.push(`content differs: ${file}`);
  }
  return differences;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 2) {
    fail2(
      "Usage: check-installed-copies.mjs [<source-root> [<installed-root>]]",
    );
  }
  const sourceRoot = args[0] ?? join(REPO_ROOT, "skills");
  const installedRoot = args[1] ?? join(REPO_ROOT, ".claude", "skills");

  for (const root of [sourceRoot, installedRoot]) {
    if (!(await isDir(root))) fail2(`Not a directory: "${root}".`);
  }

  const sourceNames = await skillNames(sourceRoot);
  const installedNames = await skillNames(installedRoot);
  const installedSet = new Set(installedNames);
  const sourceSet = new Set(sourceNames);

  const lines = [];
  let driftedCount = 0;

  for (const name of sourceNames) {
    if (!installedSet.has(name)) {
      driftedCount += 1;
      lines.push(`DRIFT ${name}`);
      lines.push(
        `        - no installed copy under "${installedRoot}" — reinstall so the tracked copy exists`,
      );
      continue;
    }
    const differences = await compareSkill(
      join(sourceRoot, name),
      join(installedRoot, name),
    );
    if (differences.length === 0) {
      lines.push(`OK    ${name}`);
      continue;
    }
    driftedCount += 1;
    lines.push(`DRIFT ${name}`);
    for (const difference of differences) lines.push(`        - ${difference}`);
  }

  for (const name of installedNames) {
    if (sourceSet.has(name)) continue;
    if (REPOSITORY_LOCAL.has(name)) {
      lines.push(`LOCAL ${name} (repository-local; no source under "${sourceRoot}")`);
      continue;
    }
    driftedCount += 1;
    lines.push(`DRIFT ${name}`);
    lines.push(
      `        - installed with no source under "${sourceRoot}", and not a known repository-local skill`,
    );
  }

  lines.push("");
  lines.push(
    driftedCount === 0
      ? `All ${sourceNames.length} distributable skill(s) match their installed copies.`
      : `${driftedCount} skill(s) drifted from their installed copies.`,
  );
  if (driftedCount > 0) {
    lines.push(
      "The source under the source root is authoritative; regenerate the installed copies with `npx skills` rather than hand-editing them.",
    );
  }
  process.stdout.write(`${lines.join("\n")}\n`);
  process.exit(driftedCount === 0 ? 0 : 1);
}

main();
