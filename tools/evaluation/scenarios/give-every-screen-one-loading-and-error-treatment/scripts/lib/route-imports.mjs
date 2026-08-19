// route-imports.mjs — parsing and resolving relative imports in this mock's
// Prettier-formatted TSX, shared by check-shared-extracted-module.mjs and
// check-screens-keep-distinct-content.mjs.
//
// Extracted rather than copy-pasted (as an earlier version of both scripts
// did) because the two scripts' own descriptions promise they agree on what
// "the shared module" is — pulls-the-two-screens-onto-one-shared-module
// detects it, lets-each-screen-say-its-own-thing re-derives it "the same
// way" — and nothing enforced that when the logic lived twice. A fix to
// resolution now lands once for both factors instead of needing to be
// applied, and kept in sync, in two places.
//
// factor-judgment.mjs invokes a judgment script as
// `spawnSync(process.execPath, [resolve(scriptPath), contextPath], { cwd: workspace })`
// — the script runs from its own path in this repository, so an ordinary
// relative ESM import of a sibling module resolves normally. This file is
// never invoked directly by factor-judgment.mjs and carries no
// `#!/usr/bin/env node` shebang for that reason.

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

/**
 * the two route files both this scenario's factor scripts read — the
 * scenario's own subject. Declared once here rather than in each entry
 * script for the same reason the parsing and resolution logic around it
 * is: pulls-the-two-screens-onto-one-shared-module and
 * lets-each-screen-say-its-own-thing must agree on which two files they
 * are reading, and a change to that pair (a third screen added to the
 * scenario's own subject, say) should not risk landing in one script and
 * not the other.
 */
export const ROUTE_FILES = ["src/routes/PostListPage.tsx", "src/routes/PostEditorPage.tsx"];

/**
 * every path a unified diff ADDED, read from its "--- /dev/null" /
 * "+++ b/<path>" pair — the shape `git diff` always writes for a new file,
 * regardless of how the hunks inside are shaped.
 *
 * @param {string} diffText
 * @returns {Set<string>}
 */
export function addedFilesFromDiff(diffText) {
  const added = new Set();
  const lines = diffText.split("\n");
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i] === "--- /dev/null" && lines[i + 1].startsWith("+++ ")) {
      added.add(lines[i + 1].slice(4).replace(/^b\//, "").trim());
    }
  }
  return added;
}

/**
 * the local identifier names one import clause binds — default, namespace,
 * and named (including `X as Y` aliasing and a leading `type`).
 *
 * @param {string} clause the text between "import"/"export" and "from"
 * @returns {string[]}
 */
export function boundNamesFromClause(clause) {
  const names = [];
  const text = clause.trim().replace(/^type\s+/, "");
  const nsMatch = text.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
  if (nsMatch) names.push(nsMatch[1]);
  const namedMatch = text.match(/\{([\s\S]*)\}/);
  if (namedMatch) {
    for (const part of namedMatch[1].split(",")) {
      const piece = part.trim().replace(/^type\s+/, "");
      if (!piece) continue;
      const asMatch = piece.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/);
      if (asMatch) names.push(asMatch[2]);
      else {
        const bare = piece.match(/^([A-Za-z_$][\w$]*)$/);
        if (bare) names.push(bare[1]);
      }
    }
  }
  const beforeBraceOrStar = text.split(/[{*]/)[0];
  const defaultMatch = beforeBraceOrStar.match(/^([A-Za-z_$][\w$]*)/);
  if (defaultMatch) names.push(defaultMatch[1]);
  return [...new Set(names)];
}

/**
 * strips `//` and `/* *\/` comments from `text`, leaving every other
 * character — including a comment-LIKE sequence inside a single-, double-,
 * or backtick-quoted string, which is not a comment and is walked over
 * untouched (escapes respected). A `//` comment's own characters are
 * dropped outright; a `/* *\/` comment's non-newline characters become
 * spaces and its own newlines are kept as newlines, so a caller's line
 * arithmetic over the result (`text.slice(0, i).split("\n").length`) still
 * lines up with the original source. importsIn's own clauseRe is
 * unbounded-lazy (`[\s\S]*?`) between "import"/"export" and the next
 * "from \"...\"", which is exactly the shape a same-named mention inside an
 * ordinary code comment — "// Mirrors the pattern from '../components/X'"
 * — can satisfy; stripping comments first is what keeps that mention from
 * ever reaching the regex at all. Exported for the same reason: a shared
 * component's own usage capture in the sibling script (usageSpansFor in
 * check-screens-keep-distinct-content.mjs) scans a route file's raw
 * content for the same tag/call shapes, and without stripping first, a
 * comment merely MENTIONING the component in tag shape — "// See
 * <LoadingError message=\"...\" /> for the older shape." — is read as a
 * real usage span.
 *
 * @param {string} text
 * @returns {string}
 */
