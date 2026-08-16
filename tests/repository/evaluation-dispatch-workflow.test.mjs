// evaluation-dispatch.yaml's safety properties, held as tests rather than
// left to a reader of its own header comment.
//
// this is the sibling of tests/repository/scheduled-audit-tools.test.mjs and
// borrows its shape: that file proves a network-reaching audit cannot become a
// gate; this one proves the workflow that spends real money and holds a model
// credential cannot also write to this repository, and that the instrument it
// drives has exactly one entry point. a grep proves these today; this file
// proves them on every run.
//
// seven properties, matching evaluation-dispatch.yaml's own System design
// exactly (see docs/operations/evaluation-dispatch.md and the workflow's own
// header comment):
//
//   1. workflow_dispatch is the workflow's only trigger — no contributor can
//      cause a run, and no pull request can alter what a run executes.
//   2. no job declaring `strategy.matrix` also declares its own
//      `concurrency` block — a matrix job's group is evaluated once per
//      cell, so a job-level group would collapse every cell into one and
//      cancel most of them.
//   3. the workflow-level `concurrency` block groups per dispatch scenario
//      (`group` interpolates `inputs.scenario`) and never cancels a run in
//      progress (`cancel-in-progress: false`) — cancelling a matrix
//      mid-flight destroys probes already paid for.
//   4. every job declaring `strategy.matrix` also declares
//      `fail-fast: false` — one failed cell must not cancel its siblings or
//      discard the paid work of the cells that already finished.
//   5. no job declaring `contents: write` also references a model-credential
//      secret — the job that can write to this repository never also holds
//      the credential that spends money.
//   6. every job that DOES reference a model-credential secret declares
//      `permissions: {}` — the least this repository can grant a job that
//      spawns a model or feeds one a transcript.
//   7. the instrument's three scripts (probe.mjs, evaluate.mjs, derive.mjs)
//      are named by this workflow and by no other — so a second workflow
//      cannot quietly grow a second, differently-permissioned entry point.
//
// every assertion below was confirmed to fail against a copy of the workflow
// with the property it names removed, then reverted — see the pull request
// this test shipped in for what was planted and what failed.

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { repoPath } from "../helpers/run.mjs";

const WORKFLOW_FILE = "evaluation-dispatch.yaml";

/** the secrets that authenticate a model, never a repository write. */
const MODEL_TOKEN_NEEDLES = ["secrets.CLAUDE_CODE_OAUTH_TOKEN", "secrets.ANTHROPIC_API_KEY"];

/** the instrument's three scripts, by the exact path a workflow step invokes. */
const INSTRUMENT_SCRIPTS = [
  "tools/evaluation/probe.mjs",
  "tools/evaluation/evaluate.mjs",
  "tools/evaluation/derive.mjs",
];

const readWorkflow = () => readFile(repoPath(".github/workflows", WORKFLOW_FILE), "utf8");

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

/** a workflow's `on:` block, as raw text — everything up to the next top-level key. */
function triggerBlockOf(yaml) {
  const match = yaml.match(/^on:\n([\s\S]*?)(?=^\S)/m);
  if (!match) throw new Error(`No 'on:' block found in ${WORKFLOW_FILE}`);
  return match[1];
}

/**
 * every top-level job's own text, keyed by job name — from its `  <name>:`
 * heading up to (not including) the next job's heading, or the end of the
 * `jobs:` section.
 *
 * @param {string} yaml
 * @returns {Record<string, string>}
 */
function jobBlocksOf(yaml) {
  const jobsIndex = yaml.indexOf("\njobs:\n");
  if (jobsIndex === -1) throw new Error(`No 'jobs:' block found in ${WORKFLOW_FILE}`);
  const jobsSection = yaml.slice(jobsIndex + 1);

  const headings = [...jobsSection.matchAll(/^ {2}([a-zA-Z0-9_-]+):\s*\n/gm)];
  const blocks = {};
  for (let index = 0; index < headings.length; index += 1) {
    const start = headings[index].index;
    const end = index + 1 < headings.length ? headings[index + 1].index : jobsSection.length;
    blocks[headings[index][1]] = jobsSection.slice(start, end);
  }
  return blocks;
}

