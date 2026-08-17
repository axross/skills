#!/usr/bin/env node
// an outcome-phase script judgment: does one file in the reconstructed
// workspace contain every substring the factor expects.
//
// generic across this scenario's two outcome factors — one checking that
// jest.config.cjs declares which files coverage should even look at
// (collectCoverageFrom, so shared/resolve-translation.ts stays visible as
// uncovered rather than disappearing from the report), one checking that it
// measures with the runner's own v8 instrumentation rather than Babel's
// default (coverageProvider set to v8) — docs/specs/skill-evaluation.md's
// "both what had to appear and what had to not" reduces here to two things
// that both have to newly appear, since jest.config.cjs declares neither
// option today. The file itself lives in the reconstructed workspace, which
// is this process's own cwd (see this scenario's scenario.json and
// factor-judgment.mjs's runScriptJudgment); jest.config.cjs is one of
// tsuzuri's own baseline files and always exists in a materialized
// workspace, so its absence here would mean the workspace itself is not
// what this script expects to judge, not that the factor's own artefact is
// missing — which is why that case still exits non-zero rather than
// reporting a `false` result.
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

const { file, mustContainAll } = context.expect ?? {};
if (typeof file !== "string" || file.length === 0) {
  fail("context.expect.file must be a non-empty, workspace-relative path.");
}
if (!Array.isArray(mustContainAll) || mustContainAll.length === 0) {
  fail("context.expect.mustContainAll must be a non-empty array of substrings.");
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
