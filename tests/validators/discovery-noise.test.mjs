// Offline tests for the prior annotation and the determinism probe.
//
// Everything here is exact. The tails are ratios of rising factorials of small
// integers, so every figure the report prints has a closed form, and asserting
// `2/33` rather than `0.0606` is both stronger and immune to the arithmetic
// being reimplemented in floats later.
//
// TWO SYMMETRIES ARE ASSERTED ACROSS A WHOLE GRID RATHER THAN INSTANCE BY
// INSTANCE. Both were first noticed as coincidences — two unrelated-looking
// lines sharing a number — and both turned out to be general identities. A
// coincidence pinned one instance at a time keeps looking like luck and stops
// being checked; the grid is what makes it a property.

import { describe, expect, it } from "vitest";

import {
  compareExact,
  directionOf,
  equalExact,
  exact,
  NOISE_ALPHA,
  NOISE_BAND,
  predictiveTail,
  readingFor,
  resolvabilityFloor,
  toNumber,
} from "../../scripts/discovery-eval/noise.mjs";
import {
  DEFAULT_DETERMINISM_REPEATS,
  MIN_DETERMINISM_REPEATS,
  reportedSkills,
  runsTest,
  wilsonInterval,
  Z_95,
} from "../../scripts/discovery-eval/determinism.mjs";
import { annotate, renderReport } from "../../scripts/discovery-eval/report.mjs";
import {
  deltaAgainst,
  tallyCase,
  trackedSkills,
} from "../../scripts/discovery-eval/compare.mjs";

/** `{ hits, repeats }` without the ceremony. */
const T = (hits, repeats) => ({ hits, repeats });

/** The tail as an exact fraction string, for assertions that read like arithmetic. */
const frac = (value) => `${value.numerator}/${value.denominator}`;

/** Every `(hits, repeats)` prior with `repeats <= 5`: 20 pairs. */
const PRIORS = [];
for (let repeats = 1; repeats <= 5; repeats += 1) {
  for (let hits = 0; hits <= repeats; hits += 1) PRIORS.push(T(hits, repeats));
}

/** Every `(n, k)` with `1 <= n <= 5` and `0 <= k <= n`: 20 pairs. */
const OUTCOMES = [];
for (let n = 1; n <= 5; n += 1) {
  for (let k = 0; k <= n; k += 1) OUTCOMES.push({ n, k });
}

describe("the band", () => {
  it("has an exact form that agrees with the documented one", () => {
    // Written independently rather than derived, because deriving an exact
    // rational by scaling the double would reintroduce the representation error
    // it exists to avoid. This is the assertion that keeps the two in step.
    expect(toNumber(NOISE_BAND)).toBe(NOISE_ALPHA);
    expect(frac(NOISE_BAND)).toBe("1/20");
  });
});

