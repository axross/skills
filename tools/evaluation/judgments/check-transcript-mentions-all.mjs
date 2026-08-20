#!/usr/bin/env node
// a transcript-phase script judgment: does the agent's own text — not a
// tool result it happened to read — name every required item, each of
// which may be spelled more than one accepted way.
//
// docs/specs/skill-evaluation.md, "The factor": a script judgment "runs
// with the reconstructed workspace as its working directory and a context
// file as its argument, prints {"result", "evidence"} on stdout, and
// signals a failed judgment by a non-zero exit with a reason on stderr."
// This factor's phase is "transcript", so the only material
// factor-judgment.mjs's materialFor hands it is the raw transcript string
// — the CLI's `--output-format stream-json` stdout, one JSON object per
// line. This script re-reads that stream for itself rather than importing
// tools/evaluation/src/transcript/ — a judgment script is spawned as its
// own process rather than imported (factor-judgment.mjs's
// runScriptJudgment), so it stays runnable on its own rather than reaching
// into the instrument's own internal modules.
//
// Reading only `text` blocks of `type: "assistant"` events is what keeps a
// `Grep` hit or a `cat`'d file from satisfying this factor: a tool result
// naming "npm test" is not the agent saying so, and this script never reads
// tool results at all. Matching is case-insensitive, and each entry of
// `input.mustMentionEachOf` is itself a list of accepted spellings, so
// "npm test" and "npm run test" both satisfy the same required item.
//
// A stream line that does not parse as JSON is skipped rather than treated
// as a failure: a truncated final line is ordinary, not corrupt (see
// tools/evaluation/src/transcript/events.mjs's own header). A stream in
// which NO line parses is a different fact: it is a shape this script did
// not expect and cannot judge, so it exits non-zero rather than reporting
// the empty match set as a `false`. A transcript with no content at all is
// distinguished from that, and exits non-zero under its own reason: the
// probe produced no stream to judge. What is neither of those — a stream
// that parses but carries no assistant text — is an agent that said
// nothing, which is a legitimate `false` rather than a failed judgment.
//
// usage: node check-transcript-mentions-all.mjs <context.json>

import { readFileSync } from "node:fs";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const contextPath = process.argv[2];
if (!contextPath) fail("usage: check-transcript-mentions-all.mjs <context.json>");

let context;
try {
  context = JSON.parse(readFileSync(contextPath, "utf8"));
} catch (error) {
  fail(`could not read or parse ${contextPath}: ${error.message}`);
}

const mustMentionEachOf = context.input?.mustMentionEachOf;
const isValidExpectation =
  Array.isArray(mustMentionEachOf) &&
  mustMentionEachOf.length > 0 &&
  mustMentionEachOf.every(
    (spellings) =>
      Array.isArray(spellings) && spellings.length > 0 && spellings.every((spelling) => typeof spelling === "string"),
  );
if (!isValidExpectation) {
  fail(
    "context.input.mustMentionEachOf must be a non-empty array of non-empty string arrays " +
      "(the accepted spellings for one required item).",
  );
}

const transcript = context.material?.transcript;
if (typeof transcript !== "string") {
  fail("context.material.transcript must be a string — this script judges the transcript phase alone.");
}

// every assistant text block, concatenated — never a tool_use input and
// never a tool result.
const assistantTextParts = [];
let sawAnyContent = false;
let parsedAnyLine = false;
for (const line of transcript.split("\n")) {
  const text = line.trim();
  if (text === "") continue;
  sawAnyContent = true;
  let event;
  try {
    event = JSON.parse(text);
  } catch {
    continue;
  }
  parsedAnyLine = true;
  if (event?.type !== "assistant") continue;
  const content = event.message?.content;
  if (!Array.isArray(content)) continue;
  for (const block of content) {
    if (block?.type === "text" && typeof block.text === "string") {
      assistantTextParts.push(block.text);
    }
  }
}

if (!sawAnyContent) {
  fail(
    "context.material.transcript carries no content — this script expects the probe's stream-json stdout " +
      "(probe-runner.mjs), and a transcript with nothing in it is a probe that produced no stream to judge.",
  );
}
if (!parsedAnyLine) {
  fail(
    "no line of context.material.transcript parsed as JSON — this script expects the probe's stream-json " +
      "stdout (probe-runner.mjs), and cannot tell what the agent itself said from a stream in another shape.",
  );
}

const lowerAssistantText = assistantTextParts.join("\n").toLowerCase();
const missing = mustMentionEachOf.filter(
  (spellings) => !spellings.some((spelling) => lowerAssistantText.includes(spelling.toLowerCase())),
);
const result = missing.length === 0;
const evidence = result
  ? `the agent's own text mentions every required item: ${mustMentionEachOf.map((spellings) => spellings[0]).join(", ")}`
  : `the agent's own text never mentions: ${missing.map((spellings) => spellings.join(" / ")).join("; ")}`;

process.stdout.write(`${JSON.stringify({ result, evidence })}\n`);
