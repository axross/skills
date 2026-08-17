#!/usr/bin/env node
// an outcome-phase script judgment: does the reconstructed workspace give
// the app's shared tappable control a real in-flight disabled state, and
// does the new edit-card screen actually bind it to its own in-flight save.
//
// docs/specs/skill-evaluation.md, "Three phases": an outcome factor is
// handed the diff and the task. The diff is read here only to find WHICH
// file is the new edit screen — the scenario names no path for it, since
// the screen's own location is the agent's choice (see this scenario's own
// scenario.json description) — and the actual judgment is made by reading
// the reconstructed workspace (this process's own cwd), the same files the
// diff already put there.
//
// Two conditions:
//
//   1. THE CONTROL IS READY — src/ui/action-button.tsx, read by name because
//      it already exists and any fix has to touch it in place, must:
//        a. declare a `disabled` field on ActionButtonProps,
//        b. wire that field to the underlying Pressable's own `disabled`
//           prop (so it is not a prop that types but does nothing), and
//        c. carry a real visual treatment for it — a "disabled" entry in
//           the stylesheet's variants naming an actual style property
//           (opacity, backgroundColor, color, or borderColor), not just a
//           boolean toggled with no visible effect.
//   2. THE SCREEN BINDS IT — some file the diff newly added uses
//      <ActionButton ... disabled={EXPR} ...> where EXPR's own text names
//      an in-flight/save state (matched against submit/saving/pending/
//      progress, case-insensitively) rather than, say, field validity.
//      This is the check that keeps this factor distinct from its sibling
//      (still-validates-on-press-rather-than-gating-the-control.mjs's own
//      script), which is what catches a disabled expression bound to
//      validity instead.
//
// action-button.tsx is read by a fixed, known path — it already exists in
// every recall workspace, patch or no patch, so its absence means the
// reconstructed workspace itself is broken, which is a judgment this script
// cannot make and exits non-zero for, rather than reporting `false`. A new
// edit screen not existing at all is a different situation: a real,
// substantive `false` (the agent did not do the task), not an error.
//
// Limitation, stated rather than hidden: the disabled={EXPR} extraction
// assumes EXPR contains no unescaped `}` of its own — true of every prop
// value in this codebase today (`label={submitting ? "Adding…" : "Add card"}`
// is the closest precedent, and it is single-brace-nested only in the same
// way). An expression that nests an object literal would not be captured
// correctly.
//
// usage: node check-in-flight-disabled-save-control.mjs <context.json>

import { readFileSync } from "node:fs";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const contextPath = process.argv[2];
if (!contextPath) fail("usage: check-in-flight-disabled-save-control.mjs <context.json>");

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

const ACTION_BUTTON_PATH = "src/ui/action-button.tsx";
let actionButtonSource;
try {
  actionButtonSource = readFileSync(ACTION_BUTTON_PATH, "utf8");
} catch (error) {
  fail(`could not read ${ACTION_BUTTON_PATH} from the reconstructed workspace: ${error.message}`);
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

// --- 1. is the control itself ready? ---

const hasDisabledProp = /\bdisabled\??\s*:\s*boolean\b/.test(actionButtonSource);

const pressableTags = jsxOpeningTags(actionButtonSource, "Pressable");
const pressableUsesDisabled = pressableTags.some((tag) => /\bdisabled\s*=\s*\{/.test(tag));

function hasDisabledVisualTreatment(source) {
  const keyMatch = source.match(/\bdisabled\s*:\s*\{/);
  if (!keyMatch) return false;
  let depth = 1;
  let i = keyMatch.index + keyMatch[0].length;
  const start = i;
  while (i < source.length && depth > 0) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") depth--;
    i++;
  }
  const body = source.slice(start, i - 1);
  return /\b(opacity|backgroundColor|color|borderColor)\s*:/.test(body);
}

const hasVisualTreatment = hasDisabledVisualTreatment(actionButtonSource);
const controlReady = hasDisabledProp && pressableUsesDisabled && hasVisualTreatment;

// --- 2. does the new screen bind it to an in-flight save? ---

const newFiles = newFilesFromDiff(diff).filter((path) => path.endsWith(".tsx"));

const IN_FLIGHT_EXPR_RE = /\b(?:submit|saving|save|pending|progress)\w*\b/i;

// a diff naming zero new .tsx files is a real, judgeable "no edit screen was
// added" — a legitimate `false`, not an error (this scenario's whole task is
// new-file work, so nothing existed before the probe ran; see this script's
// own header). A diff naming new files that are then unreadable from the
// reconstructed workspace is the different case: the workspace does not
// hold what the diff claims it added, which is exactly the missing-material
// case this factor cannot judge through.
let readableCount = 0;
let boundInFile = null;
for (const path of newFiles) {
  let content;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    continue;
  }
  readableCount++;
  const tags = jsxOpeningTags(content, "ActionButton");
  for (const tag of tags) {
    const disabledMatch = tag.match(/\bdisabled\s*=\s*\{([^}]*)\}/);
    if (disabledMatch && IN_FLIGHT_EXPR_RE.test(disabledMatch[1])) {
      boundInFile = path;
      break;
    }
  }
  if (boundInFile) break;
}

if (newFiles.length > 0 && readableCount === 0) {
  fail(
    `the diff names ${newFiles.length} new .tsx file(s) (${newFiles.join(", ")}) that the reconstructed ` +
      "workspace does not actually have — this factor cannot be judged.",
  );
}

const screenBindsDisabled = boundInFile !== null;
const result = controlReady && screenBindsDisabled;

const evidenceParts = [];
evidenceParts.push(
  controlReady
    ? `${ACTION_BUTTON_PATH} declares a disabled prop, wires it to Pressable, and gives it a visual treatment`
    : `${ACTION_BUTTON_PATH} is missing one of: a disabled prop (${hasDisabledProp}), Pressable wiring (${pressableUsesDisabled}), a visual treatment (${hasVisualTreatment})`,
);
evidenceParts.push(
  screenBindsDisabled
    ? `${boundInFile} passes ActionButton a disabled expression naming an in-flight save state`
    : newFiles.length === 0
      ? "the diff added no .tsx file to bind a disabled state in"
      : `none of the diff's added files (${newFiles.join(", ")}) pass ActionButton a disabled expression naming an in-flight save state`,
);

process.stdout.write(`${JSON.stringify({ result, evidence: evidenceParts.join("; ") })}\n`);