describe("the predictive tail", () => {
  it("is a distribution: the mass over every outcome sums to exactly one", () => {
    for (const prior of PRIORS) {
      for (let n = 1; n <= 5; n += 1) {
        expect(
          equalExact(predictiveTail(prior, T(n, n), "fall"), exact(1n)),
          `prior ${prior.hits}/${prior.repeats} at ${n} repeats`,
        ).toBe(true);
      }
    }
  });

  it("falls to zero hits at five repeats, as exact rationals", () => {
    const fall = (h) => frac(predictiveTail(T(h, 5), T(0, 5), "fall"));
    expect(fall(1)).toBe("3/11"); // 27.3%
    expect(fall(2)).toBe("4/33"); // 12.1%
    expect(fall(3)).toBe("1/22"); // 4.5%
    expect(fall(4)).toBe("1/77"); // 1.3%
    expect(fall(5)).toBe("1/462"); // 0.2%
  });

  it("does not collapse at a saturated prior, which is why the point estimate was rejected", () => {
    // (1 - p̂)^n returns EXACTLY zero here, calling two probes proof of
    // impossibility. Fifteen of this fixture's cases run at two repeats.
    const tail = predictiveTail(T(2, 2), T(0, 2), "fall");
    expect(frac(tail)).toBe("1/10");
    expect(toNumber(tail)).toBeGreaterThan(0);
  });

  it("rises off a zero prior, and the two SPURIOUS shapes differ by exactly 28", () => {
    const rise = (k) => predictiveTail(T(0, 5), T(k, 5), "rise");
    expect(frac(rise(3))).toBe("2/33"); // 6.1%
    expect(frac(rise(4))).toBe("1/66"); // 1.5%
    expect(frac(rise(5))).toBe("1/462"); // 0.2%

    // Asserted FROM THE VALUES, never from the printed percentages: 6.1 / 0.2
    // is 30.5, and the true ratio is 28. Dividing two rounded figures is how
    // the wrong number got into this repository's prose once already.
    const [weak, strong] = [rise(3), rise(5)];
    expect(weak.numerator * strong.denominator).toBe(28n * (weak.denominator * strong.numerator));
  });

  it("uses a measured mayInclude tally as a prior like any other", () => {
    expect(frac(predictiveTail(T(2, 5), T(4, 5), "rise"))).toBe("27/154"); // 17.5%
  });

  it("computes against each side's own denominator", () => {
    // A prior recorded at 5 against a run of 2 computes against 5...
    expect(frac(predictiveTail(T(5, 5), T(0, 2), "fall"))).toBe("1/28");
    // ...and the converse against 2.
    expect(frac(predictiveTail(T(2, 2), T(0, 5), "fall"))).toBe("1/56");
  });

  it("survives the prior's own arbitrariness — no verdict flips under Jeffreys", () => {
    const both = (h, n0, n) => [
      predictiveTail(T(h, n0), T(0, n), "fall"),
      predictiveTail(T(h, n0), T(0, n), "fall", "jeffreys"),
    ];
    const asPercent = (value) => Number((toNumber(value) * 100).toFixed(1));

    const cases = [
      [3, 5, 5, 4.5, 4.7],
      [2, 5, 5, 12.1, 14.0],
      [2, 2, 2, 10.0, 6.3],
      [1, 5, 5, 27.3, 33.9],
      [5, 5, 5, 0.2, 0.1],
    ];
    for (const [h, n0, n, uniform, jeffreys] of cases) {
      const [flat, jeff] = both(h, n0, n);
      expect(asPercent(flat)).toBe(uniform);
      expect(asPercent(jeff)).toBe(jeffreys);
      // The verdict is what must not move — a boundary that depends on a prior
      // nobody chose deliberately is an artifact, not a finding.
      expect(toNumber(flat) < NOISE_ALPHA).toBe(toNumber(jeff) < NOISE_ALPHA);
    }
  });
});

describe("the fall/rise identity", () => {
  // P(X <= k | prior h/n0, n) = P(X >= n-k | prior (n0-h)/n0, n)
  //
  // Stated at every cut point, not only at k = 0. The k = 0 case is a QUARTER
  // of this grid, and the delta block's `now` is arbitrary — so a statement
  // covering only the extremes would not contain the case that block relies on.
  it("holds at every cut point across 400 combinations, as exact equality", () => {
    let combinations = 0;
    for (const prior of PRIORS) {
      const mirrored = T(prior.repeats - prior.hits, prior.repeats);
      for (const { n, k } of OUTCOMES) {
        combinations += 1;
        expect(
          equalExact(
            predictiveTail(prior, T(k, n), "fall"),
            predictiveTail(mirrored, T(n - k, n), "rise"),
          ),
          `prior ${prior.hits}/${prior.repeats}, n ${n}, k ${k}`,
        ).toBe(true);
      }
    }
    expect(combinations).toBe(400);
  });

  it("pins both directions of each collision that appears in the documentation", () => {
    // The two the report actually renders side by side. Each is asserted in
    // both directions rather than once, because a fall and a rise are distinct
    // EVENTS that happen to share a number.
    expect(frac(predictiveTail(T(2, 2), T(0, 2), "fall"))).toBe("1/10");
    expect(frac(predictiveTail(T(0, 2), T(2, 2), "rise"))).toBe("1/10");
    expect(frac(predictiveTail(T(5, 5), T(0, 5), "fall"))).toBe("1/462");
    expect(frac(predictiveTail(T(0, 5), T(5, 5), "rise"))).toBe("1/462");
  });
});

