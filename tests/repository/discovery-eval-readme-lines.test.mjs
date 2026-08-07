// Every example annotation in the discovery README must be one the data could
// actually produce.
//
// The figures in that document are the ones a maintainer reads instead of
// running a $4 evaluation, and until now nothing checked them. They are exactly
// the kind that rots quietly: a case's `repeats` drops from 5 to 2 and the
// prose keeps showing `0/5`; an estimator changes and the percentages beside it
// do not. Neither breaks a build, and neither is visible without redoing the
// arithmetic by hand — which is what the reader came to the README to avoid.
//
// So this rebuilds each line rather than pattern-matching it. Every documented
// annotation is re-rendered through the SAME `annotate` the report uses, from
// the prior and run the line itself states, and compared as a string. A figure
// that has drifted fails, and so does a denominator the fixture cannot produce.
//
// Deliberately NOT asserted: that a documented prior matches the committed
// snapshot. Most examples describe a re-recorded, fingerprinted snapshot —
// which is the state the annotation activates in and the one this tree is not
// yet in — so pinning them to today's tallies would make the honest examples
// unwritable.

import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { annotate } from "../../scripts/discovery-eval/report.mjs";
import { repoPath } from "../helpers/run.mjs";

const README = repoPath("evals/discovery/README.md");
const FIXTURE = repoPath("evals/discovery/fixture.json");

/**
 * The report's own annotation grammar:
 *   `  <case>: <skill> <hits>/<repeats>  (prior <h>/<n0>, P <p>% — <reading>)`
 *   `  <case>: <skill> <h>/<n0> -> <hits>/<repeats>  (P <p>% — <reading>)`
 * with the prior optionally an em dash, the probability optionally absent, and
 * an optional trailing `(unattributable)` drift mark — which is a SEPARATE
 * parenthesis from the reading, so the reading is captured lazily and the mark
 * matched explicitly rather than swallowed.
 */
const LINE =
  /^ {2}([a-z0-9-]+): ([a-z0-9-]+) (\d+|—)\/(\d+)(?: -> (\d+)\/(\d+))? {2}\((.+?)\)(?: {2}\(unattributable\))?$/;

/** `prior 1/5` or `prior —`, as the annotation writes it. */
const PRIOR = /^prior (?:(\d+)\/(\d+)|—)/;

/**
 * Rebuild every documented annotation and report what does not reconstruct.
 *
 * Exported shape is a list of problems rather than a throw, so the negative
 * controls below can assert that a corrupted line is actually caught — a
 * checker nobody has watched fail is not evidence.
 *
 * @param {string} markdown
 * @param {Map<string, number>} repeatsByCase
 * @returns {string[]} one message per problem; empty when everything rebuilds
 */
export function reconstruct(markdown, repeatsByCase) {
  const problems = [];
  let checked = 0;

  for (const raw of markdown.split("\n")) {
    const match = LINE.exec(raw);
    if (!match) continue;
    const [, caseId, skill, hitsText, repeatsText, nowHits, nowRepeats, annotation] = match;
    checked += 1;

    // A delta line states the prior in the ratio itself; a findings line states
    // it inside the parentheses.
    const isDelta = nowHits !== undefined;
    const run = isDelta
      ? { hits: Number(nowHits), repeats: Number(nowRepeats) }
      : { hits: Number(hitsText), repeats: Number(repeatsText) };

    if (!repeatsByCase.has(caseId)) {
      problems.push(`${caseId}: no such case in the fixture`);
      continue;
    }
    // The rot this exists for: a case's declared repeats change and the prose
    // keeps quoting the old denominator.
    if (run.repeats !== repeatsByCase.get(caseId)) {
      problems.push(
        `${caseId}: line runs ${run.repeats} repeat(s), fixture declares ${repeatsByCase.get(caseId)}`,
      );
      continue;
    }

    let prior = null;
    if (isDelta) {
      prior = hitsText === "—" ? null : { hits: Number(hitsText), repeats: Number(repeatsText) };
    } else {
      const stated = PRIOR.exec(annotation);
      if (!stated) {
        problems.push(`${caseId}/${skill}: annotation states no prior`);
        continue;
      }
      prior = stated[1] === undefined ? null : { hits: Number(stated[1]), repeats: Number(stated[2]) };
    }

    // A line quoting a probability is claiming a fingerprinted snapshot; one
    // saying "no P" is claiming the opposite. Rebuild it under what it claims.
    const fingerprinted = !annotation.includes("no P:");
    const rebuilt = annotate(prior, run, {
      fingerprinted,
      movedWord: isDelta ? "moved" : "regression",
      showPrior: !isDelta,
    });

    if (rebuilt !== `(${annotation})`) {
      problems.push(`${caseId}/${skill}: documented ${`(${annotation})`}, recomputes to ${rebuilt}`);
    }
  }

  if (checked === 0) problems.push("no annotation lines found — the check would pass vacuously");
  return problems;
}

const repeatsByCase = async () => {
  const fixture = JSON.parse(await readFile(FIXTURE, "utf8"));
  return new Map(fixture.cases.map((entry) => [entry.id, entry.repeats ?? 5]));
};

describe("the discovery README's example lines", () => {
  it("every documented annotation recomputes from the pure exports", async () => {
    expect(reconstruct(await readFile(README, "utf8"), await repeatsByCase())).toEqual([]);
  });

  it("catches a corrupted figure", async () => {
    // The negative control. Without it, a checker that silently matched
    // nothing would look exactly like a clean pass.
    const corrupted =
      "  hf-touch-targets: high-fidelity-ui-design 0/5  (prior 1/5, P 26.9% — consistent with no change)";
    const problems = reconstruct(corrupted, await repeatsByCase());
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("recomputes to");
  });

  it("catches a corrupted reading, even where the figure is right", async () => {
    const corrupted =
      "  hf-touch-targets: high-fidelity-ui-design 0/5  (prior 1/5, P 27.3% — regression)";
    expect(reconstruct(corrupted, await repeatsByCase())).toHaveLength(1);
  });

  it("catches a line whose run exceeds its case's declared repeats", async () => {
    // `rcs-css-module` declares `repeats: 2`, so a 5-repeat line describes a
    // run the fixture cannot produce.
    const impossible =
      "  rcs-css-module: react-component-styling 0/5  (prior 5/5, P 0.2% — regression)";
    const problems = reconstruct(impossible, await repeatsByCase());
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("fixture declares 2");
  });

  it("catches a case the fixture does not define", async () => {
    const unknown =
      "  no-such-case: high-fidelity-ui-design 0/5  (prior 1/5, P 27.3% — consistent with no change)";
    expect(reconstruct(unknown, await repeatsByCase())[0]).toContain("no such case");
  });

  it("fails rather than passing vacuously when it matches nothing", async () => {
    expect(reconstruct("# nothing here\n", await repeatsByCase())[0]).toContain("vacuously");
  });
});
