#!/usr/bin/env node
// an outcome-phase script judgment: does docs/deployment.md's "Rolling back"
// section carry an ordered list of at least two items.
//
// docs/specs/skill-evaluation.md, "The factor": a script judgment "runs
// with the reconstructed workspace as its working directory and a context
// file as its argument, prints {"result", "evidence"} on stdout, and
// signals a failed judgment by a non-zero exit with a reason on stderr."
// This factor's phase is "outcome", so this script reads the reconstructed
// workspace itself — never the diff — for what the section says now; see
// factor-judgment.mjs's materialFor.
//
// What this cannot see: a rewrite that lists the same steps as well-formed
// prose paragraphs, with no line that opens like a numbered list item,
// fails this check even if a person reading it would recognize a clear
// procedure. That is deliberate rather than an oversight — this script
// looks for Markdown's own ordered-list syntax, not for "reads like a
// procedure" in general, and docs/deployment.md carries no ordered list
// anywhere in the mock today, so producing the syntax itself is something a
// treatment run has to do rather than copy from local precedent.
//
// usage: node check-rollback-ordered-list.mjs <context.json>

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
if (!contextPath) fail("usage: check-rollback-ordered-list.mjs <context.json>");

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

const items = section.split("\n").filter((line) => ORDERED_LIST_ITEM.test(line));
const result = items.length >= 2;
const evidence = result
  ? `the "Rolling back" section carries an ordered list of ${items.length} items: ${items.map((line) => line.trim()).join(" / ")}`
  : `the "Rolling back" section carries ${items.length} ordered-list item(s), fewer than the two this factor requires`;

process.stdout.write(`${JSON.stringify({ result, evidence })}\n`);
