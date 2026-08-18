#!/usr/bin/env node
// an outcome-phase script judgment: is one exact, expected sentence no
// longer present, verbatim, in a named file of the reconstructed workspace.
//
// docs/specs/skill-evaluation.md, "The factor": a script judgment "runs
// with the reconstructed workspace as its working directory and a context
// file as its argument, prints {"result", "evidence"} on stdout, and
// signals a failed judgment by a non-zero exit with a reason on stderr."
// This factor's phase is "outcome", so this script reads the reconstructed
// workspace directly.
//
// What this cannot see: a rewording that keeps the same false claim in
// different words still satisfies this script, since it checks for one
// exact string rather than for whether the file's meaning changed. A
// correction placed anywhere other than the one file this factor names
// would not be seen by it at all — that is what this scenario's reasoning
// factor is for.
//
// usage: node check-sentence-absent.mjs <context.json>

import { readFileSync } from "node:fs";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const contextPath = process.argv[2];
if (!contextPath) fail("usage: check-sentence-absent.mjs <context.json>");

let context;
try {
  context = JSON.parse(readFileSync(contextPath, "utf8"));
} catch (error) {
  fail(`could not read or parse ${contextPath}: ${error.message}`);
}

const { file, sentence } = context.input ?? {};
if (typeof file !== "string" || file.length === 0) {
  fail("context.input.file must be a non-empty, workspace-relative path.");
}
if (typeof sentence !== "string" || sentence.length === 0) {
  fail("context.input.sentence must be a non-empty string.");
}

let content;
try {
  content = readFileSync(file, "utf8");
} catch (error) {
  fail(`could not read ${file} from the reconstructed workspace: ${error.message}`);
}

const result = !content.includes(sentence);
const evidence = result
  ? `${file} no longer contains the sentence ${JSON.stringify(sentence)}`
  : `${file} still contains the sentence ${JSON.stringify(sentence)}, verbatim`;

process.stdout.write(`${JSON.stringify({ result, evidence })}\n`);
