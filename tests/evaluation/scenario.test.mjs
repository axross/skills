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

  // #407: a null factor entry (a plausible half-removed array element) must
  // not reach assertOnlyKnownKeys's Object.keys and surface as a raw,
  // path-free TypeError — it gets this validator's normal, path-naming
  // failure instead, the same treatment assertNoBudgetField already gives a
  // null value.
  it("rejects a null factor entry with a clean, path-naming error rather than a raw TypeError", () => {
    const scenario = validScenario({ factors: [null] });
    expect(() => validateScenario(scenario, "test.json")).toThrow(/factors\[0\] must be an object/);
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
  // is what a scenario document sees. Each rejection below therefore checks
  // for that guard-specific phrasing rather than the bare key, so a control
  // fails again if the guard itself ever stops catching the key.
  it.each([
    "budget",
    "budgetUsd",
    "cap",
    "usdCap",
    "costUsd",
    "costCeiling",
    "costCap",
    "dollarCap",
    "dollarLimit",
    "maxCostUsd",
    "priceUsd",
    "priceCeiling",
    "unmeasuredProbeCostCeilingUsd",
  ])("rejects a top-level %s key as a budget-shaped field", (key) => {
    const scenario = { ...validScenario(), [key]: 5 };
    expect(() => validateScenario(scenario, "test.json")).toThrow(new RegExp(`${key} looks like a budget`));
  });

  // #406: \bcap\b never fires once a word character follows "cap", so these
  // five slipped past the old substring guard untouched.
  it("rejects a top-level capUsd key, naming the path, the key, and the matched word", () => {
    const scenario = { ...validScenario(), capUsd: 5 };
    expect(() => validateScenario(scenario, "test.json")).toThrow(/test\.json\.capUsd.*"cap"/);
  });

  it.each(["capUSD", "capUsdCeiling", "maxSpend", "spendLimit"])(
    "rejects the top-level %s key that slipped through the old substring guard",
    (key) => {
      const scenario = { ...validScenario(), [key]: 5 };
      expect(() => validateScenario(scenario, "test.json")).toThrow(new RegExp(`${key} looks like a budget`));
    },
  );

  // #406 revision 2: this guard briefly matched a whole word against a fixed
  // root plus an s/es/ed/ing ending list, and that list could not keep up
  // with how English actually spells these inflections — "priced" drops the
  // silent e, and "costly"/"budgetary" aren't endings at all. Matching a
  // root as a word-prefix instead catches the whole class in one rule
  // rather than one literal per spelling.
  it.each(["priced", "pricey", "costly", "budgetary", "budgets", "costs", "spending"])(
    "rejects the within-word derivation %s that a word-exact rule would drop",
    (key) => {
      const scenario = { ...validScenario(), [key]: 5 };
      expect(() => validateScenario(scenario, "test.json")).toThrow(new RegExp(`${key} looks like a budget`));
    },
  );

  // cap stays a whole word rather than a prefix — a cap prefix would fire on
  // capture/capability below — so every form it takes is listed outright in
  // FORBIDDEN_WORDS rather than produced by an ending rule: the plural, and
  // the two inflections English spells with a doubled consonant. each is
  // named here, so dropping one from that set fails a test rather than
  // quietly widening what a scenario may declare.
  it.each(["caps", "capped", "capping"])(
    "rejects %s, a form of cap that only an outright listing catches",
    (key) => {
      const scenario = { ...validScenario(), [key]: 5 };
      expect(() => validateScenario(scenario, "test.json")).toThrow(new RegExp(`"${key}"`));
    },
  );

  it.each(["max_spend", "cap-usd"])("rejects the snake_case or kebab-case budget key %s", (key) => {
    const scenario = { ...validScenario(), [key]: 5 };
    expect(() => validateScenario(scenario, "test.json")).toThrow(new RegExp(`${key} looks like a budget`));
  });

  // the acceptance side of this guard is exercised inside `judgment.expect`
  // rather than at the scenario's top level. #407's allow-list refuses any
  // top-level key the instrument does not read, so a top-level probe would
  // be rejected for a reason that has nothing to do with word matching, and
  // the control would pass for the wrong reason or fail for one. `expect` is
  // the one subtree the allow-list deliberately does not reach, which makes
  // it the only place a key's verdict is attributable to this guard alone.
  const withExpectKey = (key) =>
    validScenario({
      factors: [
        {
          id: "x",
          phase: "outcome",
          description: "d",
          judgment: { method: "script", script: "a.mjs", expect: { [key]: 5 } },
        },
      ],
    });

  it.each(["capture", "capability", "recap"])(
    "accepts the %s key, whose text merely contains a forbidden word",
    (key) => {
      expect(() => validateScenario(withExpectKey(key), "test.json")).not.toThrow();
    },
  );

  // two disclosed limits, recorded here as the behavior they are so neither
  // is discovered later as a surprise (plan's Assumptions section).

  // costume begins with "cost" and is refused, an accepted false positive:
  // refusing a key unrelated to budgets is the safe direction for a guard
  // whose failure mode is admitting one, and costume is not a plausible key
  // in a scenario document.
  it("rejects costume, an accepted false positive", () => {
    expect(() => validateScenario(withExpectKey("costume"), "test.json")).toThrow(/"costume"/);
  });

  // unpriced buries "price" behind "un" — a root preceded by other letters
  // inside one word is out of reach of any word-level rule, and closing it
  // would mean returning to the substring matching that produced the capUsd
  // gap this guard exists to fix. a residual gap, disclosed rather than
  // closed.
  it("accepts unpriced, a residual gap disclosed rather than closed", () => {
    expect(() => validateScenario(withExpectKey("unpriced"), "test.json")).not.toThrow();
  });

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

  // #406: the key the whole issue is about, checked below the top level as
  // well — this is where a per-case cap would actually be written now that
  // the allow-list holds the levels above it.
  it("rejects a capUsd key nested inside a judgment's own `expect`", () => {
    expect(() => validateScenario(withExpectKey("capUsd"), "test.json")).toThrow(/"cap"/);
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
