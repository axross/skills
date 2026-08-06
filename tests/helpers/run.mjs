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
  checkSkillFrontmatter:
    "skills/agent-skill-authoring/scripts/check-skill-frontmatter.mjs",
  checkSkillBody: "skills/agent-skill-authoring/scripts/check-skill-body.mjs",
  checkSkillReferences:
    "skills/agent-skill-authoring/scripts/check-skill-references.mjs",
  checkLinks: "skills/agent-skill-authoring/scripts/check-links.mjs",
  checkCommitMessage:
    "skills/conventional-commits/scripts/check-commit-message.mjs",
  checkWireframe: "skills/wireframe-design/scripts/check-wireframe.mjs",
  checkIndex: "skills/living-product-specification/scripts/check-index.mjs",
  checkReferences:
    "skills/living-product-specification/scripts/check-references.mjs",
  checkGlossary: "skills/living-product-specification/scripts/check-glossary.mjs",
  checkDecisionNaming:
    "skills/living-product-specification/scripts/check-decision-naming.mjs",
  checkDecisionSupersede:
    "skills/living-product-specification/scripts/check-decision-supersede.mjs",
  checkInstalledCopies:
    "skills/agent-skill-management/scripts/check-installed-copies.mjs",
  linkFreshness:
    "skills/agent-skill-authoring/scripts/link-freshness/check.mjs",
  reportObligationLoad: "scripts/report-obligation-burden.mjs",
  reportSkillDuplication: "scripts/report-skill-duplication.mjs",
  discoveryEval: "scripts/discovery-eval/run.mjs",
  extractSnapshot: "scripts/discovery-eval/extract-snapshot.mjs",
  materialize: "scripts/value-eval/materialize.mjs",
  probe: "scripts/value-eval/probe.mjs",
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
