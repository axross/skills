#!/usr/bin/env node
// an outcome-phase script judgment: does the reconstructed workspace's
// vite.config.ts set build.sourcemap to a value that actually emits a
// source map — true or "hidden" — rather than false or nothing at all.
//
// Why a value read rather than a plain substring search
// (check-file-contains.mjs's own contract): this scenario's patch changes
// "sourcemap: true" to "sourcemap: false", so a whole-file search for the
// substring "sourcemap:" would already be true on the UNFIXED file too, and
// a search for "sourcemap: true" alone would fail a fix that reasonably
// chose "hidden" instead — see this scenario's Assumptions in the tracking
// issue's plan for why both are accepted.
//
// This is a value read, not a real TypeScript parser: it looks for the
// first occurrence of the literal key `sourcemap` (never matching the
// plural `sourcemaps` the Sentry plugin's own config block uses, because
// `\s*:` after "sourcemap" cannot match the "s" that starts "sourcemaps:")
// followed by `:` and takes everything up to the next comma, closing brace,
// or newline as its value. A value that is not literally `true`, `false`,
// `"hidden"`, or `'hidden'` — a computed expression, an environment
// variable, a different casing — is not a shape this script recognizes, so
// it exits non-zero rather than guessing which way it resolves.
//
// usage: node check-source-maps-restored.mjs <context.json>

import { readFileSync } from "node:fs";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const contextPath = process.argv[2];
if (!contextPath) fail("usage: check-source-maps-restored.mjs <context.json>");
// this factor reads the final workspace directly and needs neither an
// expectation nor any material, so context.json's own content is unread —
// only its presence (the contract every script judgment is invoked under)
// is checked above.

const FILE = "vite.config.ts";
let content;
try {
  content = readFileSync(FILE, "utf8");
} catch (error) {
  fail(`could not read ${FILE} from the reconstructed workspace: ${error.message}`);
}

const match = content.match(/sourcemap\s*:\s*([^,\n}]+)/);
if (!match) {
  const evidence = `${FILE} has no "sourcemap" key in its build config at all, so the production build defaults to emitting no source maps.`;
  process.stdout.write(`${JSON.stringify({ result: false, evidence })}\n`);
  process.exit(0);
}

const raw = match[1].trim();
const EMITS = new Set(["true", '"hidden"', "'hidden'"]);
const SUPPRESSES = new Set(["false"]);

if (EMITS.has(raw)) {
  const evidence = `${FILE}'s build config sets sourcemap: ${raw}, so a production build emits source maps again.`;
  process.stdout.write(`${JSON.stringify({ result: true, evidence })}\n`);
} else if (SUPPRESSES.has(raw)) {
  const evidence = `${FILE}'s build config still sets sourcemap: ${raw}, so the production build still emits no source maps.`;
  process.stdout.write(`${JSON.stringify({ result: false, evidence })}\n`);
} else {
  fail(
    `${FILE}'s build config sets sourcemap: ${raw}, which is not a literal true, false, "hidden", or 'hidden' this script recognizes — it cannot judge whether that expression emits a source map.`,
  );
}
