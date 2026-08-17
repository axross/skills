#!/usr/bin/env node
// an outcome-phase script judgment, paired with
// check-shared-extracted-module.mjs: given the same shared, newly-added
// module the two route files import, does each screen still say something
// of its own through it, rather than the extraction having flattened both
// screens onto one hardcoded message.
//
// references/component-states.md's "One Shared Surface": the shared surface
// should "take its content as props" so features "keep their distinct
// control without forking the surface" — an extraction that renders one
// hardcoded string on both screens has moved the duplication rather than
// removed it, and has cost the product the two different, useful sentences
// PostListPage.tsx and PostEditorPage.tsx used to show.
//
// This is deliberately not independent of
// check-shared-extracted-module.mjs: it judges the quality of the very
// extraction that script detects, re-deriving "the shared module" through
// the same ./lib/route-imports.mjs both scripts import, so a fix to how
// that resolution works lands identically for both factors.
//
// The check: find the shared newly-added module (same resolution
// check-shared-extracted-module.mjs uses), then for each route file,
// collect the exact usage SPAN of each identifier it imports from that
// module — a JSX element's own tag and attributes, or a call expression's
// own arguments, and nothing outside either shape, so a surrounding
// `if (...) return`, `&&` guard, or trailing `;` never reaches the
// comparison. Each span is then normalized: whitespace collapses, and any
// identifier ending in "Query" is replaced with a fixed placeholder, since
// the two screens' own pre-existing query-variable names (postsQuery vs
// postQuery) differ under essentially any extraction and say nothing about
// whether the extraction itself kept each screen's content distinct. The
// two files' normalized usage is then compared: identical usage (including
// "neither file visibly uses what it imported") is reported as false,
// naming that as its own evidence; different usage is true. This is a
// character-accumulating read, not a real parser — see usageSpansFor — and
// a route file missing from the workspace, or no shared newly-added module
// to compare at all, are two different situations: the former is a
// judgment this script cannot make (exits non-zero); the latter is a
// judgment this script CAN make, and it is false (nothing was parameterized
// because nothing was shared).
//
// An earlier version of this factor compared the raw source lines
// surrounding each occurrence rather than the usage span alone, which let
// the screens' own pre-existing query-variable names carry a comparison
// that should have found nothing to distinguish — reported true for a
// textbook flattening whose only surviving difference was postsQuery vs
// postQuery. A later version's own JSX-span reader (captureJsxElement)
// found the end of an open tag by scanning for an unquoted `>` with no
// notion of `=>`, so an element carrying a callback prop —
// `onRetry={() => query.refetch()}` — hit the `>` inside `=>` first, was
// read as having children, found no matching close tag, and its whole
// span was silently dropped: two screens passing genuinely distinct
// messages alongside a retry callback compared as two empty strings and
// reported false. Both fixed after separate review rounds; see #429's
// fix-round history for the reproductions each version was built and
// checked against.
//
// usage: node check-screens-keep-distinct-content.mjs <context.json>

import { existsSync, readFileSync } from "node:fs";
import { addedFilesFromDiff, readRouteFile } from "./lib/route-imports.mjs";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const contextPath = process.argv[2];
if (!contextPath) fail("usage: check-screens-keep-distinct-content.mjs <context.json>");

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

const ROUTE_FILES = ["src/routes/PostListPage.tsx", "src/routes/PostEditorPage.tsx"];

/**
 * captures balanced text starting at `openIndex`, where
 * `text[openIndex] === openChar`, tracking nested `openChar`/`closeChar`
 * pairs while skipping their occurrences inside a single-, double-, or
 * backtick-quoted string (so a prop value like `message="Loading (posts)…"`
 * cannot unbalance the scan on its own parenthesis).
 *
 * @param {string} text
 * @param {number} openIndex
 * @param {string} openChar
 * @param {string} closeChar
 * @returns {number | null} the index just past the matching `closeChar`, or
 *   null if the text ends before the nesting returns to zero
 */
function captureBalanced(text, openIndex, openChar, closeChar) {
  let depth = 0;
  let quote = null;
  let i = openIndex;
  while (i < text.length) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      i++;
      continue;
    }
    if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) return i + 1;
    }
    i++;
  }
  return null;
}

/**
 * finds the end of a JSX element's OPEN TAG — the `>` (or `/>`) that
 * actually closes it — starting at `start`, the index right after the tag
 * name. A `>` only terminates the tag when it is at JSX-expression-
 * container depth 0 AND outside any quoted span: an attribute value can
 * itself carry a `>` that means something else entirely — `=>` in a prop
 * like `onRetry={() => query.refetch()}`, a comparison in
 * `showRetry={attempts > 2}`, or a literal character in `title="Drafts >
 * 10"` — and none of those may be read as the tag's own close. Container
 * depth is tracked via `{`/`}` (an attribute's `{expression}`); inside a
 * quote, `{`/`}`/`>` are all inert until the matching close, the same
 * string-skipping stripComments in the sibling lib/route-imports.mjs
 * already does for its own scan (escapes respected; a backtick's own
 * `${…}` holes are not specially re-entered as code, matching that same
 * precedent — not a concern for the flat prop values this scenario's
 * subject produces).
 *
 * @param {string} text
 * @param {number} start
 * @returns {{ end: number, selfClosing: boolean } | null} `end` is the
 *   index of the terminating `>` itself; null if the tag never closes
 *   before the text ends
 */
