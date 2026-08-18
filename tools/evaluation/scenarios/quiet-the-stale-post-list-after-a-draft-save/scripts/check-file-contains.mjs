#!/usr/bin/env node
// an outcome-phase script judgment: does one file in the reconstructed
// workspace contain every substring the factor expects.
//
// generic across this scenario's two outcome factors — one checking what
// the fix has to ADD (the missing invalidation), one checking what it must
// NOT remove (the existing detail-cache write) — docs/specs/skill-evaluation.md's
// "both what had to appear and what had to not". The file itself lives in
// the reconstructed workspace, which is this process's own cwd (see this
// scenario's scenario.json and factor-judgment.mjs's runScriptJudgment); a
// file the expectation names but the workspace does not have is a judgment
// this script cannot make, not a `false` result, so it exits non-zero
// rather than reporting one.
//
// usage: node check-file-contains.mjs <context.json>

import { readFileSync } from "node:fs";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const contextPath = process.argv[2];
if (!contextPath) fail("usage: check-file-contains.mjs <context.json>");

let context;
try {
  context = JSON.parse(readFileSync(contextPath, "utf8"));
} catch (error) {
  fail(`could not read or parse ${contextPath}: ${error.message}`);
}

const { file, mustContainAll } = context.input ?? {};
if (typeof file !== "string" || file.length === 0) {
  fail("context.input.file must be a non-empty, workspace-relative path.");
}
if (!Array.isArray(mustContainAll) || mustContainAll.length === 0) {
  fail("context.input.mustContainAll must be a non-empty array of substrings.");
}

let content;
try {
  content = readFileSync(file, "utf8");
} catch (error) {
  fail(`could not read ${file} from the reconstructed workspace: ${error.message}`);
}

const missing = mustContainAll.filter((needle) => !content.includes(needle));
const result = missing.length === 0;
const evidence = result
  ? `${file} contains every expected substring: ${mustContainAll.join(", ")}`
  : `${file} is missing: ${missing.join(", ")}`;

process.stdout.write(`${JSON.stringify({ result, evidence })}\n`);
