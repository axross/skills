#!/usr/bin/env node
// an outcome-phase script judgment: did the probe's diff pull the two route
// screens' repeated loading-and-error handling onto ONE shared module both
// screens now import.
//
// docs/specs/skill-evaluation.md, "Three phases": an outcome factor is
// handed the diff and the task. This script also reads
// src/routes/PostListPage.tsx and src/routes/PostEditorPage.tsx from the
// reconstructed workspace directly (this process's own cwd — see this
// scenario's scenario.json and factor-judgment.mjs's runScriptJudgment),
// since "which module each screen imports" is a fact about the final
// workspace, not about the diff's text.
//
// The check: resolve every RELATIVE import each of the two route files
// declares against the workspace (trying the usual TS/JS extension and
// index-file candidates against what actually exists on disk, so an import
// specifier with no extension still resolves), and require that at least one
// resolved path is imported by BOTH files AND is a path the probe's own diff
// ADDED (a "--- /dev/null" / "+++ b/<path>" pair — the same signal a new
// file always carries in a unified diff). Two screens that each grew their
// own new helper, or a fix that never introduced a new file at all, fail
// this correctly: nothing they share was newly added.
//
// A route file missing from the workspace is a judgment this script cannot
// make (there is nothing to read its imports from), so it exits non-zero
// rather than reporting false.
//
// usage: node check-shared-extracted-module.mjs <context.json>

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const contextPath = process.argv[2];
if (!contextPath) fail("usage: check-shared-extracted-module.mjs <context.json>");

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
 * every path this unified diff ADDED, read from its "--- /dev/null" /
 * "+++ b/<path>" pair — the shape `git diff` always writes for a new file,
 * regardless of how the hunks inside are shaped.
 *
 * @param {string} diffText
 * @returns {Set<string>}
 */
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
 * local identifier names for named/default/namespace forms — good enough
 * for the Prettier-formatted TSX this mock's route files are written in,
 * not a full parser. Re-exports ("export ... from") are included too, since
 * a barrel-style extraction could plausibly re-export rather than import.
 *
 * @param {string} content
 * @returns {Array<{ specifier: string, names: string[] }>}
 */
function importsIn(content) {
  const results = [];
  const clauseRe = /\b(?:import|export)\s+([\s\S]*?)\s+from\s*["']([^"']+)["']/g;
  let match;
  while ((match = clauseRe.exec(content))) {
    results.push({ specifier: match[2], names: boundNamesFromClause(match[1]) });
  }
  const bareRe = /\bimport\s*["']([^"']+)["']/g;
  while ((match = bareRe.exec(content))) {
    results.push({ specifier: match[1], names: [] });
  }
  return results;
}

/**
 * the local identifier names one import clause binds — default, namespace,
 * and named (including `X as Y` aliasing and a leading `type`).
 *
 * @param {string} clause the text between "import"/"export" and "from"
 * @returns {string[]}
 */
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

/**
 * resolves one RELATIVE import specifier against the file that declared it,
 * trying the usual TS/JS extension and index-file candidates against what
 * actually exists in the reconstructed workspace (this process's own cwd).
 *
 * @param {string} specifier
 * @param {string} fromFile workspace-relative path of the importing file
 * @returns {string | null} a workspace-relative path, or null if nothing on
 *   disk matches any candidate
 */
function resolveRelativeSpecifier(specifier, fromFile) {
  if (!specifier.startsWith(".")) return null; // package import — not this factor's concern
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
 * every workspace path this file's relative imports resolve to, as a Set.
 *
 * @param {string} routeFile workspace-relative path
 * @returns {Set<string>}
 */
function resolvedImportsOf(routeFile) {
  const content = readFileSync(routeFile, "utf8");
  const resolved = new Set();
  for (const { specifier } of importsIn(content)) {
    const target = resolveRelativeSpecifier(specifier, routeFile);
    if (target) resolved.add(target);
  }
  return resolved;
}

for (const file of ROUTE_FILES) {
  if (!existsSync(file)) {
    fail(
      `${file} does not exist in the reconstructed workspace — this factor cannot judge whether its logic was extracted.`,
    );
  }
}

const addedFiles = addedFilesFromDiff(diff);
const [fileA, fileB] = ROUTE_FILES;
const resolvedA = resolvedImportsOf(fileA);
const resolvedB = resolvedImportsOf(fileB);

const shared = [...resolvedA].filter((path) => resolvedB.has(path));
const sharedAndAdded = shared.filter((path) => addedFiles.has(path)).sort();

const result = sharedAndAdded.length > 0;
const evidence = result
  ? `both ${fileA} and ${fileB} import ${sharedAndAdded.join(", ")}, which the probe's own diff added`
  : shared.length > 0
    ? `${fileA} and ${fileB} share the resolved import(s) ${shared.sort().join(", ")}, but none of them is a file the probe's own diff added`
    : `${fileA} resolves its relative imports to [${[...resolvedA].sort().join(", ")}] and ${fileB} to [${[...resolvedB].sort().join(", ")}] — no resolved import is shared between the two files`;

process.stdout.write(`${JSON.stringify({ result, evidence })}\n`);
