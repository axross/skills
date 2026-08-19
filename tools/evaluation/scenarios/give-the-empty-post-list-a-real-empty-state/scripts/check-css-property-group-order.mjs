#!/usr/bin/env node
// an outcome-phase script judgment: does the CSS a probe's diff newly ADDED
// to any CSS Module follow the fifteen-group property order
// react-component-styling's references/style-property-order.md teaches —
// groups 1-13 (the declaration groups) at least. Group 14 (nested at-rules)
// and group 15 (nested state/pseudo-selector blocks) are checked only for
// "comes after every direct declaration in the same rule", never recursed
// into: their own internal order is a separate concern this factor does not
// claim to judge.
//
// docs/specs/skill-evaluation.md, "Three phases": an outcome factor is
// handed the diff and the task. Why only what the diff ADDED, rather than
// the whole file: inkwell's own stylesheets are deliberately non-uniform
// (tools/evaluation/mocks/README.md — "a mock that codified one would hand a
// control run the very convention a scenario asks about"), so checking a
// whole file would fail this factor on content the scenario never asked the
// model to touch.
//
// This is a line-based reading, not a CSS parser: it trusts that a
// declaration ends in `;` (which is how every stylesheet in this mock is
// written — Prettier's own CSS formatting) but tolerates a value that spans
// several lines before that `;`, since Button.module.css's own `transition`
// already does that. A property this reference does not place in any of its
// thirteen declaration groups (`box-shadow` is one — the reference itself
// never mentions it) is skipped rather than guessed at, so it can neither
// pass nor fail this factor.
//
// A model that never touches a CSS Module at all — inline styles, a
// different mechanism entirely — cannot have followed a property-order
// convention it never wrote any properties into, so that is reported as a
// real `false` rather than treated as unjudgeable. A model that touches a
// CSS Module but writes only properties this reference does not cover is a
// genuinely different situation — this script cannot tell whether an
// unrecognized-only change followed the taught order or not — so that case
// exits non-zero, an error rather than a guessed verdict.
//
// A subtlety a first version of this script got wrong: `git diff`'s added
// lines for one file are not one contiguous stretch of that file. Two
// declarations added into two DIFFERENT pre-existing rules, in two separate
// hunks, are exactly as "flat" in the diff as two declarations added into
// the SAME rule — nothing in the added-lines list itself says which. This
// script therefore keeps the diff's own line-contiguity (see
// addedLineRunsForFile's "runs") and only compares two depth-0 declarations
// — ones added straight into a rule the diff never shows the braces of —
// when they came from the same contiguous run. A rule the diff itself
// opened (depth 1 or deeper) is unaffected: seeing that rule's own `{` is
// what makes it one rule, regardless of whether its added lines were split
// across hunks.
//
// usage: node check-css-property-group-order.mjs <context.json>

import { readFileSync } from "node:fs";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const contextPath = process.argv[2];
if (!contextPath) fail("usage: check-css-property-group-order.mjs <context.json>");

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

// react-component-styling's references/style-property-order.md, groups 1-13
// in order. Matched top to bottom; the first pattern that matches wins.
const GROUPS = [
  /^(position|inset(-.*)?|z-index)$/, // 1 Positioning
  /^(display|container|grid-template(-.*)?|flex-direction|flex-wrap|align-items|justify-content|place-(items|content|self)|gap|row-gap|column-gap)$/, // 2 Layout container
  /^(grid-area|grid-column(-.*)?|grid-row(-.*)?|align-self|justify-self|flex(-.*)?|order)$/, // 3 Placement in the parent
  /^(inline-size|width|block-size|height|min-.*|max-.*|aspect-ratio)$/, // 4 Size
  /^(margin(-.*)?|padding(-.*)?)$/, // 5 Spacing
  /^(background(-.*)?|color)$/, // 6 Background and colour
  /^(border(-.*)?)$/, // 7 Border and shape (covers border-radius too)
  /^(font(-.*)?|line-height|letter-spacing|text(-.*)?|white-space|word-break|tab-size)$/, // 8 Typography
  /^(overflow(-.*)?|clip-path|line-clamp|-webkit-line-clamp)$/, // 9 Overflow and clipping
  /^(opacity|filter|backdrop-filter|transform(-.*)?|mix-blend-mode)$/, // 10 Visual effects
  /^(transition(-.*)?|animation(-.*)?)$/, // 11 Motion
  /^(cursor|user-select|pointer-events|outline(-.*)?)$/, // 12 Interaction and reset
  /^--/, // 13 Custom properties
];

