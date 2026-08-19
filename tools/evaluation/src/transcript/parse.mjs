// one reading of a stored probe transcript.
//
// "one reading" is the whole design. the transcript is what gets stored; a
// later question this reading does not answer is answered by writing another
// reading, not by paying for another probe. that inverts the rule the
// instrument used to run under — persist the extracted signal, discard the raw
// stream — which assumed the next question would be a threshold over the signal
// already extracted, and failed the moment the question changed.
//
// `null` means the stream said nothing, and is deliberately distinct from a
// zero or an empty list, which mean it said so. a caller cross-checking a
// declared value against a reported one has to tell "disagrees" from "did not
// say": the first is a failed measurement, the second is an older CLI.

import { readEvents, toolUseBlocks } from "./events.mjs";

/** tolerates the fields a given CLI version happens not to emit. */
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
 * @param {string} stdout raw JSONL from one probe
 * @returns {{
 *   toolCalls: Array<{ name: string, input: Record<string, unknown> }>,
 *   turns: number|null,
 *   truncated: boolean,
 *   cost: number|null,
 *   loadedSkills: string[]|null,
 *   model: string|null,
 *   runtimeVersion: string|null,
 *   finalAssistantText: string|null,
 *   usage: {
 *     input: number, output: number, cacheCreation: number, cacheRead: number,
 *     messages: number,
 *   },
 * }}
 */
export function parseTranscript(stdout) {
  const events = readEvents(stdout);

  let turns = null;
  let truncated = false;
  let cost = null;
  let loadedSkills = null;
  let model = null;
  let runtimeVersion = null;
  // overwritten on every assistant event, never merged with an earlier one,
  // so what survives the loop is whatever the *last* assistant message said
  // — or `null` when that message carried no text block (a turn that ended
  // on a tool call). either way reads as "the stream did not say", the same as no assistant message at all.
  let finalAssistantText = null;
  const usage = { input: 0, output: 0, cacheCreation: 0, cacheRead: 0, messages: 0 };

  for (const event of events) {
    if (event.type === "assistant") {
      const content = event.message?.content;
      const texts = Array.isArray(content)
        ? content.filter((block) => block?.type === "text" && typeof block.text === "string")
        : [];
      finalAssistantText = texts.length > 0 ? texts.map((block) => block.text).join("\n\n") : null;
    }

    if (event.type === "system") {
      if (typeof event.model === "string") model ??= event.model;
      // `skills`, never `slash_commands` — the latter mixes skills with
      // built-in commands and would over-report a loaded set by roughly double.
      if (Array.isArray(event.skills)) {
        loadedSkills ??= event.skills.filter((name) => typeof name === "string");
      }
      // not every CLI version puts its version on the init event.
      if (typeof event.version === "string") runtimeVersion ??= event.version;
    }

    if (event.type === "result") {
      if (typeof event.total_cost_usd === "number") cost = event.total_cost_usd;
      if (typeof event.num_turns === "number") turns = event.num_turns;
      // read from the stream's own subtype, never inferred from the
      // transcript's length or the process's exit code — a long run that ended
      // cleanly and one the cap cut short are not otherwise distinguishable.
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
    finalAssistantText,
    usage,
  };
}

/**
 * command shapes this repository's mocks actually run (see
 * tools/evaluation/mocks/tsuzuri/package.json), plus the runners a caller
 * might invoke directly. not exhaustive by design — a different mock's
 * toolchain overrides them.
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
 * what the model reached for.
 *
 * separate from `parseTranscript` because the command patterns are a property
 * of the mock's toolchain, not of the CLI's stream format, so overriding them
 * must not mean touching the parse.
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
 *   invocation, including repeats, in stream order
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
      // a plugin-qualified name reduces to the skill itself, so a case fixture
      // never has to know how a skill was installed.
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
