#!/usr/bin/env node
// an outcome-phase script judgment: the "what had to not" companion to
// check-in-flight-disabled-save-control.mjs. Checks that the new edit-card
// screen still surfaces a validation problem inline on press — the way
// new-card-screen.tsx already does — rather than solving the disabled-state
// ask the wrong way: greying the save control out until every field is
// valid.
//
// docs/specs/skill-evaluation.md, "Three phases": an outcome factor is
// handed the diff and the task. The diff is read here only to find WHICH
// file is the new edit screen, exactly as this scenario's sibling script
// does — see that script's own header for why no path is named in
// scenario.json.
//
// A file counts as the edit screen for this factor's purposes when all
// three hold:
//
//   1. VALIDATES ON PRESS — some `if (...) { ... }` block whose body both
//      calls a setXError-shaped state setter and returns, the same shape
//      new-card-screen.tsx:54-57 already has (`if (!front.trim() ||
//      !back.trim()) { setError(...); return; }`).
//   2. SURFACES THE ERROR INLINE — a JSX conditional that renders on a
//      variable whose name contains "error" (`{error ? ... : null}` or
//      `{error && ...}`), the same shape that block's own render already
//      has.
//   3. NOT COUPLED TO FIELD VALIDITY — the screen's ActionButton usage for
//      the save control, if it passes a `disabled={EXPR}` at all, must not
//      reference the screen's own field-state (an identifier also passed as
//      `value={...}` to some field component in the same file, e.g. `front`
//      or `back`) or call `.trim()`/`.length` inside EXPR. This is a
//      positive detection of validity-coupling, not merely the absence of
//      an in-flight term: an expression may legitimately name an in-flight
//      state AND still fail this condition, because a combined guard —
//      `disabled={saving || !front.trim() || !back.trim()}` — greys the
//      control out on invalid input exactly as much as a validity-only one
//      does, layered under a legitimate-looking in-flight term. Whether
//      EXPR names an in-flight state at all is
//      check-in-flight-disabled-save-control.mjs's own claim, not this
//      one's; that script does not require exclusivity either, precisely
//      because this script is what catches the combination.
//
// Limitation, stated rather than hidden: a validity check laundered through
// a derived, differently-named boolean the disabled expression alone
// references (`const isValid = front.trim() && back.trim(); ...
// disabled={!isValid}`) is caught by neither signal above and would pass
// this factor undetected. What this heuristic deliberately does NOT do:
// treat a bare negated identifier (`disabled={!ready}`, `disabled={!saving}`)
// as validity-shaped by itself. A negated boolean is exactly as likely to be
// a legitimate, if unusually named or polarized, in-flight flag as a
// validity check, and over-rejecting that shape would fail correct work —
// the defect a broader "any `!identifier`" pattern would have introduced.
//
// Same limitation as its sibling script: the `if` and `disabled={...}`
// extraction assumes no nested `{}` inside either, true of every precedent
// in this codebase today.
//
// A diff that added no .tsx file at all is a legitimate `false` — there is
// no edit screen for "still validates" to be true of — not an error; see
// this scenario's sibling script for why. A diff naming new files the
// reconstructed workspace does not actually have is the missing-material
// case this factor exits non-zero for instead.
//
// usage: node check-validates-on-press.mjs <context.json>

import { readFileSync } from "node:fs";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const contextPath = process.argv[2];
if (!contextPath) fail("usage: check-validates-on-press.mjs <context.json>");

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

/**
 * paths the diff created as new files, read from its own "--- /dev/null"
 * markers rather than assumed from any one hunk shape.
 * @returns {string[]}
 */
function newFilesFromDiff(diffText) {
  const lines = diffText.split("\n");
  const files = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] !== "--- /dev/null") continue;
    const next = lines[i + 1];
    if (next && next.startsWith("+++ ")) {
      files.push(next.slice(4).replace(/^b\//, "").trim());
    }
  }
  return files;
}

/** the attribute text of every `<tagName ...>` opening tag in `content`. */
function jsxOpeningTags(content, tagName) {
  const re = new RegExp(`<${tagName}\\b([\\s\\S]*?)>`, "g");
  const tags = [];
  let match;
  while ((match = re.exec(content)) !== null) {
    tags.push(match[1]);
  }
  return tags;
}