describe("the resolvability floor", () => {
  it("never exceeds the tail of any attainable outcome, over the same 400 combinations", () => {
    // The invariant that makes `cannot resolve` safe: it can only ever replace
    // `consistent with no change`, never a finding.
    let combinations = 0;
    for (const prior of PRIORS) {
      for (const { n, k } of OUTCOMES) {
        combinations += 1;
        const run = T(k, n);
        const tail = predictiveTail(prior, run, directionOf(prior, run));
        expect(
          compareExact(resolvabilityFloor(prior, n), tail),
          `prior ${prior.hits}/${prior.repeats}, n ${n}, k ${k}`,
        ).toBeLessThanOrEqual(0);
      }
    }
    expect(combinations).toBe(400);
  });

  it("is invariant under mirroring the prior, over 100 combinations", () => {
    // A COROLLARY OF THE IDENTITY AT k = 0, not a separate coincidence: the
    // floor is min(P(X <= 0), P(X >= n)), and mirroring the prior swaps those
    // two terms. This is the identity's grid with `k` dropped.
    let combinations = 0;
    for (const prior of PRIORS) {
      const mirrored = T(prior.repeats - prior.hits, prior.repeats);
      for (let n = 1; n <= 5; n += 1) {
        combinations += 1;
        expect(
          equalExact(resolvabilityFloor(prior, n), resolvabilityFloor(mirrored, n)),
          `prior ${prior.hits}/${prior.repeats} at ${n} repeats`,
        ).toBe(true);
      }
    }
    expect(combinations).toBe(100);
  });

  it("shares 4.545% between prior 2/5 and prior 3/5 for that reason, not by luck", () => {
    const low = resolvabilityFloor(T(2, 5), 5);
    const high = resolvabilityFloor(T(3, 5), 5);
    expect(frac(low)).toBe("1/22");
    // Asserted as the SAME value rather than pinned twice: 3 = 5 - 2, so this
    // is one instance of the corollary above.
    expect(equalExact(low, high)).toBe(true);
  });

  it("does not claim mirroring accounts for every floor collision", () => {
    // The bound on the corollary's reach, asserted rather than left to prose.
    // 1/35 is produced by TWO distinct mirror classes, so a future
    // simplification claiming "the collisions are exactly the mirrored pairs"
    // would be false — the same overreach this repository has already made once
    // about the tail.
    const classes = [
      [T(0, 2), 4],
      [T(2, 2), 4],
      [T(0, 3), 3],
      [T(3, 3), 3],
    ];
    for (const [prior, n] of classes) {
      expect(frac(resolvabilityFloor(prior, n)), `${prior.hits}/${prior.repeats}@${n}`).toBe("1/35");
    }
    // Two classes, not one: {0/2, 2/2} at four repeats and {0/3, 3/3} at three.
    expect(new Set(classes.map(([, n]) => n)).size).toBe(2);
  });

  it("pins the two-repeat floors as two distinct values, not three coincidences", () => {
    const three = (value) => `${(toNumber(value) * 100).toFixed(3)}%`;
    expect(three(resolvabilityFloor(T(0, 2), 2))).toBe("10.000%");
    expect(three(resolvabilityFloor(T(1, 2), 2))).toBe("30.000%");
    expect(three(resolvabilityFloor(T(2, 2), 2))).toBe("10.000%");
    // A mirror pair plus a self-mirror.
    expect(equalExact(resolvabilityFloor(T(0, 2), 2), resolvabilityFloor(T(2, 2), 2))).toBe(true);
    expect(new Set([1n * 10n, 3n * 10n]).size).toBe(2);
  });

  it("pins BOTH on-boundary cases numerically, never by verdict", () => {
    // Exactly on the band, so the comparison holds with zero margin and a
    // verdict word here would be a coin flip dressed as a rule. There are two
    // such floors — they are a mirror pair — and the `prior 0/2` side is the
    // shape most of this fixture's inferred priors take once a re-record gives
    // them a two-repeat denominator.
    for (const prior of [T(2, 2), T(0, 2)]) {
      const floor = resolvabilityFloor(prior, 3);
      expect(frac(floor)).toBe("1/20");
      expect(toNumber(floor)).toBeCloseTo(NOISE_ALPHA, 12);
      // Stronger than the tolerance, and only true because the comparison is
      // made on exact rationals rather than on the double: the two are the
      // same value, not merely near each other.
      expect(equalExact(floor, NOISE_BAND)).toBe(true);
    }
  });

  it("decides the off-boundary pair by verdict", () => {
    // Below the band on one side, above it on the other — asserted through the
    // reading rather than the number, which is what a reader acts on.
    expect(readingFor({ prior: T(1, 2), run: T(0, 3), fingerprinted: true }).kind).toBe(
      "cannot-resolve",
    );
    expect(readingFor({ prior: T(2, 2), run: T(0, 4), fingerprinted: true }).kind).not.toBe(
      "cannot-resolve",
    );
  });
});

