// Offline tests for the value-evaluation's transcript-shaped extraction:
// scripts/discovery-eval/stream.mjs's additive `parseTranscript` export, and
// scripts/value-eval/transcript.mjs built on top of it. Every fixture here is
// a synthetic JSONL string — never a live CLI, per this task's scope.

import { describe, expect, it } from "vitest";

import { parseTranscript } from "../../scripts/discovery-eval/stream.mjs";
import {
  DEFAULT_FORMAT_COMMAND_PATTERNS,
  DEFAULT_LINT_COMMAND_PATTERNS,
  DEFAULT_TEST_COMMAND_PATTERNS,
  extractTranscript,
} from "../../scripts/value-eval/transcript.mjs";

const line = (object) => `${JSON.stringify(object)}\n`;

const assistantMessage = (content) =>
  line({ type: "assistant", message: { content } });

const toolUse = (name, input) => ({ type: "tool_use", name, input });

const initEvent = ({ model, skills } = {}) =>
  line({
    type: "system",
    subtype: "init",
    ...(model !== undefined ? { model } : {}),
    ...(skills !== undefined ? { skills } : {}),
  });

const resultEvent = ({ cost = 0, turns, subtype = "success" } = {}) =>
  line({
    type: "result",
    subtype,
    total_cost_usd: cost,
    ...(turns !== undefined ? { num_turns: turns } : {}),
  });

describe("parseTranscript (scripts/discovery-eval/stream.mjs, additive)", () => {
  it("reads every tool_use block, not only Skill, in stream order with repeats kept", () => {
    const stdout =
      assistantMessage([toolUse("Read", { file_path: "a.ts" })]) +
      assistantMessage([
        toolUse("Bash", { command: "npm test" }),
        toolUse("Skill", { skill: "unit-testing" }),
      ]) +
      assistantMessage([toolUse("Read", { file_path: "a.ts" })]);

    const { toolCalls } = parseTranscript(stdout);

    expect(toolCalls).toEqual([
      { name: "Read", input: { file_path: "a.ts" } },
      { name: "Bash", input: { command: "npm test" } },
      { name: "Skill", input: { skill: "unit-testing" } },
      { name: "Read", input: { file_path: "a.ts" } },
    ]);
  });

  it("reads num_turns and total_cost_usd from the result event", () => {
    const stdout = resultEvent({ cost: 1.23, turns: 42 });

    const { turns, cost } = parseTranscript(stdout);

    expect(turns).toBe(42);
    expect(cost).toBe(1.23);
  });

  it("reports truncated from result.subtype: error_max_turns, not from length", () => {
    const short = resultEvent({ subtype: "error_max_turns" });
    const long =
      Array.from({ length: 50 }, (_, i) =>
        assistantMessage([toolUse("Read", { file_path: `file-${i}.ts` })]),
      ).join("") + resultEvent({ subtype: "success" });

    expect(parseTranscript(short).truncated).toBe(true);
    // A far LONGER transcript that never reports error_max_turns must read as
    // NOT truncated — proof the signal is the field, not the line count.
    expect(parseTranscript(long).truncated).toBe(false);
  });

  it("reads the loaded-skill list and the model exactly as parseStream does", () => {
    const stdout = initEvent({ model: "claude-opus-5", skills: ["code-review", "run"] });

    const { loaded, model } = parseTranscript(stdout);

    expect(loaded).toEqual(["code-review", "run"]);
    expect(model).toBe("claude-opus-5");
  });

  it("returns null loaded (not []) when the stream never reported a skill list", () => {
    expect(parseTranscript("").loaded).toBeNull();
  });

  it("survives an unparseable line, same forgiving behaviour as parseStream", () => {
    const stdout = initEvent({ model: "m" }) + '{"type":"result","total_cos';
    expect(parseTranscript(stdout).model).toBe("m");
  });
});

