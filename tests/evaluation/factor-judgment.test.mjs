// judgeFactor: running one factor's script or reasoning judgment and
// normalizing the outcome into the record factors.json stores.

import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { tempDir, writeFileIn } from "../helpers/fixtures.mjs";
import { plantCleanupFailure } from "./helpers/planted-cleanup-failure.mjs";
import { judgeFactor, materialFor } from "../../tools/evaluation/src/factor-judgment.mjs";

// spy-mode (not a replacing factory): every node:fs/promises call keeps its
// real behavior unless a test explicitly overrides one — see
// helpers/planted-cleanup-failure.mjs.
vi.mock(import("node:fs/promises"), { spy: true });

const PROBE = {
  skillsInvoked: ["unit-testing"],
  diff: "diff --git a/x b/x\n",
  task: { prompt: "do it" },
  transcript: '{"type":"result"}\n',
};

describe("materialFor", () => {
  it("bounds a discovery factor to the skill invocations alone", () => {
    expect(materialFor("discovery", PROBE)).toEqual({ skillsInvoked: PROBE.skillsInvoked });
  });

  it("bounds an outcome factor to the diff and the task", () => {
    expect(materialFor("outcome", PROBE)).toEqual({ diff: PROBE.diff, task: PROBE.task });
  });

  it("bounds a transcript factor to the transcript", () => {
    expect(materialFor("transcript", PROBE)).toEqual({ transcript: PROBE.transcript });
  });

  it("throws on an unknown phase", () => {
    expect(() => materialFor("sideways", PROBE)).toThrow(/Unknown phase/);
  });
});

