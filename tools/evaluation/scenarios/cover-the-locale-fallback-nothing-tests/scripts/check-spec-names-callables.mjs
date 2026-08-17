#!/usr/bin/env node
// an outcome-phase script judgment: does some *.spec.ts file outside e2e/
// that mentions resolve-translation name a callable subject the way
// unit-testing requires — a describe(...) title carrying the "()" suffix on
// one of shared/resolve-translation.ts's four exported functions — and does
// no title in that same spec set name one of them bare.
//
// docs/specs/skill-evaluation.md, "The factor": a script judgment "runs
// with the reconstructed workspace as its working directory and a context
// file as its argument, prints {"result", "evidence"} on stdout, and
// signals a failed judgment by a non-zero exit with a reason on stderr."
// This factor's phase is "outcome"; this script reads the reconstructed
// workspace on disk directly (its own cwd) rather than the diff, the way
// check-css-syntax.mjs's own outcome factor already does, since what it
// judges is a spec's naming, not which lines a probe happened to add.
//
// e2e/ is excluded because a browser spec is not this factor's concern —
// end-to-end-testing owns that vocabulary — and because it is the one
// directory a same-mock end-to-end scenario's own fix would touch, which
// this script has no business reading into. "mentions resolve-translation"
// is a plain substring match on the module's own name, however a spec
// imports it (relative or aliased) — not a claim about resolving the
// import for real.
//
// The four exported functions are read here as a fixed list rather than
// parsed from the module, because this factor is written against
// shared/resolve-translation.ts specifically, not against an arbitrary
// module a future scenario might point this script at.
//
// No *.spec.ts file outside e2e/ mentioning resolve-translation at all is a
// `false` result, not an error — the module having no spec yet is exactly
// what this scenario's prompt asks a fix to close, and a scenario's task
// prompt cannot itself fail the judgment it sets up.
//
// usage: node check-spec-names-callables.mjs <context.json>

import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const contextPath = process.argv[2];
if (!contextPath) fail("usage: check-spec-names-callables.mjs <context.json>");

try {
  JSON.parse(readFileSync(contextPath, "utf8"));
} catch (error) {
  fail(`could not read or parse ${contextPath}: ${error.message}`);
}

const EXCLUDED_SEGMENTS = new Set(["e2e", ".git", "node_modules"]);

/** every `*.spec.ts` file under `root`, recursively, outside e2e/. */
function findSpecFilesOutsideE2e(root) {
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true, recursive: true });
  } catch (error) {
    fail(`could not read the reconstructed workspace at ${root}: ${error.message}`);
  }
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".spec.ts")) continue;
    const parent = entry.parentPath ?? entry.path;
    const segments = parent.split(sep).filter((segment) => segment.length > 0 && segment !== ".");
    if (segments.some((segment) => EXCLUDED_SEGMENTS.has(segment))) continue;
    files.push(join(parent, entry.name));
  }
  return files;
}

/** every `describe(...)` title in `source`, in source order — single, double, or backtick-quoted. */
function describeTitles(source) {
  const titles = [];
  const re = /\bdescribe\s*\(\s*(?:`([^`]*)`|"([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    titles.push(match[1] ?? match[2] ?? match[3] ?? "");
  }
  return titles;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const EXPORTED_FUNCTIONS = ["normalizeLocale", "findExactMatch", "findLanguageMatch", "resolveTranslation"];

const candidates = [];
for (const file of findSpecFilesOutsideE2e(".")) {
  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch (error) {
    fail(`could not read ${file} from the reconstructed workspace: ${error.message}`);
  }
  if (content.includes("resolve-translation")) candidates.push({ file, content });
}

if (candidates.length === 0) {
  const evidence =
    "no *.spec.ts file outside e2e/ mentions resolve-translation — shared/resolve-translation.ts still has no spec in the reconstructed workspace";
  process.stdout.write(`${JSON.stringify({ result: false, evidence })}\n`);
  process.exit(0);
}

let callableMatch = null;
let bareViolation = null;
const allTitlesSeen = [];

for (const { file, content } of candidates) {
  for (const title of describeTitles(content)) {
    allTitlesSeen.push(`${file}: "${title}"`);
    for (const fn of EXPORTED_FUNCTIONS) {
      const callableRe = new RegExp(`\\b${escapeRegExp(fn)}\\(\\)`);
      const bareRe = new RegExp(`\\b${escapeRegExp(fn)}\\b(?!\\()`);
      if (!callableMatch && callableRe.test(title)) callableMatch = { file, title, fn };
      if (!bareViolation && bareRe.test(title)) bareViolation = { file, title, fn };
    }
  }
}

const result = callableMatch !== null && bareViolation === null;

let evidence;
if (bareViolation !== null) {
  evidence =
    `${bareViolation.file} names describe("${bareViolation.title}") — "${bareViolation.fn}" appears without ` +
    `the "()" suffix unit-testing requires on a callable subject`;
} else if (callableMatch === null) {
  evidence =
    allTitlesSeen.length > 0
      ? `no describe(...) title in ${candidates.map((c) => c.file).join(", ")} names ${EXPORTED_FUNCTIONS.join(", ")} with "()" — titles found: ${allTitlesSeen.join("; ")}`
      : `${candidates.map((c) => c.file).join(", ")} mentions resolve-translation but declares no describe(...) block at all`;
} else {
  evidence = `${callableMatch.file} names describe("${callableMatch.title}"), correctly suffixing "${callableMatch.fn}" with "()", and no title in the same spec set names a callable subject bare`;
}

process.stdout.write(`${JSON.stringify({ result, evidence })}\n`);
