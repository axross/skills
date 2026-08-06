// Qualifying a finding with the prior it is measured against.
//
// A finding line says a skill was selected in zero runs, or in a majority, and
// nothing more — so the same line means "this discovery text is marginal" on a
// case whose selection-snapshot rate is 1/5 and "something broke" on one recorded at 5/5.
// At 1/5 a five-repeat run draws zero about a third of the time, so the report
// has been unable to tell a real regression from an unlucky sample.
//
// THE ESTIMATOR IS A POSTERIOR PREDICTIVE TAIL, NOT (1 - p̂)^n. The point
// estimate treats a prior measured from five samples as though it were the
// truth, and at p̂ = 1 it returns exactly zero — so a 2/2 prior would call two
// samples proof of impossibility. Integrating over Beta(h + 1, n0 - h + 1)
// counts the prior's own sampling error, which is the whole difficulty here:
// every prior in this fixture comes from a handful of probes.
//
// EVERYTHING IS EXACT RATIONAL ARITHMETIC. The tails are ratios of rising
// factorials of small numbers, so BigInt computes them exactly and floats are
// produced only at the rendering boundary. That is not fastidiousness: the
// symmetries this module relies on — a fall equals its mirrored rise, the
// resolvability floor is invariant under mirroring the prior — are asserted as
// equalities over a whole grid, and an equality that holds only to 1e-15 is a
// weaker claim that would quietly stop holding if the arithmetic changed.
//
// NO PRIOR IS EVER INVENTED. A selection snapshot records a zero-hit skill by OMITTING
// it, so an absence means "measured, and zero" for a skill the run tracked and
// "nobody ever looked" for one it did not. Conflating them would put a
// probability against a measurement that was never taken; `priorFor` in
// compare.mjs splits them, and this module renders `null` rather than guessing.

/** @typedef {{ numerator: bigint, denominator: bigint }} Exact an exact rational */
/** @typedef {{ hits: number, repeats: number }} Tally hits out of runs */

/**
 * The band a result must clear to read as movement rather than noise.
 *
 * 5% is this issue's own benchmark rather than a tuned constant — the figure
 * the tracking issue used to argue that reaching it at a 1/5 rate would take
 * ~14 repeats per case. It is deliberately NOT derived from measured corpus
 * noise, because nothing has measured that yet; `--determinism` is what will.
 */
export const NOISE_ALPHA = 0.05;

/**
 * The same band as an exact rational, which is what comparisons actually use.
 *
 * `0.05` is not representable in binary, so comparing an exact tail against the
 * double would decide the on-boundary cases — `floor(prior 2/2, run 3)` and its
 * mirror `floor(prior 0/2, run 3)`, both exactly `1/20` — by whichever way that
 * representation error happened to fall. Deriving this from `NOISE_ALPHA` by
 * scaling would reintroduce the same problem one step earlier, so the two are
 * written independently and a test asserts they agree.
 */
export const NOISE_BAND = { numerator: 1n, denominator: 20n };

/**
 * Decimal places carried when an exact rational is finally turned into a float.
 *
 * Well past a double's ~17 significant digits, so the conversion is limited by
 * the float rather than by this.
 */
const DECIMAL_DIGITS = 25;
const NUMBER_SCALE = 10n ** BigInt(DECIMAL_DIGITS);

function greatestCommonDivisor(a, b) {
  let left = a < 0n ? -a : a;
  let right = b < 0n ? -b : b;
  while (right > 0n) {
    [left, right] = [right, left % right];
  }
  return left;
}

/**
 * An exact rational in lowest terms.
 *
 * @param {bigint} numerator
 * @param {bigint} [denominator]
 * @returns {Exact}
 */
export function exact(numerator, denominator = 1n) {
  if (denominator === 0n) throw new RangeError("a rational needs a non-zero denominator");
  const flip = denominator < 0n;
  const top = flip ? -numerator : numerator;
  const bottom = flip ? -denominator : denominator;
  const divisor = greatestCommonDivisor(top, bottom) || 1n;
  return { numerator: top / divisor, denominator: bottom / divisor };
}

const add = (a, b) =>
  exact(a.numerator * b.denominator + b.numerator * a.denominator, a.denominator * b.denominator);

const multiply = (a, b) => exact(a.numerator * b.numerator, a.denominator * b.denominator);

const invert = ({ numerator, denominator }) => exact(denominator, numerator);

/** -1, 0 or 1. Cross-multiplied, so no float ever enters a comparison. */
export const compareExact = (a, b) => {
  const left = a.numerator * b.denominator;
  const right = b.numerator * a.denominator;
  return left < right ? -1 : left > right ? 1 : 0;
};

export const equalExact = (a, b) => compareExact(a, b) === 0;

