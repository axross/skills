#!/usr/bin/env node
// the land job's plan, for .github/workflows/discovery-eval.yaml.
//
// mirrors .github/scripts/effect-eval-landing-plan.mjs: one resolution of how
// this dispatch lands — the branch, the commit and pull-request subject, the
// extra `gh pr create` flags, and the mode records are checked against — so
// the branch/title and the mode check can never disagree about which mode this
// run is. it never runs — see that file's header for why a derivation gets its
// own script rather than a workflow-body conditional.
//
// generalised for a per-case matrix rather than a per-condition one: a
// discovery dispatch can land many case measurements in one pull request (a
// full-fixture run lands up to 59 of them), so the subject names how many
// rather than naming one case the way the effect side's single-case dispatch
// does — except when exactly one case landed, which is what the first dispatch
// against a fresh fixture does, and where naming it plainly reads better than
// "1 case measurement(s)".
//
// this land job never runs for a head-mode dispatch at all (see
// discovery-eval-admit.mjs's header on safety property 5), so `--expect` here
// is always resolved against the dry-run input alone, never against pull
// request presence.
//
// exit codes:
//   0  the plan is on stdout as JSON
//   2  bad invocation, or a dry-run input that is neither "true" nor "false"

import { parseDryRunInput } from "./lib/discovery-eval-fixture.mjs";

const USAGE = `Usage: discovery-eval-landing-plan.mjs --cases <json-array> --dry-run-input <b> --run-id <n>

Resolve how one measurement dispatch lands: its branch, its subject, the extra
flags \`gh pr create\` receives, and the mode its records are checked against.
Prints JSON; runs nothing.

  --cases <json-array>   the case ids this dispatch landed, as a JSON array
                          (required)
  --dry-run-input <b>    the dispatch's raw dry_run input, "true" or "false"
                          (required)
  --run-id <n>            the workflow run id, which names the branch (required)
  --help                  this text

Output: {"branch": ..., "title": ..., "prFlags": [...], "expect": ..., "bodyPreamble": ...}

Exit codes: 0 planned, 2 bad invocation or an input that does not resolve.`;

function fail2(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

function parseArgv(argv) {
  const options = { cases: null, dryRunInput: null, runId: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (value === undefined) fail2(`${arg} needs a value.\n${USAGE}`);
      i += 1;
      return value;
    };
    if (arg === "--cases") options.cases = next();
    else if (arg === "--dry-run-input") options.dryRunInput = next();
    else if (arg === "--run-id") options.runId = next();
    else fail2(`Unknown option ${JSON.stringify(arg)}.\n${USAGE}`);
  }
  return options;
}

/** a rehearsal's subject is deliberately not a Conventional Commit — see effect-eval-landing-plan.mjs. */
const DRY_RUN_PREAMBLE = `**This is a rehearsal. Close it; do not merge it.**

Every record here is synthetic: the dispatch ran with \`dry_run\`, so no model was
spawned and nothing was billed. Each \`metadata.json\` is stamped
\`trigger.kind: "dry-run"\`, and the landing job refused to commit until every record
agreed with that.

It exists to prove the dispatch's wiring end to end — the matrix fan-out, the
artifacts, the derivation, this commit, and this pull request — for the cost of CI
minutes rather than a paid probe.

It is opened as a draft so GitHub will not merge it. A test asserts no committed
measurement carries the dry-run stamp, so landing this anyway breaks the default
branch's checks.`;

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${USAGE}\n`);
    process.exit(0);
  }

  const options = parseArgv(argv);
  if (!options.cases) fail2(`--cases is required.\n${USAGE}`);
  if (options.dryRunInput === null) fail2(`--dry-run-input is required.\n${USAGE}`);
  if (!options.runId) fail2(`--run-id is required.\n${USAGE}`);

  let dryRun;
  try {
    dryRun = parseDryRunInput(options.dryRunInput);
  } catch (error) {
    fail2(error.message);
  }

  let cases;
  try {
    cases = JSON.parse(options.cases);
  } catch (error) {
    fail2(`--cases is not valid JSON: ${error.message}`);
  }
  if (!Array.isArray(cases) || cases.length === 0) {
    fail2("--cases must be a non-empty JSON array of case ids.");
  }

  const subject = cases.length === 1 ? `of ${cases[0]}` : `(${cases.length} cases)`;

  const plan = dryRun
    ? {
        branch: `discovery-eval/dry-run/${options.runId}`,
        title: `DRY RUN — do not merge: discovery-eval dispatch rehearsal ${subject}`,
        prFlags: ["--draft"],
        expect: "dry-run",
        bodyPreamble: DRY_RUN_PREAMBLE,
      }
    : {
        branch: `discovery-eval/measurement/${options.runId}`,
        title: `data(discovery-eval): record a case measurement ${subject}`,
        prFlags: [],
        expect: "measurement",
        bodyPreamble: `Recorded ${cases.length} case measurement(s): ${cases.join(", ")}.`,
      };

  process.stdout.write(`${JSON.stringify(plan)}\n`);
}

main();
