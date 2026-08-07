// parse.mjs — the signals a stored probe transcript yields on re-reading.
//
// EVERY FIELD HERE IS RE-DERIVABLE, WHICH IS THE POINT. The transcript itself
// is what gets stored; this module is one reading of it, and a later question
// this reading does not answer is answered by writing another reading rather
// than by paying for another probe. That inverts the rule the instrument used
// to run under — "what is persisted is the extracted signal, not the raw
// stream" — which assumed the next question would be a threshold over the
// signal already extracted, and which failed the moment the question changed.
//
// MECHANICAL, NOT JUDGMENTAL. Every field is read straight off the stream: a
// name, a count, a boolean keyed to a fixed value the CLI emits. Nothing here
// asks whether the run did the right thing.
//
// WHAT IS AND IS NOT REPORTED. `null` means the stream said nothing, and is
// deliberately distinct from a zero or an empty list, which mean the stream
// said so. A caller cross-checking a declared value against a reported one
// must be able to tell "disagrees" from "did not say" — the first is a failed
// measurement, the second is an older CLI.

import { readEvents, toolUseBlocks } from "./events.mjs";

/**
 * Sums the token counts an assistant message reports, tolerating the fields a
 * given CLI version happens not to emit.
 *
 * @param {Record<string, unknown>|undefined} usage
 * @returns {{ input: number, output: number, cacheCreation: number, cacheRead: number }}
 */
function readUsage(usage) {
  const number = (value) => (typeof value === "number" ? value : 0);
  return {
    input: number(usage?.input_tokens),
    output: number(usage?.output_tokens),
    cacheCreation: number(usage?.cache_creation_input_tokens),
    cacheRead: number(usage?.cache_read_input_tokens),
  };
}

/**
 * Reads one probe transcript.
 *
 * @param {string} stdout raw JSONL from one probe
 * @returns {{
 *   toolCalls: Array<{ name: string, input: Record<string, unknown> }>,
 *   turns: number|null,
 *   truncated: boolean,
 *   cost: number|null,
 *   loadedSkills: string[]|null,
 *   model: string|null,
 *   runtimeVersion: string|null,
 *   usage: {
 *     input: number, output: number, cacheCreation: number, cacheRead: number,
 *     messages: number,
 *   },
 * }} `truncated` is read from the `result` event's own
 *   `subtype: "error_max_turns"` and never inferred from the transcript's
 *   length or the process's exit code — a long run that ended cleanly and a
 *   run the cap cut short are not distinguishable any other way.
 */
export function parseTranscript(stdout) {
  const events = readEvents(stdout);

  let turns = null;
  let truncated = false;
  let cost = null;
  let loadedSkills = null;
  let model = null;
  let runtimeVersion = null;
  const usage = { input: 0, output: 0, cacheCreation: 0, cacheRead: 0, messages: 0 };

  for (const event of events) {
    if (event.type === "system") {
      if (typeof event.model === "string") model ??= event.model;
      // Read from `skills`, never from `slash_commands`, which mixes skills
      // with built-in commands (`/clear`, `/compact`) and would over-report a
      // loaded set by roughly a factor of two.
      if (Array.isArray(event.skills)) {
        loadedSkills ??= event.skills.filter((name) => typeof name === "string");
      }
      // Not every CLI version puts its own version on the init event. Absent
      // stays `null` — "did not say", which a cross-check treats as unknown
      // rather than as a disagreement.
      if (typeof event.version === "string") runtimeVersion ??= event.version;
    }

    if (event.type === "result") {
      if (typeof event.total_cost_usd === "number") cost = event.total_cost_usd;
      if (typeof event.num_turns === "number") turns = event.num_turns;
      if (event.subtype === "error_max_turns") truncated = true;
    }

    if (event?.message?.usage) {
      const message = readUsage(event.message.usage);
      usage.input += message.input;
      usage.output += message.output;
      usage.cacheCreation += message.cacheCreation;
      usage.cacheRead += message.cacheRead;
      usage.messages += 1;
    }
  }

  return {
    toolCalls: toolUseBlocks(events),
    turns,
    truncated,
    cost,
    loadedSkills,
    model,
    runtimeVersion,
    usage,
  };
}

/**
 * Bash command shapes this repository's mock fixtures actually run (see
 * mocks/content-site/package.json's `scripts`), plus the underlying runners and
 * formatters a caller might invoke directly rather than through an npm script.
 * Not exhaustive by design — a caller measuring a different mock's toolchain
 * overrides these.
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

/**
 * What the model reached for, read off an already-parsed transcript.
 *
 * Separate from `parseTranscript` because the command patterns are a property
 * of the MOCK's toolchain, not of the CLI's stream format — so a caller
 * measuring a different mock overrides them here without touching the parse
 * above.
 *
 * @param {ReturnType<typeof parseTranscript>} transcript
 * @param {{ testPatterns?: RegExp[], lintPatterns?: RegExp[], formatPatterns?: RegExp[] }} [options]
 * @returns {{
 *   filesRead: string[],
 *   commandsRun: string[],
 *   skillsInvoked: string[],
 *   ranTests: boolean,
 *   ranLint: boolean,
 *   ranFormat: boolean,
 * }} `filesRead` is deduplicated in first-read order; `commandsRun` keeps every
 *   invocation, including repeats, in stream order.
 */
export function readBehaviour(transcript, options = {}) {
  const {
    testPatterns = DEFAULT_TEST_COMMAND_PATTERNS,
    lintPatterns = DEFAULT_LINT_COMMAND_PATTERNS,
    formatPatterns = DEFAULT_FORMAT_COMMAND_PATTERNS,
  } = options;
  const matchesAny = (command, patterns) => patterns.some((pattern) => pattern.test(command));

  const filesRead = [];
  const seenFiles = new Set();
  const commandsRun = [];
  const skillsInvoked = [];
  let ranTests = false;
  let ranLint = false;
  let ranFormat = false;

  for (const call of transcript.toolCalls) {
    if (call.name === "Read" && typeof call.input?.file_path === "string") {
      const path = call.input.file_path;
      if (!seenFiles.has(path)) {
        seenFiles.add(path);
        filesRead.push(path);
      }
      continue;
    }
    if (call.name === "Skill" && typeof call.input?.skill === "string") {
      const selected = call.input.skill;
      // A plugin-qualified name ("plugin:skill") reduces to the skill itself,
      // so a case fixture never has to know how a skill was installed.
      skillsInvoked.push(selected.includes(":") ? selected.split(":").pop() : selected);
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

  return { filesRead, commandsRun, skillsInvoked, ranTests, ranLint, ranFormat };
}
