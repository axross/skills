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
 * ever reaching the regex at all.
 *
 * @param {string} text
 * @returns {string}
 */
function stripComments(text) {
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
 * @param {string} content
 * @returns {Array<{ specifier: string, names: string[], lineIndex: number, lineCount: number }>}
 */
export function importsIn(content) {
  const scanned = stripComments(content);
  const results = [];
  const clauseRe = /\b(?:import|export)\s+([\s\S]*?)\s+from\s*["']([^"']+)["']/g;
  let match;
  while ((match = clauseRe.exec(scanned))) {
    if (clauseCrossesAStatementBoundary(match[1])) continue;
    const before = scanned.slice(0, match.index);
    const lineIndex = before.split("\n").length - 1;
    const lineCount = match[0].split("\n").length;
    results.push({ specifier: match[2], names: boundNamesFromClause(match[1]), lineIndex, lineCount });
  }
  const bareRe = /\bimport\s*["']([^"']+)["']/g;
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
