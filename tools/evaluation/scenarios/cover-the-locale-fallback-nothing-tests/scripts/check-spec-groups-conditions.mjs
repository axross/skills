#!/usr/bin/env node
// an outcome-phase script judgment: does some *.spec.ts or *.test.ts file
// outside e2e/ that mentions resolve-translation group a condition under its
// own nested describe("when ...") block, the way unit-testing requires for
// cases that share a condition.
//
// docs/specs/skill-evaluation.md, "The factor": a script judgment "runs
// with the reconstructed workspace as its working directory and a context
// file as its argument, prints {"result", "evidence"} on stdout, and
// signals a failed judgment by a non-zero exit with a reason on stderr."
// This factor's phase is "outcome"; this script reads the reconstructed
// workspace on disk directly (its own cwd) rather than the diff, the way
// check-css-syntax.mjs's own outcome factor already does, since what it
// judges is a spec's structure, not which lines a probe happened to add.
//
// This judges only whether a condition-named group EXISTS — a describe(...)
// title that begins with the literal text "when " — never how deeply it
// nests, how many of resolve-translation.ts's four resolution conditions
// (exact match, language-only match, default-locale fallback, no match at
// all) are covered, or whether the cases inside it actually belong there.
// That is its stated limit, not an oversight: any of those would need
// reading the case bodies, which this factor does not attempt.
//
// Both ".spec.ts" and ".test.ts" are accepted as this script's own scope,
// not because either is what tsuzuri's own jest.config.cjs testMatch
// collects — that stays pinned to "*.spec.ts", a fact this script does not
// restate — but because this factor judges grouping, never whether the
// runner would collect the file.
//
// e2e/ and .claude/ are excluded for the same reasons
// check-spec-names-callables.mjs excludes them: a browser spec is
// end-to-end-testing's vocabulary, not this factor's, and .claude/ is where
// a probe's installed skills live — the one directory the skill-present and
// skill-absent conditions differ by, so reading a result out of it would be
// an asymmetric confound between them (#422), even though no installed
// skill ships a *.spec.ts or *.test.ts today. "mentions resolve-translation"
// is a plain substring match on the module's own name, however a spec
// imports it.
//
// No candidate spec outside e2e/ mentioning resolve-translation at all is a
// `false` result, not an error — the module having no spec yet is exactly
// what this scenario's prompt asks a fix to close, and a scenario's task
// prompt cannot itself fail the judgment it sets up.
//
// usage: node check-spec-groups-conditions.mjs <context.json>

import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const contextPath = process.argv[2];
if (!contextPath) fail("usage: check-spec-groups-conditions.mjs <context.json>");

try {
  JSON.parse(readFileSync(contextPath, "utf8"));
} catch (error) {
  fail(`could not read or parse ${contextPath}: ${error.message}`);
}

const EXCLUDED_SEGMENTS = new Set(["e2e", ".git", "node_modules", ".claude"]);
const CANDIDATE_EXTENSIONS = [".spec.ts", ".test.ts"];

/** every `*.spec.ts` or `*.test.ts` file under `root`, recursively, outside e2e/ and .claude/. */
function findSpecFilesOutsideE2e(root) {
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true, recursive: true });
  } catch (error) {
    fail(`could not read the reconstructed workspace at ${root}: ${error.message}`);
  }
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile() || !CANDIDATE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) continue;
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
    "no *.spec.ts or *.test.ts file outside e2e/ mentions resolve-translation — shared/resolve-translation.ts still has no spec in the reconstructed workspace";
  process.stdout.write(`${JSON.stringify({ result: false, evidence })}\n`);
  process.exit(0);
}

let match = null;
const allTitlesSeen = [];
for (const { file, content } of candidates) {
  for (const title of describeTitles(content)) {
    allTitlesSeen.push(`${file}: "${title}"`);
    if (!match && title.startsWith("when ")) match = { file, title };
  }
}

const result = match !== null;
let evidence;
if (result) {
  evidence = `${match.file} groups a condition under describe("${match.title}")`;
} else if (allTitlesSeen.length > 0) {
  evidence = `no describe(...) title in ${candidates.map((c) => c.file).join(", ")} begins with "when " — titles found: ${allTitlesSeen.join("; ")}`;
} else {
  evidence = `${candidates.map((c) => c.file).join(", ")} mentions resolve-translation but declares no describe(...) block at all`;
}

process.stdout.write(`${JSON.stringify({ result, evidence })}\n`);
