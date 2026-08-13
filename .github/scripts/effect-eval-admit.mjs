#!/usr/bin/env node
// the admit step of .github/workflows/effect-eval.yaml.
//
// it belongs to the workflow rather than to the instrument, which is why it is
// here and not beside the three commands under tools/evaluation/effect/. everything
// it does that is not a library call is shaped by GitHub — reading a dispatch
// input, writing `$GITHUB_OUTPUT`, and emitting the arrays a `strategy.matrix`
// expands. none of that is a question the evaluation asks.
//
// the decision itself is not here. whether the projected spend fits the cap is
// admission.mjs's, where it is unit-tested and reachable by anything that is
// not a workflow.
//
// the matrix is two arrays rather than a list of pairs because GitHub
// cross-products a matrix's dimensions itself.
//
// exit codes:
//   0  admitted; the matrix dimensions are on stdout and in $GITHUB_OUTPUT
//   2  bad invocation, or a case the fixture does not declare
//   4  refused — nothing downstream runs, so a case that does not fit its
//      budget costs nothing at all

import { appendFile, readFile } from "node:fs/promises";
import { join } from "node:path";

import { admitCase } from "../../tools/evaluation/effect/src/admission.mjs";
import {
  caseMeasurementName,
  CONDITIONS,
  SUMMARY_FILE,
} from "../../tools/evaluation/effect/src/layout.mjs";
import { DEFAULT_ROOT, readDeclaredCase } from "./lib/effect-eval-fixture.mjs";

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
 * read off the committed snapshot rather than by re-walking the measurement
 * directories: the snapshot is derived, and the drift check keeps it honest.
 *
 * only comparable measurements count. an incomparable one is still evidence of
 * what it cost, but projecting from it would treat a failed measurement as a
 * normal one.
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

  let declared;
  try {
    declared = await readDeclaredCase(options.root, options.caseId);
  } catch (error) {
    fail2(error.message);
  }

  const repetitions = declared.repetitionsPerCondition;
  if (!Number.isInteger(repetitions) || repetitions < 1) {
    fail2(`${options.caseId} declares no positive repetitionsPerCondition.`);
  }

  // from the fixture rather than written into the YAML, so the declared
  // repetition count and the number of probes that run cannot disagree.
  // summarize.mjs checks the same number afterwards — once the money is spent.
  const repeats = Array.from({ length: repetitions }, (_, index) => index + 1);
  const probeCount = repeats.length * CONDITIONS.length;

  const decision = admitCase({
    caseId: options.caseId,
    probeCount,
    declaredCapUsd: declared.capUsd,
    requestedCapUsd: options.capUsd === null ? null : Number(options.capUsd),
    historicalCosts: await committedCosts(options.root, options.caseId),
    unmeasuredProbeCostCeilingUsd: declared.unmeasuredProbeCostCeilingUsd,
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
    // named here rather than in the land job, so the shape comes from the
    // instrument's own layout instead of being reimplemented in shell.
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
