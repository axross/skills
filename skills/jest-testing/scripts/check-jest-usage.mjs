#!/usr/bin/env node
// check-jest-usage.mjs — a floor check for a project's Jest specs and config.
//
// This validates the four Jest rules that are decidable from source alone AND
// whose failure mode is silent — nothing errors, the suite reports green, and
// the defect surfaces later as an unexplained failure, a false pass, or a
// broken upgrade. Every other rule in the jest-testing skill needs judgment, so
// it is deliberately not here: a report from this script is always a real
// defect, never an argument.
//
// What it checks, per project root:
//   Specs (every test file under the root)
//     - a file importing SOME of the Jest API from @jest/globals while taking
//       the rest off the global object; it passes today and breaks the moment
//       injectGlobals is disabled, and no lint rule reports it
//     - `it` and `test` both used as case functions in one file
//     - an API removed in Jest 30 — a matcher alias, genMockFromModule, or the
//       SpyInstance type — which throws only when that line finally executes
//   Configuration (from a Jest config file)
//     - a testMatch/testRegex that also selects a directory belonging to a
//       different test runner, so Jest collects tests it cannot run
//
// What it does NOT check
//   Everything the skill actually turns on: whether a mock stands at a real
//   boundary, whether an assertion pins behavior or a framework's scheduling,
//   whether a snapshot was ever read, whether the clock should have been faked,
//   or whether a test would fail for the regression it exists to catch. A
//   passing run is a floor, not a conformance claim.
//
// Usage:
//   node check-jest-usage.mjs <project-root> [<project-root> ...]

import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

/** Directories never worth walking: dependencies and build output. */
const SKIPPED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  ".next",
  ".expo",
  "dist",
  "build",
  "out",
  "coverage",
  "vendor",
  ".turbo",
]);

/** Extensions a Jest spec may carry. */
const SPEC_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
]);

/** A spec filename, matching Jest's own default naming conventions. */
const SPEC_NAME = /\.(?:spec|test)\.[a-z]+$/i;

/** Config filenames Jest reads, in the order it resolves them. */
const CONFIG_FILES = [
  "jest.config.js",
  "jest.config.cjs",
  "jest.config.mjs",
  "jest.config.ts",
  "jest.config.json",
];

/**
 * Directory names that conventionally belong to a different test runner.
 *
 * A Jest pattern reaching into one of these collects files Jest cannot run —
 * the other runner's imports do not resolve — and reports them as failures
 * that have nothing to do with the code under test.
 */
const FOREIGN_TEST_DIRECTORIES = ["e2e", "playwright", "cypress", "maestro"];

/**
 * The Jest API symbols a spec may import from `@jest/globals`.
 * `jest` is excluded: it is legitimately absent from a spec that mocks nothing.
 */
const API_SYMBOLS = [
  "describe",
  "it",
  "test",
  "expect",
  "beforeAll",
  "beforeEach",
  "afterAll",
  "afterEach",
];

/** APIs removed in Jest 30, mapped to their replacements. */
const REMOVED_APIS = new Map([
  ["toBeCalled", "toHaveBeenCalled"],
  ["toBeCalledTimes", "toHaveBeenCalledTimes"],
  ["toBeCalledWith", "toHaveBeenCalledWith"],
  ["lastCalledWith", "toHaveBeenLastCalledWith"],
  ["nthCalledWith", "toHaveBeenNthCalledWith"],
  ["toReturn", "toHaveReturned"],
  ["toReturnTimes", "toHaveReturnedTimes"],
  ["toReturnWith", "toHaveReturnedWith"],
  ["lastReturnedWith", "toHaveLastReturnedWith"],
  ["nthReturnedWith", "toHaveNthReturnedWith"],
  ["toThrowError", "toThrow"],
  ["genMockFromModule", "createMockFromModule"],
  ["SpyInstance", "Spied"],
]);

/** Read a file, or return `null` when it is absent or unreadable. */
async function readIfPresent(candidate) {
  try {
    return await readFile(candidate, "utf8");
  } catch {
    return null;
  }
}

/** `true` when the path exists and is a regular file. */
async function isFile(candidate) {
  try {
    return (await stat(candidate)).isFile();
  } catch {
    return false;
  }
}

/** Every spec file under `root`, excluding skipped directories. */
async function collectSpecs(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const collected = [];

  for (const entry of entries) {
    const child = path.join(root, entry.name);

    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
      collected.push(...(await collectSpecs(child)));
      continue;
    }

    if (!entry.isFile()) continue;
    if (!SPEC_NAME.test(entry.name)) continue;
    if (!SPEC_EXTENSIONS.has(path.extname(entry.name))) continue;

    collected.push(child);
  }

  return collected;
}

