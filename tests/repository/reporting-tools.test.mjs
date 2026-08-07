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

/**
 * YAML with its comment lines removed.
 *
 * Load-bearing, and learned three times over: a well-commented workflow SAYS
 * what it does not do — "NO paths-ignore HERE", "GITHUB_TOKEN is deliberately
 * absent", "do NOT add `pull_request`" — so an assertion that reads prose flags
 * the sentence documenting a property as a breach of it. Assert against
 * directives; read the comments with your eyes.
 */
const directivesOnly = (yaml) =>
  yaml
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n");

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

describe("the merge gate's measurement-pull-request exclusion", () => {
  // effect-eval.yaml opens its pull request with GITHUB_TOKEN, and GitHub does
  // not fire workflows on those — so merge-checks.yaml already did not run on
  // it. That is an accident of platform behaviour; the exclusion makes it a
  // declared one, and this asserts it is actually there and correctly scoped.
  const readMergeChecks = () =>
    readFile(repoPath(".github/workflows/merge-checks.yaml"), "utf8");

  /** The two derived surfaces a measurement pull request consists of. */
  const DERIVED_PATHS = ["data/*/measurements/**", "data/*/summary.json"];


  it("excludes the measurement pull request at the trigger, by path", async () => {
    const yaml = await readMergeChecks();
    for (const path of DERIVED_PATHS) {
      expect(yaml, `merge-checks.yaml does not exclude ${path}`).toContain(`- "${path}"`);
    }
    expect(yaml).toMatch(/^ {4}paths-ignore:$/m);
  });

  it("keys on paths rather than on a branch name", async () => {
    // A branch-name key is a public string any contributor could adopt to skip
    // every gate. A path key is a fact about the pull request's contents: one
    // line of code in it and every gate runs, whatever the branch is called.
    // (GitHub could not do it by head branch anyway — `branches` on a
    // pull_request trigger filters the BASE branch.)
    const yaml = await readMergeChecks();
    expect(yaml, "the exclusion keys on a branch name, which a contributor chooses").not.toContain(
      "github.head_ref",
    );
    expect(yaml, "a job-level guard remains alongside the trigger-level one").not.toMatch(
      /^ {4}if:/m,
    );
  });

  it("still runs every gate on the push to the default branch", async () => {
    // Measurement data is exempt from BLOCKING a pull request, not from this
    // repository's checks. Once it merges, the gates — the drift check included
    // — run against the merged tree.
    const yaml = await readMergeChecks();
    const push = directivesOnly(
      yaml.slice(yaml.indexOf("  push:"), yaml.indexOf("\nconcurrency:")),
    );
    expect(push, "the push trigger skips measurement data, so nothing ever checks it").not.toContain(
      "paths-ignore",
    );
    expect(push).toContain("branches: [main]");
  });

  it("excludes exactly the surfaces .prettierignore exempts", async () => {
    // The coupling that would otherwise drift: a derived surface added to one
    // and missed in the other either starts failing the drift check against
    // this repository's own formatter, or starts blocking measurement pull
    // requests. Neither failure points at the file that caused it.
    const ignored = await readFile(repoPath(".prettierignore"), "utf8");
    for (const path of DERIVED_PATHS) {
      const entry = path.replace("/**", "/");
      expect(
        ignored,
        `.prettierignore does not exempt ${entry}, which merge-checks.yaml excludes`,
      ).toContain(entry);
    }
  });
});

describe("the effect evaluation's own workflow", () => {
  // #278's acceptance criterion names THIS file as what asserts these, and the
  // workflow's own header calls them "LOAD-BEARING SAFETY PROPERTY 1 of 3" and
  // "2 of 3". Both were true when the workflow was written and neither was
  // enforced, so a future edit could add `pull_request` or a write scope to the
  // job that spawns a model with Bash without failing anything.
  const WORKFLOW = ".github/workflows/effect-eval.yaml";

  const readWorkflow = () => readFile(repoPath(WORKFLOW), "utf8");

  /**
   * The lines of one indented block, given the line that opens it.
   *
   * Line scanning rather than a parsed document: this repository has no YAML
   * dependency, and adding one to assert three properties would widen the
   * supply-chain surface further than the assertion is worth. Scoping to the
   * block is what matters — `pull_request` appears in this workflow's header
   * comment as "do NOT add", so an unscoped search would report the warning
   * against adding it as the thing itself.
   *
   * @param {string} yaml
   * @param {string} opener the exact opening line, e.g. "on:" or "  probe:"
   * @returns {string|null} the block's body, opener excluded
   */
  function blockUnder(yaml, opener) {
    const lines = yaml.split("\n");
    const first = lines.indexOf(opener);
    if (first === -1) return null;
    const indent = opener.length - opener.trimStart().length;
    const body = [];
    for (const line of lines.slice(first + 1)) {
      const blank = line.trim() === "";
      const deeper = line.length - line.trimStart().length > indent;
      if (!blank && !deeper) break;
      body.push(line);
    }
    return body.join("\n");
  }

  it("declares workflow_dispatch as its only trigger", async () => {
    // The primary bound on the whole workflow: only someone with write access
    // can start it, and a dispatch always runs the file from the default
    // branch. A contributor cannot cause a run, nor cause one by editing this
    // file in a pull request.
    const on = blockUnder(await readWorkflow(), "on:");
    expect(on, `${WORKFLOW} has no top-level on: block`).not.toBeNull();
    expect(on).toMatch(/^ {2}workflow_dispatch:$/m);
    for (const forbidden of ["pull_request", "pull_request_target", "push", "schedule"]) {
      expect(
        on,
        `${WORKFLOW} adds a ${forbidden} trigger, which a contributor could raise`,
      ).not.toMatch(new RegExp(`^ {2}${forbidden}:`, "m"));
    }
  });

  it("gives the probe job no write permission at all", async () => {
    // That job spawns a model with Bash and the editing tools. Everything that
    // writes the repository happens in `land`, which spawns nothing.
    const probe = blockUnder(await readWorkflow(), "  probe:");
    expect(probe, `${WORKFLOW} has no probe job`).not.toBeNull();

    expect(probe, "the probe job does not declare an empty permissions map").toMatch(
      /^ {4}permissions: \{\}$/m,
    );
    expect(probe, "the probe job grants itself a write scope").not.toMatch(/:\s*write$/m);

    expect(directivesOnly(probe), "the probe job receives GITHUB_TOKEN").not.toContain(
      "GITHUB_TOKEN",
    );
  });

  it("keeps the writing job free of any model spawn", async () => {
    // The other half of the same separation: `land` holds contents:write and
    // pull-requests:write, so it must never be the job that runs a probe.
    const land = blockUnder(await readWorkflow(), "  land:");
    expect(land, `${WORKFLOW} has no land job`).not.toBeNull();
    expect(land).toMatch(/^ {6}contents: write$/m);
    expect(
      land,
      "the writing job invokes the probe, which would hand a model a write token",
    ).not.toContain("tools/effect-eval/evaluate.mjs");
  });
});
