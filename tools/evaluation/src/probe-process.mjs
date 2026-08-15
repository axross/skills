// building one probe's `claude` CLI invocation, and running it with a turn
// cap enforced from outside the process.
//
// the deleted instrument's own per-reading spawn.mjs is gone, but its
// recorded metadata (see the turn cap docs/glossary.md defines, and the
// old measurement this rework read as data) shows a runaway guard was part
// of the design. the CLI installed in this environment — `claude --help`,
// checked before writing this file rather than assumed — has no flag that
// bounds turns; it has `--max-budget-usd`, a dollar figure the glossary's
// own "Turn cap" entry defines itself against ("a runaway guard rather than
// a budget control"). so the cap here is enforced by this module, watching
// the CLI's own `--output-format stream-json` line by line and killing the
// process once it has seen `turnCap` assistant turns, rather than by a CLI
// flag that does not exist today.
//
// `spawnFn` is threaded through every exported function that starts a
// process, so a test can run this module's real branching logic against a
// fake child process and never touch the network or a real CLI — see
// tests/evaluation/probe-process.test.mjs.

import { spawn as nodeSpawn } from "node:child_process";

import { MODEL, SETTING_SOURCES } from "./spawn.mjs";

/** the ceiling docs/glossary.md's "Turn cap" describes, absent a scenario override. */
export const DEFAULT_TURN_CAP = 100;

/**
 * tools this instrument allows and denies on every probe, regardless of
 * scenario. `Agent` and `Task` are both denied because a probe's own effect
 * has to be attributable to the skill under test, not to a subagent this
 * instrument did not situate; `WebFetch`/`WebSearch` because a probe
 * workspace has no network to reach out over; `NotebookEdit` because no mock
 * ships a notebook for it to touch.
 */
export const ALLOWED_TOOLS = ["Bash", "Edit", "Glob", "Grep", "Read", "Skill", "TodoWrite", "Write"];
export const DISALLOWED_TOOLS = ["Agent", "NotebookEdit", "Task", "WebFetch", "WebSearch"];

/**
 * appended to every probe's system prompt. a probe runs unattended — nothing
 * reads a question it asks and nothing answers one — so it is told that
 * plainly rather than left to discover it by timing out.
 */
export const NONINTERACTIVE_BRIEF =
  "This probe runs unattended: no one is available to answer a question, so treat one as a " +
  "dead end rather than a way to pause. Carry the task as far as the workspace lets you, and " +
  "where you would otherwise ask, decide for yourself and say in your final message what you " +
  "decided and why.";

/**
 * the argv for one probe's `claude` invocation. an argv array, never a
 * shell string — see spawn.mjs's `shellQuote`, which exists only to render
 * this back into something a reader can paste.
 *
 * @param {{ prompt: string, model?: string, allowedTools?: string[], disallowedTools?: string[] }} options
 * @returns {string[]}
 */
export function buildProbeArgv({
  prompt,
  model = MODEL,
  allowedTools = ALLOWED_TOOLS,
  disallowedTools = DISALLOWED_TOOLS,
} = {}) {
  return [
    "--print",
    prompt,
    "--output-format",
    "stream-json",
    "--verbose",
    "--model",
    model,
    "--setting-sources",
    SETTING_SOURCES.join(","),
    "--allowed-tools",
    allowedTools.join(","),
    "--disallowed-tools",
    disallowedTools.join(","),
    "--permission-mode",
    "bypassPermissions",
    "--append-system-prompt",
    NONINTERACTIVE_BRIEF,
  ];
}

/**
 * counts the assistant turns a `stream-json` line represents. a line this
 * instrument cannot parse as JSON, or whose `type` is not `"assistant"`,
 * counts as zero rather than throwing — a truncated final line is ordinary
 * (see transcript/events.mjs's own `readEvents`), and the cap this function
 * feeds is a safety net, not a parser.
 *
 * @param {string} line
 * @returns {0|1}
 */
function isAssistantTurnLine(line) {
  const text = line.trim();
  if (text === "") return 0;
  try {
    return JSON.parse(text).type === "assistant" ? 1 : 0;
  } catch {
    return 0;
  }
}

/**
 * runs one probe's `claude` invocation to completion, or kills it once it
 * has produced `turnCap` assistant turns.
 *
 * @param {{
 *   argv: string[],
 *   cwd: string,
 *   env: Record<string, string>,
 *   turnCap?: number,
 *   spawnFn?: typeof nodeSpawn,
 * }} options
 * @returns {Promise<{ stdout: string, stderr: string, exitCode: number|null, killedByTurnCap: boolean }>}
 */
export function runProbeProcess({ argv, cwd, env, turnCap = DEFAULT_TURN_CAP, spawnFn = nodeSpawn }) {
  return new Promise((resolve, reject) => {
    const child = spawnFn("claude", argv, { cwd, env });

    let stdout = "";
    let stderr = "";
    let turns = 0;
    let killedByTurnCap = false;
    let carry = "";

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (killedByTurnCap) return;

      carry += chunk;
      const lines = carry.split("\n");
      carry = lines.pop() ?? "";
      for (const line of lines) {
        turns += isAssistantTurnLine(line);
        if (turns >= turnCap) {
          killedByTurnCap = true;
          child.kill("SIGTERM");
          break;
        }
      }
    });
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolve({ stdout, stderr, exitCode, killedByTurnCap });
    });
  });
}