describe("extractTranscript (scripts/value-eval/transcript.mjs)", () => {
  it("extracts files read (deduplicated, first-occurrence order)", () => {
    const stdout =
      assistantMessage([toolUse("Read", { file_path: "shared/resolve-translation.ts" })]) +
      assistantMessage([toolUse("Read", { file_path: "shared/blog-post-slug.ts" })]) +
      assistantMessage([toolUse("Read", { file_path: "shared/resolve-translation.ts" })]);

    const { filesRead } = extractTranscript(stdout);

    expect(filesRead).toEqual(["shared/resolve-translation.ts", "shared/blog-post-slug.ts"]);
  });

  it("extracts commands run, in order, keeping repeats", () => {
    const stdout =
      assistantMessage([toolUse("Bash", { command: "npm test" })]) +
      assistantMessage([toolUse("Bash", { command: "npm test" })]) +
      assistantMessage([toolUse("Bash", { command: "npm run lint" })]);

    const { commandsRun } = extractTranscript(stdout);

    expect(commandsRun).toEqual(["npm test", "npm test", "npm run lint"]);
  });

  it("detects whether the tests, the linter, and the formatter ran, independently", () => {
    const stdout =
      assistantMessage([toolUse("Bash", { command: "npm test" })]) +
      assistantMessage([toolUse("Bash", { command: "echo just poking around" })]);

    const { ranTests, ranLint, ranFormat } = extractTranscript(stdout);

    expect(ranTests).toBe(true);
    expect(ranLint).toBe(false);
    expect(ranFormat).toBe(false);
  });

  it("recognizes the mock fixture's real lint and format commands", () => {
    const lintStdout = assistantMessage([toolUse("Bash", { command: "npm run lint" })]);
    const formatStdout = assistantMessage([
      toolUse("Bash", { command: "npm run format:check" }),
    ]);
    const biomeStdout = assistantMessage([toolUse("Bash", { command: "biome check ." })]);

    expect(extractTranscript(lintStdout).ranLint).toBe(true);
    expect(extractTranscript(formatStdout).ranFormat).toBe(true);
    expect(extractTranscript(biomeStdout).ranLint).toBe(true);
  });

  it("accepts caller-supplied command patterns for a different toolchain", () => {
    const stdout = assistantMessage([toolUse("Bash", { command: "make check" })]);

    const withDefaults = extractTranscript(stdout);
    const withOverride = extractTranscript(stdout, { testPatterns: [/\bmake\s+check\b/] });

    expect(withDefaults.ranTests).toBe(false);
    expect(withOverride.ranTests).toBe(true);
  });

  it("ignores a Bash call with no string command and a Read call with no string path", () => {
    const stdout =
      assistantMessage([toolUse("Bash", {})]) + assistantMessage([toolUse("Read", {})]);

    const { filesRead, commandsRun } = extractTranscript(stdout);

    expect(filesRead).toEqual([]);
    expect(commandsRun).toEqual([]);
  });

  it("passes through turns, cost, truncated, and loadedSkills untouched", () => {
    const stdout =
      initEvent({ model: "m", skills: ["code-review"] }) +
      resultEvent({ cost: 0.42, turns: 7, subtype: "error_max_turns" });

    const result = extractTranscript(stdout);

    expect(result.turns).toBe(7);
    expect(result.cost).toBe(0.42);
    expect(result.truncated).toBe(true);
    expect(result.loadedSkills).toEqual(["code-review"]);
    expect(result.model).toBe("m");
  });

  it("returns the empty/default shape for an empty stream", () => {
    expect(extractTranscript("")).toEqual({
      filesRead: [],
      commandsRun: [],
      ranTests: false,
      ranLint: false,
      ranFormat: false,
      turns: null,
      cost: 0,
      truncated: false,
      loadedSkills: null,
      model: null,
    });
  });

  it("exports non-empty default pattern sets", () => {
    expect(DEFAULT_TEST_COMMAND_PATTERNS.length).toBeGreaterThan(0);
    expect(DEFAULT_LINT_COMMAND_PATTERNS.length).toBeGreaterThan(0);
    expect(DEFAULT_FORMAT_COMMAND_PATTERNS.length).toBeGreaterThan(0);
  });
});
