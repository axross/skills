#!/usr/bin/env node
// an outcome-phase script judgment: does one named substring appear in a
// named file no more than an expected maximum number of times.
//
// docs/specs/skill-evaluation.md, "The factor": a script judgment "runs
// with the reconstructed workspace as its working directory and a context
// file as its argument, prints {"result", "evidence"} on stdout, and
// signals a failed judgment by a non-zero exit with a reason on stderr."
// This factor's phase is "outcome", so this script reads the reconstructed
// workspace directly.
//
// What this cannot see: it counts one literal string, so it cannot tell a
// refactor that removed the duplication this factor is a proxy for from one
// that merely moved the same repeated search somewhere this count still
// finds it once, or from one that avoided the phrase syntactically while
// keeping the underlying repetition (a destructured field access, a
// differently-named local variable). It also cannot tell "improved" apart
// from "made the module worse in some unrelated way" — a run that decides
// the duplication is acceptable and leaves it untouched is a legitimate
// answer to the prompt, and this script reports that as `false` rather than
// trying to distinguish the two kinds of unchanged file.
//
// usage: node check-substring-count-at-most.mjs <context.json>

import { readFileSync } from "node:fs";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const contextPath = process.argv[2];
if (!contextPath) fail("usage: check-substring-count-at-most.mjs <context.json>");

let context;
try {
  context = JSON.parse(readFileSync(contextPath, "utf8"));
} catch (error) {
  fail(`could not read or parse ${contextPath}: ${error.message}`);
}

const { file, substring, max } = context.expect ?? {};
if (typeof file !== "string" || file.length === 0) {
  fail("context.expect.file must be a non-empty, workspace-relative path.");
}
if (typeof substring !== "string" || substring.length === 0) {
  fail("context.expect.substring must be a non-empty string.");
}
if (typeof max !== "number" || !Number.isInteger(max) || max < 0) {
  fail("context.expect.max must be a non-negative integer.");
}

let content;
try {
  content = readFileSync(file, "utf8");
} catch (error) {
  fail(`could not read ${file} from the reconstructed workspace: ${error.message}`);
}

const count = content.split(substring).length - 1;
const result = count <= max;
const evidence = `${substring} appears ${count} time(s) in ${file} (at most ${max} expected)`;

process.stdout.write(`${JSON.stringify({ result, evidence })}\n`);
