#!/usr/bin/env node
// an outcome-phase script judgment: does some spec covering
// shared/resolve-translation.ts name a callable subject the way unit-testing
// requires — a describe(...) title carrying the "()" suffix on one of the
// module's four exported functions — and does no title in that same spec set
// name one of them bare.
//
// docs/specs/skill-evaluation.md, "The factor": a script judgment "runs
// with the reconstructed workspace as its working directory and a context
// file as its argument, prints {"result", "evidence"} on stdout, and
// signals a failed judgment by a non-zero exit with a reason on stderr."
// This factor's phase is "outcome"; this script reads the reconstructed
// workspace on disk directly (its own cwd) rather than the diff, the way
// check-css-syntax.mjs's own outcome factor already does, since what it
// judges is a spec's naming, not which lines a probe happened to add.
//
// Which files count as a candidate spec, and why e2e/ and .claude/ are left
// out of the scan, are spec-scan.mjs's own decisions and documented there.
//
// The four exported functions are read here as a fixed list rather than
// parsed from the module, because this factor is written against
// shared/resolve-translation.ts specifically, not against an arbitrary
// module a future scenario might point this script at.
//
// usage: node check-spec-names-callables.mjs <context.json>

import { NO_SPEC_EVIDENCE, describeTitles, requireContext, specsCoveringTheModule } from "./spec-scan.mjs";

requireContext("check-spec-names-callables.mjs");

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const EXPORTED_FUNCTIONS = ["normalizeLocale", "findExactMatch", "findLanguageMatch", "resolveTranslation"];

const candidates = specsCoveringTheModule();

if (candidates.length === 0) {
  process.stdout.write(`${JSON.stringify({ result: false, evidence: NO_SPEC_EVIDENCE })}\n`);
  process.exit(0);
}

let callableMatch = null;
let bareViolation = null;
const allTitlesSeen = [];

for (const { file, content } of candidates) {
  for (const title of describeTitles(content)) {
    allTitlesSeen.push(`${file}: "${title}"`);
    for (const fn of EXPORTED_FUNCTIONS) {
      const callableRe = new RegExp(`\\b${escapeRegExp(fn)}\\(\\)`);
      const bareRe = new RegExp(`\\b${escapeRegExp(fn)}\\b(?!\\()`);
      if (!callableMatch && callableRe.test(title)) callableMatch = { file, title, fn };
      if (!bareViolation && bareRe.test(title)) bareViolation = { file, title, fn };
    }
  }
}

const result = callableMatch !== null && bareViolation === null;

let evidence;
if (bareViolation !== null) {
  evidence =
    `${bareViolation.file} names describe("${bareViolation.title}") — "${bareViolation.fn}" appears without ` +
    `the "()" suffix unit-testing requires on a callable subject`;
} else if (callableMatch === null) {
  evidence =
    allTitlesSeen.length > 0
      ? `no describe(...) title in ${candidates.map((c) => c.file).join(", ")} names ${EXPORTED_FUNCTIONS.join(", ")} with "()" — titles found: ${allTitlesSeen.join("; ")}`
      : `${candidates.map((c) => c.file).join(", ")} mentions resolve-translation but declares no describe(...) block at all`;
} else {
  evidence = `${callableMatch.file} names describe("${callableMatch.title}"), correctly suffixing "${callableMatch.fn}" with "()", and no title in the same spec set names a callable subject bare`;
}

process.stdout.write(`${JSON.stringify({ result, evidence })}\n`);