function findOpenTagEnd(text, start) {
  let i = start;
  let quote = null;
  let depth = 0;
  while (i < text.length) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      i++;
      continue;
    }
    if (ch === "{") {
      depth++;
      i++;
      continue;
    }
    if (ch === "}") {
      depth = Math.max(0, depth - 1);
      i++;
      continue;
    }
    if (ch === ">" && depth === 0) {
      return { end: i, selfClosing: text[i - 1] === "/" };
    }
    i++;
  }
  return null;
}

/**
 * captures one JSX element occurrence starting at `ltIndex`, where
 * `text[ltIndex] === "<"` and the tag name immediately following is `name`.
 * Returns the element's own source text — `<Name .../>` or
 * `<Name ...>...</Name>` — never anything before the `<` or after the
 * matching close, so a surrounding `if (...) return`, `&&` guard, or
 * trailing `;` never reaches the captured span. A same-named child element
 * nested inside is tracked (a rough depth count) rather than assumed away,
 * though this scenario's own subject — a leaf surface component taking its
 * content as props — is not expected to nest itself.
 *
 * @param {string} text
 * @param {number} ltIndex
 * @param {string} name
 * @returns {string | null} the whole element's source text, or null if the
 *   opening tag or a required closing tag never resolves before the text
 *   ends
 */
function captureJsxElement(text, ltIndex, name) {
  const openTag = findOpenTagEnd(text, ltIndex + 1 + name.length);
  if (!openTag) return null; // the opening tag itself never closed
  if (openTag.selfClosing) return text.slice(ltIndex, openTag.end + 1);

  let depth = 1;
  let i = openTag.end + 1; // past the '>'
  const closeTag = `</${name}>`;
  while (i < text.length) {
    if (text.startsWith(closeTag, i)) {
      depth--;
      i += closeTag.length;
      if (depth === 0) return text.slice(ltIndex, i);
      continue;
    }
    if (text.startsWith(`<${name}`, i)) depth++;
    i++;
  }
  return null; // no matching close before the text ends
}

/**
 * every usage SPAN of `name` in `text` — the JSX element it opens
 * (`<name .../>` or `<name ...>...</name>`), or the call expression it
 * opens (`name(...)`) — and nothing outside either shape. A bare reference
 * (neither shape: a type position, a value passed by name alone) contributes
 * nothing, since this factor cares about how the shared surface is actually
 * invoked, not every mention of its name.
 *
 * @param {string} text
 * @param {string} name
 * @returns {string[]}
 */
function usageSpansFor(text, name) {
  const spans = [];
  const nameRe = new RegExp(`\\b${name}\\b`, "g");
  let match;
  while ((match = nameRe.exec(text))) {
    const start = match.index;
    if (text[start - 1] === "<") {
      const span = captureJsxElement(text, start - 1, name);
      if (span) spans.push(span);
      continue;
    }
    let j = start + name.length;
    while (j < text.length && /\s/.test(text[j])) j++;
    if (text[j] === "(") {
      const end = captureBalanced(text, j, "(", ")");
      if (end !== null) spans.push(text.slice(start, end));
    }
    // else: a bare reference — not this factor's concern.
  }
  return spans;
}

/** collapses whitespace runs to a single space and trims. */
const collapseWhitespace = (text) => text.replace(/\s+/g, " ").trim();

/**
 * replaces every identifier ending in "Query" with a fixed placeholder, so
 * the two screens' own pre-existing query-variable names (postsQuery vs
 * postQuery) — which differ under essentially any extraction and say
 * nothing about whether the extraction itself kept each screen's content
 * distinct — never drive this comparison on their own.
 */
const normalizeQueryNames = (text) => text.replace(/\b[A-Za-z_$][\w$]*Query\b/g, "__QUERY__");

const normalizeUsage = (text) => collapseWhitespace(normalizeQueryNames(text));

for (const file of ROUTE_FILES) {
  if (!existsSync(file)) {
    fail(
      `${file} does not exist in the reconstructed workspace — this factor cannot judge whether the two screens still say their own thing.`,
    );
  }
}

const addedFiles = addedFilesFromDiff(diff);
const [fileA, fileB] = ROUTE_FILES;
const routeA = readRouteFile(fileA);
const routeB = readRouteFile(fileB);

const resolvedA = new Set(routeA.imports.map((entry) => entry.resolved).filter(Boolean));
const resolvedB = new Set(routeB.imports.map((entry) => entry.resolved).filter(Boolean));
const sharedAndAdded = [...resolvedA].filter((path) => resolvedB.has(path) && addedFiles.has(path)).sort();

if (sharedAndAdded.length === 0) {
  const evidence = `${fileA} and ${fileB} share no newly-added module to parameterize — there is nothing for either screen's content to say through`;
  process.stdout.write(`${JSON.stringify({ result: false, evidence })}\n`);
  process.exit(0);
}

const sharedModule = sharedAndAdded[0];

function usageTextFor(route) {
  const importEntry = route.imports.find((entry) => entry.resolved === sharedModule);
  if (!importEntry || importEntry.names.length === 0) return "";
  const spans = importEntry.names.flatMap((name) => usageSpansFor(route.content, name));
  return normalizeUsage(spans.join(" "));
}

const usageA = usageTextFor(routeA);
const usageB = usageTextFor(routeB);

const result = usageA !== usageB;
const evidence = result
  ? `${fileA}'s usage of ${sharedModule} ("${usageA}") differs from ${fileB}'s ("${usageB}") after normalizing pre-existing query-variable names`
  : `${fileA} and ${fileB} use ${sharedModule} identically ("${usageA}") once each screen's own query-variable name is normalized away, so nothing distinguishes what either screen says`;

process.stdout.write(`${JSON.stringify({ result, evidence })}\n`);
