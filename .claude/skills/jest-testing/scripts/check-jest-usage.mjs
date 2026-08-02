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

/** `true` when the filename is a Jest spec by the default naming conventions. */
const isJestSpec = (name) =>
  SPEC_NAME.test(name) && SPEC_EXTENSIONS.has(path.extname(name));

/** Cypress's default spec suffix since version 10. */
const CYPRESS_SPEC = /\.cy\.[cm]?[jt]sx?$/i;

/**
 * Directories that conventionally belong to a different test runner, each with
 * the naming convention that runner actually uses.
 *
 * A Jest pattern reaching a file in one of these collects something Jest cannot
 * run — the other runner's imports do not resolve — and reports it as a failure
 * that has nothing to do with the code under test.
 *
 * Each entry needs its OWN convention: deciding "does this directory hold
 * tests?" with Jest's `.spec.`/`.test.` filter silently excused Cypress and
 * Maestro entirely, since neither names files that way, so those two branches
 * could never fire however broad the Jest pattern was.
 */
const FOREIGN_TEST_DIRECTORIES = [
  // A generic name both conventions are found under.
  {
    directory: "e2e",
    holds: (name) => isJestSpec(name) || CYPRESS_SPEC.test(name),
  },
  { directory: "playwright", holds: isJestSpec },
  // `.spec.*` is Cypress's pre-10 default and still widely configured.
  {
    directory: "cypress",
    holds: (name) => CYPRESS_SPEC.test(name) || isJestSpec(name),
  },
  // Maestro flows are YAML, which no realistic `testMatch` selects — listed so
  // a JS/TS file misfiled here is still caught.
  {
    directory: "maestro",
    holds: (name) => /\.ya?ml$/i.test(name) || isJestSpec(name),
  },
];

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

/**
 * Every file under `root` whose name satisfies `holds`, excluding skipped
 * directories. Defaults to Jest's own spec-naming convention.
 */
