// reconstructing the probe workspace evaluate.mjs judges against, from what
// one probe's own stored files hold and nothing else.
//
// docs/specs/skill-evaluation.md, "The factor": "The probe workspace is
// reconstructed from what the measurement holds, never reused from the run
// that produced it, so a stored measurement is sufficient to judge on its
// own rather than only at the moment it was taken." This always runs — see
// evaluate.mjs's own header for why a measurement missing what it needs
// fails loudly here rather than a factor quietly being skipped.

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { materialize } from "./mock-workspace.mjs";
import { skillsForCondition } from "./scenario.mjs";

/**
 * applies a stored unified diff (a probe's own changes.patch) to an
 * already-materialized workspace — the same `git apply` mechanism
 * mock-workspace.mjs's own applyPatch uses for a scenario's own patch, run a
 * second time for the probe's diff. an empty diff (a probe that changed
 * nothing) applies as a no-op, which `git apply` accepts on empty input.
 *
 * @param {string} workspace
 * @param {string} diffText
 * @throws {Error} when the diff does not apply cleanly
 */
function applyStoredDiff(workspace, diffText) {
  if (diffText.trim().length === 0) return;
  const proc = spawnSync("git", ["apply", "--whitespace=nowarn"], {
    cwd: workspace,
    input: diffText,
    encoding: "utf8",
  });
  if (proc.status !== 0) {
    throw new Error(
      "The stored diff did not apply cleanly while reconstructing the workspace:\n" +
        (proc.stderr || proc.stdout),
    );
  }
}

/**
 * reconstructs the workspace one probe ran in, ending in the state its own
 * stored diff produced.
 *
 * @param {{
 *   scenario: object,
 *   condition: "skill-present"|"skill-absent",
 *   diffText: string,
 * }} options `scenario` is the already-loaded, already-validated scenario
 *   declaration (see scenario.mjs's loadScenario) — read from this
 *   repository's own tree, not from the measurement, because a scenario's
 *   mock and patch are stable inputs shared by every measurement of it, the
 *   same way a compiler needs both a diff and the base tree it applies
 *   against.
 * @returns {Promise<string>} the reconstructed workspace's absolute path —
 *   the caller is responsible for removing it
 * @throws {Error} when materialization fails, or the stored diff does not
 *   apply cleanly
 */
export async function reconstructWorkspace({ scenario, condition, diffText }) {
  const workspace = await materialize({
    mock: scenario.mock,
    skills: skillsForCondition(scenario, condition),
    patch: scenario.patch === null ? null : resolve(scenario.dir, scenario.patch),
    install: false,
    agentsMd: scenario.harness.agentsMd,
  });
  applyStoredDiff(workspace, diffText);
  return workspace;
}