/**
 * the `<key>:` line and everything indented under it, sliced out of `text` —
 * generic over both a flow-style one-liner (`permissions: {}`, no
 * continuation lines match) and a block (`permissions:` followed by
 * more-indented `contents: write` etc.).
 *
 * @param {string} text
 * @param {number} indent the `key:` line's own indentation, in spaces
 * @param {string} key
 * @returns {string|null}
 */
function blockAfter(text, indent, key) {
  const pattern = new RegExp(`^ {${indent}}${key}:.*\\n(?: {${indent + 1},}.*\\n?)*`, "m");
  const match = text.match(pattern);
  return match ? match[0] : null;
}

/** one job's own `permissions:` block, trimmed — `""` if it declares none. */
function permissionsOf(jobText) {
  return (blockAfter(jobText, 4, "permissions") ?? "").trim();
}

describe("evaluation-dispatch.yaml's trigger", () => {
  it("has workflow_dispatch as its only trigger", async () => {
    const block = triggerBlockOf(await readWorkflow());
    const names = [...block.matchAll(/^ {2}([a-zA-Z_]+):/gm)].map((match) => match[1]);

    // manual dispatch requiring write access, running only the version on
    // the default branch, is what keeps a contributor from causing a run and
    // a pull request from altering what a run executes — the same property
    // link-freshness.yaml's own trigger test protects, for the same reason.
    expect(names, `${WORKFLOW_FILE} must be triggered by workflow_dispatch and by nothing else`).toEqual([
      "workflow_dispatch",
    ]);
  });
});

describe("a matrix job never declares its own concurrency group", () => {
  it("no job with strategy.matrix also declares a job-level concurrency block", async () => {
    const yaml = await readWorkflow();
    const jobs = jobBlocksOf(yaml);
    const matrixJobs = Object.entries(jobs).filter(([, text]) => {
      const strategy = blockAfter(text, 4, "strategy");
      return strategy !== null && /matrix:/.test(strategy);
    });

    // guards this test against going vacuous: if nothing here declares a
    // matrix strategy, the loop below would pass having checked nothing —
    // and this workflow is supposed to fan two jobs out over one.
    expect(
      matrixJobs.length,
      `expected at least one job in ${WORKFLOW_FILE} to declare strategy.matrix`,
    ).toBeGreaterThan(0);

    for (const [name, text] of matrixJobs) {
      // `jobs.<job_id>.concurrency` is evaluated once per matrix cell. a
      // group key with no `matrix.*` in it — the only kind this workflow
      // ever wants, since the point is grouping by dispatch, not by cell —
      // resolves to the identical string for every cell, and GitHub cancels
      // all but the most recently queued pending job in a group regardless
      // of cancel-in-progress: false, which only protects an already-running
      // job. that would silently drop most of a dispatch's probes. the fix
      // is a workflow-level group instead, asserted separately below.
      expect(
        blockAfter(text, 4, "concurrency"),
        `${name} declares strategy.matrix and its own concurrency block — a matrix job's own concurrency group collapses every cell into the same group and cancels most of them`,
      ).toBeNull();
    }
  });
});

describe("evaluation-dispatch.yaml's workflow-level concurrency group", () => {
  it("is grouped per dispatch scenario and never cancels a run already in progress", async () => {
    const yaml = await readWorkflow();
    const block = blockAfter(yaml, 0, "concurrency");

    // present once, above every job, not per matrix cell — see the matrix
    // job describe above for why it cannot live at the job level instead.
    expect(block, `${WORKFLOW_FILE} must declare a workflow-level concurrency block`).not.toBeNull();

    const groupMatch = block.match(/^ {2}group:(.*)$/m);
    const group = groupMatch ? groupMatch[1].trim() : "";
    const cancelMatch = block.match(/^ {2}cancel-in-progress:(.*)$/m);
    const cancelInProgress = cancelMatch ? cancelMatch[1].trim() : "";

    // grouped per dispatch SCENARIO, not per run: two dispatches of
    // different scenarios must not queue behind each other, and only
    // interpolating the scenario input expresses that — some interpolation
    // (e.g. `github.run_id`) would satisfy "non-constant" while still
    // defeating the group, since a group every run is alone in is the same
    // as no group at all.
    expect(
      group,
      `${WORKFLOW_FILE}'s workflow-level concurrency group must interpolate inputs.scenario, found ${JSON.stringify(group)}`,
    ).toMatch(/inputs\.scenario/);

    // never cancelling: cancelling a matrix mid-flight destroys probes
    // already paid for.
    expect(
      cancelInProgress,
      `${WORKFLOW_FILE}'s workflow-level concurrency group must declare cancel-in-progress: false, found ${JSON.stringify(cancelInProgress)}`,
    ).toBe("false");
  });
});