const INLINE_ERROR_RENDER_RE = /\{\s*\w*[Ee]rror\w*\s*(?:\?|&&)/;
const VALIDITY_METHOD_RE = /\.trim\(\)|\.length\b/;

/** whether `content` contains a single-level `if (...) { ... }` block that both sets an error and returns. */
function validatesOnPress(content) {
  const re = /if\s*\([^{]*\)\s*\{([^}]*)\}/g;
  let match;
  while ((match = re.exec(content)) !== null) {
    const body = match[1];
    if (/\bset\w*[Ee]rror\w*\(/.test(body) && /\breturn\b/.test(body)) return true;
  }
  return false;
}

/** the ActionButton `disabled={...}` expression in `content`, or null if none is passed. */
function disabledExpressionOn(content, tagName) {
  const tags = jsxOpeningTags(content, tagName);
  for (const tag of tags) {
    const match = tag.match(/\bdisabled\s*=\s*\{([^}]*)\}/);
    if (match) return match[1];
  }
  return null;
}

/**
 * every bare identifier passed as `value={IDENT}` anywhere in `content` —
 * the screen's own field-state, on the same convention every field in this
 * codebase already follows (`<TextField label="Front" value={front} .../>`).
 * Not scoped to one component name, so a future field-shaped component
 * beside TextField is picked up the same way.
 * @returns {Set<string>}
 */
function fieldStateIdentifiers(content) {
  const re = /\bvalue\s*=\s*\{\s*([A-Za-z_$][\w$]*)\s*\}/g;
  const ids = new Set();
  let match;
  while ((match = re.exec(content)) !== null) {
    ids.add(match[1]);
  }
  return ids;
}

/**
 * whether `expr` couples to field validity — a positive detection of the
 * specific pattern this factor exists to catch, not merely the absence of
 * an in-flight term. See this file's own header for what this can and
 * cannot tell apart.
 * @param {string} expr
 * @param {Set<string>} fieldIds
 */
function isValidityCoupled(expr, fieldIds) {
  if (VALIDITY_METHOD_RE.test(expr)) return true;
  for (const id of fieldIds) {
    if (new RegExp(`\\b${id}\\b`).test(expr)) return true;
  }
  return false;
}

const newFiles = newFilesFromDiff(diff).filter((path) => path.endsWith(".tsx"));

let readableCount = 0;
let matchedFile = null;
let sawValidityCoupledCandidate = false; // a readable candidate whose disabled expr, if any, couples to field validity
for (const path of newFiles) {
  let content;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    continue;
  }
  readableCount++;

  const disabledExpr = disabledExpressionOn(content, "ActionButton");
  const boundToValidity = disabledExpr !== null && isValidityCoupled(disabledExpr, fieldStateIdentifiers(content));
  if (boundToValidity) sawValidityCoupledCandidate = true;

  if (validatesOnPress(content) && INLINE_ERROR_RENDER_RE.test(content) && !boundToValidity) {
    matchedFile = path;
    break;
  }
}

if (newFiles.length > 0 && readableCount === 0) {
  fail(
    `the diff names ${newFiles.length} new .tsx file(s) (${newFiles.join(", ")}) that the reconstructed ` +
      "workspace does not actually have — this factor cannot be judged.",
  );
}

const result = matchedFile !== null;

let evidence;
if (result) {
  evidence = `${matchedFile} validates on press with an inline error, and its save control's disabled state, if any, does not couple to field validity`;
} else if (newFiles.length === 0) {
  evidence = "the diff added no .tsx file, so there is no edit screen for this factor to check";
} else if (sawValidityCoupledCandidate) {
  evidence = `a candidate edit screen among (${newFiles.join(", ")}) gates its save control's disabled state on field validity, rather than validating on press`;
} else {
  evidence = `none of the diff's added files (${newFiles.join(", ")}) both validate on press and surface the error inline`;
}

process.stdout.write(`${JSON.stringify({ result, evidence })}\n`);
