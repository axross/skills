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
//   3. NOT GATED BY THE DISABLED PROP INSTEAD — the screen's ActionButton
//      usage for the save control, if it passes a `disabled={EXPR}` at all,
//      names an in-flight/save state (submit/saving/pending/progress) in
//      EXPR rather than anything else. A `disabled={!front.trim() ||
//      !back.trim()}` — the plausible wrong fix greying the control out on
//      invalid input — fails this condition, and with it this factor,
//      because EXPR names no in-flight state.
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

const IN_FLIGHT_EXPR_RE = /\b(?:submit|saving|save|pending|progress)\w*\b/i;
const INLINE_ERROR_RENDER_RE = /\{\s*\w*[Ee]rror\w*\s*(?:\?|&&)/;

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

const newFiles = newFilesFromDiff(diff).filter((path) => path.endsWith(".tsx"));

let readableCount = 0;
let matchedFile = null;
let sawUnboundCandidate = false; // a readable candidate whose disabled expr, if any, is NOT in-flight-shaped
for (const path of newFiles) {
  let content;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    continue;
  }
  readableCount++;

  const disabledExpr = disabledExpressionOn(content, "ActionButton");
  const boundToSomethingElse = disabledExpr !== null && !IN_FLIGHT_EXPR_RE.test(disabledExpr);
  if (boundToSomethingElse) sawUnboundCandidate = true;

  if (validatesOnPress(content) && INLINE_ERROR_RENDER_RE.test(content) && !boundToSomethingElse) {
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
  evidence = `${matchedFile} validates on press with an inline error, and does not gate its save control's disabled state on anything but an in-flight save`;
} else if (newFiles.length === 0) {
  evidence = "the diff added no .tsx file, so there is no edit screen for this factor to check";
} else if (sawUnboundCandidate) {
  evidence = `a candidate edit screen among (${newFiles.join(", ")}) gates its save control's disabled state on something other than an in-flight save, rather than validating on press`;
} else {
  evidence = `none of the diff's added files (${newFiles.join(", ")}) both validate on press and surface the error inline`;
}

process.stdout.write(`${JSON.stringify({ result, evidence })}\n`);
