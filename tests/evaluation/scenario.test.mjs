// loading and validating scenario.json: the real declared scenario loads
// clean, and each structural or budget-shaped defect is caught by name.

import { readdir } from "node:fs/promises";
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

  // a scenario's own `description` is a required, non-empty declared part
  // of its shape — the same treatment a factor's `description` receives.
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
    expect(() => validateScenario(scenario, "test.json")).toThrow(/"phase" must be one of/);
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

  // a null factor entry (a plausible half-removed array element) must
  // not surface as a raw, path-free TypeError — it gets this validator's
  // normal, path-naming failure instead. the schema's own `type` on a factor
  // is what refuses it now, and the message still names the position.
  it("rejects a null factor entry with a clean, path-naming error rather than a raw TypeError", () => {
    const scenario = validScenario({ factors: [null] });
    expect(() => validateScenario(scenario, "test.json")).toThrow(/factors\[0\] — a factor must be an object/);
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
  // top level. a budget-shaped top-level key fails two of the schema's
  // rules at once — `propertyNames` and `additionalProperties` — and
  // validateScenario prefers the first, so the guard gets first refusal and
  // its own message, not the closed-key one (which would also name the key,
  // for an unrelated reason), is what a scenario document sees. Each rejection below therefore checks
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

  // \bcap\b never fires once a word character follows "cap", so these
  // five slipped past the old substring guard untouched.
  it("rejects a top-level capUsd key, naming the path and the key", () => {
    const scenario = { ...validScenario(), capUsd: 5 };
    expect(() => validateScenario(scenario, "test.json")).toThrow(/test\.json\.capUsd.*"capUsd"/);
  });

  it.each(["capUSD", "capUsdCeiling", "maxSpend", "spendLimit"])(
    "rejects the top-level %s key that slipped through the old substring guard",
    (key) => {
      const scenario = { ...validScenario(), [key]: 5 };
      expect(() => validateScenario(scenario, "test.json")).toThrow(new RegExp(`${key} looks like a budget`));
    },
  );

  // this guard briefly matched a whole word against a fixed
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
  // the schema's `nonBudgetKey` pattern rather than produced by an ending
  // rule: the plural, and the two inflections English spells with a doubled
  // consonant. each is named here, so dropping one from that pattern fails a
  // test rather than quietly widening what a scenario may declare.
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

  // the acceptance side of this guard is exercised inside `judgment.input`
  // rather than at the scenario's top level. the closed key set refuses
  // any top-level key the instrument does not read, so a top-level probe would
  // be rejected for a reason that has nothing to do with word matching, and
  // the control would pass for the wrong reason or fail for one. `input` is
  // the one subtree the schema deliberately leaves open — a judgment script's
  // own arguments, which it validates itself — which makes it the only place
  // a key's verdict is attributable to this guard alone.
  const withInputKey = (key) =>
    validScenario({
      factors: [
        {
          id: "x",
          phase: "outcome",
          description: "d",
          judgment: { method: "script", script: "a.mjs", input: { [key]: 5 } },
        },
      ],
    });

  it.each(["capture", "capability", "recap"])(
    "accepts the %s key, whose text merely contains a forbidden word",
    (key) => {
      expect(() => validateScenario(withInputKey(key), "test.json")).not.toThrow();
    },
  );

  // two disclosed limits, recorded here as the behavior they are so neither
  // is discovered later as a surprise (plan's Assumptions section).

  // costume begins with "cost" and is refused, an accepted false positive:
  // refusing a key unrelated to budgets is the safe direction for a guard
  // whose failure mode is admitting one, and costume is not a plausible key
  // in a scenario document.
  it("rejects costume, an accepted false positive", () => {
    expect(() => validateScenario(withInputKey("costume"), "test.json")).toThrow(/"costume"/);
  });

  // unpriced buries "price" behind "un" — a root preceded by other letters
  // inside one word is out of reach of any word-level rule, and closing it
  // would mean returning to the substring matching that produced the capUsd
  // gap this guard exists to fix. a residual gap, disclosed rather than
  // closed.
  it("accepts unpriced, a residual gap disclosed rather than closed", () => {
    expect(() => validateScenario(withInputKey("unpriced"), "test.json")).not.toThrow();
  });

  // the schema admits `judgment.input` without constraining what
  // shape an argument takes (its keys are the judgment script's own
  // vocabulary, validated by that script), so this guard is what still
  // catches a budget-shaped key nested inside it.
  it("rejects a budget-shaped key nested inside a judgment's own `input`", () => {
    const scenario = validScenario({
      factors: [
        {
          id: "x",
          phase: "outcome",
          description: "d",
          judgment: { method: "script", script: "a.mjs", input: { costCap: 5 } },
        },
      ],
    });
    expect(() => validateScenario(scenario, "test.json")).toThrow(/budget|dollar|cost|cap/i);
  });

  // capUsd, the pivotal budget key, checked below the top level as
  // well — this is where a per-case cap would actually be written now that
  // the closed key sets hold the levels above it.
  it("rejects a capUsd key nested inside a judgment's own `input`", () => {
    expect(() => validateScenario(withInputKey("capUsd"), "test.json")).toThrow(/"capUsd"/);
  });

  // a closed-key check beside the presence checks — a key the
  // instrument does not read fails at load, named at the path it sits on.
  describe("the closed key sets", () => {
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

    it("rejects a reasoning judgment carrying `input`", () => {
      const scenario = validScenario({
        factors: [
          {
            id: "x",
            phase: "transcript",
            description: "d",
            judgment: { method: "reasoning", model: "anthropic/x", instructions: "look", input: {} },
          },
        ],
      });
      expect(() => validateScenario(scenario, "test.json")).toThrow(/judgment\.input/);
    });

    it("accepts a script judgment's `input` and examines nothing inside it", () => {
      const scenario = validScenario({
        factors: [
          {
            id: "x",
            phase: "outcome",
            description: "d",
            judgment: {
              method: "script",
              script: "a.mjs",
              input: { file: "src/x.ts", mustContainAll: ["y"] },
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

// nothing in this block states how many scenarios this repository
// declares, because that is the one fact every scenario-adding branch
// changes. two such branches merging in sequence would otherwise leave
// `main` asserting a set that omits one of them — caught by CI, but as a
// mismatched array inside an assertion about counting, several steps from
// what went wrong. what the old exact-list assertion was really for is
// checked against the directory listing instead.
describe("loadAllScenarios", () => {
  it("loads and validates every scenario directory this repository declares", async () => {
    const entries = await readdir(SCENARIOS_ROOT, { withFileTypes: true });
    const declaredDirs = entries.filter((entry) => entry.isDirectory());
    // without this, a root that listed nothing would satisfy the length
    // check below against an empty load, and pass while measuring nothing.
    expect(declaredDirs.length).toBeGreaterThan(0);

    // loadScenario validates as it loads, so a malformed scenario.json
    // rejects here rather than being discovered inside a paid dispatch.
    const scenarios = await loadAllScenarios(SCENARIOS_ROOT);
    expect(scenarios).toHaveLength(declaredDirs.length);
  });

  it("gives every scenario a distinct id", async () => {
    const ids = (await loadAllScenarios(SCENARIOS_ROOT)).map((scenario) => scenario.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // against a fixture root rather than the real one on purpose: every
  // directory under tools/evaluation/scenarios/ is named for the id it
  // declares, so a readdir that already returns them in order would let a
  // loadAllScenarios that had dropped its sort pass anyway — the test would
  // be incapable of failing. here the directory order and the id order are
  // deliberately opposed.
  it("sorts by id rather than by directory name", async () => {
    const root = await tempDir();
    const declareScenario = (dirName, id) =>
      writeFileIn(root, join(dirName, "scenario.json"), JSON.stringify(validScenario({ id })));
    await declareScenario("a-directory", "zeta-scenario");
    await declareScenario("z-directory", "alpha-scenario");

    const scenarios = await loadAllScenarios(root);
    expect(scenarios.map((scenario) => scenario.id)).toEqual(["alpha-scenario", "zeta-scenario"]);
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

// the argument bag a judgment script is handed, named `input`. the schema
// does not describe its interior: the instrument copies it verbatim into the
// context file, and each script validates its own arguments where it uses
// them. what the schema still says is that the bag is an object and that no
// key inside it, at any depth, names a budget — the no-budget rule from
// docs/decisions/2026-08-18-validate-scenarios-with-a-zero-dependency-validator.md,
// which no script checks itself.
describe("a script judgment's input", () => {
  const withInput = (input) =>
    validScenario({
      factors: [
        {
          id: "x",
          phase: "outcome",
          description: "Whether the thing got done, stated so a reader can disagree without reading the script.",
          judgment: { method: "script", script: "scripts/check.mjs", input },
        },
      ],
    });

  it("rejects the retired `expect` spelling, so a missed rename fails rather than being ignored", () => {
    const scenario = validScenario({
      factors: [
        {
          id: "x",
          phase: "outcome",
          description: "Whether the thing got done, stated so a reader can disagree without reading the script.",
          judgment: { method: "script", script: "scripts/check.mjs", expect: { file: "a.ts" } },
        },
      ],
    });
    expect(() => validateScenario(scenario, "test.json")).toThrow(/judgment\.expect is not a field/);
  });

  it("is optional, since a script may read no arguments at all", () => {
    const scenario = validScenario();
    delete scenario.factors[0].judgment.input;
    expect(() => validateScenario(scenario, "test.json")).not.toThrow();
  });

  // the shapes below are deliberately unconstrained. an earlier draft allowed
  // only scalars and string lists, which described the corpus of the day and
  // presented it as a rule: it would have refused a future script with a
  // genuinely structured argument for no reason the instrument has.
  it.each([
    ["a string", { file: "src/x.ts" }],
    ["a number", { max: 1 }],
    ["a boolean", { requireLocale: false }],
    ["a string list", { mustContainAll: ["a", "b"] }],
    ["a nested list", { mustMentionEachOf: [["npm test", "run test"], ["lint"]] }],
    ["an empty list", { roots: [] }],
    ["a null", { dir: null }],
    ["a nested object", { opts: { deep: { deeper: 1 } } }],
    ["a list of objects", { rules: [{ a: 1 }, { b: 2 }] }],
  ])("accepts %s as an argument, leaving its shape to the script", (_label, input) => {
    expect(() => validateScenario(withInput(input), "test.json")).not.toThrow();
  });

  it.each([
    ["directly", { costCeiling: 1 }],
    ["one object down", { opts: { capUsd: 5 } }],
    ["three objects down", { a: { b: { c: { spendLimit: 1 } } } }],
    ["inside a list of objects", { rules: [{ ok: 1 }, { dollarCap: 2 }] }],
    ["inside a nested list of objects", { rules: [[{ budgetary: 1 }]] }],
  ])("rejects a budget-shaped key %s", (_label, input) => {
    expect(() => validateScenario(withInput(input), "test.json")).toThrow(/looks like a budget/);
  });

  it("accepts a nested structure carrying no budget-shaped key, so the guard is shown to discriminate", () => {
    expect(() => validateScenario(withInput({ a: { b: { c: [{ ok: 1 }] } } }), "test.json")).not.toThrow();
  });
});

// the judgment script is named as a path, not chosen from a list: the schema
// deliberately knows no script, so adding one needs no schema edit. what it
// does refuse is a path that could not be a script beside its own scenario.
describe("a script judgment's script path", () => {
  const withScript = (script) =>
    validScenario({
      factors: [
        {
          id: "x",
          phase: "outcome",
          description: "Whether the thing got done, stated so a reader can disagree without reading the script.",
          judgment: { method: "script", script },
        },
      ],
    });

  it("accepts a script this repository has never seen, since the schema names none", () => {
    expect(() => validateScenario(withScript("scripts/check-something-new.mjs"), "test.json")).not.toThrow();
  });

  it.each([
    ["an absolute path", "/etc/passwd.mjs"],
    ["a path that is not a module", "scripts/check.sh"],
    ["an empty path", ""],
  ])("rejects %s", (_label, script) => {
    expect(() => validateScenario(withScript(script), "test.json")).toThrow(/judgment\.script/);
  });
});

// the rename from `expect` to `input`, checked by exhaustion rather than by
// having looked: every scenario declares `input`, and every judgment script
// reads `context.input`.
// a single missed occurrence would starve its script of arguments, and would
// otherwise surface first inside a paid dispatch.
describe("the declared scenarios and their judgment scripts", () => {
  it("carry no `expect` key and no `context.expect` read", async () => {
    const { readFile } = await import("node:fs/promises");
    const entries = await readdir(SCENARIOS_ROOT, { withFileTypes: true });
    const offenders = [];
    for (const entry of entries.filter((candidate) => candidate.isDirectory())) {
      const scenarioPath = join(SCENARIOS_ROOT, entry.name, "scenario.json");
      if (/"expect"\s*:/.test(await readFile(scenarioPath, "utf8"))) offenders.push(scenarioPath);
      let scripts;
      try {
        scripts = await readdir(join(SCENARIOS_ROOT, entry.name, "scripts"));
      } catch {
        continue;
      }
      for (const script of scripts.filter((name) => name.endsWith(".mjs"))) {
        const scriptPath = join(SCENARIOS_ROOT, entry.name, "scripts", script);
        if ((await readFile(scriptPath, "utf8")).includes("context.expect")) offenders.push(scriptPath);
      }
    }
    expect(offenders).toEqual([]);
  });
});
