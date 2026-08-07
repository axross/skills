// spawn.mjs — how probe.mjs invokes the `claude` CLI, factored out as pure
// functions so a test can assert on them without spawning anything (see
// tests/helpers/run.mjs's header on why probe.mjs itself is never imported).
//
// THE TOOL POSTURE IS INVERTED FROM THE DISCOVERY PROBE'S, DELIBERATELY.
// discovery-eval/run.mjs denies Bash and every editing tool because a
// discovery probe workspace "may be holding attacker-authored skill text
// from a pull request head" (see its DISALLOWED_TOOLS comment). This probe's
// workspace never can: materialize.mjs builds it only from this
// repository's OWN examples/ fixture and this repository's OWN installed
// skills, never from a pull request head — issue #235 states that as an
// assumption and is why this axis never combines with the pull-request-head
// overlay discovery-eval/overlay.mjs carries, the same rule that keeps
// link-freshness.yaml schedule-only. So Bash, Read, Write, and Edit are
// permitted — the model has to be able to read the project, write a file,
// and run commands, which is the whole task — and Skill stays permitted too,
// since whether the installed skill actually gets INVOKED during real work is
// exactly what this axis measures. WebFetch, WebSearch, Task/Agent, and
// NotebookEdit stay denied: nothing about writing a unit test needs the
// network or a spawned subagent, and denying them costs the measurement
// nothing.
//
// THE TURN CAP IS 100, AS A RUNAWAY GUARD, NOT A BUDGET CONTROL. Issue #235:
// "A cap that binds is a confounder rather than a limit: the treatment arm
// may legitimately do more work, so a binding cap truncates it first and
// pushes the measured effect toward zero." Do not lower it.
//
// `--setting-sources project` IS ON EVERY INVOCATION, NO EXCEPTIONS. Issue
// #235's "A control arm is not bare" section: it strips the six user-level
// skills for free; the seventeen a managed environment injects cannot be
// stripped without also stripping the workspace's own, so this is the one
// isolation lever available, and every run — control and treatment alike —
// takes it.

/**
 * The model every probe runs against, pinned rather than left to the CLI.
 *
 * WHAT CHANGING THIS INVALIDATES: every record taken before the change. The
 * effect axis attributes a difference between two conditions to the skill, and
 * that attribution holds only while everything else is held constant — the
 * model most of all. Records are comparable within one pinned model and across
 * no boundary where it moved, so a change here supersedes the existing
 * measurement rather than extending it, exactly as a fixture change does.
 *
 * WHY IT WAS NOT PINNED BEFORE, AND WHY THAT WAS NOT ENOUGH. The three runs
 * recorded on 2026-08-06 all report `claude-sonnet-5`, because that is what
 * the CLI defaulted to. The record makes drift detectable after the fact;
 * nothing prevented it. When the default moves, every earlier record silently
 * stops being comparable and the reader finds out by diffing two `model`
 * fields, if they think to look.
 *
 * WHY THIS VALUE. It is the CLI's current default and what every recorded run
 * used, so pinning it changes nothing about the measurement today and only
 * fixes what tomorrow's default cannot silently change. It is also the
 * condition most consumers of this library are actually in.
 */
export const MODEL = "claude-sonnet-5";

/** Runaway guard, not a budget control — see this module's header. */
export const TURN_CAP = 100;

/** Applied to every invocation — see this module's header. */
export const SETTING_SOURCES = ["--setting-sources", "project"];

/** The model must read, write, run commands, and (this axis's whole point) invoke a skill. */
export const ALLOWED_TOOLS = ["Bash", "Edit", "Glob", "Grep", "Read", "Skill", "TodoWrite", "Write"];

/** Nothing here needs the network or a subagent — see this module's header. */
export const DISALLOWED_TOOLS = ["Agent", "NotebookEdit", "Task", "WebFetch", "WebSearch"];

/**
 * The full `claude` CLI argv for one behaviour probe.
 *
 * @param {string} prompt
 * @returns {string[]}
 */
export function buildSpawnArgs(prompt) {
  return [
    "-p",
    prompt,
    "--output-format",
    "stream-json",
    "--verbose",
    "--model",
    MODEL,
    "--max-turns",
    String(TURN_CAP),
    "--allowedTools",
    ALLOWED_TOOLS.join(","),
    "--disallowedTools",
    DISALLOWED_TOOLS.join(","),
    ...SETTING_SOURCES,
  ];
}

/**
 * Anything whose name looks like a credential is withheld from the spawned
 * CLI's environment. Unlike discovery-eval/overlay.mjs's `evalEnvironment` —
 * whose reasoning is "the subprocess runs one turn with only the Skill tool,
 * so it has no Bash, no network fetch, and no way to read [a secret] back
 * out" — THAT reasoning does not hold here: this probe's subprocess has Bash.
 * Stripping anyway is ordinary least-privilege, not a defense against
 * attacker-controlled content (there is none here — see this module's header
 * on why the workspace is always trusted): a probe transcript that gets
 * stored and read later should not be the place an unrelated credential the
 * spawning environment happened to be holding first leaks from.
 *
 * @param {Record<string, string|undefined>} source usually `process.env`
 * @returns {Record<string, string>}
 */
export function buildProbeEnvironment(source) {
  const CREDENTIAL_NAME_RE = /(TOKEN|SECRET|PASSWORD|CREDENTIAL|KEY)/i;
  // The two variables that survive that rule, because the subprocess IS the
  // Claude CLI and cannot authenticate without one of them.
  const CLI_AUTH_ENV_VARS = ["CLAUDE_CODE_OAUTH_TOKEN", "ANTHROPIC_API_KEY"];

  const env = {};
  for (const [name, value] of Object.entries(source)) {
    if (value === undefined) continue;
    if (CLI_AUTH_ENV_VARS.includes(name)) {
      env[name] = value;
      continue;
    }
    if (CREDENTIAL_NAME_RE.test(name)) continue;
    env[name] = value;
  }
  return env;
}
