// the budget guard, as one decision before the spend.

import { describe, expect, it } from "vitest";

import { admitCase, meanProbeCost, reconcile } from "../../tools/discovery-eval/src/admission.mjs";

const base = {
  caseId: "invalidate-a-stale-list-after-a-write",
  probeCount: 2,
  declaredCapUsd: 40,
  unmeasuredProbeCostCeilingUsd: 0.35,
};

describe("meanProbeCost", () => {
  it("is null with no history, so a caller must fall back deliberately", () => {
    expect(meanProbeCost([])).toBeNull();
  });

  it("ignores a zero, which means 'no cost was reported' rather than 'free'", () => {
    expect(meanProbeCost([0, 0.2, 0.4])).toBeCloseTo(0.3);
  });
});

describe("admitCase", () => {
  it("admits when the projection fits, and says what it projected from", () => {
    const decision = admitCase(base);
    expect(decision.admitted).toBe(true);
    expect(decision.projectedTotalUsd).toBeCloseTo(0.7);
    expect(decision.basis).toBe("the fixture's declared ceiling");
  });

  it("refuses when the projection exceeds the cap", () => {
    const decision = admitCase({ ...base, declaredCapUsd: 0.5 });
    expect(decision.admitted).toBe(false);
    expect(decision.reason).toMatch(/REFUSED/);
  });

  it("prefers committed measurements over the declared ceiling", () => {
    const decision = admitCase({ ...base, historicalCosts: [1, 1, 1] });
    expect(decision.basis).toBe("committed measurements");
    expect(decision.projectedTotalUsd).toBe(2);
  });

  it("lets a dispatch LOWER the declared cap", () => {
    const decision = admitCase({ ...base, requestedCapUsd: 0.5 });
    expect(decision.capUsd).toBe(0.5);
    expect(decision.admitted).toBe(false); // $0.70 projected against $0.50
    expect(decision.reason).toMatch(/lowered from the declared \$40\.00/);
  });

  it("ignores a dispatch trying to RAISE it, and says so", () => {
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

  it("rejects a non-integer probe count", () => {
    expect(() => admitCase({ ...base, probeCount: 1.5 })).toThrow(/probeCount must be a positive integer/);
  });
});

describe("reconcile", () => {
  it("reports a run that stayed within its cap, and how far the projection was off", () => {
    const result = reconcile({ capUsd: 40, projectedTotalUsd: 0.7, actualTotalUsd: 0.5 });
    expect(result.withinCap).toBe(true);
    expect(result.projectionErrorUsd).toBeCloseTo(-0.2);
  });

  it("names an overrun as evidence the projection was too low", () => {
    const result = reconcile({ capUsd: 1, projectedTotalUsd: 0.7, actualTotalUsd: 1.5 });
    expect(result.withinCap).toBe(false);
    expect(result.overrunUsd).toBeCloseTo(0.5);
    expect(result.reason).toMatch(/too low/);
  });
});
