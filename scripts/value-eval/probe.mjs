#!/usr/bin/env node
// probe.mjs — spawns the `claude` CLI inside a value-eval workspace
// (produced by materialize.mjs) and captures the whole run: every tool call
// in order, the produced diff, the turn count, the reported cost, the
// loaded-skill list, and whether the run ended on the turn cap. Extracts the
// deterministic signals transcript.mjs and artifact.mjs define and writes
// one run record — see record.mjs for why that record carries no verdict.
//
// THIS IS A MEASURING INSTRUMENT, NOT A JUDGE. It reports what happened; it
// never decides whether what happened was good. See issue #235's System
// design: "Measurement stays separate from judgment throughout."
//
// A NON-ZERO EXIT FROM THE CLI IS EXPECTED. With a turn cap of 100 a
// legitimately long run can end in `result.subtype: error_max_turns` and a
// non-zero process status — discovery-eval/run.mjs's header documents the
// same shape for its own one-turn probe, and the reasoning transfers
// unchanged: the STREAM is what matters, and it is complete either way, so
// this never treats the process's own exit code as failure. `truncated` in
// the record is read from `result.subtype`, never inferred from anything
// about the process exit or the transcript's length.
//
// THE WORKSPACE IS ALWAYS TRUSTED CONTENT. materialize.mjs builds it only
// from this repository's OWN examples/ fixture and OWN installed skills,
// never from a pull request head, which is exactly why spawn.mjs's tool
// posture can invert the discovery probe's and permit Bash and the editing
// tools — see spawn.mjs's header for the full argument.
//
// THE STOP-LOSS GUARD IS OPT-IN, VIA --ledger. Passing it turns "after each
// run, accumulate cost and project the remaining total" (issue #235's
// non-functional requirement) into something this script itself enforces
// across separate invocations: it reads the ledger, refuses to spawn when
// the projection would exceed the cap, and appends this run's cost once it
// completes. Omit --ledger to run one probe with no cumulative check at all
// — useful for the very first probe issue #235's verification strategy asks
// be captured alone, before the ledger has anything to project from.
//
// Usage:
//   node scripts/value-eval/probe.mjs [options]
//
// Exit codes:
//   0  the run completed (or --dry-run validated) and a record was produced
//   2  bad invocation: a missing/unknown flag, a missing workspace, a
//      malformed ledger, or the `claude` CLI not on PATH
//   4  the stop-loss guard refused to start this run — the measured figures
//      are printed; nothing was spawned. Reachable only when --ledger is
//      given, so a caller that never opts in never sees it.

import { spawnSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { corpusInvocability } from "../discovery-eval/corpus.mjs";
import { classifyLoaded } from "../discovery-eval/isolation.mjs";
import { extractArtifact, isTestFilePath } from "./artifact.mjs";
import { appendRunRecord, buildRunRecord, serializeRunRecord } from "./record.mjs";
import {
  ALLOWED_TOOLS,
  buildProbeEnvironment,
  buildSpawnArgs,
  DISALLOWED_TOOLS,
  SETTING_SOURCES,
  TURN_CAP,
} from "./spawn.mjs";
import { appendLedgerCost, DEFAULT_BUDGET_USD, evaluateStopLoss, readLedger } from "./stop-loss.mjs";
import { extractTranscript } from "./transcript.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const INSTALLED_SKILLS_ROOT = join(REPO_ROOT, ".claude", "skills");

// Issue #235's functional requirements, verbatim — see "The task prompt is:"
// and "The target module is". Both are deliberately overridable so this
// probe is not welded to one mock, but neither should drift from the plan
// without a reason worth writing down.
const DEFAULT_PROMPT = "shared/resolve-translation.ts has no tests. Add unit tests for it.";
const DEFAULT_TARGET_MODULE = "shared/resolve-translation.ts";
const DEFAULT_HELPER_NAMES = ["normalizeLocale", "findExactMatch", "findLanguageMatch"];
const DEFAULT_MOCK = "content-site";
const DEFAULT_TOTAL_RUNS = 6; // issue #235: three control runs and three treatment runs

const MAX_BUFFER_BYTES = 64 * 1024 * 1024; // larger than discovery-eval's: up to 100 turns of edits and diffs, not one

const USAGE = `Usage: probe.mjs [options]

Spawn the claude CLI inside a value-eval workspace (one materialize.mjs
already produced) and capture the whole run — every tool call in order, the
produced diff, the turn count, the reported cost, the loaded-skill list, and
whether the run ended on the turn cap. Writes one run record: arm, run
index, extractor outputs, cost, turns, truncated or not, loaded skills — and
no verdict field, ever.

  --workspace <dir>       a workspace materialize.mjs produced (required)
  --arm <label>           experimental condition, e.g. "control" or
                           "treatment" (required)
  --run-index <n>         which repeat this is within the arm, 0-based (required)
  --mock <name>           which examples/ fixture the workspace came from,
                           recorded only (default: ${DEFAULT_MOCK})
  --skill <name>          recorded only: a skill installed for this arm;
                           repeatable
  --prompt <text>         the task prompt
                           (default: ${JSON.stringify(DEFAULT_PROMPT)})
  --target-module <path>  workspace-relative module the artifact extractor
                           checks helper imports against
                           (default: ${DEFAULT_TARGET_MODULE})
  --records <path>        append the run record as one NDJSON line here
                           (default: print the record to stdout)
  --ledger <path>         JSON file accumulating this case's reported costs;
                           enables the stop-loss guard below
  --total-runs <n>        total runs planned for the case, used with
                           --ledger (default ${DEFAULT_TOTAL_RUNS})
  --budget-usd <n>        cumulative stop-loss cap, used with --ledger
                           (default ${DEFAULT_BUDGET_USD})
  --dry-run               validate inputs and print the plan; spawn nothing
  --help                  this text

Every spawn passes --setting-sources project and a turn cap of ${TURN_CAP}, and
permits ${ALLOWED_TOOLS.join(", ")} while denying ${DISALLOWED_TOOLS.join(", ")}
— see spawn.mjs for why.

Exit codes: 0 a record was produced (or --dry-run validated), 2 bad
invocation, 4 the stop-loss guard refused this run (only reachable with
--ledger).`;

function fail2(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

async function isDirectory(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/** The target module's basename with no extension, e.g. "resolve-translation". */
function moduleBasename(targetModule) {
  return basename(targetModule).replace(/\.[^./]+$/, "");
}

/** Runs `git` in `cwd` and returns stdout, throwing on a non-zero exit. */
function runGitCapture(args, cwd) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(" ")} (in ${cwd}) exited ${result.status}:\n${result.stderr || result.stdout}`,
    );
  }
  return result.stdout;
}

/**
 * Stages everything so a newly added file appears in the diff too, then
 * reads back the full diff and the list of changed paths. `--no-renames`
 * keeps every `git status --porcelain -z` entry to the single "XY<space>path"
 * shape this parses — a rename would otherwise emit an "old\0new\0" pair the
 * fixed 3-character prefix strip below does not expect, and nothing in this
 * probe's task ever asks the model to rename a file.
 *
 * @param {string} workspace
 * @returns {{ diff: string, changedPaths: string[] }}
 */
function captureDiff(workspace) {
  runGitCapture(["add", "-A"], workspace);
  const diff = runGitCapture(["diff", "--cached", "--no-color"], workspace);
  const statusOutput = runGitCapture(
    ["status", "--porcelain", "-z", "--no-renames"],
    workspace,
  );
  const changedPaths = statusOutput
    .split("\0")
    .filter((entry) => entry.length > 0)
    .map((entry) => entry.slice(3));
  return { diff, changedPaths };
}

/**
 * Reads every changed path that looks like a test file, straight off the
 * workspace's working tree rather than by reconstructing it from the diff —
 * simpler and exact, since the file already exists on disk after the run.
 *
 * @param {string} workspace
 * @param {string[]} changedPaths
 * @returns {Promise<Array<{ path: string, content: string }>>}
 */
async function readChangedTestFiles(workspace, changedPaths) {
  const testPaths = changedPaths.filter((path) => isTestFilePath(path));
  return Promise.all(
    testPaths.map(async (path) => ({
      path,
      content: await readFile(join(workspace, path), "utf8"),
    })),
  );
}

/**
 * Best-effort, stderr-only isolation note for this run's loaded-skill list —
 * informational, never part of the persisted record (see record.mjs's header
 * on why the record carries no judgment). Reuses
 * discovery-eval/isolation.mjs's classification rather than reimplementing
 * it, per issue #235's system design. Swallows its own failure: a corpus read
 * going wrong must never block the record this run already earned.
 *
 * @param {string[]|null} loadedSkills
 */
async function reportIsolation(loadedSkills) {
  if (loadedSkills === null) {
    process.stderr.write("isolation: the stream reported no skill list\n");
    return;
  }
  try {
    const invocability = await corpusInvocability(INSTALLED_SKILLS_ROOT);
    const { own, colliding, foreign } = classifyLoaded(loadedSkills, invocability);
    process.stderr.write(
      `isolation: ${own.length} own, ${colliding.length} colliding, ${foreign.length} foreign` +
        (colliding.length + foreign.length > 0
          ? ` (${[...colliding, ...foreign].sort().join(", ")})`
          : "") +
        "\n",
    );
  } catch (error) {
    process.stderr.write(
      `isolation: could not classify (${error instanceof Error ? error.message : error})\n`,
    );
  }
}

function parseArgv(argv) {
  const options = {
    workspace: null,
    arm: null,
    runIndex: null,
    mock: DEFAULT_MOCK,
    skills: [],
    prompt: DEFAULT_PROMPT,
    targetModule: DEFAULT_TARGET_MODULE,
    records: null,
    ledger: null,
    totalRuns: DEFAULT_TOTAL_RUNS,
    budgetUsd: DEFAULT_BUDGET_USD,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (value === undefined) fail2(`${arg} needs a value.\n${USAGE}`);
      i += 1;
      return value;
    };

    if (arg === "--workspace") options.workspace = next();
    else if (arg === "--arm") options.arm = next();
    else if (arg === "--run-index") options.runIndex = next();
    else if (arg === "--mock") options.mock = next();
    else if (arg === "--skill") options.skills.push(next());
    else if (arg === "--prompt") options.prompt = next();
    else if (arg === "--target-module") options.targetModule = next();
    else if (arg === "--records") options.records = next();
    else if (arg === "--ledger") options.ledger = next();
    else if (arg === "--total-runs") options.totalRuns = next();
    else if (arg === "--budget-usd") options.budgetUsd = next();
    else if (arg === "--dry-run") options.dryRun = true;
    else fail2(`Unknown option ${JSON.stringify(arg)}.\n${USAGE}`);
  }

  return options;
}

/** Validates and coerces the parsed options, failing loudly on the first problem. */
function validateOptions(options) {
  if (!options.workspace) fail2(`--workspace is required.\n${USAGE}`);
  if (!options.arm) fail2(`--arm is required.\n${USAGE}`);
  if (options.runIndex === null) fail2(`--run-index is required.\n${USAGE}`);

  const runIndex = Number(options.runIndex);
  if (!Number.isInteger(runIndex) || runIndex < 0) {
    fail2(`--run-index must be a non-negative integer, got ${JSON.stringify(options.runIndex)}.`);
  }

  const totalRuns = Number(options.totalRuns);
  if (!Number.isInteger(totalRuns) || totalRuns < 1) {
    fail2(`--total-runs must be a positive integer, got ${JSON.stringify(options.totalRuns)}.`);
  }

  const budgetUsd = Number(options.budgetUsd);
  if (!Number.isFinite(budgetUsd) || budgetUsd <= 0) {
    fail2(`--budget-usd must be a positive number, got ${JSON.stringify(options.budgetUsd)}.`);
  }

  return { ...options, runIndex, totalRuns, budgetUsd };
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${USAGE}\n`);
    process.exit(0);
  }

  const options = validateOptions(parseArgv(argv));

  if (!(await isDirectory(options.workspace))) {
    fail2(`No workspace directory at ${options.workspace} — run materialize.mjs first.`);
  }

  const targetModuleBasename = moduleBasename(options.targetModule);
  const spawnArgs = buildSpawnArgs(options.prompt);

  if (options.dryRun) {
    const lines = [
      "DRY RUN — no CLI would be spawned.",
      "",
      `workspace:      ${options.workspace}`,
      `arm:            ${options.arm}`,
      `run index:      ${options.runIndex}`,
      `mock:           ${options.mock}`,
      `skills:         ${options.skills.length > 0 ? options.skills.join(", ") : "(none)"}`,
      `prompt:         ${options.prompt}`,
      `target module:  ${options.targetModule}`,
      `command:        claude ${spawnArgs.join(" ")}`,
      `records out:    ${options.records ?? "(stdout)"}`,
    ];

    if (options.ledger) {
      const costsSoFar = await readLedger(options.ledger);
      const remainingRuns = options.totalRuns - costsSoFar.length;
      const evaluation = evaluateStopLoss({
        costsSoFar,
        remainingRuns,
        capUsd: options.budgetUsd,
      });
      lines.push(
        `stop-loss:      ${evaluation.permitted ? "would PERMIT" : "would REFUSE"} — ${evaluation.reason}`,
      );
    } else {
      lines.push("stop-loss:      no --ledger given, not evaluated");
    }

    process.stdout.write(`${lines.join("\n")}\n`);
    process.exit(0);
  }

  if (options.ledger) {
    const costsSoFar = await readLedger(options.ledger);
    const remainingRuns = options.totalRuns - costsSoFar.length;
    if (remainingRuns < 1) {
      fail2(
        `--total-runs ${options.totalRuns} runs are already recorded in ${options.ledger}; nothing remains to start.`,
      );
    }
    const evaluation = evaluateStopLoss({
      costsSoFar,
      remainingRuns,
      capUsd: options.budgetUsd,
    });
    if (!evaluation.permitted) {
      process.stderr.write(
        [
          "Refusing to start this run: the cumulative stop-loss would be exceeded.",
          `  spent so far:     $${evaluation.spentSoFar.toFixed(2)}`,
          `  average per run:  $${evaluation.averagePerRun.toFixed(2)}`,
          `  projected total:  $${evaluation.projectedTotal.toFixed(2)}`,
          `  cap:              $${evaluation.capUsd.toFixed(2)}`,
          "",
          "This is a mechanism, not a decision: it stops the next run from starting.",
          "Whether to raise the cap, change the plan, or stop the case here is not",
          "this script's call.",
          "",
        ].join("\n"),
      );
      process.exit(4);
    }
  }

  const result = spawnSync("claude", spawnArgs, {
    cwd: options.workspace,
    encoding: "utf8",
    env: buildProbeEnvironment(process.env),
    maxBuffer: MAX_BUFFER_BYTES,
  });

  if (result.error) {
    if (result.error.code === "ENOENT") {
      fail2(
        "The `claude` CLI is not on PATH. This probe drives the real CLI; install it or run with --dry-run.",
      );
    }
    throw result.error;
  }
  // A non-zero status here is EXPECTED when the turn cap binds — see this
  // file's header. `truncated` below is read from the stream's own
  // `result.subtype`, never from this exit code.

  const transcript = extractTranscript(result.stdout);
  const { diff, changedPaths } = captureDiff(options.workspace);
  const testFiles = await readChangedTestFiles(options.workspace, changedPaths);
  const artifact = extractArtifact(testFiles, {
    targetModuleBasename,
    helperNames: DEFAULT_HELPER_NAMES,
  });

  const record = buildRunRecord({
    arm: options.arm,
    runIndex: options.runIndex,
    mock: options.mock,
    skills: options.skills,
    prompt: options.prompt,
    targetModule: options.targetModule,
    cliExitCode: result.status,
    transcript,
    artifact,
    diff,
  });

  if (options.records) {
    await appendRunRecord(options.records, record);
  } else {
    process.stdout.write(serializeRunRecord(record));
  }

  if (options.ledger) {
    await appendLedgerCost(options.ledger, record.costUsd);
  }

  process.stderr.write(
    `run complete: $${record.costUsd.toFixed(2)}, ${record.turns ?? "?"} turn(s), ` +
      `${record.truncated ? "TRUNCATED at the turn cap" : "finished within the turn cap"}, ` +
      `CLI exit ${record.cliExitCode}\n`,
  );
  await reportIsolation(record.loadedSkills);

  process.exit(0);
}

main();