/**
 * Source with comments blanked out, and — when `blankStrings` is set — string
 * literals too. Length is preserved so line numbers still line up.
 *
 * Two variants are needed because the checks disagree about strings. Detecting
 * a *call* must ignore them, so a symbol named inside a test title or an error
 * message is not counted. Detecting an *import specifier* or a `testMatch`
 * pattern must keep them, since the value being matched IS a string literal.
 */
function stripSource(source, { blankStrings }) {
  let out = "";
  let index = 0;

  while (index < source.length) {
    const two = source.slice(index, index + 2);

    if (two === "//") {
      const end = source.indexOf("\n", index);
      const stop = end === -1 ? source.length : end;
      out += " ".repeat(stop - index);
      index = stop;
      continue;
    }

    if (two === "/*") {
      const end = source.indexOf("*/", index + 2);
      const stop = end === -1 ? source.length : end + 2;
      // Keep newlines so line numbers survive.
      out += source.slice(index, stop).replace(/[^\n]/g, " ");
      index = stop;
      continue;
    }

    const char = source[index];

    if (char === '"' || char === "'" || char === "`") {
      let cursor = index + 1;
      while (cursor < source.length) {
        if (source[cursor] === "\\") {
          cursor += 2;
          continue;
        }
        if (source[cursor] === char) {
          cursor += 1;
          break;
        }
        cursor += 1;
      }
      const literal = source.slice(index, cursor);
      out += blankStrings ? literal.replace(/[^\n]/g, " ") : literal;
      index = cursor;
      continue;
    }

    out += char;
    index += 1;
  }

  return out;
}

/** Source with comments and string literals blanked out — for detecting calls. */
const stripNoise = (source) => stripSource(source, { blankStrings: true });

/** Source with only comments blanked out — for reading string literals. */
const stripComments = (source) => stripSource(source, { blankStrings: false });

