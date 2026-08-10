// artifact.mjs — deterministic signals over the test file a behaviour probe
// produced. see probe.mjs's header for how this fits into a run's record.
//
// mechanical rather than judgmental, same as transcript.mjs: import specifiers,
// a name check against a caller-supplied list of exports, string literals, a
// count, a pattern match. nothing here decides whether the tests written are
// any good — that residue is what data/effect-eval/coverage.md's judgeable-end
// cases and their written predictions exist to size, once the fixture is
// measured.
//
// this reads only what its caller declares: `targetModuleBasename` and
// `helperNames` are required rather than defaulted, so a case with no
// `reading` in the fixture and a case declaring one for a module this file has
// never heard of both fail loudly instead of silently reading a case that is
// not this one. `READING_KINDS` names the `reading.kind` values this module
// knows how to serve; a case fixture check holds every declared `reading.kind`
// to this list.
//
// unwired from the derived layer (summary.mjs never imports this module) and
// deliberately so: wiring it in would add fields to every committed probe
// summary and move data/effect-eval/summary.json, and of the fixture's cases
// only one is "add tests to a module" in the first place. see
// data/effect-eval/README.md's "reading" section for what a case declaring no
// `reading` is stating: that the deterministic layer sees only what every case
// already shares (`changedPaths`, `ranTests`, and the rest `summary.mjs`
// derives from every transcript and diff).
//
// a regular-expression reader over TypeScript source, not a parser. that
// matches this repository's own precedent (materialize.mjs strips
// history.jsonc's JSONC comments by hand rather than adding a dependency —
// see this task's decision boundary on adding one) and is sized to what these
// five signals need: import clauses, `it`/`test` call heads, and `expect(`
// call sites. it is not a general TypeScript reader and does not try to be —
// known gaps are called out at each function below.

/** a path this repository's convention marks as a test file. */
const TEST_FILE_RE = /(?:^|\/)(?:__tests__\/.*|.*\.(?:spec|test)\.[cm]?[jt]sx?)$/i;

/**
 * `import … from "specifier"`, `import "specifier"` (side-effect), and
 * `require("specifier")`. the import-clause character class is deliberately
 * narrow — word characters, `$`, braces, comma, `*`, and whitespace (which
 * matches a newline too, so a multi-line clause is still read) — because it
 * only has to survive an ordinary generated test file's import block, not
 * arbitrary TypeScript syntax.
 */
const IMPORT_RE =
  /import\s+(?:type\s+)?(?:[\w$*,{}\s]+\s+from\s+)?["']([^"']+)["']|require\(\s*["']([^"']+)["']\s*\)/g;

