#!/usr/bin/env node
// derive the per-measurement and repository-wide summaries over finished
// discovery case measurements, enforce the within-measurement comparability
// checks, and derive each measurement's delta against its most recent
// comparable predecessor.
//
// its own entry point for the same reason as the effect side's: the
// derivation has two callers that do not depend on each other — the landing
// job (a later part of this issue), which derives after a dispatch finishes
// and before it commits, and the drift check, which re-derives a summary
// already committed and compares bytes, so a hand-edited derived file fails a
// check rather than quietly misleading a reader.
//
// THERE IS NO BASELINE. summary.json is derived across every measurement
// under measurements/ and regenerates from that directory alone — with no
// measurements present it is the empty-but-valid derivation
// `{ measurementCount: 0, comparableCount: 0, measurements: [] }`, which is
// exactly what ships in this tree until the first measurement lands.
//
// exit codes:
//   0  every summary was written (or, with --check, matched what is committed)
//   2  bad invocation, or a measurement that could not be read
//   4  a within-measurement comparability check failed
//   5  --check found drift between a committed summary and its regeneration

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  canonicalJson,
  caseIdOf,
  DATA_ROOT,
  FIXTURE_FILE,
  MEASUREMENTS_DIR,
  SUMMARY_FILE,
} from "./src/layout.mjs";
import { comparabilityOf, deriveCaseSummary, deriveDelta } from "./src/summary.mjs";

const DEFAULT_ROOT = DATA_ROOT;

const USAGE = `Usage: summarize.mjs [options]

Derive each case measurement's summary.json from its measured and declared
files, derive the delta against each one's most recent comparable
predecessor, derive the top-level summary across all of them, and enforce the
within-measurement comparability checks.

  --root <dir>      the data root holding measurements/ and the top-level
                     summary.json (default: ${DEFAULT_ROOT})
  --fixture <path>  the case fixture, read for each case's declared repeat
                     count (default: <root>/${FIXTURE_FILE})
  --check           write nothing; compare each regenerated summary against
                     the committed bytes and fail on any difference. This is
                     the drift check
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
 * @returns {Promise<Map<string, number|null>>} declared repeats, by case id.
 *   an absent fixture returns an empty map, leaving every case declaring
 *   nothing — that is not one of the errors this throws on
 */
async function readDeclaredRepeats(fixturePath) {
  try {
    const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
    return new Map((fixture.cases ?? []).map((entry) => [entry.id, entry.repeats ?? null]));
  } catch (error) {
    if (error.code === "ENOENT") return new Map();
    throw error;
  }
}

/** directory names directly under measurements/, or `[]` when it does not exist. */
async function measurementNames(measurementsDir) {
  let entries;
  try {
    entries = await readdir(measurementsDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${USAGE}\n`);
    process.exit(0);
  }

  const options = parseArgv(argv);
  const measurementsDir = join(options.root, MEASUREMENTS_DIR);
  const declaredRepeats = await readDeclaredRepeats(options.fixture);
  const names = await measurementNames(measurementsDir);

  // FIRST PASS: derive every measurement's own summary — a pure function of
  // its own files, with no delta yet. the delta needs every measurement's
  // verdict tally to compare against, so it cannot be computed until this
  // pass is complete.
  const derivations = [];
  for (const name of names) {
    const caseId = caseIdOf(name);
    let summary;
    try {
      summary = await deriveCaseSummary(join(measurementsDir, name), {
        declaredRepeats: declaredRepeats.get(caseId) ?? null,
        measurementName: name,
      });
    } catch (error) {
      fail2(`${name}: ${error instanceof Error ? error.message : error}`);
    }
    derivations.push({ name, caseId, summary });
  }

  // SECOND PASS: each measurement's delta against its own case's OTHER
  // measurements — never against itself, and never suppressed when none is
  // comparable. see src/summary.mjs's header on the two comparability scopes.
  for (const entry of derivations) {
    const siblings = derivations
      .filter((other) => other.caseId === entry.caseId && other.name !== entry.name)
      .map((other) => other.summary);
    entry.summary.delta = deriveDelta(entry.summary, siblings);
  }

  const drifted = [];
  const incomparable = [];
  const snapshot = [];

  for (const { name, caseId, summary } of derivations) {
    const bytes = canonicalJson(summary);
    const summaryPath = join(measurementsDir, name, SUMMARY_FILE);

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
      population: summary.case?.population ?? null,
      comparable,
      probeCount: summary.probeCount,
      readableCount: summary.readableCount,
      totalCostUsd: summary.totalCostUsd,
      workspace: summary.workspace,
      model: summary.model,
      runtime: summary.runtime,
      findings: summary.verdict.findings,
      delta: summary.delta.usable
        ? { usable: true, predecessor: summary.delta.predecessor }
        : { usable: false, reason: summary.delta.reason },
    });
    if (!options.quiet) {
      process.stdout.write(`${comparable ? "ok      " : "NOT OK  "} ${name}\n`);
    }
  }

  // the same word at a second scale: a summary of every measurement, where
  // each measurement's own summary.json is a summary of every probe.
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
      drifted.push(`${SUMMARY_FILE}: the committed top-level summary is not what derives`);
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
        "Regenerate with `node tools/evaluation/discovery/summarize.mjs` and commit the result.\n",
    );
  }

  if (drifted.length > 0) process.exit(5);
  if (incomparable.length > 0) process.exit(4);
  process.exit(0);
}

main();
