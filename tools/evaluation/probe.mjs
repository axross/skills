#!/usr/bin/env node
// probe.mjs — runs one evaluation scenario's probe matrix, or previews it.
//
// docs/specs/skill-evaluation.md, "Repetitions", gives the matrix its shape:
// a run expands its scenario(s) into every (condition, repetition) probe the
// matrix implies. the refusal is #392's decision rather than the spec's —
// "the dispatch is bounded by an exact probe count instead" — so a run
// refuses before any probe starts when that exact count exceeds a declared
// limit, and
// otherwise runs every one of them — each recording the verbatim
// transcript, the workspace diff, the skill invocations, and metadata
// carrying the runtime, the model, and the digest of every installed skill.
//
// --dry-run walks the same matrix-and-admission path with the spawn
// stubbed: nothing here is ever reached under it, so a dry run never
// spawns a model and never costs anything.
//
// a github actions matrix cell needs three things this file did not have
// until now, all of them about turning "one process walks a whole matrix"
// into "one job runs one cell of it, and its sibling jobs agree on where
// their work lands":
//
// --measurement-id fixes the id measurementDirName(scenarioId) would
// otherwise mint fresh per process. every cell of one dispatch that probes
// the same scenario has to write into the same measurement directory, and a
// github actions matrix runs each cell as its own process — so the id has
// to come in from outside rather than be generated inside, once per
// scenario, by whichever job happens to run first.
//
// --condition and --repetition (singular, unlike --conditions and
// --repetitions) select exactly one probe of the matrix rather than
// expanding a cross product: one condition, one repetition index. a cell
// already knows which one it is — its own matrix entry says so — and
// --repetitions 1 alone cannot express that: every cell would write
// <condition>-1 regardless of which repetition it actually represents.
//
// --emit-matrix prints the probe matrix and the judgment matrix as one JSON
// document instead of the prose below, and exits before anything would have
// been spawned — like --dry-run, never reaching runProbe. a workflow's plan
// job reads this rather than re-parsing the human-readable matrix printed
// below, so there stays exactly one place that expands scenarios into
// probes and judgment entries: two derivations of one fact can disagree,
// and this is the one this instrument keeps.
//
// usage:
//   node probe.mjs [--dry-run] [--scenario <id>] [--conditions <list>]
//                  [--repetitions <n>] [--condition <c> --repetition <n>]
//                  [--measurement-id <id>] [--limit <n>] [--out <dir>]
//                  [--emit-matrix]
//   node probe.mjs --help
//
// exit codes:
//   0  every probe (or the dry run, or --emit-matrix) completed
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
  newId,
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
  --condition <c>       with --repetition, select exactly one probe of the
                         matrix instead of the --conditions x --repetitions
                         cross product; mutually exclusive with them
  --repetition <n>      with --condition, the 1-based repetition index this
                         one probe is recorded under
  --measurement-id <id>  fix the id measurementDirName mints, so every
                         invocation given the same id (for the same
                         scenario) writes into the same measurement
                         directory (default: a fresh id per scenario)
  --limit <n>            refuse the run before anything starts if the exact
                         probe count exceeds this (default: no limit)
  --dry-run              report the probe matrix and the admission outcome;
                         spawn nothing
  --emit-matrix           print the probe matrix and the judgment matrix as
                         one JSON document instead of the lines above, and
                         exit before anything would have been spawned
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
    condition: null,
    repetition: null,
    measurementId: null,
    limit: null,
    dryRun: false,
    emitMatrix: false,
    out: join(REPO_ROOT, MEASUREMENTS_ROOT),
  };
  // tracked separately from the options themselves: options.conditions and
  // options.repetitions already carry a default, so only these two booleans
  // can tell "the flag was passed" apart from "the default applies" — which
  // is what the mutual-exclusion check below needs.
  let conditionsGiven = false;
  let repetitionsGiven = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      process.stdout.write(`${USAGE}\n`);
      process.exit(0);
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--emit-matrix") {
      options.emitMatrix = true;
    } else if (arg === "--scenario") {
      options.scenario = argv[(index += 1)];
    } else if (arg === "--conditions") {
      options.conditions = (argv[(index += 1)] ?? "").split(",").filter(Boolean);
      conditionsGiven = true;
    } else if (arg === "--repetitions") {
      options.repetitions = Number(argv[(index += 1)]);
      repetitionsGiven = true;
    } else if (arg === "--condition") {
      options.condition = argv[(index += 1)];
    } else if (arg === "--repetition") {
      options.repetition = Number(argv[(index += 1)]);
    } else if (arg === "--measurement-id") {
      options.measurementId = argv[(index += 1)];
    } else if (arg === "--limit") {
      options.limit = Number(argv[(index += 1)]);
    } else if (arg === "--out") {
      options.out = resolve(argv[(index += 1)]);
    } else {
      fail2(`Unknown option "${arg}".\n${USAGE}`);
    }
  }

  // --condition and --repetition select exactly one probe and must arrive
  // together — a lone one names half a probe, which nothing downstream can
  // act on.
  if ((options.condition === null) !== (options.repetition === null)) {
    fail2(`--condition and --repetition select exactly one probe and must be given together.\n${USAGE}`);
  }
  // mutually exclusive with --conditions/--repetitions, rather than one
  // silently overriding the other: those two multiply a matrix, this pair
  // picks one cell of it, and a workflow step that combined them by mistake
  // should fail loudly rather than run a different probe than it asked for.
  if (options.condition !== null && (conditionsGiven || repetitionsGiven)) {
    fail2(
      `--condition/--repetition select exactly one probe; combine with --conditions or --repetitions is not allowed.\n${USAGE}`,
    );
  }
  // guards the one place --measurement-id becomes a path segment
  // (measurementDirName below): a caller-supplied id must stay one path
  // component, never a way to write outside the measurement root.
  if (options.measurementId !== null && (options.measurementId === "" || options.measurementId.includes("/"))) {
    fail2(
      `--measurement-id must be a non-empty id with no path separators, got ${JSON.stringify(options.measurementId)}.\n${USAGE}`,
    );
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

    if (options.condition !== null) {
      if (!CONDITIONS.includes(options.condition)) {
        throw new Error(
          `Unknown condition ${JSON.stringify(options.condition)}; expected one of ${CONDITIONS.join(", ")}.`,
        );
      }
      if (!Number.isInteger(options.repetition) || options.repetition < 1) {
        throw new Error(`--repetition must be a positive integer, got ${JSON.stringify(options.repetition)}.`);
      }
      // the one-probe selector: every loaded scenario gets exactly this one
      // (condition, repetition) pair, rather than expandMatrix's cross
      // product. a matrix cell always names --scenario too, so in practice
      // this maps over exactly one scenario — but nothing here assumes that.
      matrix = scenarios.map((scenario) => ({
        scenarioId: scenario.id,
        condition: options.condition,
        repetition: options.repetition,
      }));
    } else {
      matrix = expandMatrix(scenarios, { conditions: options.conditions, repetitions: options.repetitions });
    }
  } catch (error) {
    fail2(error.message);
    return;
  }

  const admission = admitDispatch({ probeCount: matrix.length, limit: options.limit });

  // --emit-matrix answers a different question from everything below: not
  // "run this", but "what would running this write, and where". it mints
  // one id per scenario right here — the same id every real probe of this
  // dispatch will be told to use via --measurement-id — and prints the
  // whole matrix as one JSON document rather than the prose below. like
  // --dry-run, it never reaches runProbe; unlike --dry-run, it prints
  // nothing but that one document, so a caller can read stdout directly as
  // JSON with nothing else to strip out first.
  if (options.emitMatrix) {
    const idByScenario = new Map(scenarios.map((scenario) => [scenario.id, options.measurementId ?? newId()]));
    const dirNameOf = (scenarioId) => measurementDirName(scenarioId, idByScenario.get(scenarioId));
    const payload = {
      admission: { ...admission, probeCount: matrix.length, limit: options.limit },
      probes: matrix.map((planned) => ({
        scenarioId: planned.scenarioId,
        condition: planned.condition,
        repetition: planned.repetition,
        measurementId: idByScenario.get(planned.scenarioId),
        measurementDirName: dirNameOf(planned.scenarioId),
      })),
      judgments: scenarios.map((scenario) => ({
        scenarioId: scenario.id,
        measurementId: idByScenario.get(scenario.id),
        measurementDirName: dirNameOf(scenario.id),
      })),
    };
    process.stdout.write(`${JSON.stringify(payload)}\n`);
    if (!admission.admitted) {
      process.stderr.write(`Refusing to start: ${admission.reason}\n`);
      process.exit(1);
    }
    process.exit(0);
    return;
  }

  if (options.condition !== null) {
    process.stdout.write(
      `Probe matrix: ${matrix.length} probe(s) across ${scenarios.length} scenario(s), ` +
        `single-probe selection [${options.condition} #${options.repetition}].\n`,
    );
  } else {
    process.stdout.write(
      `Probe matrix: ${matrix.length} probe(s) across ${scenarios.length} scenario(s), ` +
        `conditions [${options.conditions.join(", ")}], ${options.repetitions} repetition(s) each.\n`,
    );
  }
  for (const planned of matrix) {
    process.stdout.write(`  ${planned.scenarioId} ${planned.condition} #${planned.repetition}\n`);
  }

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
      // --measurement-id fixes the id passed here rather than left to
      // measurementDirName's own default; ?? undefined rather than passing
      // options.measurementId (null) straight through, because the default
      // parameter only fires on undefined, not on null.
      measurementIdByScenario.set(
        planned.scenarioId,
        measurementDirName(planned.scenarioId, options.measurementId ?? undefined),
      );
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
