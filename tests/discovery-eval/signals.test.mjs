// the per-probe signal extractor: turns, terminal reason, paths read before
// the first Skill selection, and the selection itself — deterministic, from
// a hand-built transcript. no test here spawns the CLI.

import { describe, expect, it } from "vitest";

import {
  extractSignals,
  pathsBeforeFirstSelection,
  skillsSelected,
} from "../../tools/discovery-eval/src/signals.mjs";

const line = (event) => JSON.stringify(event);

/** a situated probe that reads a file, globs, greps, then selects one skill. */
const READS_THEN_SELECTS = [
  line({ type: "system", subtype: "init", model: "claude-sonnet-5", version: "2.1.220", skills: [] }),
  line({
    type: "assistant",
    message: { content: [{ type: "tool_use", name: "Read", input: { file_path: "README.md" } }] },
  }),
  line({
    type: "assistant",
    message: {
      content: [{ type: "tool_use", name: "Glob", input: { pattern: "*.ts", path: "src" } }],
    },
  }),
  line({
    type: "assistant",
    message: {
      content: [{ type: "tool_use", name: "Grep", input: { pattern: "invalidateQueries" } }],
    },
  }),
  line({
    type: "assistant",
    message: {
      content: [{ type: "tool_use", name: "Skill", input: { skill: "tanstack-query-development" } }],
    },
  }),
  line({ type: "result", subtype: "success", num_turns: 4, total_cost_usd: 0.31 }),
].join("\n");

/** a situated probe that never finishes: the runaway guard binds. */
const RUNS_OUT_OF_TURNS = [
  line({ type: "system", subtype: "init", model: "claude-sonnet-5", skills: [] }),
  line({
    type: "assistant",
    message: { content: [{ type: "tool_use", name: "Read", input: { file_path: "README.md" } }] },
  }),
  line({ type: "result", subtype: "error_max_turns", num_turns: 40, total_cost_usd: 1.2 }),
].join("\n");

/**
 * a bare probe that DID select a skill before the cap fired — matching
 * measured records from a real dispatch: under BARE_TURN_CAP, a probe that
 * calls Skill reports num_turns: 2 and terminates error_max_turns even though
 * the selection is already made. `probe-8c7b8c5b`/`edit-an-issue-body...` from
 * that dispatch is this shape.
 */
const SELECTS_THEN_HITS_THE_CAP = [
  line({ type: "system", subtype: "init", model: "claude-sonnet-5", version: "2.1.220", skills: [] }),
  line({
    type: "assistant",
    message: { content: [{ type: "tool_use", name: "Skill", input: { skill: "github-operation" } }] },
  }),
  line({ type: "result", subtype: "error_max_turns", num_turns: 2, total_cost_usd: 0.08 }),
].join("\n");

describe("pathsBeforeFirstSelection", () => {
  const calls = [
    { name: "Read", input: { file_path: "a.ts" } },
    { name: "Glob", input: { pattern: "*.test.ts" } },
    { name: "Glob", input: { pattern: "*.ts", path: "src" } },
    { name: "Grep", input: { pattern: "foo", path: "lib" } },
    { name: "Skill", input: { skill: "x" } },
    { name: "Read", input: { file_path: "after-selection.ts" } },
  ];

  it("reports Read/Glob/Grep targets, in order, up to but excluding the first Skill call", () => {
    expect(pathsBeforeFirstSelection(calls)).toEqual([
      { tool: "Read", target: "a.ts" },
      { tool: "Glob", target: "*.test.ts" },
      { tool: "Glob", target: "src/*.ts" },
      { tool: "Grep", target: "lib: foo" },
    ]);
  });

  it("never reports anything after the first Skill call", () => {
    const targets = pathsBeforeFirstSelection(calls);
    expect(targets.some((entry) => entry.target === "after-selection.ts")).toBe(false);
  });

  it("deduplicates by (tool, target) in first-appearance order", () => {
    const repeated = [
      { name: "Read", input: { file_path: "a.ts" } },
      { name: "Read", input: { file_path: "a.ts" } },
      { name: "Skill", input: { skill: "x" } },
    ];
    expect(pathsBeforeFirstSelection(repeated)).toEqual([{ tool: "Read", target: "a.ts" }]);
  });

  it("is empty when the very first call is a Skill selection", () => {
    expect(pathsBeforeFirstSelection([{ name: "Skill", input: { skill: "x" } }])).toEqual([]);
  });

  it("is empty when no Skill call appears at all — still reports nothing past a call that never happens", () => {
    expect(
      pathsBeforeFirstSelection([{ name: "Read", input: { file_path: "a.ts" } }]),
    ).toEqual([{ tool: "Read", target: "a.ts" }]);
  });
});

