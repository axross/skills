#!/usr/bin/env node
// an outcome-phase script judgment, shared by both of this scenario's
// outcome factors: does some end-to-end spec other than e2e/home.spec.ts
// drive the post page for one particular slug — and, when the factor asks
// for it, does that same spec also set the reader's own accepted language.
//
// docs/specs/skill-evaluation.md, "The factor": a script judgment "runs
// with the reconstructed workspace as its working directory and a context
// file as its argument, prints {"result", "evidence"} on stdout, and
// signals a failed judgment by a non-zero exit with a reason on stderr."
// This factor's phase is "outcome"; this script reads the reconstructed
// workspace on disk directly (its own cwd) rather than the diff, the way
// check-css-syntax.mjs's own outcome factor already does, since what it
// judges is a spec's content, not which lines a probe happened to add.
//
// Parameterised through context.expect.slug and context.expect.requireLocale
// rather than forked into two scripts, because the two factors this
// scenario declares differ only in which slug they look for and whether
// setting the reader's language is part of what they require:
// "covers-a-reader-whose-language-matches-only-loosely" passes
// requireLocale true, "covers-the-post-that-is-listed-but-unreachable"
// passes it false.
//
// e2e/home.spec.ts is excluded by name because it already exists,
// unmodified, in every materialized tsuzuri workspace — counting it would
// let a probe that touched nothing pass by construction. e2e/ itself is one
// of tsuzuri's own baseline directories (playwright.config.ts's own
// testDir) and always exists in a materialized workspace, so its absence
// here would mean the workspace itself is not what this script expects to
// judge, not that the factor's own artefact is missing — which is why that
// one case still exits non-zero rather than reporting a `false` result. A
// candidate spec that exists but never mentions the slug, or never sets a
// language, is the ordinary case this script exists to catch, and both are
// reported as `false`.
//
// setsReaderLanguage's three tokens — a bare "locale:" object key (the
// Playwright test.use()/browser-context option), "extraHTTPHeaders" (the
// option a spec could use to set Accept-Language by hand), and a literal
// "Accept-Language" header name — are read as plain text over the candidate
// file's own source, not evaluated as code. A spec that sets the reader's
// language through some other mechanism this script does not know about
// will not be found by it — a known limitation of a textual check, not a
// claim that these are the only three ways to do it.
//
// usage: node check-e2e-covers.mjs <context.json>

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const contextPath = process.argv[2];
if (!contextPath) fail("usage: check-e2e-covers.mjs <context.json>");

let context;
try {
  context = JSON.parse(readFileSync(contextPath, "utf8"));
} catch (error) {
  fail(`could not read or parse ${contextPath}: ${error.message}`);
}

const { slug, requireLocale } = context.expect ?? {};
if (typeof slug !== "string" || slug.length === 0) {
  fail("context.expect.slug must be a non-empty string naming the post slug this factor covers.");
}
if (typeof requireLocale !== "boolean") {
  fail("context.expect.requireLocale must be a boolean.");
}

const E2E_DIR = "e2e";
const EXCLUDED_FILE = "home.spec.ts";

let entries;
try {
  entries = readdirSync(E2E_DIR, { withFileTypes: true });
} catch (error) {
  fail(`could not read ${E2E_DIR} from the reconstructed workspace: ${error.message}`);
}

const candidateFiles = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith(".spec.ts") && entry.name !== EXCLUDED_FILE)
  .map((entry) => join(E2E_DIR, entry.name));

if (candidateFiles.length === 0) {
  const evidence = `${E2E_DIR}/ holds no *.spec.ts file other than ${EXCLUDED_FILE}, so nothing in it can exercise "${slug}"`;
  process.stdout.write(`${JSON.stringify({ result: false, evidence })}\n`);
  process.exit(0);
}

const LOCALE_OPTION_RE = /\blocale\s*:/;
const EXTRA_HEADERS_RE = /\bextraHTTPHeaders\b/;
const ACCEPT_LANGUAGE_RE = /Accept-Language/i;

function setsReaderLanguage(content) {
  return LOCALE_OPTION_RE.test(content) || EXTRA_HEADERS_RE.test(content) || ACCEPT_LANGUAGE_RE.test(content);
}

const matches = [];
for (const file of candidateFiles) {
  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch (error) {
    fail(`could not read ${file} from the reconstructed workspace: ${error.message}`);
  }
  if (content.includes(slug)) matches.push({ file, setsLanguage: setsReaderLanguage(content) });
}

if (matches.length === 0) {
  const evidence = `none of ${candidateFiles.join(", ")} names "${slug}"`;
  process.stdout.write(`${JSON.stringify({ result: false, evidence })}\n`);
  process.exit(0);
}

if (!requireLocale) {
  const evidence = `${matches.map((m) => m.file).join(", ")} names "${slug}"`;
  process.stdout.write(`${JSON.stringify({ result: true, evidence })}\n`);
  process.exit(0);
}

const withLanguage = matches.filter((m) => m.setsLanguage);
const result = withLanguage.length > 0;
const evidence = result
  ? `${withLanguage.map((m) => m.file).join(", ")} names "${slug}" and sets the reader's own language`
  : `${matches.map((m) => m.file).join(", ")} names "${slug}" but none sets the reader's own language (no "locale:", "extraHTTPHeaders", or "Accept-Language" found)`;

process.stdout.write(`${JSON.stringify({ result, evidence })}\n`);
