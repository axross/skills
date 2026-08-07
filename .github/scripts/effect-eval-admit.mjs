#!/usr/bin/env node
// effect-eval-admit.mjs — the admit step of .github/workflows/effect-eval.yaml.
//
// THIS BELONGS TO THE WORKFLOW, NOT TO THE INSTRUMENT, which is why it lives
// here rather than beside the three commands under tools/effect-eval/. Sorting
// it that way is not filing: everything it does that is not a library call is
// shaped by GitHub — reading a named case out of a dispatch input, writing
// `$GITHUB_OUTPUT`, and emitting the two arrays a `strategy.matrix` expands.
// None of that is a question the evaluation asks.
//
// THE DECISION ITSELF IS NOT HERE. Whether the projected spend fits the cap is
// tools/effect-eval/src/admission.mjs's job, where it is unit-tested and where
// it stays reachable by anything that is not a workflow. This file reads two
// committed JSON files, hands them over, and formats the answer.
//
// THE MATRIX IS TWO ARRAYS, NOT A LIST OF PAIRS. GitHub cross-products the
// dimensions of a `strategy.matrix` itself, so emitting `conditions` and
// `repeats` separately gets the same six cells with no pair-building here — and
// the conditions come from the instrument's own CONDITIONS rather than being
// retyped into the YAML.
//
// Exit codes:
//   0  admitted; the matrix dimensions are on stdout and in $GITHUB_OUTPUT
//   2  bad invocation, or a case the fixture does not declare
//   4  REFUSED — the projection exceeds the cap. Nothing downstream runs, so a
//      case that does not fit its budget costs nothing at all.

import { appendFile, readFile } from "node:fs/promises";
import { join } from "node:path";

import { admitCase } from "../../tools/effect-eval/src/admission.mjs";
import {
  caseMeasurementName,
  CONDITIONS,
  DATA_ROOT,
  FIXTURE_FILE,
  SUMMARY_FILE,
} from "../../tools/effect-eval/src/layout.mjs";

const DEFAULT_ROOT = DATA_ROOT;

const USAGE = `Usage: effect-eval-admit.mjs --case <id> [options]

Decide whether one evaluation case may run, and emit the probe matrix's
dimensions for effect-eval.yaml's probe job.

  --case <id>     the case to admit (required)
  --root <dir>    the data root (default: ${DEFAULT_ROOT})
  --cap-usd <n>   lower the case's declared cap for this dispatch; a value above
                   the declared cap is reported and ignored, never honoured
  --help          this text

Exit codes: 0 admitted, 2 bad invocation, 4 refused.`;

function fail2(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

function parseArgv(argv) {
  const options = { caseId: null, root: DEFAULT_ROOT, capUsd: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (value === undefined) fail2(`${arg} needs a value.\n${USAGE}`);
      i += 1;
      return value;
    };
    if (arg === "--case") options.caseId = next();
    else if (arg === "--root") options.root = next();
    else if (arg === "--cap-usd") options.capUsd = next();
    else fail2(`Unknown option ${JSON.stringify(arg)}.\n${USAGE}`);
  }
  return options;
}

/**
 * Per-probe costs of every committed measurement of this case.
 *
 * Read off the committed snapshot rather than by re-walking the measurement
 * directories: the snapshot is derived, and the drift check is what keeps it
 * honest. Only comparable measurements count — an incomparable one is still
 * evidence of what it cost, but it is stored as a finding, and projecting from
 * it would quietly treat a failed measurement as a normal one.
 */
async function committedCosts(root, caseId) {
  let snapshot;
  try {
    snapshot = JSON.parse(await readFile(join(root, SUMMARY_FILE), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  return (snapshot.measurements ?? [])
    .filter((entry) => entry.case === caseId && entry.comparable && entry.probeCount > 0)
    .map((entry) => entry.totalCostUsd / entry.probeCount);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${USAGE}\n`);
    process.exit(0);
  }

  const options = parseArgv(argv);
  if (!options.caseId) fail2(`--case is required.\n${USAGE}`);

  const fixturePath = join(options.root, FIXTURE_FILE);
  let fixture;
  try {
    fixture = JSON.parse(await readFile(fixturePath, "utf8"));
  } catch (error) {
    fail2(`Could not read ${fixturePath}: ${error.message}`);
  }

  const declared = (fixture.cases ?? []).find((entry) => entry.id === options.caseId);
  if (!declared) {
    const known = (fixture.cases ?? []).map((entry) => entry.id).join(", ") || "(none)";
    fail2(`${fixturePath} declares no case ${JSON.stringify(options.caseId)}. Known: ${known}`);
  }

  const repetitions = declared.repetitionsPerCondition;
  if (!Number.isInteger(repetitions) || repetitions < 1) {
    fail2(`${options.caseId} declares no positive repetitionsPerCondition.`);
  }

  // Derived from the fixture rather than written into the YAML, so the declared
  // repetition count and the number of probes that actually run cannot
  // disagree. summarize.mjs checks the same number again afterwards, but that
  // check runs once the money is spent; this one runs before.
  const repeats = Array.from({ length: repetitions }, (_, index) => index + 1);
  const probeCount = repeats.length * CONDITIONS.length;

  const decision = admitCase({
    caseId: options.caseId,
    probeCount,
    declaredCapUsd: declared.capUsd,
    requestedCapUsd: options.capUsd === null ? null : Number(options.capUsd),
    historicalCosts: await committedCosts(options.root, options.caseId),
    estimatedCostUsdPerProbe: declared.estimatedCostUsdPerProbe,
  });

  process.stderr.write(`${decision.reason}\n`);

  if (!decision.admitted) {
    process.stderr.write(
      "\nThis is a finding, not a threshold to adjust. The case as declared does not fit\n" +
        "its budget; shrinking the case, raising the cap, or abandoning it is a spending\n" +
        "decision and is not this script's call.\n",
    );
    process.exit(4);
  }

  const outputs = {
    // Named here rather than in the land job, so the `<case>-<id>` shape comes
    // from the instrument's own layout instead of being reimplemented in shell.
    // Generating it before the fan-out also means the whole run knows which
    // measurement it is building from its first step.
    "measurement-dir": caseMeasurementName(options.caseId),
    conditions: JSON.stringify(CONDITIONS),
    repeats: JSON.stringify(repeats),
    "cap-usd": decision.capUsd,
    "projected-usd": decision.projectedTotalUsd,
  };
  process.stdout.write(`${JSON.stringify(outputs)}\n`);
  if (process.env.GITHUB_OUTPUT) {
    const lines = Object.entries(outputs).map(([key, value]) => `${key}=${value}`);
    await appendFile(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`, "utf8");
  }
}

main();
