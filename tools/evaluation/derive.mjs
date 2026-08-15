#!/usr/bin/env node
// derive.mjs — produces the derived tier for one scenario measurement, or
// (--check) re-derives it and compares against what is committed.
//
// docs/specs/skill-evaluation.md, "Measured, declared, and derived": the
// derived tier is regenerable from the measured and declared tiers, and a
// drift check re-derives it and fails on a mismatch. summary.json is that
// derived tier — the aggregate and nothing else, per "What a measurement
// stores": no `comparable` field, no per-probe result or rate, and no
// per-condition pass rate.
//
// usage:
//   node derive.mjs <measurement-dir> [--check]
//   node derive.mjs --help
//
// exit codes:
//   0  wrote (or, under --check, matched) summary.json
//   1  the measurement could not be read, or --check found a mismatch
//   2  bad invocation

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { deriveMeasurement } from "./src/derive-runner.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCENARIOS_ROOT = join(REPO_ROOT, "tools", "evaluation", "scenarios");

const USAGE = `Usage: derive.mjs <measurement-dir> [--check]

Computes the derived tier (each factor's pass rates and differential, and
the comparable-predecessor link) from <measurement-dir>'s own probes, each
one's metadata.json (measured) and factors.json (measured, once judged) plus
its scenario's declaration (declared).

With no --check, writes the result to <measurement-dir>/summary.json.
With --check, re-derives it and compares byte-for-byte against what is
already there, failing on any mismatch — a derived surface a hand edit has
drifted from what it was computed from.

Exit codes: 0 wrote (or matched under --check), 1 read failure or mismatch,
2 bad invocation.`;

function fail2(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${USAGE}\n`);
    process.exit(0);
  }
  const check = argv.includes("--check");
  const positional = argv.filter((arg) => arg !== "--check" && !arg.startsWith("--"));
  if (positional.length !== 1) fail2(`Expected exactly one <measurement-dir> argument.\n${USAGE}`);

  const measurementDir = resolve(positional[0]);

  let outcome;
  try {
    outcome = await deriveMeasurement({ measurementDir, scenariosRoot: SCENARIOS_ROOT });
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
    return;
  }

  if (check) {
    let existing;
    try {
      existing = await readFile(outcome.summaryPath, "utf8");
    } catch {
      process.stderr.write(`No ${outcome.summaryPath} exists to check a re-derivation against.\n`);
      process.exit(1);
      return;
    }
    if (existing !== outcome.computed) {
      process.stderr.write(
        `${outcome.summaryPath} does not match a fresh re-derivation from its own measured and ` +
          "declared tiers — it has drifted from what it was computed from.\n",
      );
      process.exit(1);
      return;
    }
    process.stdout.write(`${outcome.summaryPath} matches a fresh re-derivation byte-for-byte.\n`);
    return;
  }

  await writeFile(outcome.summaryPath, outcome.computed, "utf8");
  process.stdout.write(`Wrote ${outcome.summaryPath}.\n`);
}

main();
