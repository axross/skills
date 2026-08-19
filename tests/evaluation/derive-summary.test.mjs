// computeDerivedSummary: each factor's pass rates and differential from the
// measured tier (every probe's factors), and the shape summary.json is
// declared to carry — the aggregate and nothing else.

import { describe, expect, it } from "vitest";

import { computeDerivedSummary } from "../../tools/evaluation/src/derive-summary.mjs";

function probe(condition, repetition, factorResults, costUsd) {
  return {
    condition,
    repetition,
    factors: Object.entries(factorResults).map(([id, result]) => ({ id, result })),
    ...(costUsd === undefined ? {} : { costUsd }),
  };
}

describe("computeDerivedSummary", () => {
  // docs/specs/skill-evaluation.md, "What a measurement stores": a factor
  // entry carries its id, its phase, its differential, and its reason —
  // nothing else. `skillPresentPassRate` and `skillAbsentPassRate` are
  // computed internally (see the other cases below, which prove the
  // differential formula still uses them) but are never part of what this
  // function returns.
  it("carries the aggregate and nothing else — no `comparable` field, no per-probe entry, and no per-condition pass rate", () => {
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
    expect(Object.keys(summary.factors[0]).sort()).toEqual(["differential", "id", "phase", "reason"]);
    expect(summary.factors).toEqual([expect.objectContaining({ id: "f1", differential: 1 })]);
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
    // present rate 2/3, absent rate 1/3 — asserted only through the
    // differential, since the rates themselves are no longer on the summary.
    expect(summary.factors[0].differential).toBeCloseTo(2 / 3 - 1 / 3);
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
    // the skill-present rate computed from the probes above is 1/2; the rate
    // itself is no longer emitted on the summary (docs/specs/skill-evaluation.md,
    // "What a measurement stores"), so this is checked only through the
    // differential a discovery-phase factor reads it as.
    //
    // this fixture cannot, by itself, tell "read alone" apart from
    // "subtracted against the absent rate": every skill-absent result here
    // is `false` — the only value that condition can honestly produce for a
    // discovery factor, per "The differential" above — so the absent rate is
    // always 0 and both formulas agree. `deriveFactor`'s own branch on
    // `phase === "discovery"` is what actually makes the two paths
    // different code, not this assertion.
    expect(summary.factors[0].differential).toBeCloseTo(0.5);
  });

  // negative control 1/5 (the derive.mjs half): an errored judgment
  // produces a differential of `null`, distinguishable from the JSON number
  // `0` — never treated as a failing (0) result.
  //
  // this also covers the partial-error case the rate computation itself
  // must get right: 1 of 2 skill-present results errored, so a rate that
  // divided by both (1/2 = 0.5) rather than nulling out the whole condition
  // would surface here as `differential: 0.5` (0.5 present minus 0 absent)
  // instead of `null` — the exact bug this fixture would catch even though
  // the per-condition rate that would have been wrong is no longer emitted
  // for direct inspection.
  it("produces a `null` differential — never one computed by dividing by an unjudged probe — when a probe's judgment for a factor errored", () => {
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
    expect(factor.differential).not.toBe(0.5);
    expect(factor.differential).not.toBe(0);
    expect(factor.reason).toMatch(/errored/);
  });

  // the all-errored case reads worst of all under the old, wider shape: every
  // rate the naive computation could produce here was `0`, indistinguishable
  // at a glance from "judged, and nothing passed". with the rate itself no
  // longer emitted, the same defect would surface as a wrong *differential*
  // instead — `0 - 1 = -1` rather than `null` — which is what this asserts.
  it("produces a `null` differential, never a number, when every result under a condition errored", () => {
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
    expect(factor.differential).toBeNull();
    expect(factor.differential).not.toBe(0);
    expect(factor.differential).not.toBe(-1);
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

  // spend is recorded after a run rather than projected before it, so this
  // total is an aggregation rather than an estimate — regenerable from each
  // probe's own costUsd the same way every other derived field is.
  it("sums each probe's own costUsd into the measurement's total spend", () => {
    const summary = computeDerivedSummary({
      scenarioId: "s",
      measurementId: "m",
      factorDeclarations: [{ id: "f1", phase: "outcome" }],
      probes: [
        probe("skill-present", 1, { f1: true }, 0.05),
        probe("skill-present", 2, { f1: true }, 0.03),
        probe("skill-absent", 1, { f1: false }, 0.02),
      ],
      comparablePredecessor: null,
    });
    expect(summary.costUsd).toBeCloseTo(0.1);
  });

  // a probe with no recorded cost is not the same as one that cost nothing —
  // the same distinction the pass rates above draw between "not judged" and
  // "judged false". a missing figure must not silently read as zero, so it
  // nulls the whole aggregate rather than reporting a partial, under-counted
  // sum that looks complete.
  it("reports `costUsd: null`, never a partial sum, when any probe has no recorded cost", () => {
    const summary = computeDerivedSummary({
      scenarioId: "s",
      measurementId: "m",
      factorDeclarations: [{ id: "f1", phase: "outcome" }],
      probes: [
        probe("skill-present", 1, { f1: true }, 0.05),
        probe("skill-present", 2, { f1: true }), // no costUsd at all
      ],
      comparablePredecessor: null,
    });
    expect(summary.costUsd).toBeNull();
  });

  it("reports `costUsd: null` when a probe's own cost was recorded as null", () => {
    const summary = computeDerivedSummary({
      scenarioId: "s",
      measurementId: "m",
      factorDeclarations: [{ id: "f1", phase: "outcome" }],
      probes: [probe("skill-present", 1, { f1: true }, null)],
      comparablePredecessor: null,
    });
    expect(summary.costUsd).toBeNull();
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
