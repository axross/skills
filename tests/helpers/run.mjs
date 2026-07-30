// Spawn helpers for the validator tests.
//
// Every bundled validator is a standalone CLI whose contract is its exit code
// plus what it writes to stdout/stderr. The tests therefore run each one as a
// real child process rather than importing it: importing would execute the
// script's own `main()` and call `process.exit`, and it would test a different
// surface from the one `audit-checklist.md` tells an auditor to confirm.
//
// The one exception is commonmark.mjs, which is a module rather than a CLI and
// is imported directly by tests/unit/commonmark.test.mjs.

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

/** Repository-relative paths of the bundled validators, from their source tier. */
export const SCRIPTS = {
  checkSkill: "skills/agent-skill-authoring/scripts/check-skill.mjs",
  checkLinks: "skills/agent-skill-authoring/scripts/check-links.mjs",
  checkCommitMessage:
    "skills/conventional-commits/scripts/check-commit-message.mjs",
  scenarioCoverageGate:
    "skills/end-to-end-testing/scripts/scenario-coverage-gate.mjs",
  checkComponentStyles:
    "skills/react-component-styling/scripts/check-component-styles.mjs",
  checkWireframe: "skills/wireframe-design/scripts/check-wireframe.mjs",
  checkAmplitudeWiring:
    "skills/amplitude-analytics/scripts/check-amplitude-wiring.mjs",
  checkSentryWiring:
    "skills/sentry-instrumentation/scripts/check-sentry-wiring.mjs",
  checkInstalledCopies: "scripts/check-installed-copies.mjs",
  reportObligationLoad: "scripts/report-obligation-load.mjs",
  discoveryEval: "scripts/discovery-eval/run.mjs",
};

/**
 * Run a validator and capture its outcome.
 *
 * @param {string} scriptPath repository-relative path to a `.mjs` validator
 * @param {string[]} [args]
 * @param {{ input?: string, cwd?: string }} [options]
 * @returns {{ code: number, stdout: string, stderr: string, output: string }}
 */
export function runScript(scriptPath, args = [], { input, cwd } = {}) {
  const result = spawnSync(process.execPath, [repoPath(scriptPath), ...args], {
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
 * Bind `runScript` to one validator, so a test file reads `checkSkill(dir)`
 * rather than repeating the script key at every call.
 *
 * @param {string} scriptPath repository-relative path to a `.mjs` validator
 * @returns {(...args: string[]) => ReturnType<typeof runScript>}
 */
export function validator(scriptPath) {
  return (...args) => runScript(scriptPath, args);
}