describe("judgeFactor — script method", () => {
  async function scenarioWithScript(scriptSource) {
    const dir = await tempDir();
    await writeFileIn(dir, "scripts/check.mjs", scriptSource);
    return dir;
  }

  const PASSING_SCRIPT = `
    import { readFileSync } from "node:fs";
    const context = JSON.parse(readFileSync(process.argv[2], "utf8"));
    console.log(JSON.stringify({ result: context.material.skillsInvoked.includes("unit-testing"), evidence: "checked skillsInvoked" }));
  `;

  // a judgment's argument bag was renamed from `expect` to `input`, and the
  // context file is what carries it. this is the round trip that rename has
  // to survive: a factor's arguments reach the script under the new key, and
  // reach it as themselves. the transport is a JSON file rather than argv, so
  // a number stays a number and a list stays a list — a script guarding
  // `typeof max !== "number"` would otherwise reject every real invocation,
  // and would do so first inside a paid dispatch.
  const ECHOING_SCRIPT = `
    import { readFileSync } from "node:fs";
    const context = JSON.parse(readFileSync(process.argv[2], "utf8"));
    const shape = (value) =>
      Array.isArray(value) ? (value.length > 0 && Array.isArray(value[0]) ? "string[][]" : "string[]")
      : value === null ? "null" : typeof value;
    const shapes = Object.fromEntries(Object.entries(context.input ?? {}).map(([key, value]) => [key, shape(value)]));
    console.log(JSON.stringify({ result: true, evidence: JSON.stringify(shapes) }));
  `;

  it("hands the script its arguments under `input`, with each value's type intact", async () => {
    const scenarioDir = await scenarioWithScript(ECHOING_SCRIPT);
    const workspace = await tempDir();
    const factor = {
      id: "f1",
      phase: "outcome",
      judgment: {
        method: "script",
        script: "scripts/check.mjs",
        input: {
          file: "src/x.ts",
          max: 1,
          requireLocale: false,
          mustContainAll: ["x", "y"],
          mustMentionEachOf: [["a", "b"], ["c"]],
        },
      },
    };
    const record = await judgeFactor(factor, { scenarioDir, workspace, probe: PROBE });
    expect(JSON.parse(record.evidence)).toEqual({
      file: "string",
      max: "number",
      requireLocale: "boolean",
      mustContainAll: "string[]",
      mustMentionEachOf: "string[][]",
    });
  });

  it("hands the script a null `input` when the factor declares no arguments", async () => {
    const scenarioDir = await scenarioWithScript(`
      import { readFileSync } from "node:fs";
      const context = JSON.parse(readFileSync(process.argv[2], "utf8"));
      console.log(JSON.stringify({ result: context.input === null, evidence: "input was " + JSON.stringify(context.input) }));
    `);
    const workspace = await tempDir();
    const factor = { id: "f1", phase: "outcome", judgment: { method: "script", script: "scripts/check.mjs" } };
    const record = await judgeFactor(factor, { scenarioDir, workspace, probe: PROBE });
    expect(record.result).toBe(true);
  });

  it("returns a true/false result with evidence on a clean exit", async () => {
    const scenarioDir = await scenarioWithScript(PASSING_SCRIPT);
    const workspace = await tempDir();
    const factor = {
      id: "f1",
      phase: "discovery",
      judgment: { method: "script", script: "scripts/check.mjs" },
    };
    const record = await judgeFactor(factor, { scenarioDir, workspace, probe: PROBE });
    expect(record).toEqual({ id: "f1", phase: "discovery", method: "script", result: true, evidence: "checked skillsInvoked" });
  });

  // negative control 1/5: a factor script made to exit non-zero yields an
  // errored judgment, never a `false` one.
  it("yields an errored result, never `false`, when the script exits non-zero", async () => {
    const scenarioDir = await scenarioWithScript(
      `process.stderr.write("could not tell\\n"); process.exit(1);`,
    );
    const workspace = await tempDir();
    const factor = { id: "f1", phase: "outcome", judgment: { method: "script", script: "scripts/check.mjs" } };

    const record = await judgeFactor(factor, { scenarioDir, workspace, probe: PROBE });

    expect(record.result).toEqual({ error: "could not tell" });
    expect(record.result).not.toBe(false);
  });

  it("errors when the script exits non-zero with nothing on stderr", async () => {
    const scenarioDir = await scenarioWithScript(`process.exit(3);`);
    const workspace = await tempDir();
    const factor = { id: "f1", phase: "outcome", judgment: { method: "script", script: "scripts/check.mjs" } };

    const record = await judgeFactor(factor, { scenarioDir, workspace, probe: PROBE });

    expect(record.result.error).toMatch(/exited 3/);
  });

  it("errors when the script prints unparseable stdout", async () => {
    const scenarioDir = await scenarioWithScript(`console.log("not json");`);
    const workspace = await tempDir();
    const factor = { id: "f1", phase: "outcome", judgment: { method: "script", script: "scripts/check.mjs" } };

    const record = await judgeFactor(factor, { scenarioDir, workspace, probe: PROBE });

    expect(record.result.error).toMatch(/unparseable JSON/);
  });

  it("errors when the script's result is not a boolean", async () => {
    const scenarioDir = await scenarioWithScript(
      `console.log(JSON.stringify({ result: "yes", evidence: "x" }));`,
    );
    const workspace = await tempDir();
    const factor = { id: "f1", phase: "outcome", judgment: { method: "script", script: "scripts/check.mjs" } };

    const record = await judgeFactor(factor, { scenarioDir, workspace, probe: PROBE });

    expect(record.result.error).toMatch(/non-boolean "result"/);
  });

  it("errors when the script prints no evidence", async () => {
    const scenarioDir = await scenarioWithScript(`console.log(JSON.stringify({ result: true }));`);
    const workspace = await tempDir();
    const factor = { id: "f1", phase: "outcome", judgment: { method: "script", script: "scripts/check.mjs" } };

    const record = await judgeFactor(factor, { scenarioDir, workspace, probe: PROBE });

    expect(record.result.error).toMatch(/no non-empty "evidence"/);
  });

  it("runs the script with the workspace as its cwd", async () => {
    const scenarioDir = await scenarioWithScript(
      `console.log(JSON.stringify({ result: true, evidence: process.cwd() }));`,
    );
    const workspace = await tempDir();
    const factor = { id: "f1", phase: "outcome", judgment: { method: "script", script: "scripts/check.mjs" } };

    const record = await judgeFactor(factor, { scenarioDir, workspace, probe: PROBE });

    expect(record.evidence).toBe(workspace);
  });

  // a scratch-directory removal failure must not cost the judgment
  // already decided. this module has no CLI of its own and writes nothing to
  // disk, so the warning is carried in the returned record rather than
  // written to stderr — see runScriptJudgment's own doc comment. reverting
  // factor-judgment.mjs's fix — collapsing judgeWithScript back into
  // runScriptJudgment's `try { … return X } finally { await rm(...) }` —
  // makes this fail: the planted rejection propagates past the return and
  // replaces it, so `judgeFactor(...)` rejects instead of resolving.
  it("returns the judgment, carrying a cleanup warning, when scratch-directory cleanup fails", async () => {
    const scenarioDir = await scenarioWithScript(PASSING_SCRIPT);
    const workspace = await tempDir();
    const factor = {
      id: "f1",
      phase: "discovery",
      judgment: { method: "script", script: "scripts/check.mjs" },
    };
    const cleanup = await plantCleanupFailure({ pathIncludes: "evaluate-context-" });

    try {
      const record = await judgeFactor(factor, { scenarioDir, workspace, probe: PROBE });

      expect(cleanup.triggered).toBe(true);
      expect(record).toMatchObject({
        id: "f1",
        phase: "discovery",
        method: "script",
        result: true,
        evidence: "checked skillsInvoked",
      });
      expect(record.cleanupWarning).toMatch(/could not remove/);
      expect(record.cleanupWarning).toMatch(/planted cleanup failure/);
    } finally {
      cleanup.restore();
    }
  });
});

