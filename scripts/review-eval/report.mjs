// Rendering what a run found.
//
// NO THRESHOLD, EVER. This module has no notion of pass or fail and run.mjs
// exits 0 on every valid invocation however bad the numbers. There is no
// defensible bar for "how much of a contract a reviewer should catch" in a
// corpus of this size, and a bar nobody can defend becomes either a rule people
// route around or a warning people stop reading.
//
// NO PERCENTAGES ON A mustAnchor OUTCOME. See score.mjs: at affordable repeat
// counts a rate is not distinguishable from noise, so a target is reported as
// reached or not reached, with the raw hit count beside it for context.

/** @param {number} usd */
function money(usd) {
  return `$${usd.toFixed(2)}`;
}

function pluralise(count, noun) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * @param {object} options
 * @param {{contract: string, results: object[], cost: number, model: string|null}[]} options.arms
 *   one arm per REVIEW.md revision under test
 * @param {string[]} options.errors
 * @returns {string}
 */
export function renderReport({ arms, errors = [] }) {
  const out = [];

  for (const arm of arms) {
    out.push(`Contract: ${arm.contract}`);
    if (arm.model) out.push(`Model:    ${arm.model}`);
    out.push("");

    for (const result of arm.results) {
      out.push(`  ${result.id} — ${pluralise(result.probes, "probe")}`);

      for (const { target, hits } of result.reached) {
        out.push(`    reached      ${target}  (anchored in ${hits}/${result.probes})`);
      }
      for (const { target } of result.missed) {
        out.push(`    NOT REACHED  ${target}  (never anchored)`);
      }
      for (const { target, hits } of result.spurious) {
        out.push(`    SPURIOUS     ${target}  (anchored in ${hits}/${result.probes})`);
      }
      if (result.lens) {
        const { enumeratedIn, missingLenses } = result.lens;
        out.push(`    lens walk    enumerated in ${enumeratedIn}/${result.probes}`);
        if (missingLenses.length > 0) {
          out.push(`                 never named: ${missingLenses.join(", ")}`);
        }
      }
      out.push("");
    }
    out.push(`  Cost: ${money(arm.cost)}`);
    out.push("");
  }

  if (arms.length > 1) {
    out.push(renderComparison(arms));
    out.push("");
  }

  if (errors.length > 0) {
    out.push("Errors (these cases produced no result):");
    for (const error of errors) out.push(`  - ${error}`);
    out.push("");
  }

  out.push(
    "Reached / not reached is an EXISTENCE claim: whether any probe anchored a",
    "finding on the target, never how often. Repeat counts here are far too small",
    "to separate a rate from noise, so no percentage is reported and no threshold",
    "is defined — this reports, it never passes or fails.",
  );
  return out.join("\n");
}

/**
 * Side-by-side of which targets each contract reached.
 *
 * Deliberately a set difference and not a delta: a target one contract reached
 * and another did not is a fact about those runs, and calling it an improvement
 * would be the rate claim this harness refuses to make.
 */
function renderComparison(arms) {
  const out = ["Contract comparison — targets reached, by arm:", ""];
  const ids = [...new Set(arms.flatMap((arm) => arm.results.map((r) => r.id)))];

  for (const id of ids) {
    out.push(`  ${id}`);
    const targets = [
      ...new Set(
        arms.flatMap((arm) => {
          const result = arm.results.find((r) => r.id === id);
          return [...(result?.reached ?? []), ...(result?.missed ?? [])].map((t) => t.target);
        }),
      ),
    ].sort();

    for (const target of targets) {
      const marks = arms.map((arm) => {
        const result = arm.results.find((r) => r.id === id);
        if (!result) return "  ?  ";
        return result.reached.some((t) => t.target === target) ? " yes " : "  no ";
      });
      out.push(`    ${marks.join("|")}  ${target}`);
    }
    out.push("");
  }
  out.push(`  arms, in order: ${arms.map((arm) => arm.contract).join(", ")}`);
  return out.join("\n");
}
