// Offline tests for scripts/value-eval/spawn.mjs: the pure argv and
// environment builders probe.mjs spawns with. Nothing here spawns anything —
// see this file's sibling probe.test.mjs for the CLI-level dry-run proof
// that the real script never does either.

import { describe, expect, it } from "vitest";

import {
  ALLOWED_TOOLS,
  buildProbeEnvironment,
  buildSpawnArgs,
  DISALLOWED_TOOLS,
  MODEL,
  SETTING_SOURCES,
  TURN_CAP,
} from "../../scripts/value-eval/spawn.mjs";

describe("buildSpawnArgs", () => {
  it("passes --setting-sources project on every invocation", () => {
    const args = buildSpawnArgs("prompt text");
    expect(args).toEqual(expect.arrayContaining(["--setting-sources", "project"]));
  });

  // Unlike the capture, the argv IS the whole claim here: there is no `git`
  // behaviour to get wrong, only whether the flag is present and carries the
  // pinned value. Dropping the pin would silently revert every future run to
  // whatever the CLI defaults to, which is the drift the pin exists to stop —
  // so this fails rather than letting it happen quietly.
  it("pins the model on every invocation", () => {
    expect(MODEL).toBe("claude-sonnet-5");
    const args = buildSpawnArgs("prompt text");
    const flagIndex = args.indexOf("--model");
    expect(flagIndex).toBeGreaterThanOrEqual(0);
    expect(args[flagIndex + 1]).toBe(MODEL);
  });

  it("passes a turn cap of 100", () => {
    expect(TURN_CAP).toBe(100);
    const args = buildSpawnArgs("prompt text");
    const flagIndex = args.indexOf("--max-turns");
    expect(flagIndex).toBeGreaterThanOrEqual(0);
    expect(args[flagIndex + 1]).toBe("100");
  });

  it("permits Bash and the editing tools, unlike the discovery probe", () => {
    for (const tool of ["Bash", "Read", "Write", "Edit"]) {
      expect(ALLOWED_TOOLS).toContain(tool);
    }
  });

  it("keeps Skill allowed — whether the model invokes it is the axis being measured", () => {
    expect(ALLOWED_TOOLS).toContain("Skill");
  });

  it("denies the network and subagent tools nothing here needs", () => {
    for (const tool of ["WebFetch", "WebSearch", "Task", "Agent"]) {
      expect(DISALLOWED_TOOLS).toContain(tool);
    }
  });

  it("carries the prompt through as its own argument", () => {
    const args = buildSpawnArgs("shared/resolve-translation.ts has no tests. Add unit tests for it.");
    expect(args[0]).toBe("-p");
    expect(args[1]).toBe("shared/resolve-translation.ts has no tests. Add unit tests for it.");
  });

  it("requests the streaming JSON output the extractors parse", () => {
    const args = buildSpawnArgs("x");
    expect(args).toEqual(expect.arrayContaining(["--output-format", "stream-json", "--verbose"]));
  });

  it("SETTING_SOURCES is exactly the flag pair buildSpawnArgs uses", () => {
    expect(SETTING_SOURCES).toEqual(["--setting-sources", "project"]);
  });
});

describe("buildProbeEnvironment", () => {
  it("withholds anything credential-shaped", () => {
    const env = buildProbeEnvironment({
      PATH: "/usr/bin",
      GITHUB_TOKEN: "ghs_secret",
      NPM_CONFIG_PASSWORD: "hunter2",
      AWS_SECRET_ACCESS_KEY: "nope",
      SOME_API_KEY: "nope",
    });

    expect(env).toEqual({ PATH: "/usr/bin" });
  });

  it("keeps the CLI's own authentication, which it cannot run without", () => {
    const env = buildProbeEnvironment({
      CLAUDE_CODE_OAUTH_TOKEN: "keep",
      ANTHROPIC_API_KEY: "keep",
      GITHUB_TOKEN: "drop",
    });

    expect(env).toEqual({
      CLAUDE_CODE_OAUTH_TOKEN: "keep",
      ANTHROPIC_API_KEY: "keep",
    });
  });

  it("drops an undefined value rather than passing it through as a string", () => {
    const env = buildProbeEnvironment({ PATH: "/usr/bin", UNSET: undefined });
    expect(env).toEqual({ PATH: "/usr/bin" });
  });
});
