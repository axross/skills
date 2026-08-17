#!/usr/bin/env node
// an outcome-phase script judgment: did the probe's diff add a
// self-contained HTML document that actually answers THIS screen's own
// question, rather than a generic or leftover template.
//
// docs/specs/skill-evaluation.md, "Three phases": an outcome factor is
// handed the diff and the task. This script reads the diff's added-file
// list to find candidate HTML documents, then reads each candidate back
// from the reconstructed workspace (this process's own cwd — see this
// scenario's scenario.json and factor-judgment.mjs's runScriptJudgment) to
// check it.
//
// Two checks, both on the whole raw document text:
//
// 1. Self-containment: no `src`/`srcset` attribute, `<link href>`, CSS
//    `@import`, or CSS `url(...)` pointing at an `http:`, `https:`, or
//    protocol-relative host. This mirrors what
//    skills/wireframe-design/scripts/check-wireframe.mjs enforces, but is
//    re-implemented here rather than imported or read from skills/ — see
//    this scenario's own README-adjacent plan: a later edit to the skill's
//    validator must not silently change what a stored measurement meant,
//    and no judgment script in this repository may read a path under
//    skills/ at all.
// 2. Subject-naming: the document must contain at least one of
//    context.expect.subjectTerms (case-insensitive substring) — words drawn
//    from THIS task's own subject (posts, drafts, published counts), not
//    from the wireframe-design skill's vocabulary. A run that answered by
//    building a real React screen, by writing prose, or by leaving the
//    unfilled kit's own instructional boilerplate untouched (which never
//    mentions posts or drafts at all) produces no passing candidate.
//
// Multiple added HTML files are tolerated: this factor passes if AT LEAST
// ONE satisfies both checks, naming that file as its evidence.
//
// The diff naming an added HTML file that the reconstructed workspace does
// not actually contain is a judgment this script cannot make (something is
// inconsistent between the stored diff and the stored workspace), so that
// exits non-zero rather than reporting false — as distinct from the diff
// adding no HTML file at all, which is a real, judgeable false.
//
// usage: node check-self-contained-sketch.mjs <context.json>

import { readFileSync } from "node:fs";
import { readAddedHtmlFiles } from "./lib/added-files.mjs";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const contextPath = process.argv[2];
if (!contextPath) fail("usage: check-self-contained-sketch.mjs <context.json>");

let context;
try {
  context = JSON.parse(readFileSync(contextPath, "utf8"));
} catch (error) {
  fail(`could not read or parse ${contextPath}: ${error.message}`);
}

const diff = context.material?.diff;
if (typeof diff !== "string") {
  fail("context.material.diff must be a string — this script judges the outcome phase alone.");
}

const subjectTerms = context.expect?.subjectTerms;
if (!Array.isArray(subjectTerms) || subjectTerms.length === 0) {
  fail("context.expect.subjectTerms must be a non-empty array of case-insensitive substrings.");
}

/**
 * true when a resource URL points off the page — an absolute http(s) URL or
 * a protocol-relative `//host` reference. In-page anchors, `data:`
 * payloads, and relative paths are self-contained.
 * @param {string} url
 */
function isExternalUrl(url) {
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) || /^\/\//.test(trimmed);
}

/**
 * collects every external-fetch failure in `text` — the same four shapes
 * skills/wireframe-design/scripts/check-wireframe.mjs checks, reimplemented
 * here rather than read from that path.
 * @param {string} text
 * @returns {string[]}
 */
function externalFetchFailures(text) {
  const failures = [];
  for (const m of text.matchAll(/\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    if (isExternalUrl(m[1])) failures.push(`src="${m[1]}"`);
  }
  for (const m of text.matchAll(/\bsrcset\s*=\s*["']([^"']+)["']/gi)) {
    for (const candidate of m[1].split(",")) {
      const url = candidate.trim().split(/\s+/)[0];
      if (url && isExternalUrl(url)) failures.push(`srcset="${url}"`);
    }
  }
  for (const m of text.matchAll(/<link\b[^>]*?\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    if (isExternalUrl(m[1])) failures.push(`<link href="${m[1]}">`);
  }
  for (const m of text.matchAll(/@import\s+(?:url\(\s*)?["']?([^"')]+)/gi)) {
    if (isExternalUrl(m[1])) failures.push(`@import "${m[1]}"`);
  }
  for (const m of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
    if (isExternalUrl(m[1])) failures.push(`url(${m[1]})`);
  }
  return failures;
}

const { candidates: htmlCandidates, readable, unreadable } = readAddedHtmlFiles(diff);

if (htmlCandidates.length === 0) {
  const evidence =
    "the diff added no HTML document at all — no self-contained sketch of the screen was produced for this task";
  process.stdout.write(`${JSON.stringify({ result: false, evidence })}\n`);
  process.exit(0);
}

if (readable.length === 0) {
  fail(
    `the diff added ${htmlCandidates.length} HTML path(s) that the reconstructed workspace does not actually contain: ${unreadable.join("; ")}`,
  );
}

const perFile = readable.map(({ path, content }) => {
  const fetchFailures = externalFetchFailures(content);
  const lower = content.toLowerCase();
  const matchedTerm = subjectTerms.find((term) => lower.includes(term.toLowerCase()));
  const passes = fetchFailures.length === 0 && matchedTerm !== undefined;
  return { path, passes, fetchFailures, matchedTerm };
});

const passing = perFile.find((entry) => entry.passes);

const result = passing !== undefined;
const evidence = result
  ? `${passing.path} fetches nothing external and names its subject via "${passing.matchedTerm}"`
  : perFile
      .map(({ path, fetchFailures, matchedTerm }) => {
        const reasons = [];
        if (fetchFailures.length > 0) reasons.push(`fetches external resource(s): ${fetchFailures.join(", ")}`);
        if (matchedTerm === undefined) {
          reasons.push(`contains none of the expected subject terms (${subjectTerms.join(", ")})`);
        }
        return `${path}: ${reasons.join("; ")}`;
      })
      .join(" | ");

process.stdout.write(`${JSON.stringify({ result, evidence })}\n`);
