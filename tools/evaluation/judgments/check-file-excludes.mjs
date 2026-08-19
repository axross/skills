#!/usr/bin/env node
// an outcome-phase script judgment: does one file in the reconstructed
// workspace exclude every substring the factor expects — the negative
// counterpart of check-file-contains.mjs, for a factor whose expectation is
// that something is now absent rather than present.
//
// docs/specs/skill-evaluation.md, "The factor": a script judgment "runs
// with the reconstructed workspace as its working directory and a context
// file as its argument, prints {"result", "evidence"} on stdout, and
// signals a failed judgment by a non-zero exit with a reason on stderr."
// This factor's phase is "outcome", so this script reads the reconstructed
// workspace itself — its own cwd — rather than the diff-and-task material
// factor-judgment.mjs's materialFor hands an outcome factor. The file
// itself lives in the reconstructed workspace, which is this process's own
// cwd (see factor-judgment.mjs's runScriptJudgment); a file the
// expectation names but the workspace does not have is a judgment this
// script cannot make, not a vacuous `true` result, so it exits non-zero
// rather than reporting one — the same rule check-file-contains.mjs holds
// for the same reason.
//
// usage: node check-file-excludes.mjs <context.json>

import { readFileSync } from "node:fs";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const contextPath = process.argv[2];
if (!contextPath) fail("usage: check-file-excludes.mjs <context.json>");

let context;
try {
  context = JSON.parse(readFileSync(contextPath, "utf8"));
} catch (error) {
  fail(`could not read or parse ${contextPath}: ${error.message}`);
}

const { file, mustExcludeAll } = context.input ?? {};
if (typeof file !== "string" || file.length === 0) {
  fail("context.input.file must be a non-empty, workspace-relative path.");
}
if (!Array.isArray(mustExcludeAll) || mustExcludeAll.length === 0) {
  fail("context.input.mustExcludeAll must be a non-empty array of substrings.");
}

let content;
try {
  content = readFileSync(file, "utf8");
} catch (error) {
  fail(`could not read ${file} from the reconstructed workspace: ${error.message}`);
}

const present = mustExcludeAll.filter((needle) => content.includes(needle));
const result = present.length === 0;
const evidence = result
  ? `${file} contains none of the excluded substrings: ${mustExcludeAll.join(", ")}`
  : `${file} still contains: ${present.join(", ")}`;

process.stdout.write(`${JSON.stringify({ result, evidence })}\n`);
