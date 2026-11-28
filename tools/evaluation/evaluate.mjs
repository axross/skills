#!/usr/bin/env node
// Judge stored probe files using the matching checkout's scenario, mock,
// optional scenario patch, skills and judgments. Copy the measurement first
// to retain an independent set of factors. See docs/evaluation/results.md.

import { writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateMeasurement } from "./src/evaluate-runner.mjs";
import { canonicalJson, FACTORS_FILE } from "./src/layout.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCENARIOS_ROOT = join(REPO_ROOT, "tools", "evaluation", "scenarios");

const USAGE = `Usage: evaluate.mjs <measurement-dir>

Run from a checkout containing the matching scenario, mock, scenario patch
(if declared), skills and judgments. Each probe is reconstructed from those
inputs and its stored changes.patch, then judged using its measured files.
This writes or replaces each probe's factors.json. To retain earlier results,
copy the measurement to a separate directory and judge the copy.

A reasoning factor's judge runs through the \`claude\` CLI, authenticated
with CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY; without either, that
factor's result is recorded as an error rather than skipped or guessed.

Guide: docs/evaluation/results.md

Exit codes: 0 judged (factors may still be individually errored), 1 the
measurement could not be read, 2 bad invocation.`;

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
  const positional = argv.filter((arg) => !arg.startsWith("--"));
  if (positional.length !== 1) fail2(`Expected exactly one <measurement-dir> argument.\n${USAGE}`);

  const measurementDir = resolve(positional[0]);

  let results;
  try {
    results = await evaluateMeasurement({ measurementDir, scenariosRoot: SCENARIOS_ROOT, env: process.env });
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
    return;
  }

  for (const probe of results) {
    const factorsPath = join(measurementDir, probe.probeDirName, FACTORS_FILE);
    const errored = probe.factors.filter(
      (factor) => factor.result !== null && typeof factor.result === "object",
    ).length;
    await writeFile(
      factorsPath,
      canonicalJson({
        scenario: probe.scenarioId,
        condition: probe.condition,
        repetition: probe.repetition,
        factors: probe.factors,
      }),
      "utf8",
    );
    process.stdout.write(
      `${probe.probeDirName}: judged ${probe.factors.length} factor(s), ${errored} errored -> ${factorsPath}\n`,
    );
  }
  process.stdout.write(`Judged ${results.length} probe(s) under ${measurementDir}.\n`);
}

main();
