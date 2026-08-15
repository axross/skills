// computeDerivedSummary: each factor's pass rates and differential from the
// measured tier (every probe's factors), and the shape summary.json is
// declared to carry — the aggregate and nothing else.

import { describe, expect, it } from "vitest";

import { computeDerivedSummary } from "../../tools/evaluation/src/derive-summary.mjs";

function probe(condition, repetition, factorResults) {
  return {
    condition,
    repetition,
    factors: Object.entries(factorResults).map(([id, result]) => ({ id, result })),
  };
}

describe("computeDerivedSummary", () => {
  it("carries the aggregate and nothing else — no `comparable` field, no per-probe entry", () => {
    const summary = computeDerivedSummary({
      scenarioId: "s",
      measurementId: "s-abcd1234",
      factorDeclarations: [{ id: "f1", phase: "outcome" }],
      probes: [
        probe("skill-present", 1, { f1: true }),
        probe("skill-absent", 1, { f1: false }),
      ],
      comparablePredecessor: null,
    });
    expect(summary).not.toHaveProperty("comparable");
    expect(summary).not.toHaveProperty("probes");
    expect(summary.factors).toEqual([
      expect.objectContaining({ id: "f1", skillPresentPassRate: 1, skillAbsentPassRate: 0, differential: 1 }),
    ]);
  });

  it("computes an outcome factor's differential as present rate minus absent rate", () => {
    const summary = computeDerivedSummary({
      scenarioId: "s",
      measurementId: "m",
      factorDeclarations: [{ id: "f1", phase: "outcome" }],
      probes: [
        probe("skill-present", 1, { f1: true }),
        probe("skill-present", 2, { f1: true }),
        probe("skill-present", 3, { f1: false }),
        probe("skill-absent", 1, { f1: false }),
        probe("skill-absent", 2, { f1: false }),
        probe("skill-absent", 3, { f1: true }),
      ],
      comparablePredecessor: null,
    });
    const factor = summary.factors[0];
    expect(factor.skillPresentPassRate).toBeCloseTo(2 / 3);
    expect(factor.skillAbsentPassRate).toBeCloseTo(1 / 3);
    expect(factor.differential).toBeCloseTo(1 / 3);
  });

  // docs/specs/skill-evaluation.md, "The differential": a discovery factor's
  // differential is read as the skill-present pass rate alone, since the
  // absent condition cannot pass one by construction.
  it("reads a discovery factor's differential as the skill-present pass rate alone", () => {
    const summary = computeDerivedSummary({
      scenarioId: "s",
      measurementId: "m",
      factorDeclarations: [{ id: "discovers", phase: "discovery" }],
      probes: [
        probe("skill-present", 1, { discovers: true }),
        probe("skill-present", 2, { discovers: false }),
        probe("skill-absent", 1, { discovers: false }),
        probe("skill-absent", 2, { discovers: false }),
      ],
      comparablePredecessor: null,
    });
    expect(summary.factors[0].differential).toBeCloseTo(0.5);
    expect(summary.factors[0].skillPresentPassRate).toBeCloseTo(0.5);
  });

  // negative control 1/5 (the derive.mjs half): an errored judgment
  // produces a differential of `null`, distinguishable from the JSON number
  // `0` — never treated as a failing (0) result.
  it("reports `null`, never `0`, when a probe's judgment for a factor errored", () => {
    const summary = computeDerivedSummary({
      scenarioId: "s",
      measurementId: "m",
      factorDeclarations: [{ id: "f1", phase: "outcome" }],
      probes: [
        probe("skill-present", 1, { f1: true }),
        probe("skill-present", 2, { f1: { error: "the script exited 1" } }),
        probe("skill-absent", 1, { f1: false }),
      ],
      comparablePredecessor: null,
    });
    const factor = summary.factors[0];
    expect(factor.differential).toBeNull();
    expect(factor.differential).not.toBe(0);
    expect(factor.reason).toMatch(/errored/);
    // the condition carrying the error reports no rate either: 1 of its 2
    // probes was never judged, so 0.5 would put an unreached result in the
    // denominator. the condition that judged cleanly still reports its own.
    expect(factor.skillPresentPassRate).toBeNull();
    expect(factor.skillAbsentPassRate).toBe(0);
  });

  // the all-errored case reads worst of all: every rate the old code could
  // produce here was `0`, which is indistinguishable at a glance from "judged,
  // and nothing passed".
  it("reports a `null` pass rate, never `0`, when every result under a condition errored", () => {
    const summary = computeDerivedSummary({
      scenarioId: "s",
      measurementId: "m",
      factorDeclarations: [{ id: "f1", phase: "outcome" }],
      probes: [
        probe("skill-present", 1, { f1: { error: "the script exited 1" } }),
        probe("skill-present", 2, { f1: { error: "the script exited 1" } }),
        probe("skill-absent", 1, { f1: true }),
      ],
      comparablePredecessor: null,
    });
    const factor = summary.factors[0];
    expect(factor.skillPresentPassRate).toBeNull();
    expect(factor.skillPresentPassRate).not.toBe(0);
    expect(factor.differential).toBeNull();
    expect(factor.reason).toMatch(/errored/);
  });

  it("reports `null` when a condition recorded no probes for a factor at all", () => {
    const summary = computeDerivedSummary({
      scenarioId: "s",
      measurementId: "m",
      factorDeclarations: [{ id: "f1", phase: "outcome" }],
      probes: [probe("skill-present", 1, { f1: true })],
      comparablePredecessor: null,
    });
    const factor = summary.factors[0];
    expect(factor.differential).toBeNull();
    expect(factor.skillAbsentPassRate).toBeNull();
    expect(factor.reason).toMatch(/no skill-absent probe/);
  });

  it("counts probes by condition", () => {
    const summary = computeDerivedSummary({
      scenarioId: "s",
      measurementId: "m",
      factorDeclarations: [{ id: "f1", phase: "outcome" }],
      probes: [
        probe("skill-present", 1, { f1: true }),
        probe("skill-present", 2, { f1: true }),
        probe("skill-absent", 1, { f1: false }),
      ],
      comparablePredecessor: null,
    });
    expect(summary.probeCount).toBe(3);
    expect(summary.probeCountByCondition).toEqual({ "skill-present": 2, "skill-absent": 1 });
  });

  it("carries the comparable-predecessor link through unchanged", () => {
    const predecessor = { id: "earlier-measurement", timestamp: "2026-01-01T00:00:00Z" };
    const summary = computeDerivedSummary({
      scenarioId: "s",
      measurementId: "m",
      factorDeclarations: [{ id: "f1", phase: "outcome" }],
      probes: [probe("skill-present", 1, { f1: true }), probe("skill-absent", 1, { f1: false })],
      comparablePredecessor: predecessor,
    });
    expect(summary.comparablePredecessor).toEqual(predecessor);
  });
});
