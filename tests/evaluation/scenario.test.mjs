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
    description: "Whether the thing got done, stated so a reader can disagree without reading its factors.",
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
        description: "Whether the thing got done, stated so a reader can disagree without reading the script.",
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
    ["description", { description: "" }, /"description"/],
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

  // the maintainer settled this at the clarify gate for #407: a scenario's
  // own `description` is a required, non-empty declared part of its shape,
  // the same treatment a factor's `description` received in #398.
  it("rejects a scenario with no `description` key at all", () => {
    const scenario = validScenario();
    delete scenario.description;
    expect(() => validateScenario(scenario, "test.json")).toThrow(/"description"/);
  });

  it("rejects an unknown factor phase", () => {
    const scenario = validScenario({
      factors: [
        { id: "x", phase: "sideways", description: "d", judgment: { method: "script", script: "s.mjs" } },
      ],
    });
    expect(() => validateScenario(scenario, "test.json")).toThrow(/phase must be one of/);
  });

  it("rejects an unknown judgment method", () => {
    const scenario = validScenario({
      factors: [{ id: "x", phase: "outcome", description: "d", judgment: { method: "vibes" } }],
    });
    expect(() => validateScenario(scenario, "test.json")).toThrow(/judgment\.method/);
  });

  it("rejects a script factor with no script named", () => {
    const scenario = validScenario({
      factors: [{ id: "x", phase: "outcome", description: "d", judgment: { method: "script" } }],
    });
    expect(() => validateScenario(scenario, "test.json")).toThrow(/judgment\.script/);
  });

  it("rejects a reasoning factor missing a model or instructions", () => {
    const noModel = validScenario({
      factors: [
        {
          id: "x",
          phase: "transcript",
          description: "d",
          judgment: { method: "reasoning", instructions: "look" },
        },
      ],
    });
    expect(() => validateScenario(noModel, "test.json")).toThrow(/judgment\.model/);

    const noInstructions = validScenario({
      factors: [
        {
          id: "x",
          phase: "transcript",
          description: "d",
          judgment: { method: "reasoning", model: "anthropic/x" },
        },
      ],
    });
    expect(() => validateScenario(noInstructions, "test.json")).toThrow(/judgment\.instructions/);
  });

  it("rejects a duplicate factor id", () => {
    const scenario = validScenario({
      factors: [
        {
          id: "dup",
          phase: "outcome",
          description: "one",
          judgment: { method: "script", script: "a.mjs" },
        },
        {
          id: "dup",
          phase: "outcome",
          description: "two",
          judgment: { method: "script", script: "b.mjs" },
        },
      ],
    });
    expect(() => validateScenario(scenario, "test.json")).toThrow(/duplicates/);
  });

  // docs/glossary.md's old Evaluation case entry required exactly this — "a
  // written rationale a human can disagree with without reading code" — and
  // no decision record retired it when the model was rebuilt around factors.
  it("rejects a factor with no description at all", () => {
    const scenario = validScenario({
      factors: [{ id: "x", phase: "outcome", judgment: { method: "script", script: "a.mjs" } }],
    });
    expect(() => validateScenario(scenario, "test.json")).toThrow(/description/);
  });

  it("rejects a factor with an empty-string description", () => {
    const scenario = validScenario({
      factors: [
        { id: "x", phase: "outcome", description: "", judgment: { method: "script", script: "a.mjs" } },
      ],
    });
    expect(() => validateScenario(scenario, "test.json")).toThrow(/description/);
  });

  // the plan's own non-goal: "do not estimate cost... in any form". A
  // budget-shaped key anywhere in the document is rejected, not only at the
  // top level. assertNoBudgetField runs before the allow-list
  // (assertOnlyKnownKeys) in validateScenario, so the guard gets first
  // refusal on a budget-shaped top-level key: its own message, not the
  // allow-list's (which would also name the key, for an unrelated reason),
  // is what a scenario document sees. The assertion checks for that
  // guard-specific phrasing rather than the bare key, so this negative
  // control fails again if the guard itself ever stops catching the key —
  // #406 owns widening the pattern it matches.
  it.each(["budgetUsd", "costCeiling", "dollarCap", "maxCostUsd", "priceUsd"])(
    "rejects a top-level %s key as a budget-shaped field",
    (key) => {
      const scenario = { ...validScenario(), [key]: 5 };
      expect(() => validateScenario(scenario, "test.json")).toThrow(new RegExp(`${key} looks like a budget`));
    },
  );

  // #407: the allow-list admits `judgment.expect` without looking inside it
  // (its keys are the judgment script's own vocabulary), so this guard is
  // what still catches a budget-shaped key nested inside it.
  it("rejects a budget-shaped key nested inside a judgment's own `expect`", () => {
    const scenario = validScenario({
      factors: [
        {
          id: "x",
          phase: "outcome",
          description: "d",
          judgment: { method: "script", script: "a.mjs", expect: { costCap: 5 } },
        },
      ],
    });
    expect(() => validateScenario(scenario, "test.json")).toThrow(/budget|dollar|cost|cap/i);
  });

  // #407: an allow-list check beside the presence checks — a key the
  // instrument does not read fails at load, named at the path it sits on.
  describe("the key allow-list", () => {
    it("rejects a scenario carrying `repetitionsPerCondition`", () => {
      const scenario = { ...validScenario(), repetitionsPerCondition: 3 };
      expect(() => validateScenario(scenario, "test.json")).toThrow(/repetitionsPerCondition/);
    });

    it("rejects an arbitrary unknown top-level key, naming it at its path", () => {
      const scenario = { ...validScenario(), notAField: true };
      expect(() => validateScenario(scenario, "test.json")).toThrow(/notAField/);
    });

    it("rejects a `harness` key other than `agentsMd`, naming the offending path", () => {
      const scenario = validScenario({ harness: { agentsMd: false, subagents: [] } });
      expect(() => validateScenario(scenario, "test.json")).toThrow(/harness\.subagents/);
    });

    it("rejects a `task` key other than `prompt`, naming the offending path", () => {
      const scenario = validScenario({ task: { prompt: "Do the thing.", extra: true } });
      expect(() => validateScenario(scenario, "test.json")).toThrow(/task\.extra/);
    });

    it("rejects a factor key other than id, phase, description, or judgment — including a misspelling sitting beside the correct field", () => {
      const scenario = validScenario({
        factors: [
          {
            id: "x",
            phse: "outcome",
            phase: "outcome",
            description: "d",
            judgment: { method: "script", script: "a.mjs" },
          },
        ],
      });
      expect(() => validateScenario(scenario, "test.json")).toThrow(/factors\[0\]\.phse/);
    });

    it("rejects a script judgment carrying `model`", () => {
      const scenario = validScenario({
        factors: [
          {
            id: "x",
            phase: "outcome",
            description: "d",
            judgment: { method: "script", script: "a.mjs", model: "anthropic/x" },
          },
        ],
      });
      expect(() => validateScenario(scenario, "test.json")).toThrow(/judgment\.model/);
    });

    it("rejects a script judgment carrying `instructions`", () => {
      const scenario = validScenario({
        factors: [
          {
            id: "x",
            phase: "outcome",
            description: "d",
            judgment: { method: "script", script: "a.mjs", instructions: "look" },
          },
        ],
      });
      expect(() => validateScenario(scenario, "test.json")).toThrow(/judgment\.instructions/);
    });

    it("rejects a reasoning judgment carrying `script`", () => {
      const scenario = validScenario({
        factors: [
          {
            id: "x",
            phase: "transcript",
            description: "d",
            judgment: { method: "reasoning", model: "anthropic/x", instructions: "look", script: "a.mjs" },
          },
        ],
      });
      expect(() => validateScenario(scenario, "test.json")).toThrow(/judgment\.script/);
    });

    it("rejects a reasoning judgment carrying `expect`", () => {
      const scenario = validScenario({
        factors: [
          {
            id: "x",
            phase: "transcript",
            description: "d",
            judgment: { method: "reasoning", model: "anthropic/x", instructions: "look", expect: {} },
          },
        ],
      });
      expect(() => validateScenario(scenario, "test.json")).toThrow(/judgment\.expect/);
    });

    it("accepts a script judgment's `expect` and examines nothing inside it", () => {
      const scenario = validScenario({
        factors: [
          {
            id: "x",
            phase: "outcome",
            description: "d",
            judgment: {
              method: "script",
              script: "a.mjs",
              expect: { file: "src/x.ts", mustContainAll: ["y"] },
            },
          },
        ],
      });
      expect(() => validateScenario(scenario, "test.json")).not.toThrow();
    });
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
  it("finds all four scenarios this repository declares, sorted by id", async () => {
    const scenarios = await loadAllScenarios(SCENARIOS_ROOT);
    expect(scenarios.map((scenario) => scenario.id)).toEqual([
      "confirm-a-draft-save-like-a-publish-does",
      "give-the-empty-post-list-a-real-empty-state",
      "quiet-the-stale-post-list-after-a-draft-save",
      "respect-reduced-motion-in-the-publish-toast",
    ]);
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
