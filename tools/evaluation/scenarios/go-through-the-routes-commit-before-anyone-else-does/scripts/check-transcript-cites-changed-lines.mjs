#!/usr/bin/env node
// a transcript-phase script judgment: does the agent's own text — not a
// tool result it happened to read — carry enough distinct `path:line`
// citations that resolve against the reviewed commit's own files.
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
// This script cannot tell a citation that sits inside a genuine finding
// from one that sits inside plain narration ("I read src/App.tsx:12 to see
// how routing was wired") — that distinction is not machine-checkable from
// the transcript alone. What it checks instead is anchoring, which
// code-review's own evidence rule makes a real, checkable property: every
// citation this script counts has to satisfy both halves: a path the
// reviewed commit actually touched, and a line that actually exists in
// that file as the reconstructed workspace holds it — a relationship
// checked against the workspace, not the presence of a word. A citation
// naming a real file at an invented line number, or an invented file, does
// not count.
//
// Reading only `text` blocks of `type: "assistant"` events is what keeps a
// citation printed by a `git show` or a `Grep` from counting as one the
// agent made — what a tool returned is not what the agent wrote, and this
// script never reads a tool result at all.
//
// Citation syntax: a repo-relative `path:line` or `path:line-line`, per
// code-review's own evidence-and-reporting rule ("MUST cite a `file:line`
// (or `file:line-line` for a range)"). For a range, both ends must resolve
// inside the cited file for the citation to count.
//
// A stream line that does not parse as JSON is skipped rather than treated
// as a failure: a truncated final line is ordinary, not corrupt (see
// tools/evaluation/src/transcript/events.mjs's own header).
//
// usage: node check-transcript-cites-changed-lines.mjs <context.json>

import { readFileSync } from "node:fs";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const contextPath = process.argv[2];
if (!contextPath) fail("usage: check-transcript-cites-changed-lines.mjs <context.json>");

let context;
try {
  context = JSON.parse(readFileSync(contextPath, "utf8"));
} catch (error) {
  fail(`could not read or parse ${contextPath}: ${error.message}`);
}

const { files, minimumDistinctCitations } = context.input ?? {};
if (!Array.isArray(files) || files.length === 0 || files.some((file) => typeof file !== "string")) {
  fail("context.input.files must be a non-empty array of repo-relative path strings.");
}
if (!Number.isInteger(minimumDistinctCitations) || minimumDistinctCitations < 1) {
  fail("context.input.minimumDistinctCitations must be a positive integer.");
}

const transcript = context.material?.transcript;
if (typeof transcript !== "string") {
  fail("context.material.transcript must be a string — this script judges the transcript phase alone.");
}

// every assistant text block, concatenated — never a tool_use input and
// never a tool result.
const assistantTextParts = [];
for (const line of transcript.split("\n")) {
  const text = line.trim();
  if (text === "") continue;
  let event;
  try {
    event = JSON.parse(text);
  } catch {
    continue;
  }
  if (event?.type !== "assistant") continue;
  const content = event.message?.content;
  if (!Array.isArray(content)) continue;
  for (const block of content) {
    if (block?.type === "text" && typeof block.text === "string") {
      assistantTextParts.push(block.text);
    }
  }
}
const assistantText = assistantTextParts.join("\n");

// a repo-relative path (at least one "/" and a file extension) followed by
// ":line" or ":line-line".
const CITATION_RE = /\b([\w./-]+\/[\w.-]+\.[A-Za-z0-9]+):(\d+)(?:-(\d+))?\b/g;

const fileSet = new Set(files);
const lineCounts = new Map(); // path -> number of lines in the workspace file, or null if unreadable

function lineCountFor(path) {
  if (lineCounts.has(path)) return lineCounts.get(path);
  let count = null;
  try {
    const content = readFileSync(path, "utf8");
    // a file ending in a newline should not count its trailing empty
    // "line" as an addressable one.
    const lines = content.split("\n");
    count = lines.length > 0 && lines[lines.length - 1] === "" ? lines.length - 1 : lines.length;
  } catch {
    count = null;
  }
  lineCounts.set(path, count);
  return count;
}

const validCitations = new Set();
const rejected = [];
for (const match of assistantText.matchAll(CITATION_RE)) {
  const [citation, path, startText, endText] = match;
  if (!fileSet.has(path)) continue; // not one of the reviewed commit's own files
  const start = Number(startText);
  const end = endText !== undefined ? Number(endText) : start;
  const total = lineCountFor(path);
  if (total === null) {
    rejected.push(`${citation} (could not read ${path} from the reconstructed workspace)`);
    continue;
  }
  if (start < 1 || end < 1 || start > total || end > total || start > end) {
    rejected.push(`${citation} (${path} has ${total} line(s))`);
    continue;
  }
  validCitations.add(citation);
}

const result = validCitations.size >= minimumDistinctCitations;
const evidence = result
  ? `${validCitations.size} distinct valid citation(s) against the reviewed commit's files: ${[...validCitations].join(", ")}`
  : `only ${validCitations.size} distinct valid citation(s) against the reviewed commit's files ` +
    `(need ${minimumDistinctCitations}): found [${[...validCitations].join(", ")}], rejected [${rejected.join(", ")}]`;

process.stdout.write(`${JSON.stringify({ result, evidence })}\n`);
