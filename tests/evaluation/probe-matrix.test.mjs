// expandMatrix: every (scenario, condition, repetition) triple a run would
// take, in a stable order — the count admission.mjs is asked to admit or
// refuse.

import { describe, expect, it } from "vitest";

import { CONDITIONS, DEFAULT_REPETITIONS, expandMatrix } from "../../tools/evaluation/src/probe-matrix.mjs";

describe("expandMatrix", () => {
  it("defaults to both conditions and the spec's default repetition count", () => {
    const plan = expandMatrix([{ id: "a" }]);
    expect(plan).toHaveLength(CONDITIONS.length * DEFAULT_REPETITIONS);
    expect(new Set(plan.map((probe) => probe.condition))).toEqual(new Set(CONDITIONS));
  });

  it("multiplies across every scenario given", () => {
    const plan = expandMatrix([{ id: "a" }, { id: "b" }], { conditions: ["skill-present"], repetitions: 2 });
    expect(plan).toHaveLength(4);
    expect(plan.filter((probe) => probe.scenarioId === "a")).toHaveLength(2);
    expect(plan.filter((probe) => probe.scenarioId === "b")).toHaveLength(2);
  });

  it("numbers repetitions 1-based", () => {
    const plan = expandMatrix([{ id: "a" }], { conditions: ["skill-present"], repetitions: 3 });
    expect(plan.map((probe) => probe.repetition)).toEqual([1, 2, 3]);
  });

  it("honors a narrowed condition list", () => {
    const plan = expandMatrix([{ id: "a" }], { conditions: ["skill-absent"], repetitions: 1 });
    expect(plan).toEqual([{ scenarioId: "a", condition: "skill-absent", repetition: 1 }]);
  });

  it("rejects a non-positive repetition count", () => {
    expect(() => expandMatrix([{ id: "a" }], { repetitions: 0 })).toThrow(/positive integer/);
    expect(() => expandMatrix([{ id: "a" }], { repetitions: -1 })).toThrow(/positive integer/);
    expect(() => expandMatrix([{ id: "a" }], { repetitions: 1.5 })).toThrow(/positive integer/);
  });

  it("rejects an unknown condition", () => {
    expect(() => expandMatrix([{ id: "a" }], { conditions: ["skill-sideways"] })).toThrow(/Unknown condition/);
  });

  it("returns an empty matrix for an empty scenario list", () => {
    expect(expandMatrix([])).toEqual([]);
  });
});
