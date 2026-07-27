// Spawn helpers for the validator tests.
//
// Every bundled validator is a standalone executable whose contract is its exit
// code plus what it writes to stdout/stderr. The tests therefore run each one as
// a real child process rather than importing it: importing would execute the
// script's own `main()` and call `process.exit`, and it would test a different
// surface from the one `audit-checklist.md` tells an auditor to confirm.

import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Absolute path of the repository root, derived from this file's location. */
export const REPO_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

/** Resolve a repository-relative path to an absolute one. */
export function repoPath(...segments) {
  return join(REPO_ROOT, ...segments);
}

/**
 * Run a command and capture its outcome.
 * @param {string} command
 * @param {string[]} args
 * @param {{ input?: string, cwd?: string }} [options]
 * @returns {{ code: number, stdout: string, stderr: string, output: string }}
 */
function run(command, args, { input, cwd } = {}) {
  const result = spawnSync(command, args, {
    cwd: cwd ?? REPO_ROOT,
    input: input ?? "",
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  return {
    code: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    output: `${result.stdout}${result.stderr}`,
  };
}

/**
 * Run a Node script by repository-relative path.
 * @param {string} scriptPath repository-relative path to a `.mjs` script
 * @param {string[]} [args]
 * @param {{ input?: string, cwd?: string }} [options]
 */
export function runNodeScript(scriptPath, args = [], options = {}) {
  return run(process.execPath, [repoPath(scriptPath), ...args], options);
}

/**
 * Run an executable shell script by repository-relative path.
 * @param {string} scriptPath repository-relative path to an executable script
 * @param {string[]} [args]
 * @param {{ input?: string, cwd?: string }} [options]
 */
export function runShellScript(scriptPath, args = [], options = {}) {
  return run(repoPath(scriptPath), args, options);
}

/** Repository-relative paths of the bundled validators, from their source tier. */
export const SCRIPTS = {
  checkSkill: "skills/agent-skill-authoring/scripts/check-skill.mjs",
  checkLinks: "skills/agent-skill-authoring/scripts/check-links.sh",
  checkCommitMessage:
    "skills/conventional-commits/scripts/check-commit-message.mjs",
  scenarioCoverageGate:
    "skills/end-to-end-testing/scripts/scenario-coverage-gate.mjs",
  checkComponentStyles:
    "skills/react-component-styling/scripts/check-component-styles.mjs",
  checkWireframe: "skills/wireframe-design/scripts/check-wireframe.mjs",
  checkInstalledCopies: "scripts/check-installed-copies.mjs",
};
