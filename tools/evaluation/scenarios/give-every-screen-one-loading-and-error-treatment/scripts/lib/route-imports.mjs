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
 * every import statement's specifier in `content`, paired with the bound
 * local identifier names and the source line range the whole clause
 * occupies — good enough for the Prettier-formatted TSX this mock's route
 * files are written in, not a full parser. Re-exports ("export ... from")
 * are included too, since a barrel-style extraction could plausibly
 * re-export rather than import.
 *
 * @param {string} content
 * @returns {Array<{ specifier: string, names: string[], lineIndex: number, lineCount: number }>}
 */
export function importsIn(content) {
  const results = [];
  const clauseRe = /\b(?:import|export)\s+([\s\S]*?)\s+from\s*["']([^"']+)["']/g;
  let match;
  while ((match = clauseRe.exec(content))) {
    const before = content.slice(0, match.index);
    const lineIndex = before.split("\n").length - 1;
    const lineCount = match[0].split("\n").length;
    results.push({ specifier: match[2], names: boundNamesFromClause(match[1]), lineIndex, lineCount });
  }
  const bareRe = /\bimport\s*["']([^"']+)["']/g;
  while ((match = bareRe.exec(content))) {
    const before = content.slice(0, match.index);
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
    `${base}.module.css`,
    join(base, "index.tsx"),
    join(base, "index.ts"),
    join(base, "index.jsx"),
    join(base, "index.js"),
  ];
  for (const candidate of candidates) {
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
