// The discovery evaluation's data files must reference skills that exist.
//
// This is a DATA check, not the evaluation. It makes no model call, costs
// nothing, and is deterministic — the same class of check as the installed-copy
// gate, which is why it belongs in `npm test` while the evaluation itself
// deliberately does not (see tests/repository/reporting-tools.test.mjs).
//
// The failure it catches has already happened twice in this repository's short
// history: react-component-development was added, and loop-engineering's
// references were split and then removed. When a skill is renamed or deleted:
//
//   * a FIXTURE label naming it stops asserting anything, silently — the case
//     still runs, still reports, and has quietly stopped testing its boundary;
//   * a BASELINE entry naming it is worse, because every subsequent delta is
//     computed against a skill that can never appear again, so the report keeps
//     claiming a regression that is really a rename.
//
// Both rot without a sound. This makes them fail loudly instead.

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  parseBaseline,
  parseFixture,
} from "../../scripts/discovery-eval/fixture.mjs";
import { repoPath } from "../helpers/run.mjs";

/** Every skill name discoverable in this repository's installed root. */
async function installedSkills() {
  const root = repoPath(".claude/skills");
  const entries = await readdir(root, { withFileTypes: true });
  const names = [];
  for (const entry of entries) {
    // A symlinked entry counts: `.claude/skills` mirrors `.agents/skills`
    // by symlink, and `isDirectory()` is false for one. The SKILL.md
    // test below stats through the link and does the real filtering.
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    try {
      await stat(join(root, entry.name, "SKILL.md"));
      names.push(entry.name);
    } catch {
      // Not a skill directory.
    }
  }
  return names.sort();
}

describe("discovery evaluation data", () => {
  it("has a fixture whose every label names a real skill", async () => {
    const knownSkills = await installedSkills();
    const raw = await readFile(repoPath("evals/discovery/fixture.json"), "utf8");

    // parseFixture collects every problem, so a failure here names all of them
    // rather than one per run.
    const fixture = parseFixture(raw, { knownSkills });
    expect(fixture.cases.length).toBeGreaterThan(0);
  });

  it("has a baseline whose every entry names a real skill", async () => {
    const knownSkills = await installedSkills();
    const raw = await readFile(repoPath("evals/discovery/baseline.json"), "utf8");

    const baseline = parseBaseline(raw, { knownSkills });
    expect(baseline.model).not.toBe("");
  });

  it("accounts for every case the fixture defines", async () => {
    const knownSkills = await installedSkills();
    const fixture = parseFixture(
      await readFile(repoPath("evals/discovery/fixture.json"), "utf8"),
      { knownSkills },
    );
    const baseline = parseBaseline(
      await readFile(repoPath("evals/discovery/baseline.json"), "utf8"),
      { knownSkills },
    );

    // Accounted for means measured OR declared unmeasured. The declaration
    // exists because a case cannot be measured before it lands — a dispatch
    // evaluates the default branch's fixture — so requiring a tally outright
    // would mean no case could ever be added. What it must NOT become is a way
    // to add a case and forget it, which is why the third expectation below
    // fails on a name the fixture no longer defines.
    const unaccounted = fixture.cases
      .map((entry) => entry.id)
      .filter((id) => !(id in baseline.cases))
      .filter((id) => !baseline.unmeasured.includes(id));
    expect(
      unaccounted,
      'a case with no baseline entry reports as new on every single run, which reads as churn rather than as the unmeasured case it is — record a tally, or declare it in "unmeasured"',
    ).toEqual([]);
  });

  it("reduces repeats only where the recording justifies it", async () => {
    const knownSkills = await installedSkills();
    const fixture = parseFixture(
      await readFile(repoPath("evals/discovery/fixture.json"), "utf8"),
      { knownSkills },
    );
    const baseline = parseBaseline(
      await readFile(repoPath("evals/discovery/baseline.json"), "utf8"),
      { knownSkills },
    );

    // Two repeats is affordable only because neither verdict can turn on the
    // probes it stops spending, and that holds ONLY at an extreme. A case that
    // drifts to 1/2 fails here, and the ways out are to drop the override or to
    // re-measure at full repeats — so an override cannot quietly outlive the
    // evidence that justified it.
    const unjustified = [];
    for (const entry of fixture.cases) {
      if (entry.repeats === null) continue;
      const tally = baseline.cases[entry.id];
      if (!tally) {
        unjustified.push(`${entry.id} (declares ${entry.repeats}, never measured)`);
        continue;
      }
      const recorded = baseline.caseRepeats?.[entry.id] ?? baseline.repeats;
      const tracked = [...entry.mustInclude, ...entry.mustExclude];
      for (const skill of tracked) {
        const hits = tally[skill] ?? 0;
        if (hits !== 0 && hits !== recorded) {
          unjustified.push(`${entry.id} (${skill} at ${hits}/${recorded})`);
        }
      }
      // A standing finding is a result we EXPECT to change — si-neutral-consent-gate
      // has an issue open against the very text it measures. Fewer repeats there
      // cuts the power to notice the fix landing, which is backwards.
      if (entry.mustInclude.some((skill) => (tally[skill] ?? 0) === 0)) {
        unjustified.push(`${entry.id} (a standing MISS, so its result should move)`);
      }
    }

    expect(
      unjustified,
      "a case may declare fewer repeats only while every tracked skill sits at 0 or at full and the case is not itself a finding",
    ).toEqual([]);
  });

  it("declares no case the fixture does not define", async () => {
    const knownSkills = await installedSkills();
    const fixture = parseFixture(
      await readFile(repoPath("evals/discovery/fixture.json"), "utf8"),
      { knownSkills },
    );
    const baseline = parseBaseline(
      await readFile(repoPath("evals/discovery/baseline.json"), "utf8"),
      { knownSkills },
    );

    // The same rot the tally check catches, one field over. A declaration left
    // behind by a renamed or deleted case is a promise to measure something
    // that no longer exists, and it would silently widen what the check above
    // is willing to forgive.
    const ids = new Set(fixture.cases.map((entry) => entry.id));
    const stale = baseline.unmeasured.filter((id) => !ids.has(id));
    expect(
      stale,
      'a name in "unmeasured" that the fixture no longer defines is a declaration nothing can ever clear',
    ).toEqual([]);
  });
});