function groupIndexOf(property) {
  for (let i = 0; i < GROUPS.length; i++) {
    if (GROUPS[i].test(property)) return i;
  }
  return -1; // unrecognized — the reference does not place it, so it is skipped
}

/**
 * every `.module.css` path this diff touches, read from its `+++ b/<path>`
 * lines — the same signal `git diff` always writes regardless of how the
 * hunks inside are shaped.
 */
function moduleCssFilesTouched(diffText) {
  const files = new Set();
  for (const line of diffText.split("\n")) {
    if (!line.startsWith("+++ ")) continue;
    const path = line.slice(4).replace(/^b\//, "").trim();
    if (path.endsWith(".module.css")) files.add(path);
  }
  return [...files];
}

/**
 * the lines this diff added to one file, as an array of RUNS — maximal
 * sequences of added lines with no unadded line (context, removed, or a
 * "@@" hunk header) between them. Two added lines in different runs might
 * sit in the same pre-existing rule or in two entirely different rules;
 * contiguity of the added lines is the only evidence this function has
 * either way, so it is preserved here rather than flattened into one list —
 * flattening it is what let two unrelated rules' declarations get compared
 * against each other as if they were one.
 *
 * @returns {string[][]}
 */
function addedLineRunsForFile(diffText, filePath) {
  let current = null;
  const runs = [];
  let run = null;
  for (const line of diffText.split("\n")) {
    if (line.startsWith("+++ ")) {
      current = line.slice(4).replace(/^b\//, "").trim();
      run = null;
      continue;
    }
    if (line.startsWith("diff --git ")) {
      current = null;
      run = null;
      continue;
    }
    if (current !== filePath) continue;
    if (line.startsWith("+") && !line.startsWith("+++")) {
      if (!run) {
        run = [];
        runs.push(run);
      }
      run.push(line.slice(1));
    } else {
      run = null; // any unadded line — context, removed, or a hunk header — breaks contiguity
    }
  }
  return runs;
}

// joins runs back into one string for the character-scanning walk below,
// marking each run boundary with a sentinel character no CSS text can
// contain — a raw NUL, written here as its escape so the source stays plain
// text rather than carrying a literal control byte.
const RUN_BREAK = "\u0000";

/**
 * walks text added to one CSS Module, delimited by `{`, `}`, `;`, and
 * RUN_BREAK rather than by line, so a declaration whose value spans several
 * lines (as Button.module.css's own `transition` does) is still read as one
 * declaration. `depth` tracks nesting relative to what THIS diff opened:
 * 0 is a declaration added straight into a rule the diff's own lines never
 * show the braces of; 1 is directly inside a rule the diff opened; above 1
 * is nested content (group 14/15 territory) whose own order this function
 * does not check — only that no direct declaration follows it.
 *
 * A RUN_BREAK resets only the depth-0 tracker, and only when depth is
 * actually 0 at that point: a rule the diff itself opened (depth 1 or
 * deeper) is still one rule even when its own added lines were split across
 * hunks, but two depth-0 declarations either side of a break have no
 * evidence at all of sharing a rule, so they are never compared.
 *
 * @param {string} addedText
 * @returns {{ violations: string[], sawAnyRecognized: boolean }}
 */
function checkGroupOrder(addedText) {
  const text = addedText.replace(/\/\*[\s\S]*?\*\//g, "");
  const violations = [];
  let sawAnyRecognized = false;
  let depth = 0;
  let nestedSeenAtDepth1 = false;
  let lastGroupAtDepth1 = -1;
  let lastGroupLoose = -1;

  function considerDeclaration(segment) {
    const match = segment.match(/^(--[A-Za-z0-9-]+|[A-Za-z-]+)\s*:\s*([\s\S]+)$/);
    if (!match) return;
    // a second "prop:" starting its own line inside the value almost always
    // means a missing ";" merged two declarations into one segment — see
    // check-css-syntax.mjs's own isDeclaration for the same guard.
    if (/\n\s*(--[A-Za-z0-9-]+|[A-Za-z-]+)\s*:/.test(match[2])) return;
    const property = match[1];
    const group = groupIndexOf(property);
    if (group === -1) return;
    sawAnyRecognized = true;
    if (depth === 1) {
      if (nestedSeenAtDepth1) {
        violations.push(
          `"${property}" is a direct declaration appearing after a nested block in the same rule — ` +
            "every direct declaration belongs before any nested at-rule or pseudo-selector block.",
        );
      } else if (group < lastGroupAtDepth1) {
        violations.push(`"${property}" (group ${group + 1}) appears after group ${lastGroupAtDepth1 + 1}.`);
      }
      lastGroupAtDepth1 = Math.max(lastGroupAtDepth1, group);
    } else if (depth === 0) {
      if (group < lastGroupLoose) {
        violations.push(`"${property}" (group ${group + 1}) appears after group ${lastGroupLoose + 1}.`);
      }
      lastGroupLoose = Math.max(lastGroupLoose, group);
    }
    // depth > 1: nested content's own order is not this factor's to judge.
  }

  let segStart = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== "{" && ch !== "}" && ch !== ";" && ch !== RUN_BREAK) continue;
    const segment = text.slice(segStart, i).trim();
    if (ch === "{") {
      depth++;
      if (depth === 2) nestedSeenAtDepth1 = true;
    } else if (ch === "}") {
      if (segment.length > 0) considerDeclaration(segment); // a last declaration before "}" may skip its ";"
      if (depth > 0) depth--;
      if (depth === 0) nestedSeenAtDepth1 = false; // the next top-level rule starts fresh
    } else if (ch === RUN_BREAK) {
      // a contiguity break in the added lines — never treated as a declaration
      // boundary; any pending segment is dropped rather than guessed at, same as
      // unterminated trailing text at the scan's end. only the depth-0 "loose" tracker
      // resets per run; depth, lastGroupAtDepth1, and nestedSeenAtDepth1 stay
      // untouched.
      if (depth === 0) lastGroupLoose = -1;
    } else {
      considerDeclaration(segment);
    }
    segStart = i + 1;
  }

  return { violations, sawAnyRecognized };
}

const touchedFiles = moduleCssFilesTouched(diff);
if (touchedFiles.length === 0) {
  const evidence = "the diff touches no CSS Module file, so the taught property order was not followed by anything the probe wrote";
  process.stdout.write(`${JSON.stringify({ result: false, evidence })}\n`);
  process.exit(0);
}

const allViolations = [];
let sawAnyRecognizedAnywhere = false;
for (const file of touchedFiles) {
  const runs = addedLineRunsForFile(diff, file);
  const addedText = runs.map((run) => run.join("\n")).join(`\n${RUN_BREAK}\n`);
  const { violations, sawAnyRecognized } = checkGroupOrder(addedText);
  sawAnyRecognizedAnywhere ||= sawAnyRecognized;
  for (const violation of violations) allViolations.push(`${file}: ${violation}`);
}

if (!sawAnyRecognizedAnywhere) {
  fail(
    `the diff's added lines in ${touchedFiles.join(", ")} contain no declaration this reference places in a group — ` +
      "this factor has nothing recognizable to judge.",
  );
}

const result = allViolations.length === 0;
const evidence = result
  ? `every declaration the diff added to ${touchedFiles.join(", ")} that this reference recognizes appears in non-decreasing group order`
  : allViolations.join(" ");

process.stdout.write(`${JSON.stringify({ result, evidence })}\n`);
