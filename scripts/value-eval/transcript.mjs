// transcript.mjs — deterministic signals over one behaviour probe's captured
// JSONL stream. See probe.mjs's header for how this fits into a run's record.
//
// MECHANICAL, NOT JUDGMENTAL: every field here is read straight off the
// stream — which files a `Read` tool call named, which strings a `Bash` tool
// call ran, a count, a boolean keyed to a fixed pattern. None of it asks
// whether the run did the RIGHT thing; that residue is what issue #235's
// pilot reads by hand rather than delegating to this module or to a judge.
//
// Built on scripts/discovery-eval/stream.mjs's `parseTranscript`, added there
// ADDITIVELY beside the existing `parseStream` the discovery evaluation
// depends on — see that function's own header for why nothing here could
// safely live inside `parseStream` itself.

import { parseTranscript } from "../discovery-eval/stream.mjs";

/**
 * Bash command shapes this repository's mock fixtures actually run (see
 * examples/content-site/package.json's `scripts`), plus the underlying
 * runners and formatters a caller might invoke directly rather than through
 * an npm script. Not exhaustive by design — a caller measuring a different
 * mock's toolchain overrides these via `extractTranscript`'s `options`.
 */
export const DEFAULT_TEST_COMMAND_PATTERNS = [
  /\b(?:npm|yarn|pnpm)\s+(?:run\s+)?test\b/i,
  /\bjest\b/i,
  /\bvitest\b/i,
];
export const DEFAULT_LINT_COMMAND_PATTERNS = [
  /\b(?:npm|yarn|pnpm)\s+run\s+lint\b/i,
  /\beslint\b/i,
  /\bbiome\s+(?:check|lint)\b/i,
];
export const DEFAULT_FORMAT_COMMAND_PATTERNS = [
  /\b(?:npm|yarn|pnpm)\s+run\s+format(?::check)?\b/i,
  /\bprettier\b/i,
  /\bbiome\s+format\b/i,
];

/** @param {string} command @param {RegExp[]} patterns @returns {boolean} */
function matchesAny(command, patterns) {
  return patterns.some((pattern) => pattern.test(command));
}

/**
 * Extracts every mechanical transcript signal issue #235's plan lists: which
 * files were read, which commands ran and in what order, whether the tests
 * were executed, whether the linter or formatter ran, the turn count, the
 * cost, whether the run ended on the turn cap, and what the CLI loaded.
 *
 * @param {string} stdout raw JSONL from one probe
 * @param {{
 *   testPatterns?: RegExp[],
 *   lintPatterns?: RegExp[],
 *   formatPatterns?: RegExp[],
 * }} [options]
 * @returns {{
 *   filesRead: string[],
 *   commandsRun: string[],
 *   ranTests: boolean,
 *   ranLint: boolean,
 *   ranFormat: boolean,
 *   turns: number|null,
 *   cost: number,
 *   truncated: boolean,
 *   loadedSkills: string[]|null,
 *   model: string|null,
 * }} `filesRead` is deduplicated in first-read order; `commandsRun` keeps
 *   every invocation, including repeats, in stream order — order is the
 *   signal the plan asks for there, so collapsing repeats would lose it.
 */
export function extractTranscript(stdout, options = {}) {
  const {
    testPatterns = DEFAULT_TEST_COMMAND_PATTERNS,
    lintPatterns = DEFAULT_LINT_COMMAND_PATTERNS,
    formatPatterns = DEFAULT_FORMAT_COMMAND_PATTERNS,
  } = options;

  const { toolCalls, turns, truncated, cost, loaded, model } = parseTranscript(stdout);

  const filesRead = [];
  const seenFiles = new Set();
  const commandsRun = [];
  let ranTests = false;
  let ranLint = false;
  let ranFormat = false;

  for (const call of toolCalls) {
    if (call.name === "Read" && typeof call.input?.file_path === "string") {
      const path = call.input.file_path;
      if (!seenFiles.has(path)) {
        seenFiles.add(path);
        filesRead.push(path);
      }
      continue;
    }
    if (call.name === "Bash" && typeof call.input?.command === "string") {
      const command = call.input.command;
      commandsRun.push(command);
      if (matchesAny(command, testPatterns)) ranTests = true;
      if (matchesAny(command, lintPatterns)) ranLint = true;
      if (matchesAny(command, formatPatterns)) ranFormat = true;
    }
  }

  return {
    filesRead,
    commandsRun,
    ranTests,
    ranLint,
    ranFormat,
    turns,
    cost,
    truncated,
    loadedSkills: loaded,
    model,
  };
}
