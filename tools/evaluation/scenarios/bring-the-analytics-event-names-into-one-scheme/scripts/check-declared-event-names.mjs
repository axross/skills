#!/usr/bin/env node
// an outcome-phase script judgment: do the event names one TypeScript
// interface declares all share the same scheme fingerprint — a name's word
// separator (space, underscore, hyphen, or a camelCase boundary) paired with
// its capitalization pattern (lower, upper, title, sentence, or mixed). It
// asserts no particular scheme: software-instrumentation asks for one
// written convention applied across every event, never a specific spelling,
// so this script computes each declared name's own fingerprint and compares
// names to EACH OTHER rather than against a fixed expected string.
//
// Why read the interface rather than grep the file for a chosen scheme's own
// substring (e.g. "_"): a factor that only checked for one convention would
// fail a model that picked Title Case or camelCase instead, even though
// either is a perfectly good single scheme. Comparing fingerprints to each
// other, not to a constant, is what lets any self-consistent scheme pass.
//
// Why this file and not the call sites: this scenario's sibling script,
// check-call-site-event-names.mjs, reads the literal strings `trackEvent`
// is actually called with; this script reads the keys the `Events`
// interface declares instead, because `trackEvent<Name extends keyof
// Events>` makes the two sets agree by *compilation* — a fix that renames
// every emitted name at its call site but forgets the type's own keys (or
// the reverse) would look consistent to either check read alone.
// tools/evaluation/mocks/README.md names the reason the two stay separate:
// "a name that existed only in the event type would leave the _exercised_
// convention perfectly consistent, which is the opposite of what is wanted
// here." Two factors, each reading one side, is what lets a fix that moved
// only one of them still fail — and names which.
//
// This is a textual scan of the interface body, not a TypeScript parser: it
// finds "interface <name> {", then tracks brace depth to isolate each
// top-level member — so a member's own nested object type, e.g.
// `{ site_slug: string; post_id: number }`, is never mistaken for a second
// top-level key — and reads the key as whatever precedes ":" once trimmed,
// quoted or bare. A member whose key does not fit one of the four named
// capitalization patterns is not an error: its fingerprint simply ends in
// "mixed", which by construction cannot equal any other name's fingerprint,
// so it correctly keeps the factor from passing rather than being silently
// skipped. A comment inside the interface body, a key using a delimiter
// this script does not name, or a value type this reader's brace-counting
// cannot balance (an unterminated string containing a brace, for instance)
// are known gaps this script does not attempt to cover — none of them
// appears in this mock's own Events interface. "interface <name> {" with
// no such block found is a real `false` — the file is there and readable,
// and it simply declares no names for this factor to read. A block that
// opens but never closes is the different case: this reader's own
// brace-counting cannot tell where the interface ends, so that one stays a
// judgment this script cannot make.
//
// usage: node check-declared-event-names.mjs <context.json>

import { readFileSync } from "node:fs";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const contextPath = process.argv[2];
if (!contextPath) fail("usage: check-declared-event-names.mjs <context.json>");

let context;
try {
  context = JSON.parse(readFileSync(contextPath, "utf8"));
} catch (error) {
  fail(`could not read or parse ${contextPath}: ${error.message}`);
}

const { file, interfaceName, expectedCount } = context.input ?? {};
if (typeof file !== "string" || file.length === 0) {
  fail("context.input.file must be a non-empty, workspace-relative path.");
}
if (typeof interfaceName !== "string" || interfaceName.length === 0) {
  fail("context.input.interfaceName must be a non-empty string.");
}
if (!Number.isInteger(expectedCount) || expectedCount <= 0) {
  fail("context.input.expectedCount must be a positive integer.");
}

let content;
try {
  content = readFileSync(file, "utf8");
} catch (error) {
  fail(`could not read ${file} from the reconstructed workspace: ${error.message}`);
}

const openPattern = new RegExp(`\\binterface\\s+${interfaceName}\\b[^{]*\\{`);
const openMatch = openPattern.exec(content);
if (!openMatch) {
  const evidence = `${file} declares no "interface ${interfaceName}" block.`;
  process.stdout.write(`${JSON.stringify({ result: false, evidence })}\n`);
  process.exit(0);
}

// walk forward from the matched "{" counting brace depth, so the block ends
// at the "}" that actually closes the interface rather than the first "}" a
// member's own nested object type happens to contain.
let depth = 1;
let cursor = openMatch.index + openMatch[0].length;
const bodyStart = cursor;
for (; cursor < content.length && depth > 0; cursor++) {
  if (content[cursor] === "{") depth++;
  else if (content[cursor] === "}") depth--;
}
if (depth !== 0) {
  fail(`${file}'s "interface ${interfaceName}" block never closes — this factor cannot read it.`);
}
const body = content.slice(bodyStart, cursor - 1);

// split the body into top-level members on ";" seen at brace depth 0, so a
// member's own nested object type is never mistaken for the end of the
// member — the same depth-tracking read used to find the block above,
// applied one level in.
const members = [];
let memberDepth = 0;
let segmentStart = 0;
for (let i = 0; i < body.length; i++) {
  const ch = body[i];
  if (ch === "{") memberDepth++;
  else if (ch === "}") memberDepth--;
  else if (ch === ";" && memberDepth === 0) {
    members.push(body.slice(segmentStart, i));
    segmentStart = i + 1;
  }
}
const tail = body.slice(segmentStart).trim();
if (tail.length > 0) members.push(tail);

const KEY_RE = /^\s*(?:"([^"]+)"|'([^']+)'|([A-Za-z_$][A-Za-z0-9_$]*))\s*\??\s*:/;
const names = [];
for (const member of members) {
  const match = KEY_RE.exec(member);
  if (match) names.push(match[1] ?? match[2] ?? match[3]);
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
    // every word after the first is capitalized by construction, so only the first
    // word's case distinguishes lowerCamelCase from PascalCase. anything else — a
    // lowercase/all-caps middle word (impossible from the split), or an "other" first
    // word — is reported as not fitting a named pattern, never guessed at.
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

if (names.length !== expectedCount) {
  const evidence =
    `"interface ${interfaceName}" in ${file} declares ${names.length} name(s) ` +
    `(${names.map((name) => JSON.stringify(name)).join(", ")}), not the expected ${expectedCount}.`;
  process.stdout.write(`${JSON.stringify({ result: false, evidence })}\n`);
  process.exit(0);
}

const fingerprints = names.map(schemeFingerprint);
const result = fingerprints.every((fingerprint) => fingerprint === fingerprints[0]);
const evidence = result
  ? `every declared name shares one scheme fingerprint (${fingerprints[0]}): ${names.map((name) => JSON.stringify(name)).join(", ")}`
  : `the declared names do not share one scheme: ${names
      .map((name, index) => `${JSON.stringify(name)} (${fingerprints[index]})`)
      .join(", ")}`;

process.stdout.write(`${JSON.stringify({ result, evidence })}\n`);
