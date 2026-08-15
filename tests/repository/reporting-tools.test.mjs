// reporting tools must stay out of the enforced-gate set.
//
// two scripts here report instead of judging, for two different reasons, and
// each is one careless wiring away from becoming a gate that can never fail
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
// skill. its reason is the strongest of the two: the defect is not decidable
// from the text at all. the Portable Source Exception lets a self-contained
// distributable skill restate a rule another skill owns, and every skill here is
// distributable — so a gate on similarity would fail correct prose. only intent
// separates the cases, and intent is not in the corpus.
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
