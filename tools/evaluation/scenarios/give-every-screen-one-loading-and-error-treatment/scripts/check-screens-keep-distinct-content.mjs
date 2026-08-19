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
// The check: find the shared, newly-added module SET that is actually
// ABOUT this scenario's own subject (same resolution AND same
// isSetAboutLoadingAndError concern check check-shared-extracted-module.mjs
// uses, applied to the whole set rather than one file at a time, and
// itself reading both route files' JSX usage of that set alongside each
// module's own source — see ./lib/route-imports.mjs's own header for why
// and for the deliberate permissiveness and widenings that check carries),
// then for each route file, collect
// the exact usage SPAN of each identifier it imports from ANY module in
// that set — a JSX element's own tag and attributes, or a call
// expression's own arguments, and nothing outside either shape, so a
// surrounding `if (...) return`, `&&` guard, or trailing `;` never reaches
// the comparison. Reading across the whole set (not just one module)
// matters the same way the concern check itself does: a Spinner and a
// separate ErrorBanner each contribute their own usage span, and either
// one differing between screens is enough to say the two screens still say
// their own thing. Each screen's spans are joined and then normalized:
// whitespace collapses, and any identifier ending in "Query" is replaced
// with a fixed placeholder, since the two screens' own pre-existing
// query-variable names (postsQuery vs postQuery) differ under essentially
// any extraction and say nothing about whether the extraction itself kept
// each screen's content distinct. The two files' normalized usage is then
// compared: identical usage (including "neither file visibly uses what it
// imported") is reported as false, naming that as its own evidence;
// different usage is true. This is a character-accumulating read, not a
// real parser — see usageSpansFor — and a route file missing from the
// workspace, or no shared newly-added module set to compare at all, are
// two different situations: the former is a judgment this script cannot
// make (exits non-zero); the latter is a judgment this script CAN make,
// and it is false (nothing was parameterized because nothing was shared).
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
// reported false. A third version's own children-scanning loop (inside
// captureJsxElement) was neither expression-string-aware nor
// self-closing-aware: a `{...}` child holding a string shaped like this
// element's own closing tag truncated the capture early, and a nested
// same-named element that was itself self-closing left the depth count one
// too high, running the scan past the real close and returning null for an
// element that had closed just fine. A fourth version scanned each route
// file's RAW content for usage spans, comments included, so a code comment
// merely mentioning the shared component in tag shape —
// "// See <LoadingError message="..." /> for the older shape." — was
// captured as a real usage span: two screens passing the shared component
// byte-for-byte identical props, the exact flattening this factor exists
// to catch, compared as different once that comment's own captured span
// joined the real one. usageTextFor now strips comments (lib/route-imports
// .mjs's stripComments, exported for this) before either screen's content
// ever reaches usageSpansFor. Each was fixed after its own review round,
// against a reproduction constructed for it first.
//
// usage: node check-screens-keep-distinct-content.mjs <context.json>

import { existsSync, readFileSync } from "node:fs";
import {
  ROUTE_FILES,
  addedFilesFromDiff,
  isSetAboutLoadingAndError,
  readRouteFile,
  usageSpansForSharedSet,
} from "./lib/route-imports.mjs";

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

// the usage-span capture is a move into ./lib/route-imports.mjs rather
// than a reimplementation: isSetAboutLoadingAndError needs the exact same
// reader to see how each route file uses a shared module, not only that
// module's own text — see that function's own header.

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
const aboutConcern =
  sharedAndAdded.length > 0 && isSetAboutLoadingAndError(sharedAndAdded, [routeA, routeB]);

if (!aboutConcern) {
  const evidence =
    sharedAndAdded.length > 0
      ? `${fileA} and ${fileB} share the newly-added module(s) ${sharedAndAdded.join(", ")}, but taken together they do not reference both a loading-ish and a failure-ish token, so there is nothing about this scenario's own subject for either screen's content to say through`
      : `${fileA} and ${fileB} share no newly-added module to parameterize — there is nothing for either screen's content to say through`;
  process.stdout.write(`${JSON.stringify({ result: false, evidence })}\n`);
  process.exit(0);
}

/**
 * the text one route file shows for the shared module set: every JSX usage
 * span of every name that file binds from a module in sharedAndAdded,
 * joined and normalized. Comments are stripped from the file first, so a
 * commented-out mention of a shared component never joins a real usage.
 */
function usageTextFor(route) {
  return normalizeUsage(usageSpansForSharedSet(route, sharedAndAdded).join(" "));
}

const usageA = usageTextFor(routeA);
const usageB = usageTextFor(routeB);

const result = usageA !== usageB;
const evidence = result
  ? `${fileA}'s usage of ${sharedAndAdded.join(", ")} ("${usageA}") differs from ${fileB}'s ("${usageB}") after normalizing pre-existing query-variable names`
  : `${fileA} and ${fileB} use ${sharedAndAdded.join(", ")} identically ("${usageA}") once each screen's own query-variable name is normalized away, so nothing distinguishes what either screen says`;

process.stdout.write(`${JSON.stringify({ result, evidence })}\n`);
