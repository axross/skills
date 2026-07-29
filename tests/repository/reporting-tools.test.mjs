// Reporting tools must stay out of the enforced-gate set.
//
// scripts/report-obligation-load.mjs reports a number with NO threshold: it
// exits 0 on every valid invocation however large the figures get. That is a
// deliberate design decision — there is no evidence for any particular limit in
// this corpus, and an indefensible threshold becomes either a rule people route
// around or a warning people stop reading.
//
// A tool like that is one careless wiring away from becoming a gate that can
// never fail, which is worse than no gate at all: it occupies the slot, costs CI
// time, and reads to everyone downstream as though the number were being
// enforced. The tracking issue asked for a grep confirming nothing invokes it.
// A grep confirms today; this file confirms every day, which is what the claim
// actually needs.
//
// If a threshold is ever justified, deleting this file is the deliberate act
// that admits it — and that is the point.

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { repoPath, runScript, SCRIPTS } from "../helpers/run.mjs";
import { GATES } from "./gates.mjs";

/** Scripts that report rather than judge, and so must gate nothing. */
const REPORTING_TOOLS = [SCRIPTS.reportObligationLoad];

/** The basename a wiring would most likely name, e.g. "report-obligation-load.mjs". */
const basenameOf = (path) => path.slice(path.lastIndexOf("/") + 1);

/** Every file under `dir`, as absolute paths. */
async function filesUnder(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await filesUnder(path)));
    } else {
      files.push(path);
    }
  }
  return files;
}

describe("reporting tools are not gates", () => {
  it.each(REPORTING_TOOLS)("keeps %s out of the gate registry", (script) => {
    expect(
      GATES.map((entry) => entry.script),
      "a no-threshold reporter registered as a gate would run in `npm test` and could never fail",
    ).not.toContain(script);
  });

  it.each(REPORTING_TOOLS)("keeps %s out of every npm script", async (script) => {
    const packageJson = JSON.parse(await readFile(repoPath("package.json"), "utf8"));
    const name = basenameOf(script);

    for (const [scriptName, command] of Object.entries(packageJson.scripts)) {
      expect(
        command,
        `npm script "${scriptName}" invokes the reporter, which has no pass/fail semantics to contribute`,
      ).not.toContain(name);
    }
  });

  it.each(REPORTING_TOOLS)("keeps %s out of every CI workflow", async (script) => {
    const workflowDir = repoPath(".github/workflows");
    const name = basenameOf(script);

    for (const path of await filesUnder(workflowDir)) {
      const yaml = await readFile(path, "utf8");
      expect(
        yaml,
        `${path} invokes the reporter; a check that cannot fail is not a check`,
      ).not.toContain(name);
    }
  });

  it.each(REPORTING_TOOLS)("keeps %s out of every hook", async (script) => {
    const hookDir = repoPath(".claude/hooks");
    const name = basenameOf(script);

    for (const path of await filesUnder(hookDir)) {
      const source = await readFile(path, "utf8");
      expect(
        source,
        `${path} invokes the reporter, which would block or slow a session for a number nothing acts on`,
      ).not.toContain(name);
    }
  });

  it.each(REPORTING_TOOLS)("still exits 0 on the repository's own full tree", (script) => {
    // The claim this whole file protects: the tool genuinely cannot fail, so
    // keeping it out of the gates costs nothing and wiring it in gains nothing.
    expect(runScript(script, []).code).toBe(0);
  });
});
