#!/usr/bin/env node
// an outcome-phase script judgment: do the event names one or more call
// sites actually pass to `trackEvent(...)` all share the same scheme
// fingerprint — a name's word separator (space, underscore, hyphen, or a
// camelCase boundary) paired with its capitalization pattern (lower, upper,
// title, sentence, or mixed). It asserts no particular scheme, the same as
// its sibling script, check-declared-event-names.mjs: fingerprints are
// compared to each other, never to a fixed expected string, so any
// self-consistent convention passes.
//
// Why several files rather than one: the three literal names this scenario
// asks about are not emitted from one place — two fire from
// src/routes/PostEditorPage.tsx (the editor's save and publish flows) and
// the third from src/routes/Layout.tsx (the sidebar's site switcher).
// `context.expect.files` names every file this factor reads, so a fix that
// brings the editor's own two names into a scheme while leaving the
// switcher's untouched (or the reverse) is read correctly rather than
// missed because only one file was checked.
//
// Why read the call sites at all, rather than trust the declared type alone
// (this scenario's sibling factor's own subject): `trackEvent<Name extends
// keyof Events>` makes the declared keys and the emitted names agree by
// *compilation*, so a fix that renames the `Events` interface's keys but
// leaves a call site's own string literal exactly as it was would still
// type-check — and would satisfy a check of the type alone while emitting
// the old, inconsistent name at runtime. tools/evaluation/mocks/README.md
// names this directly: "a name that existed only in the event type would
// leave the _exercised_ convention perfectly consistent, which is the
// opposite of what is wanted here." Reading the call sites is what a check
// of the type cannot do on its own.
//
// This is a textual scan for `trackEvent(` immediately followed by a
// single- or double-quoted string literal, not a TypeScript parser or a
// call-graph walk: `trackEvent<Name extends keyof Events>(name: Name, ...)`
// in analytics.ts itself never matches, since a generic type parameter sits
// between the name and the opening parenthesis there, but a name passed
// through a local variable, a template literal, or a wrapper function this
// script has not been told to look inside would not be recognized as a
// literal — a known limitation, since every call site this mock actually
// has passes a plain quoted string directly. Finding literally zero
// `trackEvent(` calls with a literal first argument across every named file
// is treated as this factor having nothing to judge; finding some but not
// the expected count is a real, reportable mismatch rather than an error.
//
// usage: node check-call-site-event-names.mjs <context.json>

import { readFileSync } from "node:fs";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const contextPath = process.argv[2];
if (!contextPath) fail("usage: check-call-site-event-names.mjs <context.json>");

let context;
try {
  context = JSON.parse(readFileSync(contextPath, "utf8"));
} catch (error) {
  fail(`could not read or parse ${contextPath}: ${error.message}`);
}

const { files, expectedCount } = context.expect ?? {};
if (!Array.isArray(files) || files.length === 0) {
  fail("context.expect.files must be a non-empty array of workspace-relative paths.");
}
for (const file of files) {
  if (typeof file !== "string" || file.length === 0) {
    fail("context.expect.files must contain only non-empty strings.");
  }
}
if (!Number.isInteger(expectedCount) || expectedCount <= 0) {
  fail("context.expect.expectedCount must be a positive integer.");
}

const CALL_RE = /\btrackEvent\(\s*(["'])((?:\\.|(?!\1).)*)\1/g;

const found = []; // { file, name }
for (const file of files) {
  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch (error) {
    fail(`could not read ${file} from the reconstructed workspace: ${error.message}`);
  }
  for (const match of content.matchAll(CALL_RE)) {
    found.push({ file, name: match[2] });
  }
}

if (found.length === 0) {
  fail(
    `none of ${files.join(", ")} contains a trackEvent( call with a literal first argument — ` +
      "this factor has no emitted names to judge.",
  );
}

/**
 * a name's scheme fingerprint: its word separator paired with its
 * capitalization pattern. Two names share a scheme exactly when their
 * fingerprints are the same string.
 *
 * @param {string} name
 * @returns {string}
 */
function schemeFingerprint(name) {
  let separator;
  let words;
  if (name.includes(" ")) {
    separator = "space";
    words = name.split(" ").filter((word) => word.length > 0);
  } else if (name.includes("_")) {
    separator = "underscore";
    words = name.split("_").filter((word) => word.length > 0);
  } else if (name.includes("-")) {
    separator = "hyphen";
    words = name.split("-").filter((word) => word.length > 0);
  } else {
    // no explicit delimiter: read word boundaries from letter-case
    // transitions instead — the fourth separator this scenario's system
    // design names. A name with no internal transition (all one case, e.g.
    // "publish") produces a single word, which still classifies below.
    separator = "camel";
    words = name.split(/(?=[A-Z])/).filter((word) => word.length > 0);
  }

  if (words.length === 0) return `${separator}:empty`;

  const wordCase = (word) => {
    if (/^[a-z0-9]+$/.test(word)) return "lower";
    if (/^[A-Z0-9]+$/.test(word)) return "upper";
    if (/^[A-Z][a-z0-9]*$/.test(word)) return "capitalized";
    return "other";
  };
  const cases = words.map(wordCase);

  if (separator === "camel") {
    // every word after the first is capitalized by construction — that is
    // how the split above found it — so only the first word's own case
    // distinguishes lowerCamelCase from PascalCase; anything else (a
    // lowercase or all-caps word in the middle, which the split could not
    // actually produce, or a first word this classifier calls "other") is
    // reported as not fitting a named pattern rather than guessed at.
    const restFit = cases.slice(1).every((c) => c === "capitalized");
    if (restFit && cases[0] === "lower") return "camel:lower";
    if (restFit && cases[0] === "capitalized") return "camel:title";
    return "camel:mixed";
  }

  if (cases.every((c) => c === "lower")) return `${separator}:lower`;
  if (cases.every((c) => c === "upper")) return `${separator}:upper`;
  if (cases.every((c) => c === "capitalized")) return `${separator}:title`;
  if (cases[0] === "capitalized" && cases.slice(1).every((c) => c === "lower")) {
    return `${separator}:sentence`;
  }
  return `${separator}:mixed`;
}

if (found.length !== expectedCount) {
  const evidence =
    `${files.join(", ")} together contain ${found.length} trackEvent( call(s) with a literal first argument ` +
    `(${found.map((f) => `${JSON.stringify(f.name)} in ${f.file}`).join(", ")}), not the expected ${expectedCount}.`;
  process.stdout.write(`${JSON.stringify({ result: false, evidence })}\n`);
  process.exit(0);
}

const fingerprints = found.map((f) => schemeFingerprint(f.name));
const result = fingerprints.every((fingerprint) => fingerprint === fingerprints[0]);
const evidence = result
  ? `every emitted name shares one scheme fingerprint (${fingerprints[0]}): ${found.map((f) => `${JSON.stringify(f.name)} in ${f.file}`).join(", ")}`
  : `the emitted names do not share one scheme: ${found
      .map((f, index) => `${JSON.stringify(f.name)} in ${f.file} (${fingerprints[index]})`)
      .join(", ")}`;

process.stdout.write(`${JSON.stringify({ result, evidence })}\n`);
