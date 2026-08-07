// spawn.mjs — the declared configuration a probe runs under, and the CLI argv
// built from it.
//
// THE CONFIGURATION IS THE SOURCE, AND THE ARGV IS DERIVED FROM IT. Not the
// other way around, and not both independently. `buildArgv` reads nothing but
// its argument, so a flag that is not in the configuration cannot reach the
// command line — which is what makes the stored `metadata.json` a complete
// account of how the probe was invoked rather than a description of it that
// might have drifted. A test asserts the round trip: rebuilding the argv from a
// stored configuration reproduces the argv the probe used.
//
// WHAT IS A CONSTANT HERE RATHER THAN A CONFIGURATION FIELD, AND WHY THAT IS
// STILL COMPLETE. `--output-format stream-json --verbose` is how the harness
// READS the run, not a condition the run is under: changing it would change
// what this instrument can parse, not what the model was asked to do. It is
// therefore a property of the instrument, and the instrument is pinned in the
// record too — `metadata.json`'s `instrument.commit`. Between the configuration
// and that commit, the argv is fully determined.
//
// THE TOOL POSTURE IS INVERTED FROM THE DISCOVERY PROBE'S, DELIBERATELY.
// scripts/discovery-eval/run.mjs denies Bash and every editing tool because its
// workspace "may be holding attacker-authored skill text from a pull request
// head". This probe's workspace never can: it is built only from this
// repository's own mock fixture and its own installed skills. So Bash, Read,
// Write, and Edit are permitted — the model has to read the project, write a
// file, and run commands, which is the whole task — and Skill stays permitted
// too, since whether the installed skill actually gets INVOKED during real work
// is exactly what this instrument measures. WebFetch, WebSearch, Task/Agent,
// and NotebookEdit stay denied: nothing about writing a unit test needs the
// network or a spawned subagent, and denying them costs the measurement
// nothing.
//
// THE TURN CAP IS A RUNAWAY GUARD, NOT A BUDGET CONTROL. Issue #235: "A cap
// that binds is a confounder rather than a limit: the treatment arm may
// legitimately do more work, so a binding cap truncates it first and pushes the
// measured effect toward zero." Do not lower it to save money — the budget is
// enforced by admission before the fan-out, in admission.mjs, which is the
// lever that does not distort the measurement. (That quotation predates the
// vocabulary settling: read its "treatment arm" as the skill-present condition.
// It is left as written because a quotation edited to agree with later usage is
// no longer evidence of what was decided.)
//
// `--setting-sources project` IS ON EVERY INVOCATION, NO EXCEPTIONS. It strips
// the user-level skills for free; the ones a managed environment injects cannot
// be stripped without also stripping the workspace's own, so this is the one
// isolation lever available, and both conditions take it alike.

/**
 * The model every probe runs against, pinned rather than left to the CLI.
 *
 * WHAT CHANGING THIS INVALIDATES: every measurement taken before the change.
 * This instrument attributes a difference between two conditions to the skill,
 * and that attribution holds only while everything else is held constant — the
 * model most of all. A change here supersedes the existing measurements rather
 * than extending them, exactly as a fixture change does.
 */
export const MODEL = "claude-sonnet-5";

/** Runaway guard, not a budget control — see this module's header. */
export const TURN_CAP = 100;

/** Applied to every invocation — see this module's header. */
export const SETTING_SOURCES = ["project"];

/** The model must read, write, run commands, and (the whole point) invoke a skill. */
export const ALLOWED_TOOLS = ["Bash", "Edit", "Glob", "Grep", "Read", "Skill", "TodoWrite", "Write"];

/** Nothing here needs the network or a subagent — see this module's header. */
export const DISALLOWED_TOOLS = ["Agent", "NotebookEdit", "Task", "WebFetch", "WebSearch"];

/**
 * @typedef {object} Configuration
 * @property {{ name: string, version: string|null, options: {
 *   maxTurns: number, settingSources: string[],
 *   allowedTools: string[], disallowedTools: string[],
 * } }} runtime
 * @property {{ provider: string, model: string, options: Record<string, unknown> }} model
 * @property {{ name: string, tree: string, commit: string|null }} project
 * @property {Record<string, string>} skills name → content digest; `{}` when skill-absent
 * @property {{ prompt: string, targetModule: string }} task
 */

/**
 * Assembles the declared configuration for one probe.
 *
 * @param {{
 *   runtimeVersion?: string|null,
 *   projectName: string,
 *   projectTree: string,
 *   projectCommit?: string|null,
 *   skills?: Record<string, string>,
 *   prompt: string,
 *   targetModule: string,
 * }} input
 * @returns {Configuration}
 */
export function buildConfiguration({
  runtimeVersion = null,
  projectName,
  projectTree,
  projectCommit = null,
  skills = {},
  prompt,
  targetModule,
}) {
  return {
    runtime: {
      name: "claude-code",
      version: runtimeVersion,
      options: {
        maxTurns: TURN_CAP,
        settingSources: [...SETTING_SOURCES],
        allowedTools: [...ALLOWED_TOOLS],
        disallowedTools: [...DISALLOWED_TOOLS],
      },
    },
    model: { provider: "anthropic", model: MODEL, options: {} },
    project: { name: projectName, tree: projectTree, commit: projectCommit },
    skills: { ...skills },
    task: { prompt, targetModule },
  };
}

/**
 * The full `claude` CLI argv for one probe, derived from nothing but the
 * configuration.
 *
 * @param {Configuration} configuration
 * @returns {string[]}
 * @throws {Error} when the configuration is missing a field the argv needs —
 *   loudly, because a silently-defaulted flag is exactly the drift the round
 *   trip exists to catch.
 */
export function buildArgv(configuration) {
  const { runtime, model, task } = configuration ?? {};
  const options = runtime?.options;

  const missing = [];
  if (typeof task?.prompt !== "string") missing.push("task.prompt");
  if (typeof model?.model !== "string") missing.push("model.model");
  if (!Number.isInteger(options?.maxTurns)) missing.push("runtime.options.maxTurns");
  for (const key of ["settingSources", "allowedTools", "disallowedTools"]) {
    if (!Array.isArray(options?.[key])) missing.push(`runtime.options.${key}`);
  }
  if (missing.length > 0) {
    throw new Error(`Cannot build an argv: the configuration is missing ${missing.join(", ")}.`);
  }

  return [
    "-p",
    task.prompt,
    "--output-format",
    "stream-json",
    "--verbose",
    "--model",
    model.model,
    "--max-turns",
    String(options.maxTurns),
    "--allowedTools",
    options.allowedTools.join(","),
    "--disallowedTools",
    options.disallowedTools.join(","),
    "--setting-sources",
    options.settingSources.join(","),
  ];
}

/**
 * POSIX single-quoting for one argv entry, for DISPLAY only.
 *
 * The real invocation passes an argv array with no shell, so nothing here is
 * ever parsed by one. The quoting exists so a reader who pastes a printed
 * command gets the command that was described rather than a prompt split
 * across several arguments.
 *
 * @param {string} argument
 * @returns {string}
 */
export function shellQuote(argument) {
  return /^[A-Za-z0-9_./:=-]+$/.test(argument)
    ? argument
    : `'${argument.replaceAll("'", `'\\''`)}'`;
}
