// case -> probe plan: mode, tools, turns, workspace kind.

import { describe, expect, it } from "vitest";

import {
  BARE_ALLOWED_TOOLS,
  BARE_TURN_CAP,
  planFor,
  PROVISIONAL_SITUATED_TURN_CAP,
  SITUATED_ALLOWED_TOOLS,
} from "../../tools/discovery-eval/src/plan.mjs";

describe("planFor", () => {
  it("runs a case declaring a mock situated: Read, Glob, Grep, Skill, a runaway turn cap", () => {
    const plan = planFor({ id: "x", mock: "tsuzuri" });
    expect(plan.mode).toBe("situated");
    expect(plan.tools).toEqual(["Read", "Glob", "Grep", "Skill"]);
    expect(plan.tools).toEqual(SITUATED_ALLOWED_TOOLS);
    expect(plan.turns).toBe(PROVISIONAL_SITUATED_TURN_CAP);
    expect(plan.workspace).toEqual({ kind: "mock", mock: "tsuzuri" });
    expect(plan.forcedBare).toBe(false);
  });

  it("runs a case declaring no mock bare: Skill only, one turn", () => {
    const plan = planFor({ id: "x" });
    expect(plan.mode).toBe("bare");
    expect(plan.tools).toEqual(["Skill"]);
    expect(plan.tools).toEqual(BARE_ALLOWED_TOOLS);
    expect(plan.turns).toBe(BARE_TURN_CAP);
    expect(plan.workspace).toEqual({ kind: "scratch" });
    expect(plan.forcedBare).toBe(false);
  });

  it("--head-skills forces a mock-declaring case bare", () => {
    const plan = planFor({ id: "x", mock: "tsuzuri" }, { headSkills: true });
    expect(plan.mode).toBe("bare");
    expect(plan.tools).toEqual(["Skill"]);
    expect(plan.turns).toBe(BARE_TURN_CAP);
    expect(plan.workspace).toEqual({ kind: "scratch" });
    expect(plan.forcedBare).toBe(true);
  });

  it("--head-skills on an already-bare case changes nothing, and does not claim to have forced it", () => {
    const plan = planFor({ id: "x" }, { headSkills: true });
    expect(plan.mode).toBe("bare");
    expect(plan.forcedBare).toBe(false);
  });

  it("honours an overridden turn cap for a situated case", () => {
    const plan = planFor({ id: "x", mock: "tsuzuri" }, { turnCap: 7 });
    expect(plan.turns).toBe(7);
  });

  it("never lets a turn-cap override change bare mode's cap", () => {
    const plan = planFor({ id: "x" }, { turnCap: 999 });
    expect(plan.turns).toBe(BARE_TURN_CAP);
  });

  it("refuses a case with no id", () => {
    expect(() => planFor({})).toThrow(/needs a case object carrying a non-empty "id"/);
  });

  it("refuses a non-positive turn cap", () => {
    expect(() => planFor({ id: "x", mock: "tsuzuri" }, { turnCap: 0 })).toThrow(/turnCap must be/);
  });

  it("treats an empty-string mock the same as no mock", () => {
    expect(planFor({ id: "x", mock: "" }).mode).toBe("bare");
  });
});
