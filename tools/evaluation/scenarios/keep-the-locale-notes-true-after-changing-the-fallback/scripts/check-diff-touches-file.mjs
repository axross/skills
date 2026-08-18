#!/usr/bin/env node
// an outcome-phase script judgment: was one named, workspace-relative path
// among the files the probe's diff touched.
//
// docs/specs/skill-evaluation.md, "The factor": a script judgment "runs
// with the reconstructed workspace as its working directory and a context
// file as its argument, prints {"result", "evidence"} on stdout, and
// signals a failed judgment by a non-zero exit with a reason on stderr."
// This factor's phase is "outcome", and this script reads only
// `material.diff` — it never opens the named file at all.
//
// What this cannot see: this is the shallowest kind of factor this
// instrument can declare. It reads that a path appears among the diff's own
// "+++ b/<path>" lines, never what changed there or whether the change is
// any good — a file touched and made worse still satisfies it. That
// shallowness is deliberate here; see this scenario's own scenario.json for
// why the factor that names this script earns its place anyway.
//
// usage: node check-diff-touches-file.mjs <context.json>

import { readFileSync } from "node:fs";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

/** the workspace-relative paths of every file a unified diff added or modified, from its "+++ b/<path>" lines. */
function touchedPaths(diff) {
  const paths = [];
  for (const match of diff.matchAll(/^\+\+\+ b\/(.+)$/gm)) {
    paths.push(match[1]);
  }
  return [...new Set(paths)];
}

const contextPath = process.argv[2];
if (!contextPath) fail("usage: check-diff-touches-file.mjs <context.json>");

let context;
try {
  context = JSON.parse(readFileSync(contextPath, "utf8"));
} catch (error) {
  fail(`could not read or parse ${contextPath}: ${error.message}`);
}

const file = context.input?.file;
if (typeof file !== "string" || file.length === 0) {
  fail("context.input.file must be a non-empty, workspace-relative path.");
}

const diff = context.material?.diff;
if (typeof diff !== "string") {
  fail("context.material.diff must be a string — this script judges the outcome phase alone.");
}

const touched = touchedPaths(diff);
const result = touched.includes(file);
const evidence = result
  ? `${file} is among the files the diff touched`
  : touched.length > 0
    ? `the diff touched ${touched.join(", ")}, which does not include ${file}`
    : `the diff touched no files at all`;

process.stdout.write(`${JSON.stringify({ result, evidence })}\n`);
