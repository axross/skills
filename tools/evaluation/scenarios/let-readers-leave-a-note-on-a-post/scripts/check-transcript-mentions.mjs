#!/usr/bin/env node
// a transcript-phase script judgment: did the agent ITSELF say any of a
// small set of phrases, checked case-insensitively.
//
// docs/specs/skill-evaluation.md, "Three phases": a transcript factor is
// shown the transcript alone — factor-judgment.mjs's materialFor hands
// this script exactly {"transcript": "..."} and nothing else, never the
// diff or the skill invocations, so this script has no reconstructed
// workspace to read and does not try to.
//
// what it does NOT scan is the load-bearing part. probe-runner.mjs stores
// the CLI's whole redacted stream-json stdout as the transcript, so every
// file the agent read is in there verbatim, tool result and all. A plain
// substring scan over that text therefore fires on what the agent READ,
// not on what it worked out — and in this scenario the installed peer
// skills' own bodies carry the very phrases this factor looks for, in
// both conditions, so a scan of the whole transcript would answer itself.
// This script parses the stream as JSONL instead and scans only the text
// blocks of `assistant` events: the agent's own words.
//
// a line that does not parse as JSON is skipped rather than fatal — a
// truncated final line is ordinary, and transcript/events.mjs's own reader
// treats it the same way. A stream in which NO line parses is a shape this
// script did not expect and cannot judge, so it exits non-zero; a stream
// that parses but carries no assistant text is an agent that said nothing,
// which is a legitimate `false` rather than a failed judgment.
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

const { anyOf } = context.input ?? {};
if (!Array.isArray(anyOf) || anyOf.length === 0 || !anyOf.every((p) => typeof p === "string" && p.length > 0)) {
  fail("context.input.anyOf must be a non-empty array of non-empty strings.");
}

const transcript = context.material?.transcript;
if (typeof transcript !== "string") {
  fail(
    "context.material.transcript must be a string — this script judges the transcript phase alone, and a " +
      "transcript-phase factor is handed exactly that (factor-judgment.mjs's materialFor).",
  );
}

/** the text blocks of every `assistant` event, in order — the agent's own words, never a tool's output. */
function assistantText(stream) {
  const said = [];
  let parsedAnyLine = false;

  for (const line of stream.split("\n")) {
    const text = line.trim();
    if (text === "") continue;

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
      if (block?.type === "text" && typeof block.text === "string") said.push(block.text);
    }
  }

  return { said, parsedAnyLine };
}

const { said, parsedAnyLine } = assistantText(transcript);
if (!parsedAnyLine) {
  fail(
    "no line of context.material.transcript parsed as JSON — this script expects the probe's stream-json " +
      "stdout (probe-runner.mjs), and cannot tell what the agent itself said from a stream in another shape.",
  );
}

const lowered = said.join("\n").toLowerCase();
const matched = anyOf.find((phrase) => lowered.includes(phrase.toLowerCase()));
const result = matched !== undefined;
const evidence = result
  ? `the agent's own messages contain "${matched}" (matched case-insensitively, across ${said.length} assistant text block(s))`
  : `the agent's own messages (${said.length} assistant text block(s)) contain none of: ${anyOf.join(", ")} ` +
    "(matched case-insensitively); text the agent only read is deliberately out of scope";

process.stdout.write(`${JSON.stringify({ result, evidence })}\n`);
