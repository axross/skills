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
// extraction that script detects, re-deriving "the shared module" the same
// way. As with quiet-the-stale-post-list-after-a-draft-save's
// keeps-the-detail-cache-write and respect-reduced-motion-in-the-publish-
// toast's keeps-the-animation-for-everyone-else, a run that changed nothing
// also passes THAT factor, which is why this one exists alongside it rather
// than instead of it.
//
// The check: find the shared newly-added module (same resolution
// check-shared-extracted-module.mjs uses), then for each route file, collect
// every place in the file — outside the import statement itself — where an
// identifier that file imports from that module is used, normalize
// whitespace, and compare the two files' collected usage. Identical usage
// (including "neither file visibly uses what it imported") is reported as
// false, naming that as its own evidence; different usage is true. This is a
// line-accumulating read, not a real parser — see collectUsageSnippets —
// and a route file missing from the workspace, or no shared newly-added
// module to compare at all, are two different situations: the former is a
// judgment this script cannot make (exits non-zero); the latter is a
// judgment this script CAN make, and it is false (nothing was parameterized
// because nothing was shared).
//
// usage: node check-screens-keep-distinct-content.mjs <context.json>

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

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

/** every path this unified diff ADDED — see check-shared-extracted-module.mjs's own copy of this function. */
function addedFilesFromDiff(diffText) {
  const added = new Set();
  const lines = diffText.split("\n");
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i] === "--- /dev/null" && lines[i + 1].startsWith("+++ ")) {
      added.add(lines[i + 1].slice(4).replace(/^b\//, "").trim());
    }
  }
  return added;
}

/**
 * every import statement's specifier in `content`, paired with the bound
 * local identifier names — see check-shared-extracted-module.mjs's own copy
 * of this function for the same house-style caveat (good enough for this
 * mock's Prettier-formatted TSX, not a full parser).
 *
 * @param {string} content
 * @returns {Array<{ specifier: string, names: string[], lineIndex: number, lineCount: number }>}
 */
function importsIn(content) {
  const results = [];
  const clauseRe = /\b(?:import|export)\s+([\s\S]*?)\s+from\s*["']([^"']+)["']/g;
  let match;
  while ((match = clauseRe.exec(content))) {
    const before = content.slice(0, match.index);
    const lineIndex = before.split("\n").length - 1;
    const lineCount = match[0].split("\n").length;
    results.push({ specifier: match[2], names: boundNamesFromClause(match[1]), lineIndex, lineCount });
  }
  return results;
}

function boundNamesFromClause(clause) {
  const names = [];
  const text = clause.trim().replace(/^type\s+/, "");
  const nsMatch = text.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
  if (nsMatch) names.push(nsMatch[1]);
  const namedMatch = text.match(/\{([\s\S]*)\}/);
  if (namedMatch) {
    for (const part of namedMatch[1].split(",")) {
      const piece = part.trim().replace(/^type\s+/, "");
      if (!piece) continue;
      const asMatch = piece.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/);
      if (asMatch) names.push(asMatch[2]);
      else {
        const bare = piece.match(/^([A-Za-z_$][\w$]*)$/);
        if (bare) names.push(bare[1]);
      }
    }
  }
  const beforeBraceOrStar = text.split(/[{*]/)[0];
  const defaultMatch = beforeBraceOrStar.match(/^([A-Za-z_$][\w$]*)/);
  if (defaultMatch) names.push(defaultMatch[1]);
  return [...new Set(names)];
}

