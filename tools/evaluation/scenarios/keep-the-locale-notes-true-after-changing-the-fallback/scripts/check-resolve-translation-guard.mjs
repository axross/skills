#!/usr/bin/env node
// an outcome-phase script judgment, and this scenario's guard factor: does
// shared/resolve-translation.ts's own resolveTranslation function still
// fall back to post.defaultLocale when nothing else matched.
//
// docs/specs/skill-evaluation.md, "The factor": a script judgment "runs
// with the reconstructed workspace as its working directory and a context
// file as its argument, prints {"result", "evidence"} on stdout, and
// signals a failed judgment by a non-zero exit with a reason on stderr."
// This factor's phase is "outcome", so this script reads the reconstructed
// workspace directly.
//
// This factor is a guard, not a differential carrier — see this scenario's
// own scenario.json for why: the task asks directly for this behaviour
// change, so it is expected to read `true` under both of this scenario's
// probe conditions once the task has actually been attempted, and exists
// only so the scenario's other outcome factors are readable as a
// documentation finding rather than as evidence that the underlying bug was
// never fixed at all.
//
// What this cannot see: it reads resolveTranslation's own body, from its
// declaration to the end of the file, for the literal expression
// `post.defaultLocale` — a fallback reintroduced through a renamed field, a
// helper this script does not know to look inside, or `post["defaultLocale"]`
// would not be caught. It cannot make a judgment at all when
// resolveTranslation itself cannot be located in the file — not the same as
// a `false` result — and exits non-zero rather than reporting one.
//
// usage: node check-resolve-translation-guard.mjs <context.json>

import { readFileSync } from "node:fs";

const MODULE_PATH = "shared/resolve-translation.ts";
const START_MARKER = "export function resolveTranslation";
const FORBIDDEN_EXPRESSION = "post.defaultLocale";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const contextPath = process.argv[2];
if (!contextPath) fail("usage: check-resolve-translation-guard.mjs <context.json>");

try {
  JSON.parse(readFileSync(contextPath, "utf8"));
} catch (error) {
  fail(`could not read or parse ${contextPath}: ${error.message}`);
}

let content;
try {
  content = readFileSync(MODULE_PATH, "utf8");
} catch (error) {
  fail(`could not read ${MODULE_PATH} from the reconstructed workspace: ${error.message}`);
}

const start = content.indexOf(START_MARKER);
if (start === -1) {
  fail(
    `${MODULE_PATH} no longer contains ${JSON.stringify(START_MARKER)} — this factor cannot locate resolveTranslation's own body to judge.`,
  );
}

const body = content.slice(start);
const result = !body.includes(FORBIDDEN_EXPRESSION);
const evidence = result
  ? `resolveTranslation's own body no longer reads ${FORBIDDEN_EXPRESSION}`
  : `resolveTranslation's own body still reads ${FORBIDDEN_EXPRESSION}`;

process.stdout.write(`${JSON.stringify({ result, evidence })}\n`);
