#!/usr/bin/env node
// an outcome-phase script judgment: does the line immediately before the
// ordered list in docs/deployment.md's "Rolling back" section introduce it
// in prose ending with a colon.
//
// docs/specs/skill-evaluation.md, "The factor": a script judgment "runs
// with the reconstructed workspace as its working directory and a context
// file as its argument, prints {"result", "evidence"} on stdout, and
// signals a failed judgment by a non-zero exit with a reason on stderr."
// This factor's phase is "outcome", so this script reads the reconstructed
// workspace itself, the same as its sibling check-rollback-ordered-list.mjs.
//
// What this cannot see: whether the lead-in sentence itself is any good —
// only that some line of prose sits directly above the list and ends with
// a colon. It also cannot make a judgment at all when the section carries
// no ordered list to introduce in the first place — that is a limitation of
// this script, not a `false` result, since "does the lead-in end in a
// colon" presupposes there is a lead-in to check, so this script exits
// non-zero and reports why rather than guessing at an answer.
//
// usage: node check-rollback-lead-in.mjs <context.json>

import { readFileSync } from "node:fs";

const DEPLOYMENT_DOC = "docs/deployment.md";
const SECTION_HEADING = "## Rolling back";
const ORDERED_LIST_ITEM = /^[ \t]{0,3}\d+\.[ \t]+\S/;

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

/** the text of one `##`-level section, from just after its heading line to the next `##` heading or end of file. */
function sectionAfter(content, heading) {
  const start = content.indexOf(`${heading}\n`);
  if (start === -1) return null;
  const bodyStart = start + heading.length + 1;
  const next = content.indexOf("\n## ", bodyStart);
  return next === -1 ? content.slice(bodyStart) : content.slice(bodyStart, next);
}

const contextPath = process.argv[2];
if (!contextPath) fail("usage: check-rollback-lead-in.mjs <context.json>");

try {
  JSON.parse(readFileSync(contextPath, "utf8"));
} catch (error) {
  fail(`could not read or parse ${contextPath}: ${error.message}`);
}

let content;
try {
  content = readFileSync(DEPLOYMENT_DOC, "utf8");
} catch (error) {
  fail(`could not read ${DEPLOYMENT_DOC} from the reconstructed workspace: ${error.message}`);
}

const section = sectionAfter(content, SECTION_HEADING);
if (section === null) {
  fail(
    `${DEPLOYMENT_DOC} no longer has a ${JSON.stringify(SECTION_HEADING)} heading — this factor cannot locate the section it judges.`,
  );
}

const lines = section.split("\n");
const listIndex = lines.findIndex((line) => ORDERED_LIST_ITEM.test(line));
if (listIndex === -1) {
  fail(
    `the "Rolling back" section carries no ordered list — this factor judges what introduces one, and there is nothing to introduce.`,
  );
}

let leadInIndex = -1;
for (let i = listIndex - 1; i >= 0; i -= 1) {
  if (lines[i].trim() !== "") {
    leadInIndex = i;
    break;
  }
}

let result;
let evidence;
if (leadInIndex === -1) {
  result = false;
  evidence = "nothing precedes the ordered list in the section — there is no lead-in line at all";
} else {
  const leadIn = lines[leadInIndex].trim();
  result = leadIn.endsWith(":");
  evidence = result
    ? `the line immediately before the ordered list reads ${JSON.stringify(leadIn)}, ending in a colon`
    : `the line immediately before the ordered list reads ${JSON.stringify(leadIn)}, which does not end in a colon`;
}

process.stdout.write(`${JSON.stringify({ result, evidence })}\n`);
