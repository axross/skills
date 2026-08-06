#!/usr/bin/env node
// extract-snapshot.mjs — lift the proposed snapshot out of a captured report.
//
// `run.mjs --emit-snapshot` prints a report and then, after a fixed marker line,
// a snapshot document for a human to commit. That is the right shape for a local
// run, where the terminal is right there. It is the wrong shape for a CI
// dispatch: the document has to land BYTE-EXACT in a committed file, and
// copy-pasting ~90 lines of JSON out of a log viewer is the one step in the
// whole re-record that a human can silently get wrong. `npm run format:check`
// would only catch the damage after it was committed.
//
// So `discovery-eval.yaml` captures the report, runs this, and uploads what it
// writes as a build artifact. The maintainer downloads a file instead of
// selecting text.
//
// THIS IS NOT THE RUNNER, AND IT NEVER WRITES THE WORKING TREE. It writes
// exactly one path, given on the command line, and the workflow points that at
// $RUNNER_TEMP. "The runner never writes the working tree; a human commits it
// deliberately" stays true — this moves a document from stdout to a file the
// human still has to commit themselves.
//
// It VALIDATES before writing, through the same `parseSnapshot` that will read
// the committed file. A slice that produced something malformed then fails the
// job loudly, rather than uploading ~90 plausible-looking lines that only fail
// once they are in the tree.
//
// Usage:
//   node scripts/discovery-eval/extract-snapshot.mjs <report-file> <output-file>
//
// Exit codes:
//   0  a valid snapshot document was written
//   2  no marker in the report, or what followed it does not parse

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { corpusDigest } from "./corpus.mjs";
import { parseSnapshot, ValidationError } from "./fixture.mjs";
import { SNAPSHOT_MARKER } from "./report.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const USAGE = `Usage: extract-snapshot.mjs <report-file> <output-file>

Slice the proposed snapshot out of a captured --emit-snapshot report, validate
it, and write it where a workflow can upload it as an artifact.

Exit codes: 0 written (or --help), 2 bad invocation, no marker, or an invalid
document.`;

function fail2(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

/**
 * The document that follows the marker, or `null` when there is no marker.
 *
 * Pure, so the slicing rule is unit-testable without a report on disk. The
 * marker must be a whole line: matching it mid-line would let a report that
 * merely QUOTES the phrase — a future doc-comment, a copied log — cut the
 * document short.
 *
 * @param {string} report the full captured stdout of a run
 * @returns {string|null}
 */
export function sliceSnapshot(report) {
  const marker = `${SNAPSHOT_MARKER}\n`;
  const at = report.startsWith(marker) ? 0 : report.indexOf(`\n${marker}`);
  if (at === -1) return null;
  return report.slice(at === 0 ? marker.length : at + marker.length + 1);
}

async function main() {
  // Asking for help is not a bad invocation, so it succeeds — matching run.mjs,
  // which answers `--help` before it looks at anything else. Folding the two
  // together made `--help` on its own exit 2, since it carries no paths.
  if (process.argv.includes("--help")) {
    process.stdout.write(`${USAGE}\n`);
    process.exit(0);
  }

  const [reportPath, outputPath] = process.argv.slice(2);
  if (!reportPath || !outputPath) {
    fail2(`Both a report file and an output file are required.\n${USAGE}`);
  }

  let report;
  try {
    report = await readFile(reportPath, "utf8");
  } catch (error) {
    fail2(`Cannot read the report at ${reportPath}: ${error.message}`);
  }

  const document = sliceSnapshot(report);
  if (document === null) {
    fail2(
      `No proposed snapshot in ${reportPath}: the run produced no "${SNAPSHOT_MARKER}" line. Was it invoked with --emit-snapshot?`,
    );
  }

  // Validated against the installed corpus, exactly as the committed file will
  // be by the data check in `npm test` — so a document that would fail there
  // fails here instead, before anyone commits it.
  const knownSkills = Object.keys(
    await corpusDigest(resolve(REPO_ROOT, ".claude", "skills")),
  );
  let parsed;
  try {
    parsed = parseSnapshot(document, { knownSkills });
  } catch (error) {
    if (error instanceof ValidationError) {
      fail2(
        `The emitted snapshot is not valid:\n  ${error.problems.join("\n  ")}`,
      );
    }
    fail2(`The emitted snapshot could not be parsed: ${error.message}`);
  }

  await writeFile(outputPath, document, "utf8");
  process.stdout.write(
    `Wrote a snapshot recorded on "${parsed.model}" at ${parsed.repeats} repeat(s), covering ${Object.keys(parsed.cases).length} case(s), to ${outputPath}\n`,
  );
}

// Only when run as a CLI: the slicing rule above is imported by tests.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
