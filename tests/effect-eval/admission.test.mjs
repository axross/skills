// the budget guard, as one decision before the spend.

import { describe, expect, it } from "vitest";

import { admitCase, meanProbeCost, reconcile } from "../../tools/effect-eval/src/admission.mjs";

const base = {
  caseId: "add-unit-tests-for-an-untested-module",
  probeCount: 6,
  declaredCapUsd: 40,
  unmeasuredProbeCostCeilingUsd: 6,
};

describe("meanProbeCost", () => {
  it("is null with no history, so a caller must fall back deliberately", () => {
    expect(meanProbeCost([])).toBeNull();
  });

  it("ignores a zero, which means 'no cost was reported' rather than 'free'", () => {
    expect(meanProbeCost([0, 2, 4])).toBe(3);
  });
});

describe("admitCase", () => {
  it("admits when the projection fits, and says what it projected from", () => {
    const decision = admitCase(base);
    expect(decision.admitted).toBe(true);
    expect(decision.projectedTotalUsd).toBe(36);
    expect(decision.basis).toBe("the fixture's declared ceiling");
  });

  it("refuses when the projection exceeds the cap", () => {
    const decision = admitCase({ ...base, unmeasuredProbeCostCeilingUsd: 8 });
    expect(decision.admitted).toBe(false);
    expect(decision.reason).toMatch(/REFUSED/);
  });

  it("prefers committed measurements over the declared ceiling", () => {
    const decision = admitCase({ ...base, historicalCosts: [1, 1, 1] });
    expect(decision.basis).toBe("committed measurements");
    expect(decision.projectedTotalUsd).toBe(6);
  });

  it("lets a dispatch LOWER the declared cap", () => {
    const decision = admitCase({ ...base, requestedCapUsd: 20 });
    expect(decision.capUsd).toBe(20);
    expect(decision.admitted).toBe(false); // $36 projected against $20
    expect(decision.reason).toMatch(/lowered from the declared \$40\.00/);
  });

  it("ignores a dispatch trying to RAISE it, and says so", () => {
    // the fixture is reviewed and committed; a dispatch input is typed into a
    // form.
    const decision = admitCase({ ...base, requestedCapUsd: 999 });
    expect(decision.capUsd).toBe(40);
    expect(decision.reason).toMatch(/may lower the declared cap and may not raise it/);
  });

  it("refuses to run at all with no usable per-probe cost", () => {
    expect(() => admitCase({ ...base, unmeasuredProbeCostCeilingUsd: 0 })).toThrow(
      /no usable per-probe cost/,
    );
  });

  it("rejects a non-positive declared cap rather than admitting everything", () => {
    expect(() => admitCase({ ...base, declaredCapUsd: 0 })).toThrow(/declares no positive cap/);
  });
});

describe("reconcile", () => {
  it("reports a run that stayed within its cap, and how far the projection was off", () => {
    const result = reconcile({ capUsd: 40, projectedTotalUsd: 36, actualTotalUsd: 30 });
    expect(result.withinCap).toBe(true);
    expect(result.projectionErrorUsd).toBe(-6);
  });

  it("names an overrun as evidence the estimate is too low", () => {
    // reported, never enforced: the money is already spent, so its job is to
    // tell the next admission that its estimate is wrong.
    const result = reconcile({ capUsd: 40, projectedTotalUsd: 36, actualTotalUsd: 52 });
    expect(result.withinCap).toBe(false);
    expect(result.overrunUsd).toBe(12);
    expect(result.reason).toMatch(/too low/);
  });
});
