#!/usr/bin/env node
// an outcome-phase script judgment: does any file under the named roots,
// after the extension and suffix filters, contain any of the named needles.
//
// docs/specs/skill-evaluation.md, "The factor": a script judgment "runs
// with the reconstructed workspace as its working directory and a context
// file as its argument, prints {"result", "evidence"} on stdout, and
// signals a failed judgment by a non-zero exit with a reason on stderr."
// This factor's phase is "outcome", so this script reads the reconstructed
// workspace itself — its own cwd — rather than the diff-and-task material
// factor-judgment.mjs's materialFor hands an outcome factor; the walk below
// is what does the reading.
//
// check-source-free-of.mjs is this script's negative counterpart: same
// walk, opposite verdict — passing here means a needle was found, passing
// there means none was.
//
// .git, node_modules, and .claude are skipped unconditionally, regardless
// of what the input's own roots or extensions name. .git is the
// load-bearing exclusion: the reconstructed workspace is a real Git
// repository whose object store holds every version of every file it ever
// committed, so a walk that descended into it could find a needle inside a
// blob the probe never touched, rather than inside the workspace as the
// probe actually left it.
//
// usage: node check-source-contains-any.mjs <context.json>

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ALWAYS_SKIPPED = new Set([".git", "node_modules", ".claude"]);

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const contextPath = process.argv[2];
if (!contextPath) fail("usage: check-source-contains-any.mjs <context.json>");

let context;
try {
  context = JSON.parse(readFileSync(contextPath, "utf8"));
} catch (error) {
  fail(`could not read or parse ${contextPath}: ${error.message}`);
}

const { roots, extensions, excludeSuffixes, anyOf } = context.input ?? {};
if (!Array.isArray(roots) || roots.length === 0 || !roots.every((r) => typeof r === "string" && r.length > 0)) {
  fail("context.input.roots must be a non-empty array of non-empty strings.");
}
if (extensions !== undefined && extensions !== null) {
  if (!Array.isArray(extensions) || !extensions.every((e) => typeof e === "string" && e.length > 0)) {
    fail("context.input.extensions, when present, must be an array of non-empty strings.");
  }
}
if (excludeSuffixes !== undefined) {
  if (!Array.isArray(excludeSuffixes) || !excludeSuffixes.every((s) => typeof s === "string" && s.length > 0)) {
    fail("context.input.excludeSuffixes, when present, must be an array of non-empty strings.");
  }
}
if (!Array.isArray(anyOf) || anyOf.length === 0 || !anyOf.every((n) => typeof n === "string" && n.length > 0)) {
  fail("context.input.anyOf must be a non-empty array of non-empty strings.");
}

// undefined/null means "every extension" — the filter this scenario needs
// when a subject (a catalog's own text, say) could legitimately move into
// any file type, not only the ones a stricter factor wants to bound.
const extensionList = extensions ?? null;
const suffixes = excludeSuffixes ?? [];

function passesFilters(path) {
  if (extensionList && !extensionList.some((ext) => path.endsWith(ext))) return false;
  if (suffixes.some((suffix) => path.endsWith(suffix))) return false;
  return true;
}

function walk(dir, files) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (ALWAYS_SKIPPED.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
}

const files = [];
for (const root of roots) {
  let rootStat;
  try {
    rootStat = statSync(root);
  } catch (error) {
    fail(
      `context.input.roots names ${JSON.stringify(root)}, which does not exist in the reconstructed workspace: ${error.message}`,
    );
  }
  if (!rootStat.isDirectory()) {
    fail(`context.input.roots names ${JSON.stringify(root)}, which is not a directory in the reconstructed workspace.`);
  }
  walk(root, files);
}

const searched = files.filter(passesFilters);

/** the first file among `candidates` that contains any of `needles`, or null. */
function firstMatch(candidates, needles) {
  for (const file of candidates) {
    let content;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      continue; // not readable as text — not a candidate for a textual match
    }
    const needle = needles.find((n) => content.includes(n));
    if (needle !== undefined) return { file, needle };
  }
  return null;
}

const match = firstMatch(searched, anyOf);
const result = match !== null;
const evidence = result
  ? `${relative(".", match.file)} contains "${match.needle}"`
  : `none of the ${searched.length} file(s) searched under [${roots.join(", ")}]` +
    `${extensionList ? ` (extensions: ${extensionList.join(", ")})` : ""} contain any of: ${anyOf.join(", ")}`;

process.stdout.write(`${JSON.stringify({ result, evidence })}\n`);
