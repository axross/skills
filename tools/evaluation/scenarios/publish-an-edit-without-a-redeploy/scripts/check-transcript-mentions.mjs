#!/usr/bin/env node
// a transcript-phase script judgment: does the probe's own transcript
// mention any of a small set of phrases, checked case-insensitively.
//
// docs/specs/skill-evaluation.md, "Three phases": a transcript factor is
// shown the transcript alone — factor-judgment.mjs's materialFor hands
// this script exactly {"transcript": "..."} and nothing else, never the
// diff or the skill invocations, so this script has no reconstructed
// workspace to read and does not try to.
//
// usage: node check-transcript-mentions.mjs <context.json>

import { readFileSync } from "node:fs";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const contextPath = process.argv[2];
if (!contextPath) fail("usage: check-transcript-mentions.mjs <context.json>");

let context;
try {
  context = JSON.parse(readFileSync(contextPath, "utf8"));
} catch (error) {
  fail(`could not read or parse ${contextPath}: ${error.message}`);
}

const { anyOf } = context.expect ?? {};
if (!Array.isArray(anyOf) || anyOf.length === 0 || !anyOf.every((p) => typeof p === "string" && p.length > 0)) {
  fail("context.expect.anyOf must be a non-empty array of non-empty strings.");
}

const transcript = context.material?.transcript;
if (typeof transcript !== "string") {
  fail(
    "context.material.transcript must be a string — this script judges the transcript phase alone, and a " +
      "transcript-phase factor is handed exactly that (factor-judgment.mjs's materialFor).",
  );
}

const lowered = transcript.toLowerCase();
const matched = anyOf.find((phrase) => lowered.includes(phrase.toLowerCase()));
const result = matched !== undefined;
const evidence = result
  ? `the transcript contains "${matched}" (matched case-insensitively)`
  : `the transcript contains none of: ${anyOf.join(", ")} (matched case-insensitively)`;

process.stdout.write(`${JSON.stringify({ result, evidence })}\n`);
