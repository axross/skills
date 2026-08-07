// Reporting tools must stay out of the enforced-gate set.
//
// Three scripts here report instead of judging, for three different reasons,
// and each is one careless wiring away from becoming a gate that can never fail
// — which is worse than no gate at all: it occupies the slot, costs CI time, and
// reads to everyone downstream as though something were being enforced.
//
// scripts/report-obligation-burden.mjs reports a number with NO threshold: it
// exits 0 on every valid invocation however large the figures get. There is no
// evidence for any particular limit in this corpus, and an indefensible
// threshold becomes either a rule people route around or a warning people stop
// reading.
//
// scripts/report-skill-duplication.mjs ranks rules stated in more than one
// skill. Its reason is the strongest of the three: the defect is not decidable
// from the text at all. The Portable Source Exception lets a self-contained
// distributable skill restate a rule another skill owns, and every skill here is
// distributable — so a gate on similarity would fail correct prose. Only intent
// separates the cases, and intent is not in the corpus.
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
    script: SCRIPTS.reportObligationBurden,
    // A distinctive basename, so this catches `node ./scripts/report-…` too.
    needle: "report-obligation-burden.mjs",
    workflow: null,
    runnable: true,
  },
  {
    script: SCRIPTS.reportSkillDuplication,
    needle: "report-skill-duplication.mjs",
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
    script: SCRIPTS.evaluate,
    // Matched by PATH for the same reason as its discovery-side sibling above:
    // "evaluate.mjs" alone is too generic to assert anything.
    needle: "tools/effect-eval/evaluate.mjs",
    // It has earned its own workflow, and exactly one. Until #278 this entry
    // read `workflow: null` with the note "this has no such entry point yet,
    // and until it does, any workflow naming it is a wiring mistake" — so
    // adding the workflow had to break this test first, which is what the
    // guard was for. The guard is not weakened by being satisfied: naming the
    // probe in any SECOND workflow still fails.
    workflow: "effect-eval.yaml",
    // Driving the real CLI needs a network and a secret, so running it here
    // would make the suite chargeable and non-deterministic. Its exit-0
    // guarantee is asserted through --help and --dry-run instead.
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
});

describe("the merge gate's measurement-pull-request guard", () => {
  // effect-eval.yaml opens its pull request with GITHUB_TOKEN, and GitHub does
  // not fire workflows on those — so merge-checks.yaml already does not run on
  // it. That is an accident of platform behaviour; the guard makes it a
  // declared one, and this asserts the guard is actually there, on every gate,
  // rather than on two of three.
  const readMergeChecks = () =>
    readFile(repoPath(".github/workflows/merge-checks.yaml"), "utf8");

  const GATE_JOBS = ["format-validation", "lint", "tests"];

  it("carries the guard on every gate job, not merely somewhere in the file", async () => {
    const yaml = await readMergeChecks();
    // Split on job headers so a guard present three times in one job cannot
    // pass for a guard present once in each.
    for (const job of GATE_JOBS) {
      const start = yaml.indexOf(`\n  ${job}:\n`);
      expect(start, `merge-checks.yaml has no ${job} job`).toBeGreaterThan(-1);
      const rest = yaml.slice(start + 1);
      const end = rest.search(/\n {2}[a-z-]+:\n/);
      const block = end === -1 ? rest : rest.slice(0, end);

      expect(block, `${job} does not skip the measurement pull request`).toContain(
        "startsWith(github.head_ref, 'measurement/')",
      );
      // The author conjunct is the half that cannot be forged. Without it any
      // contributor could skip all three gates by naming a branch
      // `measurement/…`.
      expect(
        block,
        `${job} keys its guard on the branch name alone, which any contributor can choose`,
      ).toContain("github.event.pull_request.user.login == 'github-actions[bot]'");
    }
  });

  it("guards at job level rather than filtering the trigger", async () => {
    const yaml = await readMergeChecks();
    // A workflow skipped by a path or branch filter never reports, so a
    // required status check would stay pending forever. A job skipped by `if:`
    // reports and satisfies it.
    expect(
      yaml,
      "a trigger-level filter would leave a required check pending rather than satisfied",
    ).not.toMatch(/^\s*(paths-ignore|branches-ignore):/m);
  });
});