describe("skillsSelected", () => {
  it("reads every Skill call's selection, in order, deduplicated", () => {
    const calls = [
      { name: "Skill", input: { skill: "a" } },
      { name: "Skill", input: { skill: "b" } },
      { name: "Skill", input: { skill: "a" } },
    ];
    expect(skillsSelected(calls)).toEqual(["a", "b"]);
  });

  it("reduces a plugin-qualified name to the skill itself", () => {
    expect(skillsSelected([{ name: "Skill", input: { skill: "myplugin:code-review" } }])).toEqual([
      "code-review",
    ]);
  });

  it("ignores a non-Skill call", () => {
    expect(skillsSelected([{ name: "Read", input: { file_path: "a.ts" } }])).toEqual([]);
  });
});

describe("extractSignals", () => {
  it("reports turns, success, paths read before selection, and the selection, for a clean run", () => {
    const signals = extractSignals(READS_THEN_SELECTS);
    expect(signals.turns).toBe(4);
    expect(signals.terminalReason).toBe("success");
    expect(signals.readable).toBe(true);
    expect(signals.pathsBeforeSelection).toEqual([
      { tool: "Read", target: "README.md" },
      { tool: "Glob", target: "src/*.ts" },
      { tool: "Grep", target: "invalidateQueries" },
    ]);
    expect(signals.selectedSkills).toEqual(["tanstack-query-development"]);
    expect(signals.model).toBe("claude-sonnet-5");
    expect(signals.runtimeVersion).toBe("2.1.220");
    expect(signals.costUsd).toBe(0.31);
  });

  it("marks a probe that terminates on error_max_turns with no selection unreadable, not a selection of nothing", () => {
    const signals = extractSignals(RUNS_OUT_OF_TURNS);
    expect(signals.terminalReason).toBe("error_max_turns");
    expect(signals.readable).toBe(false);
    // null, not [] — a caller must never fold this into a zero-hit tally.
    expect(signals.selectedSkills).toBeNull();
    expect(signals.turns).toBe(40);
  });

  it("still reports what it read before truncating, even though the probe is unreadable", () => {
    const signals = extractSignals(RUNS_OUT_OF_TURNS);
    expect(signals.pathsBeforeSelection).toEqual([{ tool: "Read", target: "README.md" }]);
  });

  it("marks a probe readable when it selected a skill before error_max_turns fired, carrying the selection", () => {
    const signals = extractSignals(SELECTS_THEN_HITS_THE_CAP);
    expect(signals.terminalReason).toBe("error_max_turns");
    // this is the defect issue #343 names: a probe that plainly selected
    // github-operation must not be discarded just because the cap fired on
    // the very next turn.
    expect(signals.readable).toBe(true);
    expect(signals.selectedSkills).toEqual(["github-operation"]);
    expect(signals.turns).toBe(2);
  });

  it("reports 'unknown' and unreadable for a stream with no result event at all", () => {
    const noResult = [
      line({ type: "system", subtype: "init", model: "claude-sonnet-5", skills: [] }),
    ].join("\n");
    const signals = extractSignals(noResult);
    expect(signals.terminalReason).toBe("unknown");
    expect(signals.readable).toBe(false);
    expect(signals.selectedSkills).toBeNull();
  });

  it("tolerates a truncated final line rather than discarding the whole transcript", () => {
    const truncated = `${READS_THEN_SELECTS}\n{"type":"result","subtype":"succ`;
    const signals = extractSignals(truncated);
    expect(signals.selectedSkills).toEqual(["tanstack-query-development"]);
  });
});
