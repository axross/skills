#!/usr/bin/env node
// an outcome-phase script judgment: does any Markdown file the probe's diff
// touched carry a heading whose text contains the expected substring.
//
// docs/specs/skill-evaluation.md, "The factor": a script judgment "runs
// with the reconstructed workspace as its working directory and a context
// file as its argument, prints {"result", "evidence"} on stdout, and
// signals a failed judgment by a non-zero exit with a reason on stderr."
// This factor's phase is "outcome", so the material this script is handed
// is `{diff, task}` — see factor-judgment.mjs's materialFor — and it reads
// the diff to find which files were touched, then the reconstructed
// workspace to read what each one now says.
//
// Reused by three factors in this scenario's own scenario.json, one per
// required heading, rather than folded into one "carries most of the
// required sections" factor: a factor result is `true`, `false`, or an
// error and never a ratio, so decomposing per heading is what lets a
// failure name which one specifically was missing.
//
// What this cannot see: a document that covers the expected point in prose
// without a heading naming it passes nowhere here — this script reads
// heading text alone, never whether the section under it actually satisfies
// what the heading promises. It also cannot tell a heading that exists from
// one whose section is empty, off-topic, or copied verbatim from a
// template; judging content is this scenario's reasoning factor's job, not
// this script's.
//
// usage: node check-heading-in-touched-markdown.mjs <context.json>

import { readFileSync } from "node:fs";

const HEADING_LINE = /^#{1,6}\s+(.+?)\s*$/;

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

/** every heading's own text in `content`, `#` markers stripped. */
function headings(content) {
  const found = [];
  for (const line of content.split("\n")) {
    const match = line.match(HEADING_LINE);
    if (match) found.push(match[1]);
  }
  return found;
}

const contextPath = process.argv[2];
if (!contextPath) fail("usage: check-heading-in-touched-markdown.mjs <context.json>");

let context;
try {
  context = JSON.parse(readFileSync(contextPath, "utf8"));
} catch (error) {
  fail(`could not read or parse ${contextPath}: ${error.message}`);
}

const headingContains = context.input?.headingContains;
if (typeof headingContains !== "string" || headingContains.length === 0) {
  fail("context.input.headingContains must be a non-empty string.");
}

const diff = context.material?.diff;
if (typeof diff !== "string") {
  fail("context.material.diff must be a string — this script judges the outcome phase alone.");
}

const markdownPaths = touchedPaths(diff).filter((path) => path.endsWith(".md"));

const needle = headingContains.toLowerCase();
let matchedFile = null;
let matchedHeading = null;
for (const path of markdownPaths) {
  let content;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    continue; // touched in the diff but unreadable now (e.g. later deleted) — not this factor's concern
  }
  const found = headings(content).find((heading) => heading.toLowerCase().includes(needle));
  if (found) {
    matchedFile = path;
    matchedHeading = found;
    break;
  }
}

const result = matchedFile !== null;
const evidence = result
  ? `${matchedFile} carries the heading "${matchedHeading}", which contains ${JSON.stringify(headingContains)}`
  : markdownPaths.length > 0
    ? `the diff touched these Markdown file(s) — ${markdownPaths.join(", ")} — and none carries a heading containing ${JSON.stringify(headingContains)}`
    : `the diff touched no Markdown file at all, so none can carry a heading containing ${JSON.stringify(headingContains)}`;

process.stdout.write(`${JSON.stringify({ result, evidence })}\n`);
