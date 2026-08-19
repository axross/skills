#!/usr/bin/env node
// an outcome-phase script judgment: does some spec covering
// shared/resolve-translation.ts group a condition under its own
// describe("when ...") block, the way unit-testing requires for cases that
// share a condition.
//
// docs/specs/skill-evaluation.md, "The factor": a script judgment "runs
// with the reconstructed workspace as its working directory and a context
// file as its argument, prints {"result", "evidence"} on stdout, and
// signals a failed judgment by a non-zero exit with a reason on stderr."
// This factor's phase is "outcome"; this script reads the reconstructed
// workspace on disk directly (its own cwd) rather than the diff, the way
// check-css-syntax.mjs's own outcome factor already does, since what it
// judges is a spec's structure, not which lines a probe happened to add.
//
// This judges only whether a condition-named group EXISTS — a describe(...)
// title that begins with the literal text "when " — never how deeply it
// nests, how many of resolve-translation.ts's four resolution conditions
// (exact match, language-only match, default-locale fallback, no match at
// all) are covered, or whether the cases inside it actually belong there.
// That is its stated limit, not an oversight: any of those would need
// reading the case bodies, which this factor does not attempt.
//
// Which files count as a candidate spec, and why e2e/ and .claude/ are left
// out of the scan, are spec-scan.mjs's own decisions and documented there.
//
// usage: node check-spec-groups-conditions.mjs <context.json>

import { NO_SPEC_EVIDENCE, describeTitles, requireContext, specsCoveringTheModule } from "./spec-scan.mjs";

requireContext("check-spec-groups-conditions.mjs");

const candidates = specsCoveringTheModule();

if (candidates.length === 0) {
  process.stdout.write(`${JSON.stringify({ result: false, evidence: NO_SPEC_EVIDENCE })}\n`);
  process.exit(0);
}

let match = null;
const allTitlesSeen = [];
for (const { file, content } of candidates) {
  for (const title of describeTitles(content)) {
    allTitlesSeen.push(`${file}: "${title}"`);
    if (!match && title.startsWith("when ")) match = { file, title };
  }
}

const result = match !== null;
let evidence;
if (result) {
  evidence = `${match.file} groups a condition under describe("${match.title}")`;
} else if (allTitlesSeen.length > 0) {
  evidence = `no describe(...) title in ${candidates.map((c) => c.file).join(", ")} begins with "when " — titles found: ${allTitlesSeen.join("; ")}`;
} else {
  evidence = `${candidates.map((c) => c.file).join(", ")} mentions resolve-translation but declares no describe(...) block at all`;
}

process.stdout.write(`${JSON.stringify({ result, evidence })}\n`);