describe("judgeFactor — reasoning method", () => {
  const factor = {
    id: "f1",
    phase: "transcript",
    judgment: { method: "reasoning", model: "anthropic/claude-haiku-4-5-20251001", instructions: "look closely" },
  };

  it("records the judge's model and the full prompt on a normal verdict", async () => {
    const fetchImpl = async () => ({
      ok: true,
      json: async () => ({ content: [{ type: "text", text: '{"result": true, "evidence": "quoted"}' }] }),
    });
    const record = await judgeFactor(factor, { scenarioDir: "/unused", workspace: "/unused", probe: PROBE, apiKey: "k", fetchImpl });

    expect(record.result).toBe(true);
    expect(record.evidence).toBe("quoted");
    expect(record.judge).toEqual({ model: "anthropic/claude-haiku-4-5-20251001" });
    expect(record.prompt).toContain("look closely");
    expect(record.prompt).toContain(JSON.stringify(PROBE.transcript));
  });

  it("errors, carrying judge and prompt, when no API key was given", async () => {
    const record = await judgeFactor(factor, { scenarioDir: "/unused", workspace: "/unused", probe: PROBE });

    expect(record.result).toEqual({ error: expect.stringContaining("no reasoning-judge API key") });
    expect(record.judge).toEqual({ model: "anthropic/claude-haiku-4-5-20251001" });
    expect(record.prompt).toContain("look closely");
  });

  // negative control 5/5: a judge returning something unreadable yields an
  // errored judgment carrying its reason — never `false` — and still
  // records the judge and the prompt, so the failed attempt is auditable.
  it("errors, never `false`, and still records judge and prompt, when the judge's answer is unreadable", async () => {
    const fetchImpl = async () => ({
      ok: true,
      json: async () => ({ content: [{ type: "text", text: "I'm not totally sure, honestly." }] }),
    });
    const record = await judgeFactor(factor, { scenarioDir: "/unused", workspace: "/unused", probe: PROBE, apiKey: "k", fetchImpl });

    expect(record.result).not.toBe(false);
    expect(record.result.error).toMatch(/held no JSON object/);
    expect(record.judge).toEqual({ model: "anthropic/claude-haiku-4-5-20251001" });
    expect(record.prompt).toContain("look closely");
  });
});
