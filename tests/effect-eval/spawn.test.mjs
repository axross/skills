// the declared configuration, and the argv derived from it.
//
// the round trip is the point. a stored metadata.json claims to account for how
// its probe was invoked, and that claim is worth something only if rebuilding
// the argv from the stored configuration reproduces the argv the probe used.

import { describe, expect, it } from "vitest";

import {
  ALLOWED_TOOLS,
  buildArgv,
  buildConfiguration,
  DISALLOWED_TOOLS,
  MODEL,
  shellQuote,
  TURN_CAP,
} from "../../tools/effect-eval/src/spawn.mjs";

const aConfiguration = (overrides = {}) =>
  buildConfiguration({
    projectName: "tsuzuri",
    projectTree: "sha256:abc",
    prompt: "shared/resolve-translation.ts has no tests. Add unit tests for it.",
    targetModule: "shared/resolve-translation.ts",
    ...overrides,
  });

describe("the configuration → argv round trip", () => {
  it("reproduces the argv from a configuration that has been through JSON", () => {
    // what the stored record goes through: serialized, read back, rebuilt.
    const configuration = aConfiguration({ skills: { "unit-testing": "sha256:def" } });
    const used = buildArgv(configuration);

    const stored = JSON.parse(JSON.stringify({ configuration })).configuration;

    expect(buildArgv(stored)).toEqual(used);
  });

  it("takes every variable flag from the configuration and nowhere else", () => {
    const argv = buildArgv(
      aConfiguration({ prompt: "a different task", targetModule: "shared/other.ts" }),
    );
    expect(argv).toEqual([
      "-p",
      "a different task",
      "--output-format",
      "stream-json",
      "--verbose",
      "--model",
      MODEL,
      "--max-turns",
      String(TURN_CAP),
      "--allowedTools",
      ALLOWED_TOOLS.join(","),
      "--disallowedTools",
      DISALLOWED_TOOLS.join(","),
      "--setting-sources",
      "project",
    ]);
  });

  it("carries --setting-sources project on every invocation", () => {
    // the one isolation lever available, and both conditions take it alike.
    expect(buildArgv(aConfiguration())).toContain("--setting-sources");
    expect(buildArgv(aConfiguration({ skills: { "unit-testing": "sha256:d" } }))).toContain(
      "project",
    );
  });

  it("refuses to guess at a missing field rather than silently defaulting it", () => {
    // a silently-defaulted flag is the drift the round trip exists to catch.
    const configuration = aConfiguration();
    delete configuration.runtime.options.maxTurns;
    expect(() => buildArgv(configuration)).toThrow(/runtime\.options\.maxTurns/);
  });

  it("names every missing field at once, not only the first", () => {
    expect(() => buildArgv({})).toThrow(/task\.prompt.*model\.model/s);
  });
});

describe("buildConfiguration", () => {
  it("leaves the skills map empty for the skill-absent condition", () => {
    expect(aConfiguration().skills).toEqual({});
  });

  it("copies rather than aliases the caller's skills map", () => {
    const skills = { "unit-testing": "sha256:def" };
    const configuration = aConfiguration({ skills });
    skills["late-addition"] = "sha256:ghi";
    expect(configuration.skills).toEqual({ "unit-testing": "sha256:def" });
  });

  it("records the runtime version as null when nothing reported one", () => {
    // distinct from a disagreement: an older CLI that says nothing must not
    // read as a probe that ran against the wrong version.
    expect(aConfiguration().runtime.version).toBeNull();
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