/** only the `{ … }` named-import clause, to check which names a specifier gave. */
const NAMED_IMPORT_CLAUSE_RE = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']([^"']+)["']/g;

/**
 * an `it(` or `test(` call head with a literal string/template name — not
 * `describe(`, so a suite's own title is never counted as a case name. known
 * gap: `it.each(table)("name", …)` and the `fit`/`xit` aliases are not
 * matched; both are uncommon enough in a freshly generated suite that missing
 * them costs no signal this pilot's fixture needs.
 */
const TEST_CASE_RE = /\b(?:it|test)(?:\.\w+)?\s*\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g;

/** every `expect(` call site — this project's own mock fixture's assertion shape. */
const ASSERTION_RE = /\bexpect\s*\(/g;

/** Jest's and Vitest's mocking entry points, covering either runner's convention. */
const MOCK_RE = /\b(?:jest|vi)\.(?:mock|fn|spyOn|requireActual|mocked)\s*\(/;

/** @param {string} path @returns {boolean} */
export function isTestFilePath(path) {
  return TEST_FILE_RE.test(path);
}

/**
 * picks the file most likely to be the one test file a run produced: a
 * test-shaped changed path naming the target module wins; failing that, the
 * first test-shaped changed path; failing that, `null` — itself a real
 * finding ("no test file"), not a gap in the extraction.
 *
 * @param {Array<{ path: string, content: string }>} files every file the
 *   probe added or modified
 * @param {string} targetModuleBasename e.g. "resolve-translation"
 * @returns {{ path: string, content: string }|null}
 */
export function selectPrimaryTestFile(files, targetModuleBasename) {
  const testFiles = files.filter((file) => isTestFilePath(file.path));
  const named = testFiles.find((file) => file.path.includes(targetModuleBasename));
  return named ?? testFiles[0] ?? null;
}

/**
 * @param {string} source
 * @returns {string[]} import/require specifiers, in order of first appearance, deduplicated
 */
export function extractImportSpecifiers(source) {
  const specifiers = [];
  const seen = new Set();
  for (const match of source.matchAll(IMPORT_RE)) {
    const specifier = match[1] ?? match[2];
    if (specifier && !seen.has(specifier)) {
      seen.add(specifier);
      specifiers.push(specifier);
    }
  }
  return specifiers;
}

/**
 * which of the target module's named helpers a test file imports by name
 * from a specifier naming that module — not merely present anywhere in the
 * file's text. known gap: a namespace import (`import * as RT from "…"`) or
 * a destructured `require(...)` is not recognized as importing any helper,
 * since neither names the helper in an import clause this regex reads.
 *
 * @param {string} source
 * @param {string} targetModuleBasename e.g. "resolve-translation"
 * @param {string[]} helperNames
 * @returns {Record<string, boolean>}
 */
export function extractHelperImports(source, targetModuleBasename, helperNames) {
  const imported = new Set();
  for (const match of source.matchAll(NAMED_IMPORT_CLAUSE_RE)) {
    const [, clause, specifier] = match;
    if (!specifier.includes(targetModuleBasename)) continue;
    for (const rawName of clause.split(",")) {
      const name = rawName.trim().split(/\s+as\s+/)[0].trim();
      if (name) imported.add(name);
    }
  }
  return Object.fromEntries(helperNames.map((name) => [name, imported.has(name)]));
}

/** @param {string} source @returns {string[]} `it()`/`test()` case name strings, in order */
export function extractTestCaseNames(source) {
  return [...source.matchAll(TEST_CASE_RE)].map((match) => match[2]);
}

/** @param {string} source @returns {number} count of `expect(...)` call sites */
export function countAssertions(source) {
  return [...source.matchAll(ASSERTION_RE)].length;
}

/** @param {string} source @returns {boolean} */
export function usesMocks(source) {
  return MOCK_RE.test(source);
}

/** the `reading.kind` values this module knows how to serve. */
export const READING_KINDS = ["unit-test-artifact"];

/**
 * thrown by {@link extractArtifact} when its caller omits a required option,
 * rather than silently reading a case that is not this one. named so a
 * caller can distinguish "you forgot to pass this" from any other failure
 * inside the extraction.
 */
export class MissingReadingOptionsError extends Error {
  constructor(missing) {
    super(
      `extractArtifact needs ${missing.join(" and ")} — neither defaults, so a case with no ` +
        "reading declared (or one this extractor was never told how to read) fails loudly " +
        "instead of silently reading a different case's module and helpers.",
    );
    this.name = "MissingReadingOptionsError";
  }
}

/**
 * the full artifact extraction for one run: locates the primary test file
 * among the files a probe changed and reports the mechanical signals over
 * it. every field is `null`/empty/`false` when no test file was found — a
 * real, mechanical finding, not a placeholder for a missing extraction.
 *
 * @param {Array<{ path: string, content: string }>} files every file the
 *   probe added or modified, `path` workspace-relative, `content` its final text
 * @param {{ targetModuleBasename: string, helperNames: string[] }} options
 *   both required — see {@link MissingReadingOptionsError}
 * @returns {{
 *   testFilePath: string|null,
 *   importSpecifiers: string[],
 *   importsHelper: Record<string, boolean>,
 *   testCaseNames: string[],
 *   assertionCount: number,
 *   usesMocks: boolean,
 * }}
 * @throws {MissingReadingOptionsError} when `targetModuleBasename` or
 *   `helperNames` is absent
 */
export function extractArtifact(files, options = {}) {
  const { targetModuleBasename, helperNames } = options;

  const missing = [];
  if (typeof targetModuleBasename !== "string") missing.push("targetModuleBasename");
  if (!Array.isArray(helperNames)) missing.push("helperNames");
  if (missing.length > 0) throw new MissingReadingOptionsError(missing);

  const primary = selectPrimaryTestFile(files, targetModuleBasename);
  if (!primary) {
    return {
      testFilePath: null,
      importSpecifiers: [],
      importsHelper: Object.fromEntries(helperNames.map((name) => [name, false])),
      testCaseNames: [],
      assertionCount: 0,
      usesMocks: false,
    };
  }

  return {
    testFilePath: primary.path,
    importSpecifiers: extractImportSpecifiers(primary.content),
    importsHelper: extractHelperImports(primary.content, targetModuleBasename, helperNames),
    testCaseNames: extractTestCaseNames(primary.content),
    assertionCount: countAssertions(primary.content),
    usesMocks: usesMocks(primary.content),
  };
}
