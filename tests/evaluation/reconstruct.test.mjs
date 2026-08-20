// reconstructWorkspace: rebuilding the workspace one probe ran in, ending in
// the state its stored diff produced — the property that makes a stored
// measurement sufficient to judge on its own.

import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it, onTestFinished } from "vitest";

import { reconstructWorkspace } from "../../tools/evaluation/src/reconstruct.mjs";
import { loadScenario } from "../../tools/evaluation/src/scenario.mjs";
import { repoPath } from "../helpers/run.mjs";

const SCENARIO_DIR = repoPath(
  "tools/evaluation/scenarios/quiet-the-stale-post-list-after-a-draft-save",
);
const FIXTURE_PROBE_DIR = repoPath(
  "tests/evaluation/fixtures/measurement/quiet-the-stale-post-list-after-a-draft-save-fixture01/skill-present-1",
);

async function cleanedUp(workspace) {
  onTestFinished(() => rm(workspace, { recursive: true, force: true }));
  return workspace;
}

describe("reconstructWorkspace", () => {
  it("ends in the state the stored diff produced, on the real fixture's own diff", async () => {
    const scenario = await loadScenario(SCENARIO_DIR);
    const diffText = await readFile(join(FIXTURE_PROBE_DIR, "changes.patch"), "utf8");

    const workspace = await cleanedUp(
      await reconstructWorkspace({ scenario, condition: "skill-present", diffText }),
    );

    const fixed = await readFile(join(workspace, "src/queries/posts/post-save-mutation.ts"), "utf8");
    expect(fixed).toContain("invalidateQueries");
    expect(fixed).toContain("getPostListQueryOptions");
    // the negative outcome factor's own expectation: the pre-existing
    // detail-cache write must survive the reconstruction too.
    expect(fixed).toContain("setQueryData");
  });

  it("installs the skill-absent condition's narrower skill set", async () => {
    const scenario = await loadScenario(SCENARIO_DIR);

    const workspace = await cleanedUp(
      await reconstructWorkspace({ scenario, condition: "skill-absent", diffText: "" }),
    );

    const { readdir } = await import("node:fs/promises");
    const installed = await readdir(join(workspace, ".claude", "skills"));
    expect(installed.sort()).toEqual(["code-maintainability", "react-component-development"]);
  });

  it("applies an empty diff as a no-op", async () => {
    const scenario = await loadScenario(SCENARIO_DIR);

    const workspace = await cleanedUp(
      await reconstructWorkspace({ scenario, condition: "skill-present", diffText: "" }),
    );

    const original = await readFile(join(workspace, "src/queries/posts/post-save-mutation.ts"), "utf8");
    expect(original).not.toContain("invalidateQueries");
  });

  it("withholds the mock's working agreement when the scenario declares agentsMd: false", async () => {
    const scenario = await loadScenario(SCENARIO_DIR);
    expect(scenario.harness.agentsMd).toBe(true);

    const withAgentsMd = await cleanedUp(
      await reconstructWorkspace({ scenario, condition: "skill-present", diffText: "" }),
    );
    const withoutAgentsMd = await cleanedUp(
      await reconstructWorkspace({
        scenario: { ...scenario, harness: { ...scenario.harness, agentsMd: false } },
        condition: "skill-present",
        diffText: "",
      }),
    );

    await expect(readFile(join(withAgentsMd, "AGENTS.md"), "utf8")).resolves.toBeTruthy();
    await expect(readFile(join(withoutAgentsMd, "AGENTS.md"), "utf8")).rejects.toThrow();
    await expect(readFile(join(withoutAgentsMd, "CLAUDE.md"), "utf8")).rejects.toThrow();
  });

  it("throws when the stored diff does not apply cleanly", async () => {
    const scenario = await loadScenario(SCENARIO_DIR);
    const bogusDiff = [
      "diff --git a/nonexistent-file.ts b/nonexistent-file.ts",
      "index 0000000..1111111 100644",
      "--- a/nonexistent-file.ts",
      "+++ b/nonexistent-file.ts",
      "@@ -1 +1 @@",
      "-old",
      "+new",
      "",
    ].join("\n");

    await expect(
      reconstructWorkspace({ scenario, condition: "skill-present", diffText: bogusDiff }),
    ).rejects.toThrow(/did not apply cleanly/);
  });
});
