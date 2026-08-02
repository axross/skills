// Reporting tools must stay out of the enforced-gate set.
//
// Two scripts here report instead of judging, for two different reasons, and
// both are one careless wiring away from becoming a gate that can never fail —
// which is worse than no gate at all: it occupies the slot, costs CI time, and
// reads to everyone downstream as though something were being enforced.
//
// scripts/report-obligation-load.mjs reports a number with NO threshold: it
// exits 0 on every valid invocation however large the figures get. There is no
// evidence for any particular limit in this corpus, and an indefensible
// threshold becomes either a rule people route around or a warning people stop
// reading.
//
// scripts/discovery-eval/run.mjs reports which skills a prompt surfaced. It
// cannot gate for three independent reasons: it is non-deterministic, it costs
// money per run, and it needs a secret that fork pull requests do not receive.
// A flaky merge gate gets bypassed or deleted.
//
// The tracking issues asked for a grep confirming nothing invokes either. A grep
// confirms today; this file confirms every day, which is what the claim actually
// needs.
//
// If a threshold is ever justified, deleting the relevant entry is the
// deliberate act that admits it — and that is the point.

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { repoPath, runScript, SCRIPTS } from "../helpers/run.mjs";
import { GATES } from "./gates.mjs";

/**
 * @typedef {object} ReportingTool
 * @property {string} script    repository-relative path to the script
 * @property {string} needle    the string a wiring would contain
 * @property {string|null} workflow  the ONE workflow allowed to name it
 * @property {boolean} runnable whether it can be executed with no network or secret
 */

/** @type {ReportingTool[]} */
const REPORTING_TOOLS = [
  {
    script: SCRIPTS.reportObligationLoad,
    // A distinctive basename, so this catches `node ./scripts/report-…` too.
    needle: "report-obligation-load.mjs",
    workflow: null,
    runnable: true,
  },
  {
    script: SCRIPTS.discoveryEval,
    // Matched by PATH, not basename: "run.mjs" alone is generic enough to
    // collide with unrelated text and would make this assertion meaningless.
    needle: "scripts/discovery-eval/run.mjs",
    // Its own workflow is the one place it may appear — maintainer-triggered,
    // and not a required check.
    workflow: "discovery-eval.yaml",
    // Driving the real CLI needs a network and a secret, so running it here
    // would make the suite non-deterministic and chargeable. The exit-0
    // guarantee is asserted through --dry-run instead.
    runnable: false,
  },
  {
    script: SCRIPTS.reviewEval,
    // By path for the same reason as the sibling above: "run.mjs" is generic.
    needle: "scripts/review-eval/run.mjs",
    workflow: "review-eval.yaml",
    // Same constraint as the discovery evaluation, and dearer still: a review
    // probe reads a whole diff across many turns rather than taking one.
    runnable: false,
  },
];

const label = (tool) => tool.script;

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
  it.each(REPORTING_TOOLS.map(label))("keeps %s out of the gate registry", (script) => {
    expect(
      GATES.map((entry) => entry.script),
      "a reporter registered as a gate would run in `npm test` with no pass/fail semantics to contribute",
    ).not.toContain(script);
  });

  it.each(REPORTING_TOOLS)("keeps $script out of every npm script", async (tool) => {
    const packageJson = JSON.parse(await readFile(repoPath("package.json"), "utf8"));

    for (const [scriptName, command] of Object.entries(packageJson.scripts)) {
      expect(
        command,
        `npm script "${scriptName}" invokes the reporter, which has no pass/fail semantics to contribute`,
      ).not.toContain(tool.needle);
    }
  });

  it.each(REPORTING_TOOLS)(
    "lets $script appear in at most its own CI workflow",
    async (tool) => {
      const workflowDir = repoPath(".github/workflows");

      const naming = [];
      for (const path of await filesUnder(workflowDir)) {
        const yaml = await readFile(path, "utf8");
        if (yaml.includes(tool.needle)) naming.push(path.slice(path.lastIndexOf("/") + 1));
      }

      // Stronger than "appears nowhere": the tool with a workflow of its own
      // must appear in EXACTLY that one, so neither wiring it into a gating
      // workflow nor quietly losing its own trigger can pass unnoticed.
      expect(
        naming.sort(),
        tool.workflow
          ? `${tool.script} must be invoked by ${tool.workflow} and by no other workflow`
          : `${tool.script} invokes a check that cannot fail; no workflow should run it`,
        ).toEqual(tool.workflow ? [tool.workflow] : []);
    },
  );

  it.each(REPORTING_TOOLS)(
    "keeps $script out of the merge-gating workflow specifically",
    async (tool) => {
      // Named separately from the sweep above because this is the assertion
      // that actually matters: merge-checks.yaml is what blocks a pull request.
      const yaml = await readFile(
        repoPath(".github/workflows/merge-checks.yaml"),
        "utf8",
      );
      expect(
        yaml,
        `${tool.script} would become a merge gate, which it cannot be`,
      ).not.toContain(tool.needle);
    },
  );

  it.each(REPORTING_TOOLS)("keeps $script out of every hook", async (tool) => {
    const hookDir = repoPath(".claude/hooks");

    for (const path of await filesUnder(hookDir)) {
      const source = await readFile(path, "utf8");
      expect(
        source,
        `${path} invokes the reporter, which would block or slow a session for a number nothing acts on`,
      ).not.toContain(tool.needle);
    }
  });

  it.each(REPORTING_TOOLS.filter((tool) => tool.runnable))(
    "$script still exits 0 on the repository's own full tree",
    (tool) => {
      // The claim this whole file protects: the tool genuinely cannot fail, so
      // keeping it out of the gates costs nothing and wiring it in gains nothing.
      expect(runScript(tool.script, []).code).toBe(0);
    },
  );

  it("exits 0 from the discovery evaluation's offline path", () => {
    // The evaluation itself needs a network and a secret, so its no-fail
    // guarantee is asserted on the one path that needs neither. --dry-run
    // validates the fixture and prints the plan without any model call.
    const result = runScript(SCRIPTS.discoveryEval, ["--dry-run"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("No model call was made.");
  });

  it("exits 0 from the review evaluation's offline path", () => {
    // Same reasoning as above: the evaluation drives the real CLI, so its
    // no-fail guarantee is asserted on the path that needs neither network nor
    // secret. --dry-run validates the fixture and prices the run.
    const result = runScript(SCRIPTS.reviewEval, ["--dry-run"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("No model was called and no secret was read.");
  });
});
