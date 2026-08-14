#!/usr/bin/env node
// the land step of .github/workflows/effect-eval.yaml that refuses to commit
// records the dispatch did not produce.
//
// it belongs to the workflow because it compares two things only the workflow
// sees together: the mode of the dispatch, which is an input, and the stamp on
// each record, which evaluate.mjs writes. summarize.mjs sees the records and
// not the dispatch; the workflow saw the dispatch and, until this, not the
// records.
//
// it checks each direction, not just the one that costs nothing to get wrong,
// and that is the point. a dry run whose records are not all stamped means the
// flag never reached evaluate.mjs and six probes were paid for by a rehearsal;
// a paid run with any record stamped means a probe wrote a synthetic transcript
// and the measurement is fiction. a check that only looked for the first would
// leave the expensive half unguarded, and this branch has already shipped two
// fields whose checks could not fail.
//
// exit codes:
//   0  every record's stamp matches the dispatch's mode
//   2  bad invocation, or a record that could not be read
//   3  a disagreement — named, and nothing should be committed

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { METADATA_FILE } from "../../tools/evaluation/src/layout.mjs";
import { conditionOf } from "../../tools/evaluation/readings/effect/src/layout.mjs";

/** what `trigger.kind` reads on a record from each kind of dispatch. */
const DRY_RUN_KIND = "dry-run";

const USAGE = `Usage: effect-eval-check-mode.mjs --dir <case-dir> --expect <mode>

Compare every probe record's trigger.kind against the dispatch's mode, and
refuse when they disagree in either direction.

  --dir <case-dir>  the case measurement directory (required)
  --expect <mode>   "dry-run" or "measurement" (required)
  --help            this text

Exit codes: 0 they agree, 2 bad invocation, 3 a disagreement.`;

function fail2(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

function parseArgv(argv) {
  const options = { dir: null, expect: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (value === undefined) fail2(`${arg} needs a value.\n${USAGE}`);
      i += 1;
      return value;
    };
    if (arg === "--dir") options.dir = next();
    else if (arg === "--expect") options.expect = next();
    else fail2(`Unknown option ${JSON.stringify(arg)}.\n${USAGE}`);
  }
  return options;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${USAGE}\n`);
    process.exit(0);
  }

  const { dir, expect } = parseArgv(argv);
  if (!dir) fail2(`--dir is required.\n${USAGE}`);
  if (expect !== DRY_RUN_KIND && expect !== "measurement") {
    fail2(`--expect must be "${DRY_RUN_KIND}" or "measurement", got ${JSON.stringify(expect)}.`);
  }

  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    fail2(`Could not read ${dir}: ${error.message}`);
  }
  const probes = entries
    .filter((entry) => entry.isDirectory() && conditionOf(entry.name) !== null)
    .map((entry) => entry.name)
    .sort();

  // an empty directory is a disagreement rather than a pass. a dispatch whose
  // probes all failed would otherwise slip through this check and be caught
  // only by the repetition count, after the commit.
  if (probes.length === 0) {
    process.stderr.write(`${dir} holds no probe directories; nothing to check and nothing to land.\n`);
    process.exit(3);
  }

  const wrong = [];
  for (const name of probes) {
    let metadata;
    try {
      metadata = JSON.parse(await readFile(join(dir, name, METADATA_FILE), "utf8"));
    } catch (error) {
      fail2(`Could not read ${name}/${METADATA_FILE}: ${error.message}`);
    }
    const kind = metadata?.trigger?.kind ?? null;
    const isDryRun = kind === DRY_RUN_KIND;
    if (isDryRun !== (expect === DRY_RUN_KIND)) {
      wrong.push(`${name}: trigger.kind is ${JSON.stringify(kind)}`);
    }
  }

  if (wrong.length > 0) {
    process.stderr.write(
      `Refusing to land: this dispatch is a ${expect} run, but ${wrong.length} of ` +
        `${probes.length} record(s) disagree:\n` +
        wrong.map((line) => `  ${line}\n`).join("") +
        (expect === DRY_RUN_KIND
          ? "\nA dry run whose records are not stamped means --dry-run never reached the probe, " +
            "so this rehearsal spawned models and was billed.\n"
          : "\nA measurement with a stamped record means a probe wrote a synthetic transcript, " +
            "so what it reports is fiction.\n"),
    );
    process.exit(3);
  }

  process.stdout.write(`${probes.length} record(s) match the ${expect} dispatch.\n`);
}

main();
