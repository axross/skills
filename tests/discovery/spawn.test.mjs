// the declared configuration, the argv derived from it, and the dry-run path
// through runProbe — no test here spawns the CLI.

import { describe, expect, it } from "vitest";

import { MODEL, SETTING_SOURCES, shellQuote } from "../../tools/evaluation/src/spawn.mjs";
import { planFor } from "../../tools/evaluation/readings/discovery/src/plan.mjs";
import {
  BARE_DISALLOWED_TOOLS,
  buildArgv,
  buildConfiguration,
  runProbe,
  SITUATED_DISALLOWED_TOOLS,
  syntheticTranscript,
} from "../../tools/evaluation/readings/discovery/src/spawn.mjs";

const testCase = {
  id: "invalidate-a-stale-list-after-a-write",
  prompt: "Saving a draft leaves the title and timestamp on the post list stale.",
  mock: "inkwell",
  population: "discovered",
  mustInclude: ["tanstack-query-development"],
  mustExclude: ["next-app-development"],
  mayInclude: [],
  rationale: "because.",
};

describe("buildConfiguration", () => {
  it("carries a situated plan's tools, turns and workspace through", () => {
    const plan = planFor(testCase);
    const configuration = buildConfiguration({ plan, projectTree: "sha256:tree", testCase });
    expect(configuration.runtime.options.allowedTools).toEqual(["Read", "Glob", "Grep", "Skill"]);
    expect(configuration.runtime.options.disallowedTools).toEqual(SITUATED_DISALLOWED_TOOLS);
    expect(configuration.runtime.options.maxTurns).toBe(plan.turns);
    expect(configuration.workspace).toEqual({ mode: "situated", mock: "inkwell", tree: "sha256:tree" });
    expect(configuration.model.model).toBe(MODEL);
  });

  it("carries a bare plan's narrower tool set, and never a project tree", () => {
    const bareCase = { id: "x", prompt: "p", population: "discovered", mustInclude: ["a"], mustExclude: [], mayInclude: [], rationale: "r" };
    const plan = planFor(bareCase);
    const configuration = buildConfiguration({ plan, projectTree: "sha256:should-be-ignored", testCase: bareCase });
    expect(configuration.runtime.options.allowedTools).toEqual(["Skill"]);
    expect(configuration.runtime.options.disallowedTools).toEqual(BARE_DISALLOWED_TOOLS);
    expect(configuration.workspace).toEqual({ mode: "bare", mock: null, tree: null });
  });

  it("denies ToolSearch in a bare probe — allowedTools: [\"Skill\"] alone did not keep it out", () => {
    // measured records from a real dispatch: 3 of 12 bare probes spent their
    // whole turn cap on a ToolSearch call, under a configuration whose
    // allowedTools was exactly ["Skill"]. Declaring it denied is this
    // instrument's fix; see spawn.mjs's BARE_DISALLOWED_TOOLS for what is and
    // is not established about the CLI actually honouring it.
    const bareCase = { id: "x", prompt: "p", population: "discovered", mustInclude: ["a"], mustExclude: [], mayInclude: [], rationale: "r" };
    const plan = planFor(bareCase);
    const configuration = buildConfiguration({ plan, testCase: bareCase });
    expect(configuration.runtime.options.disallowedTools).toContain("ToolSearch");
    expect(BARE_DISALLOWED_TOOLS).toContain("ToolSearch");
  });

  it("carries --setting-sources project on every invocation", () => {
    const plan = planFor(testCase);
    const configuration = buildConfiguration({ plan, testCase });
    expect(configuration.runtime.options.settingSources).toEqual(SETTING_SOURCES);
  });

  it("copies rather than aliases the caller's skills and invocability maps", () => {
    const plan = planFor(testCase);
    const skills = { alpha: "sha256:a" };
    const configuration = buildConfiguration({ plan, testCase, skills });
    skills.beta = "sha256:b";
    expect(configuration.skills).toEqual({ alpha: "sha256:a" });
  });

  it("lifts the case's labels into the configuration for later verdict derivation", () => {
    const plan = planFor(testCase);
    const configuration = buildConfiguration({ plan, testCase });
    expect(configuration.case).toEqual({
      id: testCase.id,
      prompt: testCase.prompt,
      mock: "inkwell",
      population: "discovered",
      mustInclude: ["tanstack-query-development"],
      mustExclude: ["next-app-development"],
      mayInclude: [],
      rationale: "because.",
    });
  });
});

describe("the configuration -> argv round trip", () => {
  it("reproduces the argv from a configuration that has been through JSON", () => {
    const plan = planFor(testCase);
    const configuration = buildConfiguration({ plan, projectTree: "sha256:tree", testCase });
    const used = buildArgv(configuration);
    const stored = JSON.parse(JSON.stringify({ configuration })).configuration;
    expect(buildArgv(stored)).toEqual(used);
  });

  it("takes every variable flag from the configuration and nowhere else", () => {
    const plan = planFor(testCase, { turnCap: 12 });
    const argv = buildArgv(buildConfiguration({ plan, testCase }));
    expect(argv).toEqual([
      "-p",
      testCase.prompt,
      "--output-format",
      "stream-json",
      "--verbose",
      "--model",
      MODEL,
      "--max-turns",
      "12",
      "--allowedTools",
      "Read,Glob,Grep,Skill",
      "--disallowedTools",
      SITUATED_DISALLOWED_TOOLS.join(","),
      "--setting-sources",
      "project",
    ]);
  });

  it("refuses to guess at a missing field rather than silently defaulting it", () => {
    const plan = planFor(testCase);
    const configuration = buildConfiguration({ plan, testCase });
    delete configuration.runtime.options.maxTurns;
    expect(() => buildArgv(configuration)).toThrow(/runtime\.options\.maxTurns/);
  });

  it("names every missing field at once, not only the first", () => {
    expect(() => buildArgv({})).toThrow(/case\.prompt.*model\.model/s);
  });
});

describe("shellQuote", () => {
  it("leaves a plain argument alone", () => {
    expect(shellQuote("--max-turns")).toBe("--max-turns");
  });

  it("quotes a prompt so a pasted command is the command described", () => {
    expect(shellQuote("two words")).toBe("'two words'");
  });

  it("survives an embedded single quote", () => {
    expect(shellQuote("it's")).toBe(`'it'\\''s'`);
  });
});

describe("syntheticTranscript", () => {
  it("is shaped like a real one-turn success, so the rest of the pipeline has something to parse", () => {
    const plan = planFor(testCase);
    const configuration = buildConfiguration({ plan, testCase });
    const transcript = syntheticTranscript(configuration);
    const lines = transcript.trim().split("\n").map((line) => JSON.parse(line));
    expect(lines[0]).toMatchObject({ type: "system", subtype: "init", model: MODEL });
    expect(lines[1]).toMatchObject({ type: "result", subtype: "success" });
  });
});

describe("runProbe — the dry-run path (the only one a test may exercise)", () => {
  it("spawns nothing and returns a synthetic transcript", () => {
    const plan = planFor(testCase);
    const configuration = buildConfiguration({ plan, testCase });
    const { rawStdout, cliExitCode, argv } = runProbe(configuration, { workspace: "/nonexistent", dryRun: true });
    expect(cliExitCode).toBeNull();
    expect(rawStdout).toContain(MODEL);
    expect(argv).toContain(testCase.prompt);
  });
});
