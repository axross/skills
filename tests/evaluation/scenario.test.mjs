// loading and validating scenario.json: the real declared scenario loads
// clean, and each structural or budget-shaped defect is caught by name.

import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { repoPath } from "../helpers/run.mjs";
import { tempDir, writeFileIn } from "../helpers/fixtures.mjs";
import {
  loadAllScenarios,
  loadScenario,
  skillsForCondition,
  validateScenario,
} from "../../tools/evaluation/src/scenario.mjs";

const SCENARIOS_ROOT = repoPath("tools/evaluation/scenarios");

/** a minimal scenario.json that validateScenario accepts on its own. */
function validScenario(overrides = {}) {
  return {
    id: "example-scenario",
    mock: "tsuzuri",
    targetSkills: ["unit-testing"],
    peerSkills: [],
    patch: null,
    harness: { agentsMd: false },
    task: { prompt: "Do the thing." },
    factors: [
      {
        id: "a-factor",
        phase: "outcome",
        judgment: { method: "script", script: "scripts/check.mjs" },
      },
    ],
    ...overrides,
  };
}

describe("validateScenario", () => {
  it("accepts a well-formed scenario", () => {
    expect(() => validateScenario(validScenario(), "test.json")).not.toThrow();
  });

  it.each([
    ["id", { id: "" }, /"id"/],
    ["mock", { mock: "" }, /"mock"/],
    ["targetSkills", { targetSkills: [] }, /"targetSkills"/],
    ["peerSkills", { peerSkills: "not-an-array" }, /"peerSkills"/],
    ["harness", { harness: null }, /"harness"/],
    ["harness.agentsMd", { harness: {} }, /agentsMd/],
    ["task.prompt", { task: {} }, /task\.prompt/],
    ["factors", { factors: [] }, /"factors"/],
  ])("rejects a missing or malformed %s", (_label, overrides, pattern) => {
    expect(() => validateScenario({ ...validScenario(), ...overrides }, "test.json")).toThrow(pattern);
  });

  it("rejects a scenario with no `patch` key at all", () => {
    const scenario = validScenario();
    delete scenario.patch;
    expect(() => validateScenario(scenario, "test.json")).toThrow(/"patch"/);
  });

  it("rejects an unknown factor phase", () => {
    const scenario = validScenario({
      factors: [{ id: "x", phase: "sideways", judgment: { method: "script", script: "s.mjs" } }],
    });
    expect(() => validateScenario(scenario, "test.json")).toThrow(/phase must be one of/);
  });

  it("rejects an unknown judgment method", () => {
    const scenario = validScenario({
      factors: [{ id: "x", phase: "outcome", judgment: { method: "vibes" } }],
    });
    expect(() => validateScenario(scenario, "test.json")).toThrow(/judgment\.method/);
  });

  it("rejects a script factor with no script named", () => {
    const scenario = validScenario({
      factors: [{ id: "x", phase: "outcome", judgment: { method: "script" } }],
    });
    expect(() => validateScenario(scenario, "test.json")).toThrow(/judgment\.script/);
  });

  it("rejects a reasoning factor missing a model or instructions", () => {
    const noModel = validScenario({
      factors: [{ id: "x", phase: "transcript", judgment: { method: "reasoning", instructions: "look" } }],
    });
    expect(() => validateScenario(noModel, "test.json")).toThrow(/judgment\.model/);

    const noInstructions = validScenario({
      factors: [{ id: "x", phase: "transcript", judgment: { method: "reasoning", model: "anthropic/x" } }],
    });
    expect(() => validateScenario(noInstructions, "test.json")).toThrow(/judgment\.instructions/);
  });

  it("rejects a duplicate factor id", () => {
    const scenario = validScenario({
      factors: [
        { id: "dup", phase: "outcome", judgment: { method: "script", script: "a.mjs" } },
        { id: "dup", phase: "outcome", judgment: { method: "script", script: "b.mjs" } },
      ],
    });
    expect(() => validateScenario(scenario, "test.json")).toThrow(/duplicates/);
  });

  // the plan's own non-goal: "do not estimate cost... in any form". A
  // budget-shaped key anywhere in the document is rejected, not only at the
  // top level.
  it.each(["budgetUsd", "costCeiling", "dollarCap", "maxCostUsd", "priceUsd"])(
    "rejects a top-level %s key as a budget-shaped field",
    (key) => {
      const scenario = { ...validScenario(), [key]: 5 };
      expect(() => validateScenario(scenario, "test.json")).toThrow(/budget|dollar|cost|cap/i);
    },
  );

  it("rejects a budget-shaped key nested inside a factor", () => {
    const scenario = validScenario({
      factors: [
        {
          id: "x",
          phase: "outcome",
          judgment: { method: "script", script: "a.mjs" },
          expect: { costCap: 5 },
        },
      ],
    });
    expect(() => validateScenario(scenario, "test.json")).toThrow(/budget|dollar|cost|cap/i);
  });
});

describe("loadScenario", () => {
  it("loads and validates this repository's own declared scenario", async () => {
    const scenario = await loadScenario(
      join(SCENARIOS_ROOT, "quiet-the-stale-post-list-after-a-draft-save"),
    );
    expect(scenario.id).toBe("quiet-the-stale-post-list-after-a-draft-save");
    expect(scenario.factors.length).toBeGreaterThan(0);
    expect(scenario.dir).toContain("quiet-the-stale-post-list-after-a-draft-save");
  });

  it("throws naming the path when scenario.json is missing", async () => {
    const dir = await tempDir();
    await expect(loadScenario(dir)).rejects.toThrow(/No scenario\.json/);
  });

  it("throws when scenario.json is not valid JSON", async () => {
    const dir = await tempDir();
    await writeFileIn(dir, "scenario.json", "{ not json");
    await expect(loadScenario(dir)).rejects.toThrow(/not valid JSON/);
  });
});

describe("loadAllScenarios", () => {
  it("finds exactly the one scenario this repository declares", async () => {
    const scenarios = await loadAllScenarios(SCENARIOS_ROOT);
    expect(scenarios).toHaveLength(1);
    expect(scenarios[0].id).toBe("quiet-the-stale-post-list-after-a-draft-save");
  });

  it("returns an empty array for a root that does not exist", async () => {
    const scenarios = await loadAllScenarios(repoPath("tools/evaluation/nonexistent-scenarios"));
    expect(scenarios).toEqual([]);
  });
});

describe("skillsForCondition", () => {
  const scenario = { targetSkills: ["a"], peerSkills: ["b", "c"] };

  it("installs target plus peer skills in the skill-present condition", () => {
    expect(skillsForCondition(scenario, "skill-present")).toEqual(["a", "b", "c"]);
  });

  it("installs only peer skills in the skill-absent condition", () => {
    expect(skillsForCondition(scenario, "skill-absent")).toEqual(["b", "c"]);
  });

  it("throws on an unknown condition", () => {
    expect(() => skillsForCondition(scenario, "skill-sideways")).toThrow(/Unknown condition/);
  });
});
