#!/usr/bin/env node
// check-amplitude-wiring.mjs — Amplitude wiring validator.
//
// Three checks, each drawn from a real defect found in a real repository, and
// each chosen because it is mechanically decidable with a low false-positive
// rate (see ../SKILL.md and its references). Everything else this skill teaches
// needs project context or rides a fast-moving option surface, so it stays
// prose rather than becoming a check that cries wolf.
//
//   1. An Amplitude API key literal in a source file. The key is public by
//      design, so this is not a secret leak — it is a key that cannot vary by
//      environment and cannot be rotated without a release.
//   2. An Amplitude or Ampli secret-tier credential behind a public
//      environment prefix (NEXT_PUBLIC_ / EXPO_PUBLIC_). Unlike the API key,
//      these genuinely must not reach a client bundle. A public prefix on an
//      ordinary Amplitude API key is correct and is NOT reported.
//   3. A project using @amplitude/analytics-react-native whose manifest does
//      not declare @react-native-async-storage/async-storage at all. That
//      package backs both the event queue and the identity store, so its total
//      absence means identity resets on every launch.
//
//      Deliberately narrow: a devDependencies-only declaration is NOT reported.
//      React Native CLI autolinking scans both dependency sections, so that
//      placement usually still links the native module. It is a correctness
//      problem the skill covers in prose, not a decidable failure.
//
// Dependency-light (Node standard library only) so it runs anywhere the skill
// is installed. It is not wired into this repository's gate set.
//
// Usage:
//   node check-amplitude-wiring.mjs [<dir>]   # defaults to the current directory
//
// Exit codes:
//   0  no violations found
//   1  one or more violations, or a path that could not be read
//   2  bad invocation

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const USAGE = `Usage: check-amplitude-wiring.mjs [<dir>]

Check a project for three high-cost Amplitude wiring failures:
  1. an Amplitude API key literal in a source file
  2. an Amplitude/Ampli secret-tier credential behind NEXT_PUBLIC_/EXPO_PUBLIC_
  3. the React Native SDK with no AsyncStorage declaration in the manifest

Defaults to the current directory.

Exit codes: 0 no violations, 1 violations found or path unreadable, 2 bad invocation.`;

/** Directories never worth walking — vendored, generated, or build output. */
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".expo",
  ".dart_tool",
  "dist",
  "build",
  "coverage",
  "Pods",
  "vendor",
]);

/** Source extensions the literal and prefix checks scan. */
const SOURCE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".dart",
  ".swift",
  ".kt",
  ".java",
];

/** An Amplitude API key is a 32-character hex string. */
const API_KEY_RE = /['"`]([0-9a-f]{32})['"`]/gi;

/**
 * A public-prefixed environment variable naming an Amplitude or Ampli
 * credential of the secret tier. An ordinary API key behind a public prefix is
 * correct, so SECRET or TOKEN must appear for this to fire.
 */
const PUBLIC_SECRET_RE =
  /\b((?:NEXT_PUBLIC|EXPO_PUBLIC)_[A-Z0-9_]*(?:AMPLITUDE|AMPLI)[A-Z0-9_]*)\b/g;

function isSourceFile(name) {
  return SOURCE_EXTENSIONS.some((extension) => name.endsWith(extension));
}

function isEnvFile(name) {
  return name === ".env" || name.startsWith(".env.");
}

/** Walk a directory, yielding files the checks care about. */
function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // an unreadable subdirectory is skipped, not fatal
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

function read(file) {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

/**
 * Check 1 — an Amplitude API key literal in a source file.
 *
 * Scoped to files that mention Amplitude, so an unrelated 32-character hex
 * constant elsewhere in the project is not reported.
 */
function checkApiKeyLiteral(file, text, root, violations) {
  if (!/amplitude/i.test(text)) return;
  const lines = text.split("\n");
  lines.forEach((line, index) => {
    for (const match of line.matchAll(API_KEY_RE)) {
      violations.push(
        `${relative(root, file)}:${index + 1}: Amplitude API key literal "${match[1]}" — ` +
          `read it from configuration instead; a literal cannot vary by environment or be rotated without a release.`,
      );
    }
  });
}

/** Check 2 — a secret-tier Amplitude credential behind a public prefix. */
function checkPublicSecret(file, text, root, violations) {
  const lines = text.split("\n");
  lines.forEach((line, index) => {
    for (const match of line.matchAll(PUBLIC_SECRET_RE)) {
      const name = match[1];
      if (!/SECRET|TOKEN/.test(name)) continue; // a public API key is correct
      violations.push(
        `${relative(root, file)}:${index + 1}: "${name}" exposes a secret-tier Amplitude credential ` +
          `through a public environment prefix — it reaches the client bundle. Keep it server-side.`,
      );
    }
  });
}

/** Check 3 — the React Native SDK with no AsyncStorage declaration at all. */
function checkAsyncStorage(file, text, root, violations) {
  let manifest;
  try {
    manifest = JSON.parse(text);
  } catch {
    return; // an unparseable package.json is not this validator's finding
  }
  const sections = [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.peerDependencies,
    manifest.optionalDependencies,
  ].filter((section) => section && typeof section === "object");

  const declares = (name) => sections.some((section) => name in section);

  if (!declares("@amplitude/analytics-react-native")) return;
  if (declares("@react-native-async-storage/async-storage")) return;

  violations.push(
    `${relative(root, file)}: depends on @amplitude/analytics-react-native but does not declare ` +
      `@react-native-async-storage/async-storage anywhere in the manifest — it backs both the event ` +
      `queue and the identity store, so the device id regenerates on every launch.`,
  );
}

function main() {
  const args = process.argv.slice(2);

  if (args[0] === "--help" || args[0] === "-h") {
    process.stdout.write(`${USAGE}\n`);
    process.exit(0);
  }
  if (args.length > 1 || (args[0] ?? "").startsWith("-")) {
    process.stderr.write(`${USAGE}\n`);
    process.exit(2);
  }

  const root = args[0] ?? ".";
  try {
    if (!statSync(root).isDirectory()) {
      process.stderr.write(`Not a directory: ${root}\n`);
      process.exit(1);
    }
  } catch (error) {
    process.stderr.write(`Cannot read "${root}": ${error.message}\n`);
    process.exit(1);
  }

  const violations = [];
  let scanned = 0;

  for (const file of walk(root)) {
    const name = file.split(sep).pop();
    const isManifest = name === "package.json";
    if (!isSourceFile(name) && !isEnvFile(name) && !isManifest) continue;

    const text = read(file);
    if (text === null) continue;
    scanned += 1;

    if (isSourceFile(name)) checkApiKeyLiteral(file, text, root, violations);
    if (isSourceFile(name) || isEnvFile(name)) {
      checkPublicSecret(file, text, root, violations);
    }
    if (isManifest) checkAsyncStorage(file, text, root, violations);
  }

  if (violations.length === 0) {
    process.stdout.write(
      `Amplitude wiring OK — no violations across ${scanned} file(s).\n`,
    );
    process.exit(0);
  }

  process.stderr.write("Amplitude wiring violations:\n");
  for (const violation of violations) {
    process.stderr.write(`  - ${violation}\n`);
  }
  process.exit(1);
}

main();