export function stripComments(text) {
  let out = "";
  let quote = null;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (quote) {
      out += ch;
      if (ch === "\\" && i + 1 < text.length) {
        out += text[i + 1];
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      out += ch;
      i++;
      continue;
    }
    if (ch === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      continue; // leaves the newline itself for the next loop turn
    }
    if (ch === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) {
        out += text[i] === "\n" ? "\n" : " ";
        i++;
      }
      i += 2; // past the closing */
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

/**
 * true when `clause` — the text between "import"/"export" and "from" —
 * contains a `;` or a blank line. An import clause never contains either;
 * either one appearing means clauseRe's lazy-but-unbounded match spanned
 * past a real statement boundary onto some later, unrelated "from \"...\"".
 * This is belt-and-braces behind stripComments, not a replacement for it:
 * a comment stripped to spaces can still leave the clause looking
 * superficially plausible, and this check is what catches a match that
 * still crossed a statement it should not have.
 *
 * @param {string} clause
 * @returns {boolean}
 */
function clauseCrossesAStatementBoundary(clause) {
  return clause.includes(";") || /\n[ \t]*\r?\n/.test(clause);
}

/**
 * every import statement's specifier in `content`, paired with the bound
 * local identifier names and the source line range the whole clause
 * occupies — good enough for the Prettier-formatted TSX this mock's route
 * files are written in, not a full parser. Re-exports ("export ... from")
 * are included too, since a barrel-style extraction could plausibly
 * re-export rather than import. Comments are stripped first (see
 * stripComments), and a match whose own clause still crosses what would be
 * a statement boundary is rejected (see clauseCrossesAStatementBoundary),
 * so a mention of an import-shaped phrase inside a code comment can never
 * be read as an import.
 *
 * Both patterns below anchor "import"/"export" to the START of a line
 * (`^[ \t]*`, multiline) rather than a bare `\b`. stripComments does not
 * understand regex-literal syntax, so a regex like `/^\/posts\//` carries a
 * genuine `//` in its own text (the escaped `\/` before the closing `/`)
 * that reads exactly like a line comment and strips the rest of that
 * source line. A bare `\b` would still let the clause regex match an
 * "import"/"export" keyword that a stripped-and-corrupted line happened to
 * expose mid-line; anchoring to line start closes that off structurally
 * rather than probabilistically, because Prettier never places an import
 * or export declaration anywhere but the start of its own line — the same
 * guarantee a same-line regex-literal corruption can never violate, since
 * a `//`-shaped strip stops at the first newline and can't manufacture a
 * new line start mid-corruption.
 *
 * @param {string} content
 * @returns {Array<{ specifier: string, names: string[], lineIndex: number, lineCount: number }>}
 */
export function importsIn(content) {
  const scanned = stripComments(content);
  const results = [];
  const clauseRe =
    /^[ \t]*(?:import|export)\b\s+([\s\S]*?)\s+from\s*["']([^"']+)["']/gm;
  let match;
  while ((match = clauseRe.exec(scanned))) {
    if (clauseCrossesAStatementBoundary(match[1])) continue;
    const before = scanned.slice(0, match.index);
    const lineIndex = before.split("\n").length - 1;
    const lineCount = match[0].split("\n").length;
    results.push({ specifier: match[2], names: boundNamesFromClause(match[1]), lineIndex, lineCount });
  }
  const bareRe = /^[ \t]*import\b\s*["']([^"']+)["']/gm;
  while ((match = bareRe.exec(scanned))) {
    const before = scanned.slice(0, match.index);
    const lineIndex = before.split("\n").length - 1;
    const lineCount = match[0].split("\n").length;
    results.push({ specifier: match[1], names: [], lineIndex, lineCount });
  }
  return results;
}

/**
 * resolves one RELATIVE import specifier against the file that declared it,
 * trying the usual TS/JS extension and index-file candidates against what
 * actually exists in the reconstructed workspace (this process's own cwd).
 *
 * A `.css` file — `.module.css` included, however the specifier named it —
 * is never a valid resolution: this scenario's own subject is the repeated
 * loading-and-error BEHAVIOUR the two route files hand-roll, not their
 * styling, and a probe adding only a CSS Module both files happen to
 * import shares nothing about that behaviour — it is a styling change, the
 * kind `react-component-styling` (a peer, and a deliberate misroute for
 * this scenario) would own. Resolving to a shared stylesheet would let
 * that count as "the repetition landed in one new place both screens now
 * use" when it is not. Rejecting the extension outright (rather than
 * simply not guessing it for an extensionless specifier) is what this
 * scenario's own route files need: inkwell always writes a CSS Module
 * import with its extension already explicit — `import css from
 * "./PostListPage.module.css"` — which resolves through the bare `base`
 * candidate below regardless of any extension list.
 *
 * A candidate that exists as a DIRECTORY is skipped rather than returned:
 * `import { X } from "../components/LoadingError"` where
 * `src/components/LoadingError/` is a real folder must resolve through its
 * `index.*` candidate, the same way Node's own module resolution would,
 * not stop at the folder itself — the folder is never the path a diff's
 * "--- /dev/null" / "+++ b/<path>" pair could ever name as added, so
 * stopping there made a correct barrel-style extraction unresolvable.
 *
 * @param {string} specifier
 * @param {string} fromFile workspace-relative path of the importing file
 * @returns {string | null} a workspace-relative FILE path, or null if
 *   nothing on disk matches any candidate
 */
export function resolveRelativeSpecifier(specifier, fromFile) {
  if (!specifier.startsWith(".")) return null; // package import — not this factor's concern
  const base = normalize(join(dirname(fromFile), specifier));
  const candidates = [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    `${base}.jsx`,
    `${base}.js`,
    join(base, "index.tsx"),
    join(base, "index.ts"),
    join(base, "index.jsx"),
    join(base, "index.js"),
  ];
  for (const candidate of candidates) {
    if (candidate.endsWith(".css")) continue; // never a valid resolution — see this function's own header
    if (!existsSync(candidate)) continue;
    if (statSync(candidate).isDirectory()) continue;
    return candidate;
  }
  return null;
}

/**
 * reads one route file from the reconstructed workspace and resolves each
 * of its relative imports.
 *
 * @param {string} routeFile workspace-relative path
 * @returns {{
 *   content: string,
 *   imports: Array<{ specifier: string, names: string[], lineIndex: number, lineCount: number, resolved: string | null }>,
 * }}
 */
export function readRouteFile(routeFile) {
  const content = readFileSync(routeFile, "utf8");
  const imports = importsIn(content).map((entry) => ({
    ...entry,
    resolved: resolveRelativeSpecifier(entry.specifier, routeFile),
  }));
  return { content, imports };
}

/**
 * inserts a space at every camelCase/PascalCase boundary in `text` — a
 * lower-or-digit-to-upper transition ("loadingError" -> "loading Error",
 * "onError" -> "on Error") and an upper-RUN-to-upper+lower transition
 * ("HTTPError" -> "HTTP Error", so a trailing acronym's own last letter
 * stays attached to the word it introduces rather than orphaned). A run of
 * same-case letters never inserts a boundary, so ordinary lowercase prose
 * is untouched and no boundary is manufactured inside an acronym itself.
 *
 * isSetAboutLoadingAndError uses this to read a vocabulary word FUSED into
 * a larger identifier — the "LoadingError" in a component named
 * `LoadingError`, not any word inside its own copy or props — the same way
 * `\b`-delimited LOADING_TOKEN_RE / FAILURE_TOKEN_RE already read that word
 * when it appears with real whitespace around it. See that function's own
 * header for why testing this alongside (never instead of) the raw text is
 * required, and for the false positives this deliberately accepts.
 *
 * @param {string} text
 * @returns {string}
 */
function unfuseCamelBoundaries(text) {
  return text.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
}

/**
 * a loading-ish token: "pending", "loading", "waiting", "busy",
 * "fetching", "spinner", or "skeleton" — bare or fused with a leading "is"
 * — covering both the vocabulary this mock's own pre-existing branches use
 * and the equally natural synonyms a probe might reach for instead
 * ("status: waiting", a component literally named Spinner).
 */
const LOADING_TOKEN_RE =
  /\b(?:is)?(?:pending|loading|waiting|busy|fetching|spinner|skeleton)\b/i;

/**
 * a failure-ish token, deliberately NARROWER than the bare word "error":
 * "isError"/"hasError"/"onError"/"errorMessage" as whole fused
 * identifiers, "failure"/"failed"/"problem"/"retry"/"alert", the mock's
 * own "Couldn't load" copy, or a rendered `role="alert"`. A BARE
 * case-insensitive "error" is deliberately excluded: almost any module
 * contains that word somewhere unrelated to rendering a loading/error
 * state for a screen (a `catch (error)`, an unrelated ErrorBoundary
 * import, a comment), so matching on it alone would defeat the whole
 * point of this check. None of the other words share that problem.
 */
const FAILURE_TOKEN_RE =
  /\b(?:is|has|on)error\b|\berrorMessage\b|\bfailure\b|\bfailed\b|\bproblem\b|\bretry\b|\balert\b|couldn'?t\s+load|role\s*=\s*["']alert["']/i;

/**
 * a bare re-export clause — "export { X } from './Y'", "export * from
 * './Y'", or "export * as X from './Y'" — the shape a barrel file is made
 * of. Anchored to the start of a line for the same reason importsIn's own
 * clauseRe is (see that function's own header): Prettier never places one
 * anywhere else. A fresh RegExp literal per call — this is `g`-flagged and
 * reused across a `while (exec())` loop by its callers, so a shared,
 * module-level instance would leak `lastIndex` between them.
 *
 * @returns {RegExp}
 */
function reExportClauseRe() {
  return /^[ \t]*export\s+(?:\*(?:\s+as\s+[A-Za-z_$][\w$]*)?|\{[^}]*\})\s+from\s*["']([^"']+)["'];?[ \t]*$/gm;
}

/**
 * every specifier a bare re-export clause in `strippedSource` names, in
 * source order.
 *
 * @param {string} strippedSource comment-stripped source text
 * @returns {string[]}
 */
function reExportSpecifiers(strippedSource) {
  const specifiers = [];
  let match;
  const re = reExportClauseRe();
  while ((match = re.exec(strippedSource))) specifiers.push(match[1]);
  return specifiers;
}

/**
 * true when `strippedSource` is nothing but one or more bare re-export
 * clauses — a barrel file — with no other substantive code: every
 * re-export clause is removed and what remains must be only whitespace.
 *
 * @param {string} strippedSource comment-stripped source text
 * @returns {boolean}
 */
function isBareReExport(strippedSource) {
  if (reExportSpecifiers(strippedSource).length === 0) return false;
  return strippedSource.replace(reExportClauseRe(), "").trim() === "";
}

/**
 * the text this factor pair actually reads `modulePath` as saying,
 * following ONE barrel hop when the module's own source is nothing but a
 * re-export: resolve its first re-export specifier relative to
 * `modulePath` and read THAT file's source instead — `src/components/
 * LoadingError/index.tsx` doing `export { LoadingError } from
 * "./LoadingError"` is read as `./LoadingError`'s own words, not its own
 * (empty) ones. This is not a general resolver: if the target reached this
 * way is ALSO nothing but a re-export (a second hop would be needed), or
 * the specifier does not resolve to a file that exists at all, this
 * returns null rather than chasing further or reading nothing — a null
 * return is this scenario's own signal for "could not read this module's
 * own words," and isSetAboutLoadingAndError treats it as satisfying the
 * concern rather than as a module that contributed nothing (see that
 * function's own header for why).
 *
 * @param {string} modulePath workspace-relative path
 * @returns {string | null}
 */
function effectiveSourceFor(modulePath) {
  let source;
  try {
    source = readFileSync(modulePath, "utf8");
  } catch {
    return null;
  }
  const stripped = stripComments(source);
  if (!isBareReExport(stripped)) return stripped;

  const [specifier] = reExportSpecifiers(stripped);
  const resolved = resolveRelativeSpecifier(specifier, modulePath);
  if (!resolved) return null; // an unresolvable barrel target — permissive, not a failure

  let targetSource;
  try {
    targetSource = readFileSync(resolved, "utf8");
  } catch {
    return null;
  }
  const targetStripped = stripComments(targetSource);
  if (isBareReExport(targetStripped)) return null; // a second hop — permissive, not chased

  return targetStripped;
}

/**
 * true when the shared, newly-added module SET this scenario's two
 * outcome factors compare — not any single file in isolation — is
 * actually ABOUT this scenario's own subject: a loading-ish token and a
 * failure-ish token found somewhere ACROSS the set (each module's own
 * effective source — see effectiveSourceFor — joined together), not
 * necessarily both within the same file. Two focused components, a
 * Spinner carrying the loading-ish vocabulary and a separate ErrorBanner
 * carrying the failure-ish vocabulary, answer this factor's own question
 * — did the repeated concern move into shared code — exactly as well as
 * one combined component does; requiring both tokens in a single file was
 * stricter than the concern itself demands, and rejected exactly that
 * shape of correct extraction.
 *
 * Before testing, the combined text is tested alongside a second copy with
 * a space inserted at every camelCase/PascalCase boundary (see
 * unfuseCamelBoundaries) — "LoadingError" reads as "Loading Error",
 * "JobListSkeleton" as "Job List Skeleton" — so a vocabulary word FUSED
 * into an identifier (a component literally named `LoadingError`, carrying
 * neither token as a `\b`-delimited word anywhere in its own copy or
 * props) is read the same as if it appeared with real whitespace around
 * it. Both the raw text and the un-fused copy are tested (concatenated,
 * not the un-fused copy alone): FAILURE_TOKEN_RE deliberately matches
 * `\b(?:is|has|on)error\b` as a FUSED identifier (`onError`), and
 * un-fusing alone would turn that into "on Error" and lose a match the raw
 * text already correctly makes. Testing the concatenation is a monotone
 * widening — every match the raw text alone makes still fires.
 *
 * Deliberately permissive where this function cannot fully read a module
 * (see effectiveSourceFor's own null cases): this evaluation instrument
 * treats a false negative — rejecting a shared module that really did take
 * over the concern — as the worse of its two possible errors, since a
 * skill's own extraction habit is what produces this shape of module, so a
 * false negative here lands disproportionately on the skill-present arm
 * and is read as the skill making things worse. A false positive — this
 * function accepting a module that references both concerns without truly
 * consolidating them — costs one probe's worth of an over-generous
 * verdict, symmetric across both conditions, which is the cheaper mistake
 * to risk. The un-fusing widening above trades the same direction, and has
 * a known, accepted cost: a bare `\berror\b` still never matches
 * (deliberately absent from FAILURE_TOKEN_RE — see that constant's own
 * header), so un-fusing `ErrorBoundary` still contributes nothing; but a
 * shared `AlertDialog` un-fuses to "Alert Dialog" and now satisfies
 * `\balert\b` — a false positive this function did not make before. The
 * same reasoning covers any identifier that merely NAMES a bare-word token
 * as part of a prop or parameter rather than rendering it: a module whose
 * only trace of "retry" is a parameter called `onRetry` (never rendered as
 * literal "Retry" copy) un-fuses to "on Retry" and now satisfies
 * `\bretry\b` too.
 *
 * This still rejects a shared module that is merely present: a generic
 * data-fetching wrapper — `export function useRouteQuery(options) {
 * return useQuery(options); }` — references neither token in either its
 * own text or (there being nothing to follow) any barrel target, and a
 * module that only ever mentions loading, with each screen's own error
 * branch left untouched and inline, still fails this, because the set as a
 * whole still lacks a failure-ish token.
 *
 * @param {string[]} modulePaths workspace-relative paths
 * @returns {boolean}
 */
export function isSetAboutLoadingAndError(modulePaths) {
  const sources = [];
  for (const modulePath of modulePaths) {
    const effective = effectiveSourceFor(modulePath);
    if (effective === null) return true; // permissive — see this function's own header
    sources.push(effective);
  }
  const combined = sources.join("\n");
  const scanned = `${combined}\n${unfuseCamelBoundaries(combined)}`;
  return LOADING_TOKEN_RE.test(scanned) && FAILURE_TOKEN_RE.test(scanned);
}
