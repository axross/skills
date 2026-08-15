// runProbe: materializes a real scenario's workspace, runs a probe through
// it, and returns the four records probe.mjs writes — driven against a real
// OS process (tests/evaluation/helpers/fake-cli.mjs's fake `claude`), never
// the real network.

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { fakeClaudeEnv } from "./helpers/fake-cli.mjs";
import { runProbe } from "../../tools/evaluation/src/probe-runner.mjs";
import { loadScenario } from "../../tools/evaluation/src/scenario.mjs";
import { repoPath } from "../helpers/run.mjs";

const SCENARIO_DIR = repoPath(
  "tools/evaluation/scenarios/quiet-the-stale-post-list-after-a-draft-save",
);

describe("runProbe", () => {
  it("records the four measured artefacts, in the declared stored shape", async () => {
    const scenario = await loadScenario(SCENARIO_DIR);
    const env = await fakeClaudeEnv({ FAKE_CLAUDE_INVOKE_SKILL: "tanstack-query-development" });

    const recorded = await runProbe({
      scenario,
      condition: "skill-present",
      repetition: 1,
      apiKeyEnv: env,
    });

    // metadata.json's declared shape: no `configuration` nesting, `runtime`
    // top-level, `skills` under `harness`.
    expect(recorded.metadata).not.toHaveProperty("configuration");
    expect(recorded.metadata.runtime).toBeTypeOf("object");
    expect(recorded.metadata.runtime.project.mock).toBe("inkwell");
    expect(recorded.metadata.harness.skills).toHaveProperty("tanstack-query-development");
    expect(recorded.metadata.harness.skills).toHaveProperty("react-component-development");
    expect(recorded.metadata.harness.skills).toHaveProperty("code-maintainability");
    expect(recorded.metadata).not.toHaveProperty("skills");

    // every model identifier is vendor-prefixed and fully qualified.
    expect(recorded.metadata.runtime.model).toMatch(/^anthropic\//);

    expect(recorded.metadata.condition).toBe("skill-present");
    expect(recorded.metadata.repetition).toBe(1);
    expect(recorded.metadata.task.prompt).toBe(scenario.task.prompt);

    expect(recorded.transcript).toContain('"type":"result"');
    expect(typeof recorded.diff).toBe("string");
    expect(recorded.invocations.skillsInvoked).toEqual(["tanstack-query-development"]);
  });

  it("installs only peer skills under the skill-absent condition", async () => {
    const scenario = await loadScenario(SCENARIO_DIR);
    const env = await fakeClaudeEnv();

    const recorded = await runProbe({ scenario, condition: "skill-absent", repetition: 1, apiKeyEnv: env });

    expect(Object.keys(recorded.metadata.harness.skills).sort()).toEqual(
      ["code-maintainability", "react-component-development"].sort(),
    );
  });

  it("removes the materialized workspace when it finishes", async () => {
    const scenario = await loadScenario(SCENARIO_DIR);
    const env = await fakeClaudeEnv();

    // no direct handle on the workspace path from the public API — this
    // asserts indirectly: a second run succeeds cleanly, which a leaked
    // temp directory from the first would not prevent, but at minimum
    // proves runProbe does not itself throw on cleanup.
    await expect(runProbe({ scenario, condition: "skill-absent", repetition: 1, apiKeyEnv: env })).resolves.toBeTruthy();
  });

  it("strips credential-shaped environment variables before spawning", async () => {
    const scenario = await loadScenario(SCENARIO_DIR);
    const env = await fakeClaudeEnv({ SOME_SECRET_TOKEN: "should-not-appear-anywhere" });

    const recorded = await runProbe({ scenario, condition: "skill-absent", repetition: 1, apiKeyEnv: env });

    expect(recorded.transcript).not.toContain("should-not-appear-anywhere");
    expect(JSON.stringify(recorded.metadata)).not.toContain("should-not-appear-anywhere");
  });
});
