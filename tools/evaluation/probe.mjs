#!/usr/bin/env node
// probe.mjs — runs one evaluation scenario's probe matrix, or previews it.
//
// docs/specs/skill-evaluation.md, "probe.mjs" and "The admission bound is a
// probe count, not a cost": a run expands its scenario(s) into every
// (condition, repetition) probe the matrix implies, refuses before any
// probe starts when that exact count exceeds a declared limit, and
// otherwise runs every one of them — each recording the verbatim
// transcript, the workspace diff, the skill invocations, and metadata
// carrying the runtime, the model, and the digest of every installed skill.
//
// --dry-run walks the same matrix-and-admission path with the spawn
// stubbed: nothing here is ever reached under it, so a dry run never
// spawns a model and never costs anything.
//
// usage:
//   node probe.mjs [--dry-run] [--scenario <id>] [--conditions <list>]
//                  [--repetitions <n>] [--limit <n>] [--out <dir>]
//   node probe.mjs --help
//
// exit codes:
//   0  every probe (or the dry run) completed
//   1  admission refused the run, or at least one probe failed
//   2  bad invocation

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { admitDispatch } from "./src/admission.mjs";
import {
  canonicalJson,
  DIFF_FILE,
  INVOCATIONS_FILE,
  measurementDirName,
  MEASUREMENTS_ROOT,
  METADATA_FILE,
  probeDirName,
  TRANSCRIPT_FILE,
} from "./src/layout.mjs";
import { CONDITIONS, DEFAULT_REPETITIONS, expandMatrix } from "./src/probe-matrix.mjs";
import { runProbe } from "./src/probe-runner.mjs";
import { loadAllScenarios, loadScenario } from "./src/scenario.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCENARIOS_ROOT = join(REPO_ROOT, "tools", "evaluation", "scenarios");

const USAGE = `Usage: probe.mjs [options]

Expands one or more evaluation scenarios into their probe matrix (every
condition x repetition pair), refuses to start if that exact count exceeds
a declared --limit, and otherwise runs every probe, recording its
transcript, workspace diff, skill invocations, and metadata under
tools/evaluation/measurements/.

Options:
  --scenario <id>       only this scenario (default: every scenario under
                         tools/evaluation/scenarios/)
  --conditions <list>   comma-separated, from skill-present, skill-absent
                         (default: both)
  --repetitions <n>     repetitions per condition (default: ${DEFAULT_REPETITIONS})
  --limit <n>            refuse the run before anything starts if the exact
                         probe count exceeds this (default: no limit)
  --dry-run              report the probe matrix and the admission outcome;
                         spawn nothing
  --out <dir>            measurement root to write under (default:
                         tools/evaluation/measurements)
  --help                 show this message

Exit codes: 0 completed (or a clean dry run), 1 refused or a probe failed,
2 bad invocation.`;

function fail2(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

function parseArgs(argv) {
  const options = {
    scenario: null,
    conditions: CONDITIONS,
    repetitions: DEFAULT_REPETITIONS,
    limit: null,
    dryRun: false,
    out: join(REPO_ROOT, MEASUREMENTS_ROOT),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      process.stdout.write(`${USAGE}\n`);
      process.exit(0);
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--scenario") {
      options.scenario = argv[(index += 1)];
    } else if (arg === "--conditions") {
      options.conditions = (argv[(index += 1)] ?? "").split(",").filter(Boolean);
    } else if (arg === "--repetitions") {
      options.repetitions = Number(argv[(index += 1)]);
    } else if (arg === "--limit") {
      options.limit = Number(argv[(index += 1)]);
    } else if (arg === "--out") {
      options.out = resolve(argv[(index += 1)]);
    } else {
      fail2(`Unknown option "${arg}".\n${USAGE}`);
    }
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  let scenarios;
  let matrix;
  try {
    scenarios = options.scenario
      ? [await loadScenario(join(SCENARIOS_ROOT, options.scenario))]
      : await loadAllScenarios(SCENARIOS_ROOT);
    if (scenarios.length === 0) throw new Error(`No scenario(s) found under ${SCENARIOS_ROOT}.`);
    matrix = expandMatrix(scenarios, { conditions: options.conditions, repetitions: options.repetitions });
  } catch (error) {
    fail2(error.message);
    return;
  }

  process.stdout.write(
    `Probe matrix: ${matrix.length} probe(s) across ${scenarios.length} scenario(s), ` +
      `conditions [${options.conditions.join(", ")}], ${options.repetitions} repetition(s) each.\n`,
  );
  for (const planned of matrix) {
    process.stdout.write(`  ${planned.scenarioId} ${planned.condition} #${planned.repetition}\n`);
  }

  const admission = admitDispatch({ probeCount: matrix.length, limit: options.limit });
  process.stdout.write(`Admission: ${admission.reason}\n`);
  if (!admission.admitted) {
    process.stderr.write(`Refusing to start: ${admission.reason}\n`);
    process.exit(1);
  }

  if (options.dryRun) {
    process.stdout.write("Dry run: no probe was spawned.\n");
    process.exit(0);
  }

  const scenariosById = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
  const measurementIdByScenario = new Map();
  let failures = 0;

  for (const planned of matrix) {
    const scenario = scenariosById.get(planned.scenarioId);
    if (!measurementIdByScenario.has(planned.scenarioId)) {
      measurementIdByScenario.set(planned.scenarioId, measurementDirName(planned.scenarioId));
    }
    const measurementId = measurementIdByScenario.get(planned.scenarioId);
    const probeDir = join(options.out, measurementId, probeDirName(planned.condition, planned.repetition));

    process.stdout.write(`Running ${planned.scenarioId} ${planned.condition} #${planned.repetition}...\n`);
    try {
      const recorded = await runProbe({
        scenario,
        condition: planned.condition,
        repetition: planned.repetition,
      });
      await mkdir(probeDir, { recursive: true });
      await writeFile(join(probeDir, METADATA_FILE), canonicalJson(recorded.metadata), "utf8");
      await writeFile(join(probeDir, TRANSCRIPT_FILE), recorded.transcript, "utf8");
      await writeFile(join(probeDir, DIFF_FILE), recorded.diff, "utf8");
      await writeFile(join(probeDir, INVOCATIONS_FILE), canonicalJson(recorded.invocations), "utf8");
      process.stdout.write(`  wrote ${probeDir}\n`);
    } catch (error) {
      failures += 1;
      process.stderr.write(`  FAILED ${planned.scenarioId} ${planned.condition} #${planned.repetition}: ${error.message}\n`);
    }
  }

  if (failures > 0) {
    process.stderr.write(`${failures} of ${matrix.length} probe(s) failed.\n`);
    process.exit(1);
  }
  process.stdout.write(`Completed ${matrix.length} probe(s).\n`);
}

main();