function resolveRelativeSpecifier(specifier, fromFile) {
  if (!specifier.startsWith(".")) return null;
  const base = normalize(join(dirname(fromFile), specifier));
  const candidates = [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    `${base}.jsx`,
    `${base}.js`,
    `${base}.module.css`,
    join(base, "index.tsx"),
    join(base, "index.ts"),
    join(base, "index.jsx"),
    join(base, "index.js"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * @param {string} routeFile workspace-relative path
 * @returns {{ content: string, resolvedImports: Array<{ specifier: string, resolved: string | null, names: string[], lineIndex: number, lineCount: number }> }}
 */
function readRoute(routeFile) {
  const content = readFileSync(routeFile, "utf8");
  const resolvedImports = importsIn(content).map((entry) => ({
    ...entry,
    resolved: resolveRelativeSpecifier(entry.specifier, routeFile),
  }));
  return { content, resolvedImports };
}

/**
 * collects every place `name` is used in `lines`, skipping the import
 * statement's own line range, accumulating each occurrence's line plus
 * however many following lines it takes for that line's own count of
 * "(" / "<" openers to be matched by ")" / ">" closers — bounded to 40
 * lines so a name this heuristic never finds a close for cannot run away.
 * This conflates JSX tags with comparison operators and does not track
 * genuine nesting depth; it is a line-accumulating read for a route file's
 * own return-JSX shape, not a real parser.
 *
 * @param {string[]} lines
 * @param {string} name
 * @param {number} skipStart inclusive
 * @param {number} skipEnd exclusive
 * @returns {string[]}
 */
function collectUsageSnippets(lines, name, skipStart, skipEnd) {
  const nameRe = new RegExp(`\\b${name}\\b`);
  const snippets = [];
  let i = 0;
  while (i < lines.length) {
    if (i >= skipStart && i < skipEnd) {
      i++;
      continue;
    }
    if (nameRe.test(lines[i])) {
      let depth = 0;
      const collected = [];
      let j = i;
      do {
        const line = lines[j];
        collected.push(line);
        for (const ch of line) {
          if (ch === "(" || ch === "<") depth++;
          else if (ch === ")" || ch === ">") depth = Math.max(0, depth - 1);
        }
        j++;
      } while (depth > 0 && j < lines.length && j - i < 40);
      snippets.push(collected.join("\n"));
      i = j;
    } else {
      i++;
    }
  }
  return snippets;
}

const normalizeWhitespace = (text) => text.replace(/\s+/g, " ").trim();

for (const file of ROUTE_FILES) {
  if (!existsSync(file)) {
    fail(
      `${file} does not exist in the reconstructed workspace — this factor cannot judge whether the two screens still say their own thing.`,
    );
  }
}

const addedFiles = addedFilesFromDiff(diff);
const [fileA, fileB] = ROUTE_FILES;
const routeA = readRoute(fileA);
const routeB = readRoute(fileB);

const resolvedA = new Set(routeA.resolvedImports.map((entry) => entry.resolved).filter(Boolean));
const resolvedB = new Set(routeB.resolvedImports.map((entry) => entry.resolved).filter(Boolean));
const sharedAndAdded = [...resolvedA]
  .filter((path) => resolvedB.has(path) && addedFiles.has(path))
  .sort();

if (sharedAndAdded.length === 0) {
  const evidence = `${fileA} and ${fileB} share no newly-added module to parameterize — there is nothing for either screen's content to say through`;
  process.stdout.write(`${JSON.stringify({ result: false, evidence })}\n`);
  process.exit(0);
}

const sharedModule = sharedAndAdded[0];

function usageTextFor(route, file) {
  const importEntry = route.resolvedImports.find((entry) => entry.resolved === sharedModule);
  if (!importEntry || importEntry.names.length === 0) return "";
  const lines = route.content.split("\n");
  const parts = [];
  for (const name of importEntry.names) {
    parts.push(
      ...collectUsageSnippets(lines, name, importEntry.lineIndex, importEntry.lineIndex + importEntry.lineCount),
    );
  }
  return normalizeWhitespace(parts.join(" "));
}

const usageA = usageTextFor(routeA, fileA);
const usageB = usageTextFor(routeB, fileB);

const result = usageA !== usageB;
const evidence = result
  ? `${fileA}'s usage of ${sharedModule} ("${usageA}") differs from ${fileB}'s ("${usageB}")`
  : `${fileA} and ${fileB} use ${sharedModule} identically ("${usageA}"), so nothing distinguishes what either screen says`;

process.stdout.write(`${JSON.stringify({ result, evidence })}\n`);
