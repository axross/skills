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
    if (!entry.isDirectory()) continue;
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

  it("records a baseline for every case the fixture defines", async () => {
    const knownSkills = await installedSkills();
    const fixture = parseFixture(
      await readFile(repoPath("evals/discovery/fixture.json"), "utf8"),
      { knownSkills },
    );
    const baseline = parseBaseline(
      await readFile(repoPath("evals/discovery/baseline.json"), "utf8"),
      { knownSkills },
    );

    const missing = fixture.cases
      .map((entry) => entry.id)
      .filter((id) => !(id in baseline.cases));
    expect(
      missing,
      "a case with no baseline entry reports as new on every single run, which reads as churn rather than as the unmeasured case it is",
    ).toEqual([]);
  });
});
