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
// e2e/ is walked recursively, and a file counts as a candidate when it ends
// in ".spec.ts" or ".test.ts" — this script's own accepted extensions,
// stated here rather than derived from any one runner's default collection
// glob, which is a version-sensitive fact this script does not claim to
// know. Both extensions and a nested location matter for the same reason:
// end-to-end-testing's own references/structure.md teaches a route-tree
// layout under e2e/tests/routes/ (its worked example is
// e2e/tests/routes/items/id/page.test.ts) as the default, and a
// purpose-based layout under e2e/tests/ (e.g. e2e/tests/smoke.test.ts) as
// the alternative — a probe that followed either would land its file in a
// subdirectory, named *.test.ts, which an earlier, non-recursive,
// *.spec.ts-only version of this script could not see. That version made
// both outcome factors report `false` exactly when the treatment condition
// worked, which is the defect this walk and this extension list exist to
// close.
//
// e2e/home.spec.ts is excluded by its exact workspace-relative path, not by
// bare filename, because it already exists, unmodified, in every
// materialized tsuzuri workspace — counting it would let a probe that
// touched nothing pass by construction, and excluding by bare filename
// would also silently discard a probe's own file that happens to share that
// name at a different path (e2e/tests/routes/home.spec.ts, say). e2e/
// itself is one of tsuzuri's own baseline directories (playwright.config.ts's
// own testDir) and always exists in a materialized workspace, so its
// absence here would mean the workspace itself is not what this script
// expects to judge, not that the factor's own artefact is missing — which
// is why that one case still exits non-zero rather than reporting a `false`
// result. e2e/ holding no candidate file at all — the ordinary case a probe
// that did nothing leaves behind — is reported as `false`, and so is a
// candidate that exists but never mentions the slug, or never sets a
// language.
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
const EXCLUDED_PATH = join(E2E_DIR, "home.spec.ts");
const CANDIDATE_EXTENSIONS = [".spec.ts", ".test.ts"];

let entries;
try {
  entries = readdirSync(E2E_DIR, { withFileTypes: true, recursive: true });
} catch (error) {
  fail(`could not read ${E2E_DIR} from the reconstructed workspace: ${error.message}`);
}

const candidateFiles = entries
  .filter((entry) => entry.isFile() && CANDIDATE_EXTENSIONS.some((ext) => entry.name.endsWith(ext)))
  .map((entry) => join(entry.parentPath ?? entry.path, entry.name))
  .filter((path) => path !== EXCLUDED_PATH);

if (candidateFiles.length === 0) {
  const evidence = `${E2E_DIR}/ holds no *.spec.ts or *.test.ts file other than ${EXCLUDED_PATH}, so nothing in it can exercise "${slug}"`;
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