describe("the reading precedence", () => {
  const read = (prior, run, options = {}) =>
    readingFor({ prior, run, fingerprinted: true, ...options });

  it("claims no prior rather than inventing a zero", () => {
    const reading = read(null, T(2, 5));
    expect(reading.kind).toBe("no-prior");
    expect(reading.probability).toBeNull();
  });

  it("calls a zero prior against a zero run standing, even with no corpus", () => {
    // ABOVE the fingerprint gate on purpose. This is a statement about counts,
    // and gating it would silence the standing under-reach findings the fixture
    // exists to keep visible.
    expect(read(T(0, 5), T(0, 5), { fingerprinted: false }).kind).toBe("standing");
    expect(read(T(0, 5), T(0, 5)).kind).toBe("standing");
  });

  it("withholds the probability, not the counts, when no corpus was recorded", () => {
    const reading = read(T(1, 5), T(0, 5), { fingerprinted: false });
    expect(reading.kind).toBe("no-corpus");
    expect(reading.probability).toBeNull();
  });

  it("uses a different word below the band in each block, for one event", () => {
    const findings = read(T(5, 5), T(0, 2), { movedWord: "regression" });
    const delta = read(T(5, 5), T(0, 2), { movedWord: "moved" });
    // One probability, two words: a finding has already been judged, a delta
    // line is only reporting movement.
    expect(findings.probability).toBe(delta.probability);
    expect(findings.label).toBe("regression");
    expect(delta.label).toBe("moved");
    expect(Number((findings.probability * 100).toFixed(1))).toBe(3.6);
  });

  it("reads an unmoved rate as a fall, which is the conservative direction", () => {
    expect(directionOf(T(3, 5), T(3, 5))).toBe("fall");
    // The larger of the two tails, so an unmoved result can never round into a
    // regression.
    expect(read(T(3, 5), T(3, 5)).kind).toBe("consistent");
  });
});

describe("the annotation both blocks render", () => {
  const withPrior = (prior, run, options = {}) =>
    annotate(prior, run, { fingerprinted: true, ...options });

  it("renders a finding with its prior, probability and reading", () => {
    expect(withPrior(T(1, 5), T(0, 5))).toBe("(prior 1/5, P 27.3% — consistent with no change)");
    expect(withPrior(T(5, 5), T(0, 5), { movedWord: "regression" })).toBe(
      "(prior 5/5, P 0.2% — regression)",
    );
  });

  it("renders a SPURIOUS finding the same way", () => {
    expect(withPrior(T(0, 5), T(3, 5), { movedWord: "regression" })).toBe(
      "(prior 0/5, P 6.1% — consistent with no change)",
    );
    expect(withPrior(T(0, 5), T(5, 5), { movedWord: "regression" })).toBe(
      "(prior 0/5, P 0.2% — regression)",
    );
  });

  it("renders an em dash on the prior side, never a zero", () => {
    expect(withPrior(null, T(2, 5))).toBe("(prior —, no prior: not tracked, and nothing recorded)");
    expect(withPrior(null, T(2, 5), { showPrior: false })).toBe(
      "(no prior: not tracked, and nothing recorded)",
    );
    // The distinction the em dash protects: a measured zero reads differently.
    expect(withPrior(T(0, 5), T(0, 5))).toBe("(prior 0/5 — standing)");
  });

  it("says when no outcome could have resolved the question", () => {
    expect(withPrior(T(2, 2), T(0, 2))).toBe("(prior 2/2, P 10.0% — cannot resolve at 2 repeats)");
  });

  it("states the reason when no probability may be claimed", () => {
    expect(withPrior(T(1, 5), T(0, 5), { fingerprinted: false })).toBe(
      "(prior 1/5 — no P: baseline records no corpus)",
    );
    expect(withPrior(null, T(1, 5), { noPriorReason: "no baseline recorded" })).toBe(
      "(prior —, no prior: no baseline recorded)",
    );
  });

  it("prints P to one decimal place and never more", () => {
    for (const [prior, run] of [
      [T(1, 5), T(0, 5)],
      [T(2, 5), T(4, 5)],
      [T(5, 5), T(0, 2)],
    ]) {
      expect(withPrior(prior, run)).toMatch(/P \d+\.\d%/);
    }
  });

  it("never reads 'within noise'", () => {
    // The phrase claims about the world; the report only ever claims about the
    // sample it drew.
    const rendered = PRIORS.flatMap((prior) =>
      OUTCOMES.map(({ n, k }) => withPrior(prior, T(k, n))),
    );
    expect(rendered.some((line) => line.includes("within noise"))).toBe(false);
    expect(rendered.every((line) => line.startsWith("(") && line.endsWith(")"))).toBe(true);
  });
});