/** The symbols a file imports from `@jest/globals`, or `null` if it imports none. */
function importedApiSymbols(code) {
  const importMatch = code.match(
    /import\s*\{([^}]*)\}\s*from\s*["']@jest\/globals["']/,
  );
  const requireMatch = code.match(
    /(?:const|let|var)\s*\{([^}]*)\}\s*=\s*require\(\s*["']@jest\/globals["']\s*\)/,
  );
  const clause = importMatch?.[1] ?? requireMatch?.[1];
  if (clause === undefined) return null;

  return new Set(
    clause
      .split(",")
      .map((entry) => entry.split(/\s+as\s+/)[0].trim())
      .filter(Boolean),
  );
}

/** `true` when `symbol` appears as a call in `code`. */
function isCalled(code, symbol) {
  return new RegExp(`(?<![.\\w$])${symbol}\\s*(?:\\.\\s*\\w+\\s*)*\\(`).test(
    code,
  );
}

/**
 * Findings for a partially imported test API.
 *
 * `text` keeps its string literals, so the `@jest/globals` specifier is
 * readable; `code` has them blanked, so a symbol named in a test title is not
 * counted as a call.
 */
function checkPartialImport(text, code) {
  const imported = importedApiSymbols(text);
  if (imported === null) return [];

  const inherited = API_SYMBOLS.filter(
    (symbol) => !imported.has(symbol) && isCalled(code, symbol),
  );
  if (inherited.length === 0) return [];

  return [
    {
      message: `imports ${[...imported].sort().join(", ")} from @jest/globals but takes ${inherited.join(", ")} from the global object; the file is not actually importing its test API and breaks under injectGlobals: false.`,
    },
  ];
}

/** Findings for `it` and `test` mixed in one file. */
function checkMixedCaseFunctions(code) {
  const usesIt = isCalled(code, "it");
  const usesTest = isCalled(code, "test");
  if (!usesIt || !usesTest) return [];

  return [
    {
      message:
        "uses both `it` and `test` as case functions; pick one and hold the project to it.",
    },
  ];
}

/** Findings for APIs removed in Jest 30, with line numbers. */
function checkRemovedApis(code) {
  const findings = [];

  code.split("\n").forEach((line, index) => {
    for (const [removed, replacement] of REMOVED_APIS) {
      // Only a member access counts: `.toBeCalled(` or `.SpyInstance<`.
      if (!new RegExp(`\\.\\s*${removed}\\s*[(<]`).test(line)) continue;
      findings.push({
        line: index + 1,
        message: `\`${removed}\` was removed in Jest 30; use \`${replacement}\` instead.`,
      });
    }
  });

  return findings;
}

/** The nearest Jest config file in `root`, or `null`. */
async function findConfig(root) {
  for (const name of CONFIG_FILES) {
    const candidate = path.join(root, name);
    if (await isFile(candidate)) return candidate;
  }
  return null;
}

/**
 * Findings for a discovery pattern reaching into another runner's directory.
 *
 * Only fires when that directory actually exists and holds test files, so a
 * project whose patterns merely could match one is not reported.
 */
async function checkForeignDiscovery(root, configPath, source) {
  // Every string literal in a testMatch or testRegex array.
  const patterns = [];
  for (const key of ["testMatch", "testRegex"]) {
    const declaration = source.match(
      new RegExp(`${key}\\s*:\\s*(\\[[^\\]]*\\]|["'\`][^"'\`]*["'\`])`),
    );
    if (declaration === null) continue;
    for (const literal of declaration[1].matchAll(/["'`]([^"'`]+)["'`]/g)) {
      patterns.push(literal[1]);
    }
  }
  if (patterns.length === 0) return [];

  const findings = [];

  for (const directory of FOREIGN_TEST_DIRECTORIES) {
    const candidate = path.join(root, directory);
    if (!(await isDirectoryWithSpecs(candidate))) continue;

    const reaching = patterns.filter((pattern) =>
      selectsDirectory(pattern, directory),
    );
    if (reaching.length === 0) continue;

    findings.push({
      file: configPath,
      message: `pattern ${JSON.stringify(reaching[0])} also selects ${directory}/, which holds another runner's tests; Jest will collect files it cannot run.`,
    });
  }

  return findings;
}

/** `true` when the directory exists and contains at least one spec file. */
async function isDirectoryWithSpecs(candidate) {
  try {
    if (!(await stat(candidate)).isDirectory()) return false;
  } catch {
    return false;
  }
  return (await collectSpecs(candidate)).length > 0;
}

/**
 * `true` when `pattern` would select files under `directory`.
 *
 * A pattern anchored at a different top-level directory cannot reach it; an
 * unanchored recursive pattern can.
 */
function selectsDirectory(pattern, directory) {
  const normalized = pattern.replace("<rootDir>/", "").replace(/^\.\//, "");

  // Explicitly names the directory.
  if (normalized.startsWith(`${directory}/`)) return true;

  // Anchored somewhere else — a literal first segment that is not a wildcard.
  const [head] = normalized.split("/");
  if (head !== "" && !head.includes("*")) return false;

  // Starts with a recursive wildcard, so it reaches every directory.
  return normalized.startsWith("**") || normalized.startsWith("*");
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

const USAGE = `Usage: check-jest-usage.mjs <project-root> [<project-root> ...]

Check the four Jest rules decidable from source whose failure is silent: a spec
importing only part of its test API from @jest/globals, a spec mixing \`it\` and
\`test\`, an API removed in Jest 30, and a testMatch/testRegex that also selects
another test runner's directory.

Each <project-root> is a directory holding a package.json. The spec checks run
over every *.spec.* and *.test.* file under it; the discovery check runs only
when a Jest config file is present.

A passing run is a floor, not a conformance claim.

Exit codes: 0 every project passed, 1 one or more findings, 2 bad invocation.`;

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(`${USAGE}\n`);
    process.exit(0);
  }

  const roots = args.filter((arg) => !arg.startsWith("--"));
  if (roots.length === 0) fail(USAGE);

  let findings = 0;
  let unreadable = 0;
  let checked = 0;

  for (const root of roots) {
    if (!(await isFile(path.join(root, "package.json")))) {
      process.stderr.write(`Cannot read a package.json in ${root}\n`);
      unreadable += 1;
      continue;
    }

    checked += 1;

    let specs;
    try {
      specs = await collectSpecs(root);
    } catch (error) {
      process.stderr.write(`Cannot read ${root}: ${error.message}\n`);
      unreadable += 1;
      continue;
    }

    for (const spec of specs.sort()) {
      const source = await readIfPresent(spec);
      if (source === null) {
        process.stderr.write(`Cannot read ${spec}\n`);
        unreadable += 1;
        continue;
      }

      const code = stripNoise(source);
      const specFindings = [
        ...checkPartialImport(stripComments(source), code),
        ...checkMixedCaseFunctions(code),
        ...checkRemovedApis(code),
      ];

      for (const finding of specFindings) {
        const at = finding.line === undefined ? spec : `${spec}:${finding.line}`;
        process.stdout.write(`${at}  ${finding.message}\n`);
        findings += 1;
      }
    }

    const configPath = await findConfig(root);
    if (configPath !== null) {
      const configSource = await readIfPresent(configPath);
      if (configSource === null) {
        process.stderr.write(`Cannot read ${configPath}\n`);
        unreadable += 1;
      } else {
        for (const finding of await checkForeignDiscovery(
          root,
          configPath,
          stripComments(configSource),
        )) {
          process.stdout.write(`${finding.file}  ${finding.message}\n`);
          findings += 1;
        }
      }
    }
  }

  process.stdout.write(
    findings === 0
      ? `All ${checked} project(s) passed the Jest usage checks.\n`
      : `${findings} finding(s) across ${checked} checked project(s).\n`,
  );

  process.exit(findings > 0 || unreadable > 0 ? 1 : 0);
}

await main();
