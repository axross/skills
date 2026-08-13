#!/usr/bin/env node
// the probe job's plan, for .github/workflows/discovery-eval.yaml — one matrix
// cell, one case.
//
// it resolves what evaluate.mjs is to receive for THIS case: the flags common
// to both modes (--case, an optional --repeats override, an optional
// --dry-run), a fresh measurement directory name for a measurement dispatch,
// and whether this cell needs head skills staged. it runs nothing itself — the
// workflow stays visibly in charge of what it invokes, and a plan resolved as
// data is what a test can call without spawning the CLI. see
// .github/scripts/effect-eval-probe-plan.mjs's header: this is the same
// discipline, learned there first, after a shell loop that parsed correctly
// and ran zero times passed an independent review and three planted-violation
// checks.
//
// SAFETY PROPERTY 5's OTHER HALF LIVES HERE, generalised to three modes.
// `mode` is the same pure function of `--pull-request`/`--prompt` that
// discovery-eval-admit.mjs computes (parsed the same way, by the same shared
// helpers, so the two cannot disagree about what mode this dispatch is in).
// `measurementDir` is `null` whenever mode is not "measurement" — there is
// nothing for the probe step to pass as `--out`, so a head-mode or
// override-mode cell structurally cannot ask evaluate.mjs to record. The
// workflow step still has to choose between `--out`, `--head-skills` and
// `--prompt` for itself (this script does not know the runner's
// staged-skills path, `$RUNNER_TEMP`, or the dispatch's own prompt text), but
// it has no way to reach for `--out` on a non-"measurement" plan without
// inventing a path this script never emitted.
//
// THE PROMPT TEXT ITSELF NEVER APPEARS IN `args`. Unlike `--repeats` or
// `--dry-run`, a prompt is free text that can legitimately hold a newline,
// and the workflow reads `.args[]` back with `jq -r` into a bash array one
// line at a time — embedding the prompt there would let a multi-line prompt
// silently split into several broken argv entries. `promptNeeded` only
// signals that this cell needs `--prompt`; the workflow step appends it
// itself from its own `PROMPT` environment variable, the same way it already
// appends `--head-skills` and `--head-sha` for a head-mode cell rather than
// threading a runner-only path through this script's JSON.
//
// exit codes:
//   0  the plan is on stdout as JSON
//   2  bad invocation, an unknown case, or an input that does not resolve

import { caseMeasurementName } from "../../tools/discovery-eval/src/layout.mjs";
import {
  DEFAULT_ROOT,
  parseDryRunInput,
  parsePromptInput,
  parsePullRequestInput,
  readDeclaredCase,
} from "./lib/discovery-eval-fixture.mjs";

const USAGE = `Usage: discovery-eval-probe-plan.mjs --case <id> --dry-run-input <b> [options]

Resolve one matrix cell's plan: the flags common to every mode, a fresh
measurement directory name when this dispatch records, and which mode this
cell runs under. Prints JSON; runs nothing.

  --case <id>            the case this cell probes (required)
  --pull-request <n>      a pull request number, as passed to admit (optional;
                          empty means not a head-mode dispatch)
  --prompt <text>         a prompt override, as passed to admit (optional;
                          empty means not an override-mode dispatch). Refused
                          together with --pull-request
  --repeats <n>           override this case's declared repeat count (optional)
  --dry-run-input <b>     the dispatch's raw dry_run input, "true" or "false"
                          (required)
  --root <dir>            the data root (default: ${DEFAULT_ROOT})
  --help                  this text

Output: {"mode": ..., "measurementDir": ..., "args": [...], "headSkillsNeeded": ..., "promptNeeded": ...}

Exit codes: 0 planned, 2 bad invocation or an input that does not resolve.`;

function fail2(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

function parseArgv(argv) {
  const options = {
    caseId: null,
    pullRequest: null,
    prompt: null,
    repeats: null,
    dryRunInput: null,
    root: DEFAULT_ROOT,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (value === undefined) fail2(`${arg} needs a value.\n${USAGE}`);
      i += 1;
      return value;
    };
    if (arg === "--case") options.caseId = next();
    else if (arg === "--pull-request") options.pullRequest = next();
    else if (arg === "--prompt") options.prompt = next();
    else if (arg === "--repeats") options.repeats = next();
    else if (arg === "--dry-run-input") options.dryRunInput = next();
    else if (arg === "--root") options.root = next();
    else fail2(`Unknown option ${JSON.stringify(arg)}.\n${USAGE}`);
  }
  return options;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${USAGE}\n`);
    process.exit(0);
  }

  const options = parseArgv(argv);
  if (!options.caseId) fail2(`--case is required.\n${USAGE}`);
  if (options.dryRunInput === null) fail2(`--dry-run-input is required.\n${USAGE}`);

  let dryRun;
  let pullRequest;
  let prompt;
  try {
    dryRun = parseDryRunInput(options.dryRunInput);
    pullRequest = parsePullRequestInput(options.pullRequest ?? undefined);
    prompt = parsePromptInput(options.prompt ?? undefined);
  } catch (error) {
    fail2(error.message);
  }

  // mirrors discovery-eval-admit.mjs's own refusal of the same combination —
  // see this file's header for why the two scripts must not disagree.
  if (pullRequest !== null && prompt !== null) {
    fail2(`--pull-request and --prompt cannot both be given.\n${USAGE}`);
  }

  if (options.repeats !== null) {
    const value = Number(options.repeats);
    if (!Number.isInteger(value) || value < 1) fail2("--repeats needs a positive integer.");
    options.repeats = value;
  }

  try {
    await readDeclaredCase(options.root, options.caseId);
  } catch (error) {
    fail2(error.message);
  }

  const mode = pullRequest !== null ? "head" : prompt !== null ? "override" : "measurement";

  const args = ["--case", options.caseId];
  if (options.repeats !== null) args.push("--repeats", String(options.repeats));
  if (dryRun) args.push("--dry-run");

  const plan = {
    mode,
    // null on a head-mode or override-mode plan by construction — there is
    // no directory for the workflow step to hand evaluate.mjs as `--out`, so
    // this cell cannot ask it to record even if the shell around it tried.
    measurementDir: mode === "measurement" ? caseMeasurementName(options.caseId) : null,
    args,
    headSkillsNeeded: mode === "head",
    // signals the flag only; the workflow appends the prompt text itself —
    // see this file's header.
    promptNeeded: mode === "override",
  };

  process.stdout.write(`${JSON.stringify(plan)}\n`);
}

main();