describe("a finding annotated through the whole report", () => {
  const fixture = {
    expectAlways: [],
    cases: [
      {
        id: "a-case",
        prompt: "Sketch a checkout screen.",
        rationale: "Because the layout is the question.",
        mustInclude: ["wireframe-design"],
        mustExclude: [],
        mayInclude: [],
      },
    ],
  };
  const tallies = [tallyCase(fixture.cases[0], [[], [], [], [], []])];
  const baseline = (extra = {}) => ({
    model: "m",
    repeats: 5,
    cases: { "a-case": { "wireframe-design": 5 } },
    ...extra,
  });
  const report = (delta) => renderReport({ fixture, tallies, delta, context: { model: "m", repeats: 5, corpusSize: 3 } });
  const findingLine = (text) =>
    text.split("\n").find((line) => line.trim().startsWith("a-case: wireframe-design"));

  it("carries the prior, the probability and the reading", () => {
    const delta = deltaAgainst(tallies, baseline({ corpus: { x: "aaaaaaaaaaaa" } }), "m", {
      x: "aaaaaaaaaaaa",
    });
    expect(findingLine(report(delta))).toBe(
      "  a-case: wireframe-design 0/5  (prior 5/5, P 0.2% — regression)",
    );
  });

  it("carries the drift mark when the corpus has moved", () => {
    // Where it matters most: a finding measured against a corpus that has
    // since changed cannot be attributed to anything in this repository.
    const delta = deltaAgainst(tallies, baseline({ corpus: { x: "aaaaaaaaaaaa" } }), "m", {
      x: "bbbbbbbbbbbb",
    });
    expect(findingLine(report(delta))).toContain("(unattributable)");
  });

  it("names each of the reasons no prior may be claimed", () => {
    // No baseline at all.
    expect(findingLine(report(deltaAgainst(tallies, null, "m")))).toContain(
      "no prior: no baseline recorded",
    );

    // A model mismatch, which suppresses the delta wholesale.
    const mismatch = deltaAgainst(tallies, { ...baseline(), model: "claude-sonnet-5" }, "claude-opus-5");
    expect(findingLine(report(mismatch))).toMatch(/no prior: baseline was recorded on/);

    // A case the baseline never measured.
    const unrecorded = deltaAgainst(tallies, { model: "m", repeats: 5, cases: {} }, "m");
    expect(findingLine(report(unrecorded))).toContain("no prior: case is not in the baseline");

    // ...told apart from one declared unmeasured on purpose.
    const declared = deltaAgainst(
      tallies,
      { model: "m", repeats: 5, unmeasured: ["a-case"], cases: {} },
      "m",
    );
    expect(findingLine(report(declared))).toContain("declared unmeasured");
  });

  it("renders counts and the reason, but no probability, against an unfingerprinted baseline", () => {
    const delta = deltaAgainst(tallies, baseline(), "m", { x: "aaaaaaaaaaaa" });
    const line = findingLine(report(delta));
    expect(line).toBe("  a-case: wireframe-design 0/5  (prior 5/5 — no P: baseline records no corpus)");
    expect(line).not.toContain("P 0");
  });

  it("explains the annotation in the header, once", () => {
    const text = report(deltaAgainst(tallies, baseline(), "m", null));
    expect(text).toContain("Both findings carry the PRIOR the baseline recorded");
    expect(text).toContain("independence is");
    expect(text).toContain("one clean");
    expect(text).not.toContain("within noise");
  });
});

