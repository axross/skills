#!/usr/bin/env node
// the admit job of .github/workflows/discovery-eval.yaml.
//
// it resolves the whole dispatch before any probe spawns: which mode this run
// is (a pull request's head skills, evaluated bare and reported; or a
// measurement, evaluated per the fixture and landed), which cases the matrix
// covers, and — for the money at stake — whether the projected total fits the
// fixture's cap.
//
// SAFETY PROPERTY 5 LIVES HERE. mode is a pure function of `--pull-request`:
// non-empty and it parses to a positive integer, or the dispatch refuses
// outright (see lib/discovery-eval-fixture.mjs's parsePullRequestInput) rather
// than silently falling through to a measurement dispatch. `records` is
// `mode === "measurement"` and nothing else decides it — the land job's `if:`
// reads this output rather than re-deriving the mode a second way, which is
// the same "one resolution, not two" discipline effect-eval-landing-plan.mjs
// documents. A head-mode dispatch's per-case plan (discovery-eval-probe-plan.mjs)
// never receives `--out`, so it structurally cannot materialize a case
// measurement — see that script's header for the other half of this property.
//
// ADMISSION IS FIXTURE-WIDE HERE, unlike evaluate.mjs's own per-case call.
// evaluate.mjs projects one case's repeats against the fixture's whole
// `capUsd`, which is right for a single invocation but says nothing about a
// dispatch matrixing over many cases at once — a fresh fixture's full 59
// cases project to roughly $41 against a $40 cap, which is exactly the
// scenario this script exists to catch before spawning 59 jobs that would
// each individually look affordable.
//
// exit codes:
//   0  admitted; mode, the case list, and the projection are on stdout and in
//      $GITHUB_OUTPUT
//   2  bad invocation, an unknown case, or an input that does not resolve
//   4  refused — the projected total exceeds the fixture's cap, and nothing
//      downstream runs

import { appendFile, readFile } from "node:fs/promises";
import { join } from "node:path";

import { meanProbeCost } from "../../tools/discovery-eval/src/admission.mjs";
import { SUMMARY_FILE } from "../../tools/discovery-eval/src/layout.mjs";
import {
  DEFAULT_ROOT,
  parseDryRunInput,
  parsePullRequestInput,
  readFixture,
} from "./lib/discovery-eval-fixture.mjs";

const USAGE = `Usage: discovery-eval-admit.mjs --dry-run-input <b> [options]

Resolve a discovery-eval dispatch's mode and case list, project its total
cost, and refuse before any probe spawns when that projection exceeds the
fixture's cap.

  --case <id>          run one case rather than the whole fixture (optional)
  --pull-request <n>    a pull request number: this dispatch evaluates that
                         pull request's changed skills, bare, and records
                         nothing (optional; empty means a measurement dispatch)
  --repeats <n>         override every selected case's declared repeat count
                         (optional; blank honours each case's own declaration)
  --dry-run-input <b>   the dispatch's raw dry_run input, "true" or "false"
                         (required)
  --root <dir>          the data root (default: ${DEFAULT_ROOT})
  --help                this text

Exit codes: 0 admitted, 2 bad invocation, 4 refused.`;

