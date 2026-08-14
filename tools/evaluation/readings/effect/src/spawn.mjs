// the declared configuration a probe runs under, and the CLI argv built from it.
//
// the configuration is the source and the argv is derived — not the other way
// round, and not both independently. `buildArgv` reads nothing but its
// argument, so a flag absent from the configuration cannot reach the command
// line, which is what makes a stored `metadata.json` a complete account of the
// invocation rather than a description of it that might have drifted.
//
// `--output-format stream-json --verbose` is a constant here rather than a
// configuration field because it is how the harness reads the run, not a
// condition the run is under. it is still pinned: the instrument's own commit
// is in the record, and between that and the configuration the argv is fully
// determined.
//
// the tool posture differs from the discovery probe's, deliberately, and the
// reasons do not line up. that probe denies Bash and the editing tools in
// both its modes for two different reasons: reading a pull request's own
// skill text means the workspace may hold prose from outside this
// repository, and reading a mock means a probe that starts doing the work
// has stopped measuring which skill a prompt reaches for. this one permits
// them — its workspace is built only from this repository's own mock and its
// own installed skills, and the model has to read the project, write a file,
// and run commands, which is the whole task. Skill stays permitted because
// whether an installed skill gets invoked during real work is the thing
// being measured.
//
// `MODEL` and `SETTING_SOURCES` are not here: neither is specific to this
// reading, and both live in tools/evaluation/src/spawn.mjs instead.

import { MODEL, SETTING_SOURCES } from "../../../src/spawn.mjs";

/**
 * a runaway guard, not a budget control.
 *
 * do not lower it to save money. #235: "a cap that binds is a confounder rather
 * than a limit: the treatment arm may legitimately do more work, so a binding
 * cap truncates it first and pushes the measured effect toward zero." (that
 * quotation predates the vocabulary settling — read "treatment arm" as the
 * skill-present condition. it is left as written because a quotation edited to
 * agree with later usage is no longer evidence of what was decided.) the budget
 * is enforced by admission before the fan-out, which does not distort the
 * measurement.
 */
export const TURN_CAP = 100;

export const ALLOWED_TOOLS = ["Bash", "Edit", "Glob", "Grep", "Read", "Skill", "TodoWrite", "Write"];

/** nothing about writing a unit test needs the network or a subagent. */
export const DISALLOWED_TOOLS = ["Agent", "NotebookEdit", "Task", "WebFetch", "WebSearch"];

/**
 * pinned rather than composed per case, and carried through the configuration
 * into the argv identically for both conditions.
 *
 * changing it invalidates every measurement taken before the change, for the
 * same reason changing {@link MODEL} does: the instrument attributes a
 * difference between the two conditions to the skill, and that holds only
 * while everything else — this brief included — is held constant across the
 * measurements being compared.
 *
 * its wording states the situation the run is actually in and relocates the
 * open question to the final message; it does not instruct the model to skip
 * consulting anyone. several skills in this repository instruct exactly that,
 * so a prohibition here would fight the treatment in the skill-present
 * condition and bias the very arm this instrument exists to read.
 */
export const NONINTERACTIVE_BRIEF =
  "This session runs non-interactively. No one will read a question you ask, and no answer will come back, so a run that stops to ask a question has ended without finishing the work.\n\n" +
  "Take the task as far as the workspace allows. Where you would otherwise put a decision to a person, choose the option you judge best, act on it, and say so in your final message — name the decision you made, what you assumed, and the alternatives you set aside.";

/**
 * @typedef {object} Configuration
 * @property {{ name: string, version: string|null, options: {
 *   maxTurns: number, settingSources: string[],
 *   allowedTools: string[], disallowedTools: string[], appendSystemPrompt: string,
 * } }} runtime
 * @property {{ provider: string, model: string, options: Record<string, unknown> }} model
 * @property {{ name: string, tree: string, commit: string|null }} project
 * @property {Record<string, string>} skills name → content digest; `{}` when skill-absent
 * @property {{ prompt: string }} task
 */

/**
 * @param {{
 *   runtimeVersion?: string|null,
 *   projectName: string,
 *   projectTree: string,
 *   projectCommit?: string|null,
 *   skills?: Record<string, string>,
 *   prompt: string,
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
        appendSystemPrompt: NONINTERACTIVE_BRIEF,
      },
    },
    model: { provider: "anthropic", model: MODEL, options: {} },
    project: { name: projectName, tree: projectTree, commit: projectCommit },
    skills: { ...skills },
    task: { prompt },
  };
}

/**
 * @param {Configuration} configuration
 * @returns {string[]}
 * @throws {Error} when a field the argv needs is absent — loudly, because a
 *   silently-defaulted flag is the drift the round trip exists to catch
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
  if (typeof options?.appendSystemPrompt !== "string") missing.push("runtime.options.appendSystemPrompt");
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
    "--append-system-prompt",
    options.appendSystemPrompt,
  ];
}
