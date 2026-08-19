#!/usr/bin/env node
// evaluate.mjs — judges one stored measurement's factors.
//
// docs/specs/skill-evaluation.md, "The factor": "A judgment is made against
// the stored measurement and nothing else." Every probe under the given
// measurement directory has its workspace reconstructed from what it
// stored — never reused from a run — and every factor its scenario declares
// is judged against the phase-bounded material that reconstruction permits.
// A measurement missing a required artefact fails the whole run loudly,
// rather than being judged on what remains — see evaluate-runner.mjs's
// readProbeArtifacts.
//
// a reasoning factor asks its judge through the `claude` CLI, authenticated
// with whichever of CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY is set in
// this process's environment (tools/evaluation/src/credentials.mjs's
// CLI_AUTH_ENV_VARS) — the same two variables a probe's own CLI spawn
// authenticates with. without either, that factor's own result is recorded
// as an error — never as `false`, and never by aborting every other
// factor's judgment — so this script still completes end to end with no
// credential present.
//
// usage:
//   node evaluate.mjs <measurement-dir>
//   node evaluate.mjs --help
//
// exit codes:
//   0  every probe was judged (individual factors may still be errors)
//   1  the measurement could not be read (see readProbeArtifacts)
//   2  bad invocation

import { writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateMeasurement } from "./src/evaluate-runner.mjs";
import { canonicalJson, FACTORS_FILE } from "./src/layout.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCENARIOS_ROOT = join(REPO_ROOT, "tools", "evaluation", "scenarios");

const USAGE = `Usage: evaluate.mjs <measurement-dir>

Judges every probe under <measurement-dir> against its scenario's declared
factors, reconstructing each probe's workspace from what it stored, and
writes each probe's own factors.json.

A reasoning factor's judge runs through the \`claude\` CLI, authenticated
with CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY; without either, that
factor's result is recorded as an error rather than skipped or guessed.

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