/**
 * The float a reader eventually sees.
 *
 * Scaled through BigInt rather than `Number(n) / Number(d)`: at 30 repeats the
 * rising factorials run past 2^53, so dividing two already-rounded doubles
 * would lose precision that the exact value never lost.
 *
 * @param {Exact} value
 * @returns {number}
 */
export const toNumber = ({ numerator, denominator }) => {
  // The division happens in BigInt and the result is assembled as a DECIMAL
  // STRING, not as `Number(a) / Number(b)`. Both of those operands exceed 2^53
  // at 30 repeats, so each would be rounded before the division and the error
  // would compound: that spelling returned 0.049999999999999996 for 1/20, which
  // is the one value this module compares against most often.
  const scaled = (numerator * NUMBER_SCALE) / denominator;
  const whole = scaled / NUMBER_SCALE;
  const fraction = (scaled % NUMBER_SCALE).toString().padStart(DECIMAL_DIGITS, "0");
  return Number(`${whole}.${fraction}`);
};

/**
 * The rising factorial `a(a+1)...(a+count-1)`, on an exact rational `a`.
 *
 * This is what replaces a Gamma function here. Every Beta ratio the predictive
 * tail needs is a ratio of Gammas whose arguments differ by whole numbers, and
 * each such ratio collapses to a rising factorial — so a half-integer prior
 * (the Jeffreys sensitivity check) stays exact instead of needing a
 * transcendental approximation.
 *
 * @param {Exact} base
 * @param {number} count
 * @returns {Exact}
 */
function rising(base, count) {
  let product = exact(1n);
  for (let step = 0; step < count; step += 1) {
    product = multiply(product, add(base, exact(BigInt(step))));
  }
  return product;
}

const binomial = (n, k) => {
  let value = exact(1n);
  for (let step = 0; step < k; step += 1) {
    value = multiply(value, exact(BigInt(n - step), BigInt(step + 1)));
  }
  return value;
};

/**
 * The posterior's two shape parameters, as exact rationals.
 *
 * `uniform` is Beta(1,1) — the flat prior, and what the report uses. `jeffreys`
 * is Beta(0.5,0.5), carried only so the boundary can be checked against the
 * prior's own arbitrariness: if a verdict flips between the two, the verdict is
 * an artifact of a choice nobody made deliberately.
 *
 * @param {Tally} prior
 * @param {"uniform"|"jeffreys"} shape
 * @returns {{ alpha: Exact, beta: Exact }}
 */
function posterior({ hits, repeats }, shape) {
  const misses = repeats - hits;
  if (shape === "jeffreys") {
    return {
      alpha: exact(BigInt(2 * hits + 1), 2n),
      beta: exact(BigInt(2 * misses + 1), 2n),
    };
  }
  return { alpha: exact(BigInt(hits + 1)), beta: exact(BigInt(misses + 1)) };
}

/**
 * `P(X = k)` for `X ~ BetaBinomial(n, alpha, beta)`.
 *
 * @param {Tally} prior     what the selection snapshot recorded
 * @param {number} n        runs in the new sample
 * @param {number} k        successes in that sample
 * @param {"uniform"|"jeffreys"} [shape]
 * @returns {Exact}
 */
function predictiveMass(prior, n, k, shape = "uniform") {
  const { alpha, beta } = posterior(prior, shape);
  return multiply(
    multiply(binomial(n, k), rising(alpha, k)),
    multiply(rising(beta, n - k), invert(rising(add(alpha, beta), n))),
  );
}

/**
 * The one-sided predictive tail, toward the direction of the movement.
 *
 * `"fall"` is `P(X <= k)` and `"rise"` is `P(X >= k)`. They are DISTINCT events
 * even where they happen to be equal: for any prior, run length and cut point,
 *
 *   P(X <= k | prior h/n0, n)  =  P(X >= n-k | prior (n0-h)/n0, n)
 *
 * because the posterior is Beta(h+1, n0-h+1), B(a,b) = B(b,a), and substituting
 * j -> n-j carries one sum onto the other. That identity holds at EVERY cut
 * point, not only at the extremes, which is what lets the delta block — whose
 * `now` is arbitrary — rely on it. The test suite asserts it as exact equality
 * across the whole grid rather than instance by instance.
 *
 * @param {Tally} prior
 * @param {Tally} run
 * @param {"fall"|"rise"} direction
 * @param {"uniform"|"jeffreys"} [shape]
 * @returns {Exact}
 */
export function predictiveTail(prior, run, direction, shape = "uniform") {
  const { hits, repeats } = run;
  const from = direction === "fall" ? 0 : hits;
  const to = direction === "fall" ? hits : repeats;
  let total = exact(0n);
  for (let k = from; k <= to; k += 1) {
    total = add(total, predictiveMass(prior, repeats, k, shape));
  }
  return total;
}

