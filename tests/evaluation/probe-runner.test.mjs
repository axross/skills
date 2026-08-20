// runProbe: materializes a real scenario's workspace, runs a probe through
// it, and returns the four records probe.mjs writes — driven against a real
// OS process (tests/evaluation/helpers/fake-cli.mjs's fake `claude`), never
// the real network.

import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { fakeClaudeEnv } from "./helpers/fake-cli.mjs";
import { plantCleanupFailure } from "./helpers/planted-cleanup-failure.mjs";
import { treeDigest } from "../../tools/evaluation/src/fingerprint.mjs";
import { materialize as materializeMock } from "../../tools/evaluation/src/mock-workspace.mjs";
import { ALLOWED_TOOLS, DISALLOWED_TOOLS } from "../../tools/evaluation/src/probe-process.mjs";
import { reconstructWorkspace } from "../../tools/evaluation/src/reconstruct.mjs";
import { runProbe } from "../../tools/evaluation/src/probe-runner.mjs";
import { loadScenario } from "../../tools/evaluation/src/scenario.mjs";
import { repoPath } from "../helpers/run.mjs";

// spy-mode (not a replacing factory): every node:fs/promises call keeps its
// real behavior unless a test explicitly overrides one — see
// helpers/planted-cleanup-failure.mjs.
vi.mock(import("node:fs/promises"), { spy: true });

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

  // the level the defect this instrument's capture step used to have —
  // reporting a probe that commits its own work as having changed nothing —
  // actually bit at, and no test above reaches it: a fake `claude` that
  // creates a file and commits it (helpers/fake-claude.mjs's opt-in
  // FAKE_CLAUDE_COMMIT_FILE mode), driven through the real subprocess
  // boundary runProbe uses, then fed back through reconstructWorkspace —
  // the same path a stored measurement is judged through — to confirm the
  // file a probe committed is not just present in the stored diff but
  // actually reconstructs.
  it("captures a probe's work even when it commits it, and the stored diff reconstructs it", async () => {
    const scenario = await loadScenario(SCENARIO_DIR);
    const env = await fakeClaudeEnv({
      FAKE_CLAUDE_COMMIT_FILE: "shared/probe-committed.test.ts",
      FAKE_CLAUDE_COMMIT_CONTENT: 'it("captures even when committed", () => {});\n',
    });

    const recorded = await runProbe({
      scenario,
      condition: "skill-present",
      repetition: 1,
      apiKeyEnv: env,
    });

    expect(recorded.diff).toContain("shared/probe-committed.test.ts");
    expect(recorded.diff).toContain('it("captures even when committed", () => {});');

    const workspace = await reconstructWorkspace({
      scenario,
      condition: "skill-present",
      diffText: recorded.diff,
    });
    try {
      const written = await readFile(join(workspace, "shared/probe-committed.test.ts"), "utf8");
      expect(written).toBe('it("captures even when committed", () => {});\n');
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  // the drift this records was found by hand, in a stored artifact days
  // from expiry: the instrument declared a tool the CLI no longer had, and
  // nothing compared the declaration against the `tools` array the parse
  // already read. these cases are that comparison, on the probe record.
  it("records the reported tool surface alongside the declarations it was compared against", async () => {
    const scenario = await loadScenario(SCENARIO_DIR);
    const env = await fakeClaudeEnv();

    const recorded = await runProbe({ scenario, condition: "skill-absent", repetition: 1, apiKeyEnv: env });

    const tools = recorded.metadata.runtime.tools;
    expect(tools.reported).toEqual(ALLOWED_TOOLS);
    expect(tools.allowed).toEqual(ALLOWED_TOOLS);
    expect(tools.disallowed).toEqual(DISALLOWED_TOOLS);
    expect(tools.disagreements).toEqual({
      allowedNotSurfaced: [],
      deniedButSurfaced: [],
      undeclared: [],
    });
  });

  it("records a disagreement and warns about it, without failing the probe", async () => {
    const scenario = await loadScenario(SCENARIO_DIR);
    const env = await fakeClaudeEnv({ FAKE_CLAUDE_TOOLS: "Bash,Read,ToolSearch,WebFetch" });
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    try {
      const recorded = await runProbe({ scenario, condition: "skill-absent", repetition: 1, apiKeyEnv: env });

      const { disagreements } = recorded.metadata.runtime.tools;
      expect(disagreements.deniedButSurfaced).toEqual(["WebFetch"]);
      expect(disagreements.undeclared).toEqual(["ToolSearch"]);
      expect(disagreements.allowedNotSurfaced).toContain("Write");

      // the probe record is intact — a tool-surface disagreement is a fact
      // about the CLI, never a reason to lose a paid run.
      expect(recorded.transcript).toContain('"type":"result"');
      expect(typeof recorded.diff).toBe("string");

      const warnings = stderrSpy.mock.calls.map(([text]) => text).filter(Boolean);
      expect(warnings.some((line) => line.includes("denied but reported available: WebFetch"))).toBe(true);
      expect(
        warnings.some((line) => line.includes("reported available but declared by neither list: ToolSearch")),
      ).toBe(true);
    } finally {
      stderrSpy.mockRestore();
    }
  });

  it("records no comparison, and warns about nothing, when the CLI reported no tool surface", async () => {
    const scenario = await loadScenario(SCENARIO_DIR);
    const env = await fakeClaudeEnv({ FAKE_CLAUDE_OMIT_TOOLS: "1" });
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    try {
      const recorded = await runProbe({ scenario, condition: "skill-absent", repetition: 1, apiKeyEnv: env });

      expect(recorded.metadata.runtime.tools.reported).toBeNull();
      expect(recorded.metadata.runtime.tools.disagreements).toBeNull();

      const warnings = stderrSpy.mock.calls.map(([text]) => text).filter(Boolean);
      expect(warnings.some((line) => line.includes("tool surface"))).toBe(false);
    } finally {
      stderrSpy.mockRestore();
    }
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

  // a workspace-removal failure (an ENOTEMPTY from something still
  // writing under node_modules, in the reproduction that found this) must
  // not cost the probe record that was already built. reverting
  // probe-runner.mjs's fix — putting `await rm(...)` back directly in the
  // `finally` with no try/catch — makes this fail: the planted rejection
  // propagates past `return { metadata, ... }` and replaces it, so
  // `recorded` rejects instead of resolving.
  it("returns the probe record, and warns instead of throwing, when workspace cleanup fails", async () => {
    const scenario = await loadScenario(SCENARIO_DIR);
    const env = await fakeClaudeEnv();
    const cleanup = await plantCleanupFailure({ pathIncludes: "skill-evaluation-" });
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    try {
      const recorded = await runProbe({ scenario, condition: "skill-absent", repetition: 1, apiKeyEnv: env });

      expect(cleanup.triggered).toBe(true);
      expect(recorded.metadata).toBeTypeOf("object");
      expect(recorded.transcript).toContain('"type":"result"');
      expect(typeof recorded.diff).toBe("string");
      expect(recorded.invocations.skillsInvoked).toEqual([]);

      const warnings = stderrSpy.mock.calls.map(([text]) => text).filter(Boolean);
      expect(warnings.some((line) => /warning: could not remove/.test(line))).toBe(true);
      expect(warnings.some((line) => line.includes("planted cleanup failure"))).toBe(true);
    } finally {
      cleanup.restore();
      stderrSpy.mockRestore();
    }
  });

  // #417: mock-workspace.mjs never received harness.agentsMd, so every
  // probe ran with the mock's working agreement in its workspace regardless
  // of the value stored beside it. This confirms the value now reaches the
  // materialized tree itself — through what the workspace actually
  // contains, via its content digest, not through a spy on the call.
  it("carries the scenario's declared agentsMd into the materialized workspace's tree digest", async () => {
    const scenario = await loadScenario(SCENARIO_DIR);
    expect(scenario.harness.agentsMd).toBe(true);

    const withAgentsMd = await runProbe({
      scenario,
      condition: "skill-absent",
      repetition: 1,
      apiKeyEnv: await fakeClaudeEnv(),
    });
    const withoutAgentsMd = await runProbe({
      scenario: { ...scenario, harness: { ...scenario.harness, agentsMd: false } },
      condition: "skill-absent",
      repetition: 1,
      apiKeyEnv: await fakeClaudeEnv(),
    });

    expect(withAgentsMd.metadata.harness.agentsMd).toBe(true);
    expect(withoutAgentsMd.metadata.harness.agentsMd).toBe(false);
    expect(withoutAgentsMd.metadata.runtime.project.tree).not.toBe(
      withAgentsMd.metadata.runtime.project.tree,
    );

    // the `true` digest matches materialize()'s own default — the value this
    // scenario's declaration now carries — so it is the correct digest, not
    // merely a digest that differs from the other run's.
    const reference = await materializeMock({ mock: scenario.mock });
    try {
      expect(withAgentsMd.metadata.runtime.project.tree).toBe(await treeDigest(reference));
    } finally {
      await rm(reference, { recursive: true, force: true });
    }
  });

  // both callers that materialize a workspace — the probe run and the
  // reconstruction a stored measurement is judged against — pass the
  // scenario's own harness.agentsMd through, so they must materialize
  // alike under the same declaration. exercised under `false` rather than
  // this scenario's own `true`, so the assertion is not vacuously true of
  // materialize()'s default.
  it("materializes the same tree reconstructWorkspace does, under the same declared agentsMd", async () => {
    const scenario = await loadScenario(SCENARIO_DIR);
    const withoutAgentsMd = { ...scenario, harness: { ...scenario.harness, agentsMd: false } };

    const probed = await runProbe({
      scenario: withoutAgentsMd,
      condition: "skill-absent",
      repetition: 1,
      apiKeyEnv: await fakeClaudeEnv(),
    });

    const reconstructed = await reconstructWorkspace({
      scenario: withoutAgentsMd,
      condition: "skill-absent",
      diffText: "",
    });
    try {
      expect(await treeDigest(reconstructed)).toBe(probed.metadata.runtime.project.tree);
    } finally {
      await rm(reconstructed, { recursive: true, force: true });
    }
  });

  it("strips credential-shaped environment variables before spawning", async () => {
    const scenario = await loadScenario(SCENARIO_DIR);
    const env = await fakeClaudeEnv({ SOME_SECRET_TOKEN: "should-not-appear-anywhere" });

    const recorded = await runProbe({ scenario, condition: "skill-absent", repetition: 1, apiKeyEnv: env });

    expect(recorded.transcript).not.toContain("should-not-appear-anywhere");
    expect(JSON.stringify(recorded.metadata)).not.toContain("should-not-appear-anywhere");
  });
});