function fail2(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

function parseArgv(argv) {
  const options = {
    caseId: null,
    pullRequest: null,
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
    else if (arg === "--repeats") options.repeats = next();
    else if (arg === "--dry-run-input") options.dryRunInput = next();
    else if (arg === "--root") options.root = next();
    else fail2(`Unknown option ${JSON.stringify(arg)}.\n${USAGE}`);
  }
  return options;
}

/**
 * every past probe cost of `caseId`, one figure per committed measurement.
 *
 * mirrors evaluate.mjs's own `historicalCostsFor` exactly — no `comparable`
 * filter, unlike the effect side's admit script — so this projection agrees
 * with what evaluate.mjs will independently compute per case.
 */
async function historicalCostsFor(root, caseId) {
  let raw;
  try {
    raw = await readFile(join(root, SUMMARY_FILE), "utf8");
  } catch {
    return [];
  }
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch {
    return [];
  }
  return (Array.isArray(doc.measurements) ? doc.measurements : [])
    .filter(
      (entry) =>
        entry.case === caseId &&
        typeof entry.totalCostUsd === "number" &&
        Number.isInteger(entry.probeCount) &&
        entry.probeCount > 0,
    )
    .map((entry) => entry.totalCostUsd / entry.probeCount);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${USAGE}\n`);
    process.exit(0);
  }

  const options = parseArgv(argv);
  if (options.dryRunInput === null) fail2(`--dry-run-input is required.\n${USAGE}`);

  let dryRun;
  let pullRequest;
  try {
    dryRun = parseDryRunInput(options.dryRunInput);
    pullRequest = parsePullRequestInput(options.pullRequest ?? undefined);
  } catch (error) {
    fail2(error.message);
  }

  if (options.repeats !== null) {
    const value = Number(options.repeats);
    if (!Number.isInteger(value) || value < 1) fail2("--repeats needs a positive integer.");
    options.repeats = value;
  }

  let fixture;
  try {
    fixture = await readFixture(options.root);
  } catch (error) {
    fail2(error.message);
  }

  let caseIds;
  if (options.caseId) {
    if (!fixture.cases.some((entry) => entry.id === options.caseId)) {
      const known = fixture.cases.map((entry) => entry.id).join(", ");
      fail2(`${options.root}/fixture.json declares no case ${JSON.stringify(options.caseId)}. Known: ${known}`);
    }
    caseIds = [options.caseId];
  } else {
    caseIds = fixture.cases.map((entry) => entry.id);
  }

  // safety property 5's positive half: mode is this ternary and nothing else
  // decides it. every downstream reader — the probe plan, the land job's
  // `if:` — reads `records` from this job's output rather than re-deriving it.
  const mode = pullRequest !== null ? "head" : "measurement";
  const records = mode === "measurement";

  let projectedTotalUsd = 0;
  const lines = [];
  for (const caseId of caseIds) {
    const declared = fixture.cases.find((entry) => entry.id === caseId);
    const repeats = options.repeats ?? declared.repeats ?? 1;
    const historicalCosts = await historicalCostsFor(options.root, caseId);
    const perProbeUsd = meanProbeCost(historicalCosts) ?? fixture.unmeasuredProbeCostCeilingUsd;
    const caseCostUsd = perProbeUsd * repeats;
    projectedTotalUsd += caseCostUsd;
    lines.push(`  ${caseId}: ${repeats} probe(s) at $${perProbeUsd.toFixed(2)} each = $${caseCostUsd.toFixed(2)}`);
  }

  const admitted = projectedTotalUsd <= fixture.capUsd;
  process.stderr.write(
    `${mode} dispatch over ${caseIds.length} case(s)${dryRun ? " (dry run)" : ""}:\n` +
      `${lines.join("\n")}\n` +
      `Total: $${projectedTotalUsd.toFixed(2)} against a $${fixture.capUsd.toFixed(2)} cap` +
      `${admitted ? " — admitted" : " — REFUSED"}\n`,
  );

  if (!admitted) {
    process.stderr.write(
      "\nThis is a finding, not a threshold to adjust. Narrow the dispatch with --case, or wait " +
        "for a comparable measurement to replace the fixture's unmeasuredProbeCostCeilingUsd with a " +
        "real figure — raising the cap is a spending decision and is not this script's call.\n",
    );
    process.exit(4);
  }

  const outputs = {
    mode,
    cases: JSON.stringify(caseIds),
    records: String(records),
    "cap-usd": fixture.capUsd,
    "projected-usd": Number(projectedTotalUsd.toFixed(2)),
  };
  process.stdout.write(`${JSON.stringify(outputs)}\n`);
  if (process.env.GITHUB_OUTPUT) {
    const gh = Object.entries(outputs).map(([key, value]) => `${key}=${value}`);
    await appendFile(process.env.GITHUB_OUTPUT, `${gh.join("\n")}\n`, "utf8");
  }
}

main();