async function collectSpecs(root, holds = isJestSpec) {
  const entries = await readdir(root, { withFileTypes: true });
  const collected = [];

  for (const entry of entries) {
    const child = path.join(root, entry.name);

    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
      collected.push(...(await collectSpecs(child, holds)));
      continue;
    }

    if (!entry.isFile()) continue;
    if (!holds(entry.name)) continue;

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

/** Quote characters that open a string literal. */
const QUOTES = new Set(['"', "'", "`"]);

/**
 * Every string literal declared for `key` in a config source.
 *
 * Hand-scanned rather than matched with a single regular expression, because a
 * glob legitimately contains `]` inside a bracket class — `*.[jt]s?(x)` is the
 * shape of Jest's OWN default `testMatch` — and any pattern that stops at the
 * first `]` truncates the declaration mid-string and silently yields nothing.
 * That failure is invisible: the check reports no findings, which is
 * indistinguishable from a project that is correctly configured.
 *
 * Scanning skips whole string literals while tracking bracket depth, so a `]`
 * inside a pattern cannot end the array. Every occurrence of the key is read
 * rather than only the first, so a `projects` config declaring several is
 * covered too.
 *
 * The key itself may be quoted: `jest.config.json` is one of the formats this
 * script reads, and a JavaScript config may equally be written with quoted
 * properties. Missing that spelling failed the same silent way.
 */
function declaredPatterns(source, key) {
  const patterns = [];

  const declaration = new RegExp(`(?<![\\w$])${key}["']?\\s*:`, "g");

  for (const match of source.matchAll(declaration)) {
    let index = match.index + match[0].length;
    while (index < source.length && /\s/.test(source[index])) index += 1;

    /** Read the literal starting at `index`, advancing past its closing quote. */
    const readLiteral = () => {
      const quote = source[index];
      let cursor = index + 1;
      let value = "";

      while (cursor < source.length) {
        if (source[cursor] === "\\") {
          value += source[cursor + 1] ?? "";
          cursor += 2;
          continue;
        }
        if (source[cursor] === quote) {
          cursor += 1;
          break;
        }
        value += source[cursor];
        cursor += 1;
      }

      index = cursor;
      return value;
    };

    if (QUOTES.has(source[index])) {
      patterns.push(readLiteral());
      continue;
    }

    if (source[index] !== "[") continue;

    index += 1;
    let depth = 1;

    while (index < source.length && depth > 0) {
      const char = source[index];

      if (QUOTES.has(char)) {
        patterns.push(readLiteral());
        continue;
      }

      if (char === "[") depth += 1;
      else if (char === "]") depth -= 1;
      index += 1;
    }
  }

  return patterns;
}

/**
 * Findings for a discovery pattern reaching into another runner's directory.
 *
 * Only fires when that directory actually exists and holds test files, so a
 * project whose patterns merely could match one is not reported.
 */
async function checkForeignDiscovery(root, configPath, source) {
  // `testMatch` holds globs and `testRegex` holds regular expressions. They are
  // different languages and are judged separately below; feeding a regex to the
  // glob heuristic silently misreads it.
  const globs = declaredPatterns(source, "testMatch");
  const regexes = declaredPatterns(source, "testRegex");
  if (globs.length === 0 && regexes.length === 0) return [];

  const findings = [];

  for (const entry of FOREIGN_TEST_DIRECTORIES) {
    const specs = await foreignSpecs(root, entry);
    if (specs.length === 0) continue;

    const reaching =
      globs.find((glob) => globSelectsAny(glob, specs, root, entry.directory)) ??
      regexes.find((regex) => matchesAnyPath(regex, specs));
    if (reaching === undefined) continue;

    findings.push({
      file: configPath,
      message: `pattern ${JSON.stringify(reaching)} also selects ${entry.directory}/, which holds another runner's tests; Jest will collect files it cannot run.`,
    });
  }

  return findings;
}

/**
 * `true` when a `testMatch` glob selects any of `paths`.
 *
 * Split into two independent questions, because no single matcher available
 * here answers both the way Jest does:
 *
 *   Reachability — can the pattern descend into this directory at all? Decided
 *     structurally by `reachesDirectory`, from Jest's own matcher's behavior.
 *   Filename — could the pattern's last segment match this file's name? Decided
 *     by `path.matchesGlob` on the BASENAMES alone, where no path semantics are
 *     involved and it agrees with the picomatch family Jest uses.
 *
 * Matching whole paths with `path.matchesGlob` was tried and is wrong: it and
 * Jest's matcher disagree on an unanchored pattern — `*​/**​/*.test.ts` selects
 * `e2e/journey.test.ts` under Jest and does not under `matchesGlob` — so it
 * looked exact while quietly missing cases.
 */
function globSelectsAny(pattern, paths, root, directory) {
  if (!reachesDirectory(pattern, root, directory)) return false;

  const basename = pattern.split("/").pop() ?? "";

  // Without a matcher, fall back to Jest's own naming convention: a file it
  // would not recognise as a spec is one a default pattern does not collect.
  if (typeof path.matchesGlob !== "function") {
    return paths.some((candidate) => isJestSpec(path.basename(candidate)));
  }

  try {
    return paths.some((candidate) =>
      path.matchesGlob(path.basename(candidate), basename),
    );
  } catch {
    // A malformed glob is a different defect, and Jest reports it itself.
    return false;
  }
}

/**
 * Absolute paths of the files under `root/<entry.directory>` that belong to
 * that runner, by its own naming convention.
 *
 * Absolute, not root-relative, because Jest applies both `testMatch` and
 * `testRegex` to the full path. An anchored pattern like `^e2e/` therefore
 * matches nothing under real Jest — verified against 30.4.2, whose
 * `--listTests` returns no files for it — while against a relative path it
 * would appear to match, reporting a defect that is not there.
 */
async function foreignSpecs(root, entry) {
  const candidate = path.join(root, entry.directory);

  try {
    if (!(await stat(candidate)).isDirectory()) return [];
  } catch {
    return [];
  }

  return (await collectSpecs(candidate, entry.holds)).map((spec) =>
    path.resolve(spec).split(path.sep).join("/"),
  );
}

/**
 * `true` when `pattern`, read as a regular expression, matches any of `paths`.
 *
 * This is how Jest itself decides `testRegex`, so testing the pattern against
 * the absolute paths actually on disk is exact rather than heuristic. An
 * invalid pattern is not a finding — it is a different defect, and one Jest
 * reports on its own.
 */
function matchesAnyPath(pattern, paths) {
  let expression;
  try {
    expression = new RegExp(pattern);
  } catch {
    return false;
  }
  return paths.some((candidate) => expression.test(candidate));
}

/**
 * `true` when a `testMatch` glob would select files under `directory`.
 *
 * Decided on the leading path segment, because only that segment determines
 * whether the glob can descend into a sibling directory at all:
 *
 *   `**` matches any number of segments, so it reaches everywhere.
 *   `*`  matches exactly one segment and CANNOT cross a `/`, so it reaches a
 *        subdirectory only when another segment follows it.
 *   anything literal anchors the glob elsewhere.
 *
 * The `*` distinction is the one worth stating: `<rootDir>/*.test.ts` selects
 * only files sitting at the project root — verified against `jest` 30.4.2,
 * whose `--listTests` returns the root file alone for that pattern. Treating it
 * as recursive produced a finding against a config that is entirely correct,
 * which is worse than saying nothing, since this script's whole contract is
 * that a report is a real defect.
 *
 * Deliberately a structural check rather than full glob matching, which would
 * need a dependency this script does not take — so it errs toward silence.
 *
 * Globs only. A `testRegex` is a different language and is judged by
 * `matchesAnyPath` against the paths actually on disk.
 */
function reachesDirectory(pattern, root, directory) {
  const absoluteRoot = path.resolve(root).split(path.sep).join("/");
  const expanded = pattern.replaceAll("<rootDir>", absoluteRoot);

  let remainder;

  if (expanded.startsWith("/")) {
    // An absolute pattern anchored outside this project cannot reach it.
    if (!expanded.startsWith(`${absoluteRoot}/`)) return false;
    remainder = expanded.slice(absoluteRoot.length + 1);
  } else {
    // Jest matches the pattern as written against an ABSOLUTE path, so a
    // literal leading segment can never match — `e2e/**/*.test.ts` selects
    // nothing at all. A leading wildcard still can, because it absorbs the
    // path's own leading segments.
    const [head] = expanded.split("/");
    if (head !== "*" && head !== "**") return false;
    remainder = expanded;
  }

  if (remainder.startsWith(`${directory}/`)) return true;

  const segments = remainder.split("/");
  const [head] = segments;

  if (head === "**") return true;

  // A lone `*` stands in for one directory name — possibly the foreign one —
  // but only where a further segment follows. Alone it is a filename glob.
  return head === "*" && segments.length > 1;
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
