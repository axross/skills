#!/usr/bin/env node
// derive the summary layer over finished case measurements, and enforce the
// checks that decide whether they are measurements at all.
//
// its own entry point because the derivation has two callers that do not depend
// on each other: the landing job, which derives after the matrix finishes and
// before it commits, and the drift check, which re-derives a summary already
// committed and compares bytes, so a hand-edited derived file fails a check
// rather than quietly misleading a reader.
//
// a flag on evaluate.mjs was the rejected alternative — it would give one
// command two unrelated behaviours, and leave the drift check invoking a probe
// runner in order to run no probe.
//
// exit codes:
//   0  every summary was written (or, with --check, matched what is committed)
//   2  bad invocation, or a measurement that could not be read
//   4  a comparability check failed — the measurement is not comparable
//   5  --check found drift between a committed summary and its regeneration

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { comparabilityOf } from "../../src/comparability.mjs";
import { canonicalJson, FIXTURE_FILE, MEASUREMENTS_DIR, SUMMARY_FILE } from "../../src/layout.mjs";
import { DATA_ROOT } from "./src/layout.mjs";
import { deriveCaseSummary } from "./src/summary.mjs";

const DEFAULT_ROOT = DATA_ROOT;

const USAGE = `Usage: summarize.mjs [options]

Derive each case measurement's summary.json from its measured and declared
files, derive the top-level snapshot across all of them, and enforce the
comparability checks.

  --root <dir>      the data root holding measurements/ and the top-level
                     summary.json (default: ${DEFAULT_ROOT})
  --fixture <path>  the case fixture, read for each case's declared repetition
                     count (default: <root>/${FIXTURE_FILE})
  --check           write nothing; compare each regenerated summary against the
                     committed bytes and fail on any difference. This is the
                     drift check.
  --quiet           report only failures
  --help            this text

Exit codes: 0 all good, 2 bad invocation, 4 a comparability check failed,
5 --check found drift.`;

function fail2(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

function parseArgv(argv) {
  const options = { root: DEFAULT_ROOT, fixture: null, check: false, quiet: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (value === undefined) fail2(`${arg} needs a value.\n${USAGE}`);
      i += 1;
      return value;
    };
    if (arg === "--root") options.root = next();
    else if (arg === "--fixture") options.fixture = next();
    else if (arg === "--check") options.check = true;
    else if (arg === "--quiet") options.quiet = true;
    else fail2(`Unknown option ${JSON.stringify(arg)}.\n${USAGE}`);
  }
  options.fixture ??= join(options.root, FIXTURE_FILE);
  return options;
}

/**
 * @returns {Promise<Map<string, number|null>>} declared repetitions, by case id
 * @throws {Error} when the fixture cannot be read for any reason but its
 *   absence, or when it is not valid JSON. an absent fixture is not one of
 *   these — it returns an empty map, leaving every case declaring nothing
 */
async function readDeclaredRepetitions(fixturePath) {
  try {
    const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
    return new Map(
      (fixture.cases ?? []).map((entry) => [entry.id, entry.repetitionsPerCondition ?? null]),
    );
  } catch (error) {
    if (error.code === "ENOENT") return new Map();
    throw error;
  }
}

/** directories are `<case>-<id>`, so the case is everything before the id. */
function caseIdOf(directoryName) {
  const match = directoryName.match(/^(.*)-[0-9a-f]{8}$/);
  return match ? match[1] : null;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${USAGE}\n`);
    process.exit(0);
  }

  const options = parseArgv(argv);
  const measurementsDir = join(options.root, MEASUREMENTS_DIR);
  const declaredRepetitions = await readDeclaredRepetitions(options.fixture);

  let entries;
  try {
    entries = await readdir(measurementsDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") {
      if (!options.quiet) {
        process.stdout.write(`No measurements at ${measurementsDir}; nothing to summarize.\n`);
      }
      process.exit(0);
    }
    throw error;
  }

  const names = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const drifted = [];
  const incomparable = [];
  const snapshot = [];

  for (const name of names) {
    const caseDir = join(measurementsDir, name);
    const caseId = caseIdOf(name);

    let summary;
    try {
      summary = await deriveCaseSummary(caseDir, {
        declaredRepetitions: declaredRepetitions.get(caseId) ?? null,
      });
    } catch (error) {
      fail2(`${name}: ${error instanceof Error ? error.message : error}`);
    }

    const bytes = canonicalJson(summary);
    const summaryPath = join(caseDir, SUMMARY_FILE);

    if (options.check) {
      let committed = null;
      try {
        committed = await readFile(summaryPath, "utf8");
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      if (committed === null) {
        drifted.push(`${name}: no committed ${SUMMARY_FILE}, but one derives from the files present`);
      } else if (committed !== bytes) {
        drifted.push(`${name}: the committed ${SUMMARY_FILE} is not what its measured files derive`);
      }
    } else {
      await writeFile(summaryPath, bytes, "utf8");
    }

    const { comparable, failures } = comparabilityOf(summary);
    if (!comparable) {
      incomparable.push(`${name}:\n    ${failures.join("\n    ")}`);
    }

    snapshot.push({
      measurement: name,
      case: caseId,
      comparable,
      probeCount: summary.probeCount,
      totalCostUsd: summary.totalCostUsd,
      project: summary.project,
      model: summary.model,
      runtime: summary.runtime,
    });
    if (!options.quiet) {
      process.stdout.write(`${comparable ? "ok      " : "NOT OK  "} ${name}\n`);
    }
  }

  // the same word at a second scale: a summary of every measurement, where the
  // other is a summary of every probe.
  const rootSummaryPath = join(options.root, SUMMARY_FILE);
  const rootBytes = canonicalJson({
    measurementCount: snapshot.length,
    comparableCount: snapshot.filter((entry) => entry.comparable).length,
    measurements: snapshot,
  });
  if (options.check) {
    let committed = null;
    try {
      committed = await readFile(rootSummaryPath, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (committed !== rootBytes) {
      drifted.push(`${SUMMARY_FILE}: the committed top-level snapshot is not what derives`);
    }
  } else {
    await writeFile(rootSummaryPath, rootBytes, "utf8");
  }

  if (incomparable.length > 0) {
    process.stderr.write(
      `\n${incomparable.length} measurement(s) failed a comparability check:\n  ` +
        `${incomparable.join("\n  ")}\n\n` +
        "A measurement whose probes did not run under the same conditions reports a\n" +
        "difference that cannot be attributed to the skill. This is a finding about the\n" +
        "measurement, not a threshold to adjust.\n",
    );
  }
  if (drifted.length > 0) {
    process.stderr.write(
      `\n${drifted.length} derived file(s) drifted from their measured inputs:\n  ` +
        `${drifted.join("\n  ")}\n\n` +
        "Regenerate with `node tools/evaluation/readings/effect/summarize.mjs` and commit the result.\n",
    );
  }

  if (drifted.length > 0) process.exit(5);
  if (incomparable.length > 0) process.exit(4);
  process.exit(0);
}

main();