describe("every job with strategy.matrix declares fail-fast: false", () => {
  it("no matrix job cancels its siblings, or discards the paid work of the cells that already finished, when one cell fails", async () => {
    const yaml = await readWorkflow();
    const jobs = jobBlocksOf(yaml);
    const matrixJobs = Object.entries(jobs).filter(([, text]) => {
      const strategy = blockAfter(text, 4, "strategy");
      return strategy !== null && /matrix:/.test(strategy);
    });

    // guards this test against going vacuous the same way the describe
    // above does: if nothing here declares a matrix strategy, the loop
    // below would pass having checked nothing.
    expect(
      matrixJobs.length,
      `expected at least one job in ${WORKFLOW_FILE} to declare strategy.matrix`,
    ).toBeGreaterThan(0);

    for (const [name, text] of matrixJobs) {
      const strategy = blockAfter(text, 4, "strategy");
      const failFastMatch = strategy.match(/^ {6}fail-fast:(.*)$/m);
      const failFast = failFastMatch ? failFastMatch[1].trim() : "";

      expect(
        failFast,
        `${name} declares strategy.matrix and must set fail-fast: false, found ${JSON.stringify(failFast)}`,
      ).toBe("false");
    }
  });
});

describe("write access and a model token never share a job", () => {
  it("no job declaring contents: write also references a model-credential secret", async () => {
    const jobs = jobBlocksOf(await readWorkflow());
    const writers = Object.entries(jobs).filter(([, text]) => /contents:\s*write/.test(permissionsOf(text)));

    // guards this test against going vacuous: if nothing here declares
    // contents: write, the loop below would pass having checked nothing —
    // and this workflow is supposed to have exactly one job that can write.
    expect(
      writers.length,
      `expected at least one job in ${WORKFLOW_FILE} to declare contents: write (the job that lands the measurement pull request)`,
    ).toBeGreaterThan(0);

    for (const [name, text] of writers) {
      for (const needle of MODEL_TOKEN_NEEDLES) {
        expect(text, `${name} declares contents: write and also references ${needle}`).not.toContain(needle);
      }
    }
  });
});

describe("every job holding a model token declares permissions: {}", () => {
  it("probe and evaluate are exactly the jobs referencing a model-credential secret, and both declare permissions: {}", async () => {
    const jobs = jobBlocksOf(await readWorkflow());
    const holders = Object.entries(jobs).filter(([, text]) =>
      MODEL_TOKEN_NEEDLES.some((needle) => text.includes(needle)),
    );

    // named explicitly rather than only counted: the workflow's own design
    // is that the probe job (which spawns a model) and the evaluate job
    // (which feeds one a transcript) are the two, and no others.
    expect(
      holders.map(([name]) => name).sort(),
      `expected exactly probe and evaluate to reference a model-credential secret in ${WORKFLOW_FILE}`,
    ).toEqual(["evaluate", "probe"]);

    for (const [name, text] of holders) {
      expect(permissionsOf(text), `${name}'s own permissions block`).toBe("permissions: {}");
    }
  });
});

describe("the instrument's three scripts are wired into exactly this workflow", () => {
  it.each(INSTRUMENT_SCRIPTS)("names %s in evaluation-dispatch.yaml and no other workflow", async (script) => {
    const naming = [];
    for (const path of await filesUnder(repoPath(".github/workflows"))) {
      const yaml = await readFile(path, "utf8");
      if (yaml.includes(script)) naming.push(path.slice(path.lastIndexOf("/") + 1));
    }

    // stronger than "appears somewhere": it must appear in this one workflow
    // and no other, so a second workflow growing its own, differently
    // permissioned invocation of the instrument does not pass unnoticed.
    expect(naming.sort(), `${script} must be invoked by ${WORKFLOW_FILE} and by no other workflow`).toEqual([
      WORKFLOW_FILE,
    ]);
  });
});
