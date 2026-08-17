#!/usr/bin/env node
// an outcome-phase script judgment: does PublishToast's test now sit where
// the browser project's own `include` reaches it.
//
// This is a textual, structural read of vitest.config.ts and the workspace
// tree, not a glob evaluator — this scenario has no glob-matching dependency
// to reach for, and writing one from scratch to judge one factor would be
// exactly the kind of machinery docs/conventions/directory-structure.md's
// "Where a Validator Lives" warns against. It accepts the two fixes the
// project's own structure makes natural, and reports false on anything else:
//
//   1. The test file is renamed so its own name ends in ".browser.test.tsx"
//      and stays under src/components/PublishToast/ — the browser project's
//      declared "src/**/*.browser.test.tsx" already reaches a file shaped
//      that way, without vitest.config.ts changing at all.
//   2. vitest.config.ts's browser project gains an include pattern beyond
//      its original "src/**/*.browser.test.tsx" ending in ".test.tsx", and a
//      *.test.tsx file still exists for PublishToast. This script does not
//      evaluate that new pattern against the file's actual path — it only
//      confirms the browser project's declared reach was widened while a
//      file shaped to match still exists — so a widened pattern that in
//      fact does not cover this path, or one added to the wrong project,
//      would be misjudged. That is a known limit of a script that does not
//      embed a glob matcher, not a claim to certainty about arbitrary
//      `include` edits.
//
// Renamed-away-with-no-replacement, moved outside PublishToast's own
// directory, or an `include` change to the *unit* project instead all fall
// through both checks and report false.
//
// usage: node check-toast-test-reaches-browser-project.mjs <context.json>

import { readFileSync, readdirSync } from "node:fs";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const contextPath = process.argv[2];
if (!contextPath) fail("usage: check-toast-test-reaches-browser-project.mjs <context.json>");
// this factor reads the final workspace directly and needs neither an
// expectation nor any material, so context.json's own content is unread —
// only its presence (the contract every script judgment is invoked under)
// is checked above.

const TOAST_DIR = "src/components/PublishToast";
const ORIGINAL_BROWSER_INCLUDE = "src/**/*.browser.test.tsx";

let toastFiles;
try {
  toastFiles = readdirSync(TOAST_DIR);
} catch (error) {
  fail(`could not read ${TOAST_DIR} from the reconstructed workspace: ${error.message}`);
}

const renamed = toastFiles.filter((name) => name.endsWith(".browser.test.tsx"));
if (renamed.length > 0) {
  const evidence =
    `${TOAST_DIR} contains ${renamed.map((name) => JSON.stringify(name)).join(", ")}, which the browser ` +
    `project's own "${ORIGINAL_BROWSER_INCLUDE}" include already reaches without vitest.config.ts changing.`;
  process.stdout.write(`${JSON.stringify({ result: true, evidence })}\n`);
  process.exit(0);
}

let config;
try {
  config = readFileSync("vitest.config.ts", "utf8");
} catch (error) {
  fail(`could not read vitest.config.ts from the reconstructed workspace: ${error.message}`);
}

/**
 * the string literals inside the first `include: [...]` array appearing
 * after `name: "<projectName>"` in `content` — a textual read, not a real
 * TypeScript parser.
 *
 * @returns {string[] | null} null when the project or its include array
 *   cannot be located at all
 */
function projectInclude(content, projectName) {
  const nameIndex = content.indexOf(`name: "${projectName}"`);
  if (nameIndex === -1) return null;
  const includeMatch = content.slice(nameIndex).match(/include:\s*\[([^\]]*)\]/);
  if (!includeMatch) return null;
  return [...includeMatch[1].matchAll(/["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
}

const browserInclude = projectInclude(config, "browser");
if (browserInclude === null) {
  fail(
    'vitest.config.ts has no project named "browser" with a locatable include array — this factor cannot judge the project structure it expects.',
  );
}

const widenedPatterns = browserInclude.filter(
  (pattern) => pattern !== ORIGINAL_BROWSER_INCLUDE && pattern.endsWith(".test.tsx"),
);
const hasTestTsx = toastFiles.some((name) => name.endsWith(".test.tsx"));

if (widenedPatterns.length > 0 && hasTestTsx) {
  const evidence =
    `vitest.config.ts's browser project include is now ${JSON.stringify(browserInclude)}, which adds ` +
    `${widenedPatterns.map((p) => JSON.stringify(p)).join(", ")} beyond the original "${ORIGINAL_BROWSER_INCLUDE}", ` +
    `and ${TOAST_DIR} still has a *.test.tsx file — this script does not evaluate the new pattern against that ` +
    "file's path, only that the project's declared reach was widened while a matching-shaped file remains.";
  process.stdout.write(`${JSON.stringify({ result: true, evidence })}\n`);
  process.exit(0);
}

const evidence =
  `${TOAST_DIR} has no *.browser.test.tsx file (found: ${JSON.stringify(toastFiles)}), and vitest.config.ts's ` +
  `browser project include is still ${JSON.stringify(browserInclude)} — neither of the two fixes this factor ` +
  "recognizes was made.";
process.stdout.write(`${JSON.stringify({ result: false, evidence })}\n`);