describe("which absences yield a prior", () => {
  const caseWith = (overrides) => ({
    id: "a-case",
    prompt: "p",
    rationale: "why",
    mustInclude: [],
    mustExclude: [],
    mayInclude: [],
    ...overrides,
  });

  it("tracks the three tiers whose absence is a measurement, and no others", () => {
    const tracked = trackedSkills(
      caseWith({
        mustInclude: ["wireframe-design"],
        mustExclude: ["high-fidelity-ui-design"],
        mayInclude: ["react-component-styling"],
      }),
      ["professional-behavior"],
    );
    expect(tracked.sort()).toEqual([
      "high-fidelity-ui-design",
      "professional-behavior",
      "wireframe-design",
    ]);
    // mayInclude is never a finding, so a run has no obligation to tally it —
    // reading its silence as a measured zero would manufacture a prior.
    expect(tracked).not.toContain("react-component-styling");
  });

  it("travels with the tally, so the delta does not re-derive it", () => {
    const tally = tallyCase(caseWith({ mustInclude: ["wireframe-design"] }), [[]], {
      expectAlways: ["professional-behavior"],
    });
    expect(tally.tracked.sort()).toEqual(["professional-behavior", "wireframe-design"]);
  });
});

describe("the determinism probe's statistics", () => {
  it("defaults high enough for the runs test to mean anything", () => {
    expect(DEFAULT_DETERMINISM_REPEATS).toBe(30);
    expect(MIN_DETERMINISM_REPEATS).toBe(10);
  });

  it("pins each Wilson set as a whole, at a z written to six decimals", () => {
    expect(Z_95).toBe(1.959964);
    const set = (hits) => {
      const { low, high } = wilsonInterval(hits, 30);
      return [(hits / 30).toFixed(3), `${low.toFixed(3)}-${high.toFixed(3)}`];
    };
    expect(set(0)).toEqual(["0.000", "0.000-0.114"]);
    expect(set(2)).toEqual(["0.067", "0.018-0.213"]);
    expect(set(7)).toEqual(["0.233", "0.118-0.409"]);
  });

  it("stays informative at zero, which the textbook interval does not", () => {
    // The normal interval is [0, 0] here — an assertion of impossibility from
    // thirty samples.
    expect(wilsonInterval(0, 30).high).toBeGreaterThan(0);
  });

  it("reports a constant sequence as undefined, not as extreme", () => {
    const constant = runsTest(Array.from({ length: 30 }, () => false));
    expect(constant.state).toBe("undefined");
    expect(constant.z).toBeNull();
    expect(constant.expected).toBeNull();
    expect(constant.reason).toContain("undefined");
  });

  it("computes Z even where the renderer will withhold it", () => {
    // The statistic and the decision to quote it are DIFFERENT things: what
    // fails below ten of either outcome is the normal approximation, not the
    // computation. Returning null here would make the withholding rule
    // untestable apart from the string that reports it.
    const sequence = Array.from({ length: 30 }, (_, index) => [2, 5, 9, 13, 17, 21, 26].includes(index));
    const test = runsTest(sequence);
    expect([test.n1, test.n2]).toEqual([7, 23]);
    expect(test.expected.toFixed(3)).toBe("11.733");
    expect(test.state).toBe("withheld");
    expect(test.z).not.toBeNull();
    expect(test.reason).toContain("n1,n2 >= 10");
  });

  it("returns Z = -0.386 for the case the documentation quotes", () => {
    // n1 7, n2 23, runs 11 — laid out as explicit blocks so the statistic,
    // not a sequence generator, is what is under test. Eleven blocks:
    // 4F 2T 4F 2T 4F 1T 4F 1T 4F 1T 3F.
    const blocks = [
      [false, 4], [true, 2], [false, 4], [true, 2], [false, 4], [true, 1],
      [false, 4], [true, 1], [false, 4], [true, 1], [false, 3],
    ];
    const sequence = blocks.flatMap(([value, count]) => Array.from({ length: count }, () => value));
    const test = runsTest(sequence);
    expect([test.n1, test.n2, test.runs]).toEqual([7, 23, 11]);
    expect(test.expected.toFixed(3)).toBe("11.733");
    expect(test.z.toFixed(3)).toBe("-0.386");
  });

  it("distinguishes withheld from undefined on the second documented row", () => {
    const sequence = Array.from({ length: 30 }, (_, index) => index === 2 || index === 7);
    const test = runsTest(sequence);
    expect([test.n1, test.n2, test.runs]).toEqual([2, 28, 5]);
    expect(test.expected.toFixed(3)).toBe("4.733");
    expect(test.state).toBe("withheld");
  });

  it("reports a tracked skill that was never selected", () => {
    // The row that lets the report say a universally-claiming skill was
    // selected in none of the probes. Omitting it would make that unsayable.
    const names = reportedSkills([["wireframe-design"], []], ["professional-behavior"]);
    expect(names).toEqual(["professional-behavior", "wireframe-design"]);
  });
});
