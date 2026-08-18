#!/usr/bin/env node
// a transcript-phase script judgment: did any tool the probe used take one
// of the expected strings as part of its input.
//
// docs/specs/skill-evaluation.md, "The factor": a script judgment "runs
// with the reconstructed workspace as its working directory and a context
// file as its argument, prints {"result", "evidence"} on stdout, and
// signals a failed judgment by a non-zero exit with a reason on stderr."
// This factor's phase is "transcript", so the only material
// factor-judgment.mjs's materialFor hands it is the raw transcript string
// — the CLI's `--output-format stream-json` stdout, one JSON object per
// line. This script re-reads that stream for itself rather than importing
// tools/evaluation/src/transcript/ (see this scenario's own scenario.json
// for why every judgment script here is self-contained).
//
// What this reads is a tool's own input rather than the probe's prose, and
// that is the point: it asks what the probe told a tool to do — the path a
// `Read` opened, the pattern a `Grep` searched for, the command a `Bash`
// call ran — never what the probe said about it afterward. A file named only inside a `Read` call's `file_path`
// satisfies this even when the probe's own final answer never repeats the
// filename.
//
// A stream line that does not parse as JSON is skipped rather than treated
// as a failure: a truncated final line is ordinary, not corrupt (see
// tools/evaluation/src/transcript/events.mjs's own header).
//
// usage: node check-transcript-tool-input-mentions.mjs <context.json>

import { readFileSync } from "node:fs";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const contextPath = process.argv[2];
if (!contextPath) fail("usage: check-transcript-tool-input-mentions.mjs <context.json>");

let context;
try {
  context = JSON.parse(readFileSync(contextPath, "utf8"));
} catch (error) {
  fail(`could not read or parse ${contextPath}: ${error.message}`);
}

const anyOf = context.input?.anyOf;
if (!Array.isArray(anyOf) || anyOf.length === 0 || anyOf.some((needle) => typeof needle !== "string")) {
  fail("context.input.anyOf must be a non-empty array of strings.");
}

const transcript = context.material?.transcript;
if (typeof transcript !== "string") {
  fail("context.material.transcript must be a string — this script judges the transcript phase alone.");
}

// every tool_use block's own input, serialized whole — the same reading
// tools/evaluation/src/transcript/events.mjs's toolUseBlocks does, re-read
// here rather than imported.
const serializedInputs = [];
for (const line of transcript.split("\n")) {
  const text = line.trim();
  if (text === "") continue;
  let event;
  try {
    event = JSON.parse(text);
  } catch {
    continue;
  }
  const content = event?.message?.content;
  if (!Array.isArray(content)) continue;
  for (const block of content) {
    if (block?.type !== "tool_use") continue;
    serializedInputs.push(JSON.stringify(block.input ?? {}));
  }
}

const matchedNeedle = anyOf.find((needle) => serializedInputs.some((input) => input.includes(needle)));
const result = matchedNeedle !== undefined;
const evidence = result
  ? `a tool call's own input contained "${matchedNeedle}"`
  : `none of the transcript's ${serializedInputs.length} tool input(s) contained any of [${anyOf.map((needle) => `"${needle}"`).join(", ")}]`;

process.stdout.write(`${JSON.stringify({ result, evidence })}\n`);
