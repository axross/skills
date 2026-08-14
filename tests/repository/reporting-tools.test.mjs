// reporting tools must stay out of the enforced-gate set.
//
// three scripts here report instead of judging, for three different reasons,
// and each is one careless wiring away from becoming a gate that can never fail
// — which is worse than no gate at all: it occupies the slot, costs CI time, and
// reads to everyone downstream as though something were being enforced.
//
// scripts/report-obligation-burden.mjs reports a number with no threshold: it
// exits 0 on every valid invocation however large the figures get. there is no
// evidence for any particular limit in this corpus, and an indefensible
// threshold becomes either a rule people route around or a warning people stop
// reading.
//
// scripts/report-skill-duplication.mjs ranks rules stated in more than one
// skill. its reason is the strongest of the three: the defect is not decidable
// from the text at all. the Portable Source Exception lets a self-contained
// distributable skill restate a rule another skill owns, and every skill here is
// distributable — so a gate on similarity would fail correct prose. only intent
// separates the cases, and intent is not in the corpus.
//
// tools/evaluation/readings/discovery/evaluate.mjs reports which skills a prompt
// surfaced. it cannot gate for three independent reasons: it is
// non-deterministic, it costs money per run, and it needs a secret that fork
// pull requests do not receive. a flaky merge gate gets bypassed or deleted.
//
// the tracking issues asked for a grep confirming nothing invokes either. a grep
// confirms today; this file confirms every day, which is what the claim actually
// needs.
//
// if a threshold is ever justified, deleting the relevant entry is the
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
 * @property {string|null} workflow  the single workflow allowed to name it
 * @property {boolean} runnable whether it can be executed with no network or secret
 */

/** @type {ReportingTool[]} */
const REPORTING_TOOLS = [
  {
    script: SCRIPTS.reportObligationBurden,
    // a distinctive basename, so this catches `node ./scripts/report-…` too.
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
    script: SCRIPTS.discoveryEvalEvaluate,
    // matched by PATH for the same reason as its effect-side sibling below:
    // "evaluate.mjs" alone is too generic to assert anything.
    needle: "tools/evaluation/readings/discovery/evaluate.mjs",
    // its own workflow is the one place it may appear — maintainer-triggered,
    // and not a required check.
    workflow: "discovery-eval.yaml",
    // driving the real CLI needs a network and a secret, so running it here
    // would make the suite non-deterministic and chargeable. the exit-0
    // guarantee is asserted through --dry-run instead.
    runnable: false,
  },
  {
    script: SCRIPTS.evaluate,
    // matched by PATH for the same reason as its discovery-side sibling above:
    // "evaluate.mjs" alone is too generic to assert anything.
    needle: "tools/evaluation/readings/effect/evaluate.mjs",
    // it has earned its own workflow, and exactly one. until #278 this entry
    // read `workflow: null` with the note "this has no such entry point yet,
    // and until it does, any workflow naming it is a wiring mistake" — so
    // adding the workflow had to break this test first, which is what the
    // guard was for. the guard is not weakened by being satisfied: naming the
    // probe in any further workflow still fails.
    workflow: "effect-eval.yaml",
    // driving the real CLI needs a network and a secret, so running it here
    // would make the suite chargeable and non-deterministic. its exit-0
    // guarantee is asserted through --help and --dry-run instead.
    runnable: false,
  },
];

const label = (tool) => tool.script;

/**
 * load-bearing, and learned three times over: a well-commented workflow says
 * what it does not do — "no paths-ignore here", "GITHUB_TOKEN is deliberately
 * absent", "do not add `pull_request`" — so an assertion that reads prose flags
 * the sentence documenting a property as a breach of it.
 */
const directivesOnly = (yaml) =>
  yaml
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n");

