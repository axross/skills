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
// specifier with no extension — including a barrel folder import — still
// resolves to the file behind it, never to the folder itself), take every
// resolved path imported by BOTH files that is also a path the probe's own
// diff ADDED (a "--- /dev/null" / "+++ b/<path>" pair — the same signal a
// new file always carries in a unified diff), and require that SET to be
// actually ABOUT this scenario's own subject — see
// isSetAboutLoadingAndError in ./lib/route-imports.mjs: a loading-ish token
// and a failure-ish token found somewhere across the set's own effective
// source AND across how each route file USES it (its JSX usage span for
// every name the route binds from a module in the set), not necessarily
// both in the same file or the same kind of source, so a Spinner and a
// separate ErrorBanner (each newly added, each imported by both screens)
// satisfy this exactly as well as one combined component does, and a
// correctly caller-parameterized surface that carries no vocabulary of its
// own — the content lives entirely in what each screen passes it — still
// satisfies this through its callers' own usage. That function is
// deliberately permissive — see its own header for the false-negative/
// false-positive asymmetry this scenario is built around, including the
// two widenings (reading usage spans; testing a camelCase-un-fused copy
// alongside the raw text) and each one's own accepted cost — so a shared
// module this factor cannot fully read counts in the module's favour, and
// a module that references both concerns without truly consolidating them
// can pass on lexical presence alone; this factor does not verify
// consolidation, only that the vocabulary moved. A shared module that is
// merely present (a generic data-fetching wrapper both screens happen to
// call, with each screen's own loading/error JSX left untouched) still
// fails this: a hook call produces no JSX usage span, so neither it, its
// call-site usage, nor anything it barrel-resolves to carries either
// token. Two screens that each grew their own new helper, a fix that never
// introduced a new file at all, or a shared module unrelated to loading
// and error, all fail this correctly. The parsing, resolution, and concern
// check live in ./lib/route-imports.mjs, shared with this scenario's
// paired factor script — see that module's own header for why.
//
// A route file missing from the workspace is a judgment this script cannot
// make (there is nothing to read its imports from), so it exits non-zero
// rather than reporting false.
//
// usage: node check-shared-extracted-module.mjs <context.json>

import { existsSync, readFileSync } from "node:fs";
import { ROUTE_FILES, addedFilesFromDiff, isSetAboutLoadingAndError, readRouteFile } from "./lib/route-imports.mjs";

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

for (const file of ROUTE_FILES) {
  if (!existsSync(file)) {
    fail(
      `${file} does not exist in the reconstructed workspace — this factor cannot judge whether its logic was extracted.`,
    );
  }
}

const addedFiles = addedFilesFromDiff(diff);
const [fileA, fileB] = ROUTE_FILES;
const routeA = readRouteFile(fileA);
const routeB = readRouteFile(fileB);
const resolvedA = new Set(routeA.imports.map((entry) => entry.resolved).filter(Boolean));
const resolvedB = new Set(routeB.imports.map((entry) => entry.resolved).filter(Boolean));

const shared = [...resolvedA].filter((path) => resolvedB.has(path));
const sharedAndAdded = shared.filter((path) => addedFiles.has(path)).sort();

const result =
  sharedAndAdded.length > 0 && isSetAboutLoadingAndError(sharedAndAdded, [routeA, routeB]);
const evidence = result
  ? `both ${fileA} and ${fileB} import ${sharedAndAdded.join(", ")}, which the probe's own diff added and which, taken together, reference both a loading-ish and a failure-ish token`
  : sharedAndAdded.length > 0
    ? `${fileA} and ${fileB} share the newly-added module(s) ${sharedAndAdded.join(", ")}, but taken together they do not reference both a loading-ish and a failure-ish token — a shared module alone is not this scenario's own subject`
    : shared.length > 0
      ? `${fileA} and ${fileB} share the resolved import(s) ${shared.sort().join(", ")}, but none of them is a file the probe's own diff added`
      : `${fileA} resolves its relative imports to [${[...resolvedA].sort().join(", ")}] and ${fileB} to [${[...resolvedB].sort().join(", ")}] — no resolved import is shared between the two files`;

process.stdout.write(`${JSON.stringify({ result, evidence })}\n`);
