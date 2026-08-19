// the workspace scan both of this scenario's outcome factors run before they
// judge anything: find the specs that cover shared/resolve-translation.ts, and
// read the describe(...) titles out of them.
//
// extracted rather than duplicated because the two factor scripts beside it —
// check-spec-names-callables.mjs and check-spec-groups-conditions.mjs — ask
// different questions of the same set of titles, so the scan is one concern
// with two callers rather than two similar-looking pieces of code. The
// duplication this replaces had already cost two double-edits in review: once
// to exclude .claude/, once to accept *.test.ts. run-the-toast-tests-the-suite-never-collects
// keeps its own shared helper in scripts/vitest-config.mjs the same way.
//
// this is not itself a judgment script: no factor names it, it prints nothing,
// and factor-judgment.mjs never spawns it. It is imported by the two that are.

import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";

/** the module every candidate spec must mention, matched as a plain substring. */
const MODULE_NAME = "resolve-translation";

/**
 * e2e/ is excluded because a browser spec is not these factors' concern —
 * end-to-end-testing owns that vocabulary — and because it is the one directory
 * a same-mock end-to-end scenario's own fix would touch, which these have no
 * business reading into. .claude/ is excluded because it is where a probe's
 * installed skills live, and it is the one directory the skill-present and
 * skill-absent conditions differ by: reading a result out of it would be an
 * asymmetric confound between the two conditions, of exactly the kind #422 was
 * filed about, even though no installed skill ships a spec today.
 */
const EXCLUDED_SEGMENTS = new Set(["e2e", ".git", "node_modules", ".claude"]);

/**
 * both extensions are accepted as this scan's own scope, not because either is
 * what tsuzuri's jest.config.cjs testMatch collects — that stays pinned to
 * "*.spec.ts", a fact nothing here restates — but because these factors judge
 * naming and grouping, never whether the runner would collect the file.
 */
const CANDIDATE_EXTENSIONS = [".spec.ts", ".test.ts"];

/** what a caller reports when the scan found nothing — a `false` result, never an error. */
export const NO_SPEC_EVIDENCE =
  `no *.spec.ts or *.test.ts file outside e2e/ mentions ${MODULE_NAME} — ` +
  `shared/${MODULE_NAME}.ts still has no spec in the reconstructed workspace`;

/** prints `message` on stderr and exits non-zero: a judgment that could not be made. */
export function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

/**
 * checks the invocation contract factor-judgment.mjs holds a script to — one
 * argument, naming a readable JSON context file. Neither factor here reads
 * anything out of the context, so the parsed value is discarded; what matters
 * is that a malformed invocation exits non-zero rather than reporting `false`.
 */
export function requireContext(scriptName) {
  const contextPath = process.argv[2];
  if (!contextPath) fail(`usage: ${scriptName} <context.json>`);
  try {
    JSON.parse(readFileSync(contextPath, "utf8"));
  } catch (error) {
    fail(`could not read or parse ${contextPath}: ${error.message}`);
  }
}

/** every candidate spec under `root`, recursively, outside the excluded segments. */
function findSpecFiles(root) {
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true, recursive: true });
  } catch (error) {
    fail(`could not read the reconstructed workspace at ${root}: ${error.message}`);
  }
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile() || !CANDIDATE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) continue;
    const parent = entry.parentPath ?? entry.path;
    const segments = parent.split(sep).filter((segment) => segment.length > 0 && segment !== ".");
    if (segments.some((segment) => EXCLUDED_SEGMENTS.has(segment))) continue;
    files.push(join(parent, entry.name));
  }
  return files;
}

/**
 * every spec in the reconstructed workspace (this process's own cwd) that
 * mentions the module, however it imports it — relative or aliased. A plain
 * substring match, not a claim about resolving the import for real.
 *
 * @returns {Array<{ file: string, content: string }>} empty when the module
 *   still has no spec, which is a `false` result for a caller rather than an
 *   error: that is exactly what this scenario's prompt asks a fix to close.
 */
export function specsCoveringTheModule() {
  const candidates = [];
  for (const file of findSpecFiles(".")) {
    let content;
    try {
      content = readFileSync(file, "utf8");
    } catch (error) {
      fail(`could not read ${file} from the reconstructed workspace: ${error.message}`);
    }
    if (content.includes(MODULE_NAME)) candidates.push({ file, content });
  }
  return candidates;
}

/** every `describe(...)` title in `source`, in source order — single, double, or backtick-quoted. */
export function describeTitles(source) {
  const titles = [];
  const re = /\bdescribe\s*\(\s*(?:`([^`]*)`|"([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    titles.push(match[1] ?? match[2] ?? match[3] ?? "");
  }
  return titles;
}
