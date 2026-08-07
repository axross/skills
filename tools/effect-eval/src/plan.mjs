#!/usr/bin/env node
// plan.mjs — decide whether one case may run, and emit the matrix for it.
//
// INTERNAL MACHINERY, NOT A FOURTH ENTRY POINT. The three commands at
// tools/effect-eval/ are what a person invokes: prepare, probe, summarise. This
// is what the dispatch workflow's admit job invokes, and it exists as a file
// rather than as a `node -e` in the YAML for one reason — the arithmetic it
// performs decides whether money is spent, and logic that decides that belongs
// somewhere a test can reach it. admission.mjs holds the decision; this only
// reads the declared case, hands it over, and prints the result.
//
// IT PROJECTS FROM THE COMMITTED SNAPSHOT, WHICH IS ITSELF DERIVED. Where a
// case has committed measurements, `data/effect-eval/summary.json` already
// carries their probe counts and totals — so admission reads a file the drift
// check keeps honest rather than re-walking every measurement directory.
//
// Exit codes:
//   0  admitted; the matrix is on stdout and in $GITHUB_OUTPUT when set
//   2  bad invocation, or a case the fixture does not declare
//   4  REFUSED — the projection exceeds the cap. Nothing was spawned.

import { appendFile, readFile } from "node:fs/promises";
import { join } from "node:path";

import { admitCase } from "./admission.mjs";
import { CONDITIONS } from "./layout.mjs";

const DEFAULT_ROOT = "data/effect-eval";

const USAGE = `Usage: plan.mjs --case <id> [options]

Decide whether one evaluation case may run, and emit the probe matrix.

  --case <id>       the case to plan (required)
  --root <dir>      the data root (default: ${DEFAULT_ROOT})
  --cap-usd <n>     lower the case's declared cap for this dispatch; a value
                     above the declared cap is ignored, never honoured
  --help            this text

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

/** Per-probe costs of every committed measurement of this case. */
async function committedCosts(root, caseId) {
  let snapshot;
  try {
    snapshot = JSON.parse(await readFile(join(root, "summary.json"), "utf8"));
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

  const fixturePath = join(options.root, "fixture.json");
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

  // The matrix is DERIVED from the fixture rather than written into the
  // workflow, so the declared repetition count and the number of probes that
  // actually run cannot disagree. summarize.mjs checks the same number again
  // afterwards, but that check runs once the money is spent; this is the one
  // that runs before.
  const include = [];
  for (const condition of CONDITIONS) {
    for (let repeat = 1; repeat <= repetitions; repeat += 1) {
      include.push({ condition, repeat });
    }
  }

  const decision = admitCase({
    caseId: options.caseId,
    probeCount: include.length,
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
        "decision and is not this tool's call.\n",
    );
    process.exit(4);
  }

  const matrix = JSON.stringify({ include });
  process.stdout.write(`${matrix}\n`);
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `matrix=${matrix}\ncap-usd=${decision.capUsd}\nprojected-usd=${decision.projectedTotalUsd}\n`,
      "utf8",
    );
  }
}

main();
