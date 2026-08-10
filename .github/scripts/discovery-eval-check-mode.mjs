#!/usr/bin/env node
// the land job of .github/workflows/discovery-eval.yaml, refusing to commit
// records the dispatch did not produce.
//
// mirrors .github/scripts/effect-eval-check-mode.mjs's reasoning exactly — see
// that file's header for why both directions matter (a dry run whose records
// are not all stamped means the flag never reached evaluate.mjs and every
// probe was billed; a paid run with any record stamped means a probe wrote a
// synthetic transcript and the measurement is fiction) — generalised to take
// several `--dir`s rather than one. discovery's land job can commit many case
// measurements in a single dispatch (the matrix is per case, not per
// condition), so the directories this check must read are exactly the ones
// THIS run produced, never the whole `measurements/` tree: that tree already
// holds every prior dispatch's committed measurements, most of them stamped
// differently from whatever this run's mode is, and a check that walked all of
// it would refuse a perfectly good dispatch on the strength of history it had
// nothing to do with. The workflow is expected to pass only the directories
// `git status` reports as new since checkout.
//
// exit codes:
//   0  every record's stamp matches the dispatch's mode
//   2  bad invocation, or a directory that could not be read
//   3  a disagreement — named, and nothing should be committed

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { isProbeName, METADATA_FILE } from "../../tools/discovery-eval/src/layout.mjs";

/** what `trigger.kind` reads on a record from a rehearsal. */
const DRY_RUN_KIND = "dry-run";

const USAGE = `Usage: discovery-eval-check-mode.mjs --expect <mode> --dir <path> [--dir <path> ...]

Compare every probe record's trigger.kind, across every given case-measurement
directory, against the dispatch's mode, and refuse when they disagree in
either direction.

  --dir <path>    a case-measurement directory this dispatch produced; give
                   one per case landed, never the whole measurements/ tree
  --expect <mode>  "dry-run" or "measurement" (required)
  --help           this text

Exit codes: 0 they agree, 2 bad invocation, 3 a disagreement.`;

function fail2(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

function parseArgv(argv) {
  const options = { dirs: [], expect: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (value === undefined) fail2(`${arg} needs a value.\n${USAGE}`);
      i += 1;
      return value;
    };
    if (arg === "--dir") options.dirs.push(next());
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

  const { dirs, expect } = parseArgv(argv);
  if (expect !== DRY_RUN_KIND && expect !== "measurement") {
    fail2(`--expect must be "${DRY_RUN_KIND}" or "measurement", got ${JSON.stringify(expect)}.`);
  }
  if (dirs.length === 0) {
    // an empty set is a disagreement rather than a vacuous pass, matching the
    // effect side: a dispatch whose every probe job failed before uploading
    // anything would otherwise slip through this check and be caught only by
    // summarize.mjs's repetition-count comparability check, after nothing was
    // refused here.
    process.stderr.write("No case-measurement directory was given; nothing to check and nothing to land.\n");
    process.exit(3);
  }

  const wrong = [];
  let probeCount = 0;
  for (const dir of dirs) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (error) {
      fail2(`Could not read ${dir}: ${error.message}`);
    }
    const probes = entries
      .filter((entry) => entry.isDirectory() && isProbeName(entry.name))
      .map((entry) => entry.name)
      .sort();
    if (probes.length === 0) {
      wrong.push(`${dir}: holds no probe directories`);
      continue;
    }
    for (const name of probes) {
      probeCount += 1;
      let metadata;
      try {
        metadata = JSON.parse(await readFile(join(dir, name, METADATA_FILE), "utf8"));
      } catch (error) {
        fail2(`Could not read ${dir}/${name}/${METADATA_FILE}: ${error.message}`);
      }
      const kind = metadata?.trigger?.kind ?? null;
      const isDryRun = kind === DRY_RUN_KIND;
      if (isDryRun !== (expect === DRY_RUN_KIND)) {
        wrong.push(`${dir}/${name}: trigger.kind is ${JSON.stringify(kind)}`);
      }
    }
  }

  if (wrong.length > 0) {
    process.stderr.write(
      `Refusing to land: this dispatch is a ${expect} run, but ${wrong.length} record(s) or ` +
        `directories disagree:\n` +
        wrong.map((line) => `  ${line}\n`).join("") +
        (expect === DRY_RUN_KIND
          ? "\nA dry run whose records are not stamped means --dry-run never reached the probe, " +
            "so this rehearsal spawned models and was billed.\n"
          : "\nA measurement with a stamped record means a probe wrote a synthetic transcript, " +
            "so what it reports is fiction.\n"),
    );
    process.exit(3);
  }

  process.stdout.write(`${probeCount} record(s) across ${dirs.length} case(s) match the ${expect} dispatch.\n`);
}

main();
