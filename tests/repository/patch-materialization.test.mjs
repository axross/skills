// every scenario under tools/evaluation/scenarios/ that declares a patch,
// materialized twice — once with its patch applied, once without — and held
// to the bound
// docs/decisions/2026-08-08-ship-mocks-sound-and-patch-in-defects-per-case.md
// promised when it accepted the cost of a patch at all: "every declared
// patch is applied against its mock offline, before any dispatch, so a
// rotted patch fails in the test suite rather than in a run that has
// already spent money reaching it."
//
// this is generic over scenarios and mocks on purpose, and names neither: a
// third patch-declaring scenario is picked up here with no edit, the same
// way tests/repository/mock-materialization.test.mjs stays generic over
// mocks. A scenario declaring no patch (patch: null) is simply not in the
// walk below, and a tree with no patch-declaring scenario at all is not a
// failure here — unlike mock-materialization.test.mjs's own "is a non-empty
// set" guard, this file has no companion assertion that the walk is
// non-vacuous, because a patch is optional by this repository's own design
// (the decision above) and the tree shipped with none for two years before
// this file existed.
//
// the patched materialization succeeding is the primary assertion, and it
// carries three checks for free because tools/evaluation/src/mock-workspace.mjs's
// own materialize() already enforces them: the patch applies at all,
// history.jsonc and the patched tree still name exactly the same files, and
// replaying the history leaves the workspace clean. Comparing the two
// trees is the second assertion: a patch that applies but changes nothing
// has rotted into a no-op, which the first assertion alone cannot see.
//
// no network is touched: the dependency install is opt-in and this walk
// never asks for it — the same posture mock-materialization.test.mjs holds.

import { createHash } from "node:crypto";
import { readFile, readdir, rm } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

import { describe, expect, it, onTestFinished } from "vitest";

import { materialize as materializeMock } from "../../tools/evaluation/src/mock-workspace.mjs";
import { loadAllScenarios } from "../../tools/evaluation/src/scenario.mjs";
import { repoPath } from "../helpers/run.mjs";

/**
 * every file under `root`, mapped from its POSIX-style relative path to a
 * sha256 of its raw bytes — read as a Buffer rather than as text, so a
 * binary file this mock might one day ship is compared byte for byte
 * instead of tripping over a decode. Skips `.git`.
 */
async function fileHashes(root, base = root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = {};
  for (const entry of entries) {
    if (entry.name === ".git") continue;
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      Object.assign(files, await fileHashes(full, base));
    } else {
      const relPath = relative(base, full).split(sep).join("/");
      const content = await readFile(full);
      files[relPath] = createHash("sha256").update(content).digest("hex");
    }
  }
  return files;
}

/**
 * materializes one scenario's mock, registers cleanup, and returns a
 * `{ result, workspace }` pair shaped the way this suite's other
 * spawn-based helpers are: `result.code` is 0 on success and 2 on a
 * materialization error, with the thrown error's own message as
 * `result.output` — so the `toPassCleanly()` matcher, and its failure
 * message, read exactly as they do for a spawned CLI (see
 * tests/helpers/matchers.mjs).
 *
 * @param {{ mock: string, dir: string, patch: string | null }} scenario
 * @param {{ withPatch: boolean }} options
 */
async function materializeScenario(scenario, { withPatch }) {
  const patch = withPatch && scenario.patch !== null ? resolve(scenario.dir, scenario.patch) : null;
  try {
    const workspace = await materializeMock({ mock: scenario.mock, patch });
    onTestFinished(() => rm(workspace, { recursive: true, force: true }));
    return { result: { code: 0, output: "" }, workspace };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { result: { code: 2, output: message }, workspace: null };
  }
}

const scenarios = await loadAllScenarios(repoPath("tools/evaluation/scenarios"));
const patchScenarios = scenarios.filter((scenario) => scenario.patch !== null);

describe("every scenario under tools/evaluation/scenarios/ that declares a patch", () => {
  it.each(patchScenarios.map((scenario) => [scenario.id, scenario]))(
    "materializes its mock with the patch applied: %s",
    async (id, scenario) => {
      const { result } = await materializeScenario(scenario, { withPatch: true });

      expect(result, `${id}'s patch does not satisfy materialize()'s contract`).toPassCleanly();
    },
  );

  it.each(patchScenarios.map((scenario) => [scenario.id, scenario]))(
    "leaves the patched mock different from the unpatched one: %s",
    async (id, scenario) => {
      const patched = await materializeScenario(scenario, { withPatch: true });
      const unpatched = await materializeScenario(scenario, { withPatch: false });

      expect(patched.result, `${id}'s patched materialization failed`).toPassCleanly();
      expect(
        unpatched.result,
        `${id}'s unpatched materialization of its own mock (${scenario.mock}) failed`,
      ).toPassCleanly();

      const patchedHashes = await fileHashes(patched.workspace);
      const unpatchedHashes = await fileHashes(unpatched.workspace);

      expect(
        patchedHashes,
        `${id}'s patch applies cleanly but leaves ${scenario.mock} byte-identical to the ` +
          "unpatched mock — it has rotted into a no-op.",
      ).not.toEqual(unpatchedHashes);
    },
  );
});