/**
 * The smallest tail any attainable outcome could have produced.
 *
 * Some prior/run pairs cannot clear the band at all: a 2/2 prior against two
 * fresh runs bottoms out at 10%, so EVERY possible result reads as "consistent
 * with no change" and the phrase carries no information. Saying so outright is
 * the difference between a verdict and a verdict that was never in doubt.
 *
 * The fall tail rises with `k` and the rise tail falls with it, so the minimum
 * over all attainable outcomes is always at one of the two ends.
 *
 * COROLLARY, and the reason two on-band cases are pinned rather than one: the
 * floor is invariant under mirroring the prior — floor(h, n0, n) equals
 * floor(n0-h, n0, n) — because mirroring swaps the two terms of that minimum.
 * It is NOT an account of every floor collision: 1/35 is produced by two
 * distinct mirror classes, {0/2, 2/2} at four repeats and {0/3, 3/3} at three.
 *
 * @param {Tally} prior
 * @param {number} repeats  runs in the new sample
 * @returns {Exact}
 */
export function resolvabilityFloor(prior, repeats) {
  const lowest = predictiveTail(prior, { hits: 0, repeats }, "fall");
  const highest = predictiveTail(prior, { hits: repeats, repeats }, "rise");
  return compareExact(lowest, highest) <= 0 ? lowest : highest;
}

/**
 * Which way a result moved against its prior.
 *
 * An unchanged rate is read as a fall, which is the conservative direction: its
 * tail is the larger of the two, so an unmoved result can never be reported as
 * a regression by rounding.
 *
 * @param {Tally} prior
 * @param {Tally} run
 * @returns {"fall"|"rise"}
 */
export function directionOf(prior, run) {
  const before = prior.hits * run.repeats;
  const after = run.hits * prior.repeats;
  return after <= before ? "fall" : "rise";
}

/**
 * The single precedence both the findings roll-up and the delta block read.
 *
 * ONE HELPER, TWO BLOCKS — that is the point. The same event appears in both,
 * and two independent implementations would eventually disagree about one line,
 * which is worse than either answer alone. The only thing that differs is the
 * word used below the band: a finding has already been called a regression by
 * the verdict rule, while a delta line is only reporting movement.
 *
 * Steps 4 and 5 commute — `floor <= P` holds by construction — but the order is
 * written down so nobody has to rediscover it from a fallback that happens to
 * work.
 *
 * @param {object} input
 * @param {Tally|null} input.prior          null when no prior may be claimed
 * @param {Tally} input.run                 what this run observed
 * @param {boolean} input.fingerprinted     whether the selection snapshot records a corpus
 * @param {string} [input.noPriorReason]    why there is no prior, when there is none
 * @param {"regression"|"moved"} [input.movedWord]
 * @returns {{
 *   kind: "no-prior"|"standing"|"no-corpus"|"cannot-resolve"|"moved"|"consistent",
 *   label: string,
 *   probability: number|null,
 *   tail: Exact|null,
 *   floor: Exact|null,
 * }}
 */
export function readingFor({
  prior,
  run,
  fingerprinted,
  noPriorReason = "not tracked, and nothing recorded",
  movedWord = "regression",
}) {
  const none = { probability: null, tail: null, floor: null };

  // 1. No prior may be claimed. Never a zero — a zero is a measurement.
  if (!prior) return { kind: "no-prior", label: `no prior: ${noPriorReason}`, ...none };

  // 2. A zero prior against a zero run. Deliberately ABOVE the fingerprint
  //    gate: this is a statement about counts, not a probability, so gating it
  //    on a corpus record would silence the standing under-reach findings the
  //    fixture exists to keep visible.
  if (prior.hits === 0 && run.hits === 0) {
    return { kind: "standing", label: "standing", ...none };
  }

  // 3. Counts without a fingerprint are still counts; a probability computed
  //    against tallies that may have accreted across commits is not.
  if (!fingerprinted) {
    return { kind: "no-corpus", label: "no P: selection snapshot records no corpus", ...none };
  }

  const tail = predictiveTail(prior, run, directionOf(prior, run));
  const floor = resolvabilityFloor(prior, run.repeats);
  const probability = toNumber(tail);

  // 4. No outcome could have cleared the band, so no verdict was ever in doubt.
  if (compareExact(floor, NOISE_BAND) >= 0) {
    return {
      kind: "cannot-resolve",
      label: `cannot resolve at ${run.repeats} repeats`,
      probability,
      tail,
      floor,
    };
  }

  // 5. The ordinary case.
  const below = compareExact(tail, NOISE_BAND) < 0;
  return {
    kind: below ? "moved" : "consistent",
    label: below ? movedWord : "consistent with no change",
    probability,
    tail,
    floor,
  };
}
