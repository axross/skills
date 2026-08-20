// compareToolSurface / describeToolSurface: what the instrument declared
// against what the CLI reported, and the lines a run writes about the
// difference.
//
// the declarations are passed in rather than imported from
// probe-process.mjs, so these cases keep asserting the comparison itself
// when the real lists move. the cases that do pin the real lists are
// in probe-process.test.mjs, where those lists are the subject.

import { describe, expect, it } from "vitest";

import { compareToolSurface, describeToolSurface } from "../../tools/evaluation/src/tool-surface.mjs";

const ALLOWED = ["Bash", "Read", "Write"];
const DISALLOWED = ["Agent", "WebFetch"];

describe("compareToolSurface()", () => {
  it("reports nothing when the reported surface is exactly the declared allowances", () => {
    const disagreements = compareToolSurface({
      reported: ["Bash", "Read", "Write"],
      allowed: ALLOWED,
      disallowed: DISALLOWED,
    });

    expect(disagreements).toEqual({
      allowedNotSurfaced: [],
      deniedButSurfaced: [],
      undeclared: [],
    });
  });

  it("names an allowance the CLI did not surface, which is what TodoWrite was", () => {
    const disagreements = compareToolSurface({
      reported: ["Bash", "Read"],
      allowed: [...ALLOWED, "TodoWrite"],
      disallowed: DISALLOWED,
    });

    expect(disagreements.allowedNotSurfaced).toEqual(["TodoWrite", "Write"]);
    expect(disagreements.deniedButSurfaced).toEqual([]);
  });

  it("names a denial the CLI surfaced anyway", () => {
    const disagreements = compareToolSurface({
      reported: ["Bash", "Read", "Write", "WebFetch"],
      allowed: ALLOWED,
      disallowed: DISALLOWED,
    });

    expect(disagreements.deniedButSurfaced).toEqual(["WebFetch"]);
    expect(disagreements.undeclared).toEqual([]);
  });

  it("names a surfaced tool neither list declares", () => {
    const disagreements = compareToolSurface({
      reported: ["Bash", "Read", "Write", "Workflow", "ToolSearch"],
      allowed: ALLOWED,
      disallowed: DISALLOWED,
    });

    expect(disagreements.undeclared).toEqual(["ToolSearch", "Workflow"]);
  });

  it("sorts every list, so two probes of one run record the same bytes", () => {
    const disagreements = compareToolSurface({
      reported: ["Workflow", "Bash", "CronList", "Artifact", "Read", "Write"],
      allowed: ALLOWED,
      disallowed: DISALLOWED,
    });

    expect(disagreements.undeclared).toEqual(["Artifact", "CronList", "Workflow"]);
  });

  describe("when the transcript reported no surface at all", () => {
    it("returns null rather than reporting every allowance as missing", () => {
      expect(compareToolSurface({ reported: null, allowed: ALLOWED, disallowed: DISALLOWED })).toBeNull();
    });

    it("tells that apart from a surface reported as empty", () => {
      const empty = compareToolSurface({ reported: [], allowed: ALLOWED, disallowed: DISALLOWED });

      expect(empty).not.toBeNull();
      expect(empty.allowedNotSurfaced).toEqual(["Bash", "Read", "Write"]);
    });
  });
});

describe("describeToolSurface()", () => {
  it("writes one line per non-empty disagreement, denials first", () => {
    const lines = describeToolSurface({
      allowedNotSurfaced: ["TodoWrite"],
      deniedButSurfaced: ["WebFetch"],
      undeclared: ["Workflow"],
    });

    expect(lines).toEqual([
      "denied but reported available: WebFetch",
      "allowed but not reported available: TodoWrite",
      "reported available but declared by neither list: Workflow",
    ]);
  });

  it("writes nothing when the declarations and the reported surface agreed", () => {
    expect(describeToolSurface({ allowedNotSurfaced: [], deniedButSurfaced: [], undeclared: [] })).toEqual([]);
  });

  it("writes nothing when there was no surface to compare", () => {
    expect(describeToolSurface(null)).toEqual([]);
  });
});
