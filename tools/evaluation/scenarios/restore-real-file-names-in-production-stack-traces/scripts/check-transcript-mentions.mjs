#!/usr/bin/env node
// a transcript-phase script judgment: does the probe's transcript mention at
// least one of the factor's expected phrases, case-insensitively.
//
// docs/specs/skill-evaluation.md, "The factor": a script judgment can judge
// any phase a factor declares; a transcript factor's material is
// { transcript }, per factor-judgment.mjs's materialFor. This one is a grep,
// not a reasoning read, and that is a deliberate choice recorded in this
// scenario's own plan (tracking issue #431's Assumptions): no
// ANTHROPIC_API_KEY is assumed to exist, so a reasoning judgment would
// return only an error carrying that reason, while a grep is a factor that
// can return a real verdict. The accepted cost, stated rather than hidden,
// is that an agent which merely used one of the expected words — without
// ever reasoning about the cause — satisfies this exactly as well as one
// that diagnosed it properly; this script cannot tell those apart, only
// whether the words are there.
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

const { mustContainAny } = context.input ?? {};
if (!Array.isArray(mustContainAny) || mustContainAny.length === 0) {
  fail("context.input.mustContainAny must be a non-empty array of phrases.");
}

const transcript = context.material?.transcript;
if (typeof transcript !== "string") {
  fail(
    "context.material.transcript must be a string — this script judges the transcript phase alone.",
  );
}

const haystack = transcript.toLowerCase();
const matched = mustContainAny.filter((phrase) => haystack.includes(phrase.toLowerCase()));
const result = matched.length > 0;
const evidence = result
  ? `the transcript mentions ${matched.map((phrase) => JSON.stringify(phrase)).join(", ")}`
  : `the transcript mentions none of: ${mustContainAny.map((phrase) => JSON.stringify(phrase)).join(", ")}`;

process.stdout.write(`${JSON.stringify({ result, evidence })}\n`);
