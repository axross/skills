#!/usr/bin/env node
// the land job's plan, for .github/workflows/effect-eval.yaml.
//
// it resolves how this dispatch lands — the branch, the commit and pull-request
// subject, the extra `gh pr create` flags, and the mode the records are checked
// against — and emits them as JSON for the workflow to read with `jq`.
//
// one resolution, not two. `expect` is here because the land job used to derive
// it separately, as `${{ inputs.dry-run && 'dry-run' || 'measurement' }}`, from
// the same input the branch and title came from. two derivations of one fact
// can disagree, and the mode check exists precisely to catch the case where the
// records and the dispatch disagree — a check whose own argument is derived a
// second way is weaker than it looks.
//
// it also covers the half no rehearsal reaches. a dry run executes only the
// dry-run side of what used to be a shell `if`; the measurement side ran for
// the first time when money was already spent. as a pure function both sides
// are asserted offline.
//
// exit codes:
//   0  the plan is on stdout as JSON
//   2  bad invocation, an unknown case, or a dry-run input that is neither
//      "true" nor "false"

import { DEFAULT_ROOT, parseDryRunInput, readDeclaredCase } from "./lib/effect-eval-fixture.mjs";

const USAGE = `Usage: effect-eval-landing-plan.mjs --case <id> --dry-run-input <b> --run-id <n>

Resolve how one dispatch lands: its branch, its subject, the extra flags
\`gh pr create\` receives, and the mode its records are checked against.
Prints JSON; runs nothing.

  --case <id>              the case being landed (required)
  --dry-run-input <b>      the dispatch's dry-run input, "true" or "false" (required)
  --run-id <n>             the workflow run id, which names the branch (required)
  --root <dir>             the data root (default: ${DEFAULT_ROOT})
  --help                   this text

Output: {"branch": ..., "title": ..., "prFlags": [...], "expect": ...}

Exit codes: 0 planned, 2 bad invocation or an input that does not resolve.`;

/**
 * the mode-specific opening of the pull request's body. it lives here with the
 * rest of what the mode decides, so the workflow is left with no conditional
 * keyed on the dispatch's mode at all — the comparability and budget paragraphs
 * it appends turn on other things.
 */
const DRY_RUN_PREAMBLE = `**This is a rehearsal. Close it; do not merge it.**

Every record here is synthetic: the dispatch ran with \`dry-run\`, so no model was
spawned and nothing was billed. Each \`metadata.json\` is stamped
\`trigger.kind: "dry-run"\`, and the landing job refused to commit until every record
agreed with that.

It exists to prove the dispatch's wiring end to end — the matrix fan-out, the
artifacts, the derivation, this commit, and this pull request — for the cost of CI
minutes rather than six probes.

It is opened as a draft so GitHub will not merge it. A test asserts no committed
measurement carries the dry-run stamp, so landing this anyway breaks the default
branch's checks.`;

function fail2(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

function parseArgv(argv) {
  const options = { caseId: null, dryRunInput: null, runId: null, root: DEFAULT_ROOT };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (value === undefined) fail2(`${arg} needs a value.\n${USAGE}`);
      i += 1;
      return value;
    };
    if (arg === "--case") options.caseId = next();
    else if (arg === "--dry-run-input") options.dryRunInput = next();
    else if (arg === "--run-id") options.runId = next();
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
  if (!options.runId) fail2(`--run-id is required.\n${USAGE}`);

  let dryRun;
  try {
    dryRun = parseDryRunInput(options.dryRunInput);
  } catch (error) {
    fail2(error.message);
  }

  // the case must exist even though only its id reaches the output: landing a
  // branch named after a case the fixture never declared would be a dispatch
  // nobody can trace back to a decision.
  try {
    await readDeclaredCase(options.root, options.caseId);
  } catch (error) {
    fail2(error.message);
  }

  // a rehearsal's subject is deliberately not a Conventional Commit. it is
  // never merged, so it never becomes a subject on the default branch, and a
  // reader scanning branches should see what it is at a glance.
  const plan = dryRun
    ? {
        branch: `effect-eval/dry-run/${options.runId}`,
        title: `DRY RUN — do not merge: effect-eval dispatch rehearsal for ${options.caseId}`,
        prFlags: ["--draft"],
        expect: "dry-run",
        bodyPreamble: DRY_RUN_PREAMBLE,
      }
    : {
        branch: `effect-eval/measurement/${options.runId}`,
        title: `data(effect-eval): record a case measurement of ${options.caseId}`,
        prFlags: [],
        expect: "measurement",
        bodyPreamble: `Recorded one case measurement of \`${options.caseId}\`.`,
      };

  process.stdout.write(`${JSON.stringify(plan)}\n`);
}

main();