/** every file under `dir`, as absolute paths. */
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

      // stronger than "appears nowhere": the tool with a workflow of its own
      // must appear in that one and nowhere else, so neither wiring it into a
      // gating workflow nor quietly losing its own trigger can pass unnoticed.
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
      // named separately from the sweep above because this is the assertion
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
      // the claim this whole file protects: the tool genuinely cannot fail, so
      // keeping it out of the gates costs nothing and wiring it in gains nothing.
      expect(runScript(tool.script, []).code).toBe(0);
    },
  );

  it("exits 0 from the discovery evaluation's offline path", () => {
    // the evaluation itself needs a network and a secret, so its no-fail
    // guarantee is asserted on the one path that needs neither. --dry-run with
    // no --case previews every case in the fixture and prints the projected
    // plan without any model call.
    const result = runScript(SCRIPTS.discoveryEvalEvaluate, ["--dry-run"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("No process was spawned; no network was reached.");
  });
});

describe("the merge gate's measurement-pull-request exclusion", () => {
  // GitHub does not fire workflows on a GITHUB_TOKEN-authored pull request, so
  // merge-checks.yaml already did not run on the measurement one. that is an
  // accident of platform behaviour; the exclusion makes it declared.
  const readMergeChecks = () =>
    readFile(repoPath(".github/workflows/merge-checks.yaml"), "utf8");

  /** the two derived surfaces a measurement pull request consists of. */
  const DERIVED_PATHS = [
    "tools/evaluation/data/*/measurements/**",
    "tools/evaluation/data/*/summary.json",
  ];

  it("excludes the measurement pull request at the trigger, by path", async () => {
    const yaml = await readMergeChecks();
    for (const path of DERIVED_PATHS) {
      expect(yaml, `merge-checks.yaml does not exclude ${path}`).toContain(`- "${path}"`);
    }
    expect(yaml).toMatch(/^ {4}paths-ignore:$/m);
  });

  it("keys on paths rather than on a branch name", async () => {
    // a branch name is a public string any contributor could adopt to skip
    // every gate; a path is a fact about the pull request's contents. GitHub
    // could not do it by head branch anyway — `branches` filters the base.
    const yaml = await readMergeChecks();
    expect(yaml, "the exclusion keys on a branch name, which a contributor chooses").not.toContain(
      "github.head_ref",
    );
    expect(yaml, "a job-level guard remains alongside the trigger-level one").not.toMatch(
      /^ {4}if:/m,
    );
  });

  it("still runs every gate on the push to the default branch", async () => {
    // measurement data is exempt from blocking a pull request, not from being
    // checked: once it merges the gates run against the merged tree.
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
    // a derived surface added to one and missed in the other either starts
    // failing the drift check against this repository's own formatter, or
    // starts blocking measurement pull requests. neither failure points at the
    // file that caused it.
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
  // #278 names this file as what asserts these, and the workflow's own header
  // calls them safety properties 1 and 2. both were true when the workflow was
  // written and neither was enforced, so a future edit could add
  // `pull_request`, or a write scope to the job that spawns a model with Bash,
  // without failing anything.
  const WORKFLOW = ".github/workflows/effect-eval.yaml";

  const readWorkflow = () => readFile(repoPath(WORKFLOW), "utf8");

  /**
   * line scanning rather than a parsed document: this repository has no YAML
   * dependency, and adding one to assert three properties would widen the
   * supply-chain surface more than the assertion is worth.
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
    // the primary bound on the whole workflow: only someone with write access
    // can start it, and a dispatch always runs the file from the default
    // branch.
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

  it("declares a dry-run input the probe step actually honours", async () => {
    // the rehearsal exists because everything between the matrix and the landed
    // pull request has no local analogue. an input nothing reads, or a flag
    // passed unconditionally, would each turn a $0 rehearsal into a $36 one or
    // a $36 measurement into a synthetic one.
    const yaml = await readWorkflow();
    const on = blockUnder(yaml, "on:");
    expect(on, `${WORKFLOW} declares no dry-run input`).toMatch(/^ {6}dry-run:$/m);
    expect(on, "dry-run is not a defaulted boolean, so `inputs` cannot apply its default").toMatch(
      /type: boolean/,
    );
    // the name is hyphenated to match --dry-run, trigger.kind, and the branch
    // prefix. the underscore spelling reading nothing is the silent failure:
    // `inputs.dry_run` on an input named dry-run interpolates empty, which is
    // falsy, so every rehearsal would spawn models and be billed.
    expect(
      directivesOnly(yaml),
      "an expression still reads inputs.dry_run, which is empty on an input named dry-run",
    ).not.toMatch(/inputs\.dry_run/);

    // the mode reaches evaluate.mjs through the plan script rather than a shell
    // conditional. what --dry-run resolves to for a given input is asserted in
    // effect-eval-dispatch-plan.test.mjs, which runs the resolution.
    const probe = directivesOnly(blockUnder(yaml, "  probe:"));
    expect(probe, "the probe job never resolves a plan, so the input does nothing").toContain(
      "effect-eval-probe-plan.mjs",
    );
    expect(probe, "the plan script is never told which mode the dispatch is in").toContain(
      '--dry-run-input "${DRY_RUN}"',
    );
    expect(probe, "evaluate.mjs never receives the plan's flags").toMatch(
      /evaluate\.mjs "\$\{flags\[@\]\}"/,
    );
  });

  it("leaves neither job deciding anything about the mode in shell", async () => {
    // the class this workflow has now been bitten by once. the skill loop it
    // replaced parsed correctly and ran zero times, so every text assertion
    // passed while the treatment condition installed nothing; the plan scripts
    // exist so a test can execute the derivation instead of reading it.
    //
    // this asserts only that the decisions did not come back. what they resolve
    // to lives in effect-eval-dispatch-plan.test.mjs.
    const yaml = await readWorkflow();
    for (const job of ["  probe:", "  land:"]) {
      const block = directivesOnly(blockUnder(yaml, job));
      expect(block, `${job} branches on the mode in shell again`).not.toMatch(/if \[ .*DRY_RUN/);
      expect(block, `${job} reads the fixture with an inline node -e again`).not.toMatch(
        /node -e/,
      );
      expect(block, `${job} assembles an argument list with a shell loop again`).not.toMatch(
        /while .*read/,
      );
    }
    // the idiom that derived the mode check's argument a second way, from the
    // same input the branch and title came from.
    expect(
      directivesOnly(yaml),
      "the land job derives the mode a second time instead of reading the landing plan",
    ).not.toMatch(/inputs\.dry-run &&/);
  });

  it("refuses records the dispatch did not produce, before committing", async () => {
    // both directions: a rehearsal that was billed, and a measurement that is
    // fiction. see .github/scripts/effect-eval-check-mode.mjs.
    const land = directivesOnly(blockUnder(await readWorkflow(), "  land:"));
    const checkAt = land.indexOf("effect-eval-check-mode.mjs");
    const commitAt = land.indexOf("git commit");
    expect(checkAt, `${WORKFLOW}'s land job never runs the mode check`).toBeGreaterThan(-1);
    expect(commitAt, `${WORKFLOW}'s land job never commits`).toBeGreaterThan(-1);
    expect(checkAt, "the mode check runs after the commit, which is too late").toBeLessThan(
      commitAt,
    );
  });

  it("lands under the branch, subject and draft flag the plan resolved", async () => {
    // which branch and which flag each mode gets is asserted in
    // effect-eval-dispatch-plan.test.mjs, for each mode — including the
    // measurement half, which no rehearsal ever executes. what is left to check
    // here is that the workflow actually spends what the plan handed it.
    const land = directivesOnly(blockUnder(await readWorkflow(), "  land:"));
    expect(land, "the land job never resolves a landing plan").toContain(
      "effect-eval-landing-plan.mjs",
    );
    expect(land, "the branch is not the plan's").toMatch(/git checkout -b "\$\{branch\}"/);
    expect(land, "the commit subject is not the plan's").toMatch(/git commit -m "\$\{title\}"/);

    // both halves, because either alone passes while the flag goes nowhere: the
    // array can be filled and never passed, and the expansion can be passed
    // while nothing ever fills it.
    expect(land, "the draft flags are never read out of the plan").toMatch(
      /mapfile -t draft < <\(jq -r '\.prFlags\[\]'/,
    );
    expect(land, "gh pr create never receives the draft flag").toMatch(
      /gh pr create(?:[^\n]*\\\n)*[^\n]*"\$\{draft\[@\]\}"/,
    );
  });

  it("gives the probe job no write permission at all", async () => {
    // that job spawns a model with Bash and the editing tools.
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
    // the other half of the separation: `land` holds the write scopes, so it
    // must never be the job that runs a probe.
    const land = blockUnder(await readWorkflow(), "  land:");
    expect(land, `${WORKFLOW} has no land job`).not.toBeNull();
    expect(land).toMatch(/^ {6}contents: write$/m);
    expect(
      land,
      "the writing job invokes the probe, which would hand a model a write token",
    ).not.toContain("tools/evaluation/readings/effect/evaluate.mjs");
  });
});

describe("the dispatch's job-to-job wiring", () => {
  // a step can write an output the job never re-exposes, and the reader then
  // interpolates an empty string rather than failing. that is how the land job
  // came to build the measurements root itself instead of a per-case
  // subdirectory: the admit script emitted `measurement-dir` and the admit job
  // did not pass it on. the script's own tests read its stdout and stopped
  // there, so nothing caught it.
  const WORKFLOW = ".github/workflows/effect-eval.yaml";

  it("re-exposes every output a later job reads", async () => {
    const yaml = await readFile(repoPath(WORKFLOW), "utf8");
    const directives = directivesOnly(yaml);

    const read = new Set(
      [...directives.matchAll(/needs\.(\w[\w-]*)\.outputs\.([\w-]+)/g)].map(
        ([, job, output]) => `${job}.${output}`,
      ),
    );
    expect(read.size, "no job reads another's output, so this asserts nothing").toBeGreaterThan(0);

    for (const entry of read) {
      const [job, output] = entry.split(".");
      const block = directives.slice(directives.indexOf(`\n  ${job}:\n`));
      const outputs = block.slice(block.indexOf("outputs:"), block.indexOf("steps:"));
      expect(
        outputs,
        `${WORKFLOW}: the ${job} job never declares ${output}, so every reader of ` +
          `needs.${job}.outputs.${output} interpolates an empty string`,
      ).toMatch(new RegExp(`^ {6}${output}:`, "m"));
    }
  });
});

describe("the discovery evaluation's own workflow", () => {
  // this file names this workflow as what asserts these, and the workflow's
  // own header calls them safety properties 1 through 5. All were true when
  // the workflow was written and none was enforced only by the header's
  // prose, so a future edit could add `pull_request`, or a write scope to the
  // job that spawns a model, without failing anything here first.
  const WORKFLOW = ".github/workflows/discovery-eval.yaml";

  const readWorkflow = () => readFile(repoPath(WORKFLOW), "utf8");

  /**
   * line scanning rather than a parsed document, matching the effect
   * evaluation's own workflow tests above — this repository has no YAML
   * dependency, and adding one to assert five properties would widen the
   * supply-chain surface more than the assertion is worth.
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

  it("declares exactly the five documented dispatch inputs, all optional", async () => {
    const yaml = await readWorkflow();
    const inputs = blockUnder(yaml, "    inputs:");
    expect(inputs, `${WORKFLOW} declares no inputs: block under workflow_dispatch`).not.toBeNull();
    const names = [...inputs.matchAll(/^ {6}([a-z_]+):$/gm)].map(([, name]) => name);
    expect(names).toEqual(["case", "repeats", "pull_request", "prompt", "dry_run"]);
    // every one of the five is optional — none blocks an ordinary dispatch.
    expect(inputs).not.toMatch(/required: true/);
  });

  it("declares a dry_run input the probe step actually honours", async () => {
    const yaml = await readWorkflow();
    const on = blockUnder(yaml, "on:");
    expect(on, `${WORKFLOW} declares no dry_run input`).toMatch(/^ {6}dry_run:$/m);
    expect(
      on,
      "dry_run is not a defaulted boolean, so `inputs` cannot apply its default",
    ).toMatch(/type: boolean/);
    // README.md's spec names this input dry_run (underscore); effect-eval.yaml's
    // own is dry-run (hyphen) — the two workflows are not required to agree,
    // and a stray hyphenated read here would interpolate empty.
    expect(
      directivesOnly(yaml),
      "an expression reads inputs.dry-run, which is empty on an input named dry_run",
    ).not.toMatch(/inputs\.dry-run/);

    const probe = directivesOnly(blockUnder(yaml, "  probe:"));
    expect(probe, "the probe job never resolves a plan, so the input does nothing").toContain(
      "discovery-eval-probe-plan.mjs",
    );
    expect(probe, "the plan script is never told which mode the dispatch is in").toContain(
      '--dry-run-input "${DRY_RUN}"',
    );
  });

  it("matrixes the probe job by case, one job per case, and a failing case never cancels the rest", async () => {
    const probe = blockUnder(await readWorkflow(), "  probe:");
    expect(probe, `${WORKFLOW} has no probe job`).not.toBeNull();
    expect(probe, "the matrix does not declare fail-fast: false").toMatch(/^ {6}fail-fast: false$/m);
    expect(
      probe,
      "the matrix is not built from admit's own case list",
    ).toMatch(/^ {8}case: \$\{\{ fromJSON\(needs\.admit\.outputs\.cases\) \}\}$/m);
  });

  it("gives the probe job no write permission at all", async () => {
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
    const land = blockUnder(await readWorkflow(), "  land:");
    expect(land, `${WORKFLOW} has no land job`).not.toBeNull();
    expect(land).toMatch(/^ {6}contents: write$/m);
    expect(
      land,
      "the writing job invokes the probe, which would hand a model a write token",
    ).not.toContain("tools/evaluation/readings/discovery/evaluate.mjs");
  });

  describe("safety property 5 — a pull-request dispatch runs bare and records nothing", () => {
    it("gates the land job on admit's own records output, never on a second reading of pull_request", async () => {
      const land = blockUnder(await readWorkflow(), "  land:");
      expect(
        land,
        "land's if: does not read admit's records output, so a head-mode dispatch could reach it",
      ).toMatch(/needs\.admit\.outputs\.records == 'true'/);
      expect(
        directivesOnly(land),
        "land re-derives the mode from pull_request instead of reading admit's one resolution",
      ).not.toMatch(/inputs\.pull_request/);
    });

    it("routes a pull-request dispatch to report instead, which can never commit", async () => {
      const yaml = await readWorkflow();
      const report = blockUnder(yaml, "  report:");
      expect(report, `${WORKFLOW} has no report job`).not.toBeNull();
      expect(
        report,
        "report's if: does not read admit's mode output",
      ).toMatch(/needs\.admit\.outputs\.mode == 'head'/);
      expect(
        directivesOnly(report),
        "the report job holds a contents:write permission, so it could commit like land",
      ).not.toMatch(/contents:\s*write/);
    });

    it("passes --head-skills, never --out, on the probe job's head-mode branch", async () => {
      const probe = directivesOnly(blockUnder(await readWorkflow(), "  probe:"));
      const headBranchStart = probe.indexOf('if [ "${mode}" = "head" ]; then');
      const headBranchEnd = probe.indexOf('elif [ "${mode}" = "override" ]; then', headBranchStart);
      expect(headBranchStart, "the probe step never branches on mode at all").toBeGreaterThan(-1);
      expect(
        headBranchEnd,
        "the head-mode branch has no elif for override mode right after it",
      ).toBeGreaterThan(headBranchStart);
      const headBranch = probe.slice(headBranchStart, headBranchEnd);
      expect(headBranch, "the head-mode branch never stages head skills").toContain("--head-skills");
      expect(
        headBranch,
        "the head-mode branch passes --out, which would ask evaluate.mjs to record a measurement",
      ).not.toContain("--out");
      expect(headBranch, "the head-mode branch passes --prompt, a different threat model").not.toContain(
        "--prompt",
      );
    });

    it("refuses a malformed pull_request reference through admit rather than reading it loosely", async () => {
      const admitStep = directivesOnly(blockUnder(await readWorkflow(), "  admit:"));
      expect(
        admitStep,
        "admit passes --pull-request straight through to the admit script, which parses and refuses it",
      ).toContain('args+=(--pull-request "${PR_NUMBER}")');
    });
  });

  describe("safety property 6 — a prompt-override dispatch stays situated and records nothing", () => {
    it("gates the land job on admit's own records output, which a prompt override sets false too", async () => {
      // the same records-based gate property 5 tests, restated here because
      // this is the property that makes an override run's inability to reach
      // land structural rather than a second, independent claim: `admit`
      // sets records = mode === "measurement" and nothing else decides it, so
      // "override" is refused by the same reading "head" is.
      const land = blockUnder(await readWorkflow(), "  land:");
      expect(land).toMatch(/needs\.admit\.outputs\.records == 'true'/);
    });

    it("never routes an override dispatch into the report job, which is scoped to head only", async () => {
      const report = blockUnder(await readWorkflow(), "  report:");
      expect(
        report,
        "report's if: reads something other than mode == 'head', so an override dispatch could reach it too",
      ).toMatch(/needs\.admit\.outputs\.mode == 'head'/);
      expect(directivesOnly(report), "report reads an override-shaped condition").not.toMatch(/mode == 'override'/);
    });

    it("passes --prompt, never --out or --head-skills, on the probe job's override-mode branch", async () => {
      const probe = directivesOnly(blockUnder(await readWorkflow(), "  probe:"));
      const overrideBranchStart = probe.indexOf('elif [ "${mode}" = "override" ]; then');
      const overrideBranchEnd = probe.indexOf("          else", overrideBranchStart);
      expect(overrideBranchStart, "the probe step never branches on override mode at all").toBeGreaterThan(-1);
      expect(
        overrideBranchEnd,
        "the override-mode branch has no else — every case would run override",
      ).toBeGreaterThan(overrideBranchStart);
      const overrideBranch = probe.slice(overrideBranchStart, overrideBranchEnd);
      expect(overrideBranch, "the override-mode branch never passes --prompt").toContain("--prompt");
      expect(
        overrideBranch,
        "the override-mode branch passes --out, which would ask evaluate.mjs to record a measurement",
      ).not.toContain("--out");
      expect(
        overrideBranch,
        "the override-mode branch passes --head-skills, a different threat model",
      ).not.toContain("--head-skills");
    });

    it("uploads the override records with 30-day retention, not the head report's 1", async () => {
      const probe = await readWorkflow();
      const uploadStart = probe.indexOf("Upload this case's override records");
      expect(uploadStart, "no dedicated upload step for override records").toBeGreaterThan(-1);
      const uploadStep = probe.slice(uploadStart, probe.indexOf("\n\n", uploadStart));
      expect(uploadStep, "the override upload step is not gated on mode == 'override'").toContain(
        "steps.run.outputs.mode == 'override'",
      );
      expect(uploadStep, "the override upload step does not retain for 30 days").toMatch(
        /retention-days: 30/,
      );
    });

    it("refuses a prompt together with a pull_request reference through admit rather than running any probe", async () => {
      const admitStep = directivesOnly(blockUnder(await readWorkflow(), "  admit:"));
      expect(
        admitStep,
        "admit passes --pull-request straight through to the admit script",
      ).toContain('args+=(--pull-request "${PR_NUMBER}")');
      expect(
        admitStep,
        "admit passes --prompt straight through to the admit script, which refuses the combination",
      ).toContain('args+=(--prompt "${PROMPT}")');
    });

    it("gives an override dispatch its own concurrency group, distinct from a measurement dispatch of the same case", async () => {
      const yaml = await readWorkflow();
      const concurrency = blockUnder(yaml, "concurrency:");
      expect(concurrency, `${WORKFLOW} declares no concurrency: block`).not.toBeNull();
      expect(
        concurrency,
        "the concurrency group names no override-specific branch, so it collides with the measurement group",
      ).toMatch(/format\('override-\{0\}',/);
    });
  });
});
