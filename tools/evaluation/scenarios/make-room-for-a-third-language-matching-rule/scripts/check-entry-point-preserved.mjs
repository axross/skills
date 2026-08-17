#!/usr/bin/env node
// an outcome-phase script judgment, and this scenario's non-effect factor:
// does a named module still export a named function, and does a named
// caller still import it from a named module specifier.
//
// docs/specs/skill-evaluation.md, "The factor": a script judgment "runs
// with the reconstructed workspace as its working directory and a context
// file as its argument, prints {"result", "evidence"} on stdout, and
// signals a failed judgment by a non-zero exit with a reason on stderr."
// This factor's phase is "outcome", so this script reads the reconstructed
// workspace directly.
//
// What this cannot see: it reads two files for text shaped like an export
// and an import, never whether resolveTranslation's own behaviour changed
// at all — a refactor that keeps the entry point's name and import path
// exactly as they are while breaking what it does internally still
// satisfies this script. Judging the behaviour itself is this scenario's
// sibling factor's job, not this one's — this factor asks only whether the
// module's public surface survived, which is why it is expected to read
// `true` on an untouched workspace as readily as on a well-refactored one.
//
// usage: node check-entry-point-preserved.mjs <context.json>

import { readFileSync } from "node:fs";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

/** escapes `text` for safe interpolation into a `RegExp` source string. */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** whether `content` exports a value under `name`, as a function declaration, a const, or a named re-export. */
function exportsName(content, name) {
  const escaped = escapeRegExp(name);
  const patterns = [
    new RegExp(`export\\s+(async\\s+)?function\\s+${escaped}\\s*\\(`),
    new RegExp(`export\\s+const\\s+${escaped}\\s*=`),
    new RegExp(`export\\s*\\{[^}]*\\b${escaped}\\b[^}]*\\}`),
  ];
  return patterns.some((pattern) => pattern.test(content));
}

/** whether `content` imports `name` from `specifier` via a named import. */
function importsNameFrom(content, name, specifier) {
  const pattern = new RegExp(
    `import\\s*\\{[^}]*\\b${escapeRegExp(name)}\\b[^}]*\\}\\s*from\\s*["']${escapeRegExp(specifier)}["']`,
  );
  return pattern.test(content);
}

const contextPath = process.argv[2];
if (!contextPath) fail("usage: check-entry-point-preserved.mjs <context.json>");

let context;
try {
  context = JSON.parse(readFileSync(contextPath, "utf8"));
} catch (error) {
  fail(`could not read or parse ${contextPath}: ${error.message}`);
}

const { moduleFile, exportedName, callerFile, importPath } = context.expect ?? {};
for (const [key, value] of Object.entries({ moduleFile, exportedName, callerFile, importPath })) {
  if (typeof value !== "string" || value.length === 0) {
    fail(`context.expect.${key} must be a non-empty string.`);
  }
}

let moduleContent;
try {
  moduleContent = readFileSync(moduleFile, "utf8");
} catch (error) {
  fail(`could not read ${moduleFile} from the reconstructed workspace: ${error.message}`);
}

let callerContent;
try {
  callerContent = readFileSync(callerFile, "utf8");
} catch (error) {
  fail(`could not read ${callerFile} from the reconstructed workspace: ${error.message}`);
}

const stillExported = exportsName(moduleContent, exportedName);
const stillImported = importsNameFrom(callerContent, exportedName, importPath);
const result = stillExported && stillImported;

const problems = [];
if (!stillExported) problems.push(`${moduleFile} no longer exports ${exportedName}`);
if (!stillImported) problems.push(`${callerFile} no longer imports ${exportedName} from "${importPath}"`);

const evidence = result
  ? `${moduleFile} still exports ${exportedName}, and ${callerFile} still imports it from "${importPath}"`
  : problems.join("; ");

process.stdout.write(`${JSON.stringify({ result, evidence })}\n`);
