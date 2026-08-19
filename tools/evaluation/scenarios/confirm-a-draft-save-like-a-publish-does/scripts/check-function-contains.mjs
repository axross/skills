#!/usr/bin/env node
// an outcome-phase script judgment: does the region of one file between two
// literal text markers contain every substring the factor expects.
//
// Why scoped rather than whole-file: PostEditorPage.tsx already calls
// setToast(...) for the publish flow before this scenario's fix — a
// whole-file "does it contain setToast(" check (check-file-contains.mjs's
// own contract) would already be true on the unfixed file and would prove
// nothing about handleSaveDraft specifically. Scoping to the text between a
// start and an end marker is what a plain substring search cannot do on its
// own, and is this script's one addition over that sibling.
//
// A model that renames handleSaveDraft, reorders the two handlers so the end
// marker no longer follows the start marker, or extracts a shared helper the
// marker text no longer names, will not be found by this script — a known
// limitation of a marker-scoped substring search, not a claim that this
// factor can tell "fixed" apart from "refactored into something this script
// no longer recognizes". Either marker missing from the file is a real
// `false` for the same reason: the file is there and readable, and the
// region this factor would check simply is not in it.
//
// usage: node check-function-contains.mjs <context.json>

import { readFileSync } from "node:fs";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const contextPath = process.argv[2];
if (!contextPath) fail("usage: check-function-contains.mjs <context.json>");

let context;
try {
  context = JSON.parse(readFileSync(contextPath, "utf8"));
} catch (error) {
  fail(`could not read or parse ${contextPath}: ${error.message}`);
}

const { file, startMarker, endMarker, mustContainAll } = context.input ?? {};
if (typeof file !== "string" || file.length === 0) {
  fail("context.input.file must be a non-empty, workspace-relative path.");
}
if (typeof startMarker !== "string" || startMarker.length === 0) {
  fail("context.input.startMarker must be a non-empty string.");
}
if (typeof endMarker !== "string" || endMarker.length === 0) {
  fail("context.input.endMarker must be a non-empty string.");
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

const start = content.indexOf(startMarker);
if (start === -1) {
  const evidence = `${file} does not contain the start marker ${JSON.stringify(startMarker)}.`;
  process.stdout.write(`${JSON.stringify({ result: false, evidence })}\n`);
  process.exit(0);
}
const end = content.indexOf(endMarker, start + startMarker.length);
if (end === -1) {
  const evidence = `${file} does not contain the end marker ${JSON.stringify(endMarker)} after the start marker.`;
  process.stdout.write(`${JSON.stringify({ result: false, evidence })}\n`);
  process.exit(0);
}

const region = content.slice(start, end);
const missing = mustContainAll.filter((needle) => !region.includes(needle));
const result = missing.length === 0;
const evidence = result
  ? `the region of ${file} between ${JSON.stringify(startMarker)} and ${JSON.stringify(endMarker)} contains every expected substring: ${mustContainAll.join(", ")}`
  : `the region of ${file} between ${JSON.stringify(startMarker)} and ${JSON.stringify(endMarker)} is missing: ${missing.join(", ")}`;

process.stdout.write(`${JSON.stringify({ result, evidence })}\n`);
