// the declared configuration a discovery probe runs under, the CLI argv built
// from it, and — unlike the effect side — the actual run.
//
// `buildConfiguration`/`buildArgv` mirror tools/effect-eval/src/spawn.mjs's
// round trip: the configuration is the source and the argv is derived, never
// the other way round and never both independently, so a stored
// `metadata.json` is a complete account of the invocation rather than a
// description that might have drifted.
//
// RUNNING THE CLI LIVES HERE TOO, which is where this module parts ways with
// its effect-side counterpart. tools/effect-eval/evaluate.mjs calls
// `spawnSync` itself, because that instrument writes exactly one probe per
// invocation. tools/discovery-eval/evaluate.mjs writes a whole case's repeats
// in one process (see this instrument's README — discovery has one
// condition, so preparing a workspace and probing it happen together), so
// `runProbe` is called once per repeat from inside one loop; giving it a
// module of its own keeps evaluate.mjs's own body about orchestrating repeats
// rather than about the subprocess.
//
// the tool posture is built from plan.mjs's resolved mode rather than
// declared again here — see plan.mjs's header for why situated permits
// Read/Glob/Grep/Skill and bare permits Skill alone, and why both deny Bash
// and every editing tool unconditionally: discovery asks which skill a model
// reaches for, and a probe that starts doing the work would be measuring the
// effect axis at discovery prices.

import { spawnSync } from "node:child_process";

import { stripCredentials } from "../../lib/credentials.mjs";

/**
 * pinned rather than left to the CLI's default, for the same reason
 * tools/effect-eval/src/spawn.mjs pins one: changing it invalidates every
 * measurement taken before the change, because comparability holds only
 * while the model is constant.
 */
export const MODEL = "claude-sonnet-5";

/** on every invocation, no exceptions — strips the user-level skill tier. */
export const SETTING_SOURCES = ["project"];

/**
 * denied in every situated probe: Bash and the editing tools would let a
 * probe start doing the work rather than choosing who should, and would need
 * a dependency install this instrument never runs.
 */
export const SITUATED_DISALLOWED_TOOLS = [
  "Agent",
  "Bash",
  "Edit",
  "NotebookEdit",
  "Task",
  "TodoWrite",
  "WebFetch",
  "WebSearch",
  "Write",
];

/**
 * denied in every bare probe: everything situated denies, plus Read/Glob/Grep
 * — a bare workspace holds no project worth reading, and denying them again
 * here is defence in depth rather than reliance on there being nothing to
 * find — and ToolSearch, which `allowedTools: ["Skill"]` alone did not keep
 * out of a bare probe: measured records from a real dispatch show three of
 * twelve bare probes spending their one turn on a `ToolSearch` call instead
 * of `Skill`, burning the turn cap on a tool this evaluation was never meant
 * to expose. THAT THE CLI HONOURS THIS DECLARATION IS MEASURED, NOT ASSUMED:
 * re-running all six bare cases under it produced twelve probes and not one
 * `ToolSearch` call, and the case whose two probes had both spent their only
 * turn on it selected a skill instead. The mechanism is the installed CLI's
 * own tool-search gate, which reads a tool named `ToolSearch` off the set it
 * was actually given and logs "may have been disallowed via disallowedTools"
 * once that name is absent from it.
 */
export const BARE_DISALLOWED_TOOLS = [
  "Agent",
  "Bash",
  "Edit",
  "Glob",
  "Grep",
  "NotebookEdit",
  "Read",
  "Task",
  "TodoWrite",
  "ToolSearch",
  "WebFetch",
  "WebSearch",
  "Write",
];

/**
 * @typedef {object} Configuration
 * @property {{ name: string, version: string|null, options: {
 *   maxTurns: number, settingSources: string[],
 *   allowedTools: string[], disallowedTools: string[],
 * } }} runtime
 * @property {{ provider: string, model: string, options: Record<string, unknown> }} model
 * @property {{ mode: "situated"|"bare", mock: string|null, tree: string|null }} workspace
 * @property {Record<string, string>} skills name → `description` digest
 * @property {Record<string, string>} invocability name → "invocable"|"not-invocable"|"unrecognised",
 *   declared here rather than read live at summarize time so the derivation
 *   in summary.mjs stays a pure function of the committed files — see that
 *   module's header
 * @property {{
 *   id: string, prompt: string, mock: string|null, population: string,
 *   mustInclude: string[], mustExclude: string[], mayInclude: string[],
 *   rationale: string,
 * }} case
 */

/**
 * @param {{
 *   runtimeVersion?: string|null,
 *   plan: import("./plan.mjs").ReturnType<typeof import("./plan.mjs").planFor>,
 *   projectTree?: string|null,
 *   skills?: Record<string, string>,
 *   invocability?: Record<string, string>,
 *   testCase: object,
 * }} input
 * @returns {Configuration}
 */
export function buildConfiguration({
  runtimeVersion = null,
  plan,
  projectTree = null,
  skills = {},
  invocability = {},
  testCase,
}) {
  const disallowedTools = plan.mode === "situated" ? SITUATED_DISALLOWED_TOOLS : BARE_DISALLOWED_TOOLS;
  return {
    runtime: {
      name: "claude-code",
      version: runtimeVersion,
      options: {
        maxTurns: plan.turns,
        settingSources: [...SETTING_SOURCES],
        allowedTools: [...plan.tools],
        disallowedTools: [...disallowedTools],
      },
    },
    model: { provider: "anthropic", model: MODEL, options: {} },
    workspace: {
      mode: plan.mode,
      mock: plan.workspace.kind === "mock" ? plan.workspace.mock : null,
      tree: plan.mode === "situated" ? projectTree : null,
    },
    skills: { ...skills },
    invocability: { ...invocability },
    case: {
      id: testCase.id,
      prompt: testCase.prompt,
      mock: testCase.mock ?? null,
      population: testCase.population,
      mustInclude: [...(testCase.mustInclude ?? [])],
      mustExclude: [...(testCase.mustExclude ?? [])],
      mayInclude: [...(testCase.mayInclude ?? [])],
      rationale: testCase.rationale,
    },
  };
}

/**
 * @param {Configuration} configuration
 * @returns {string[]}
 * @throws {Error} when a field the argv needs is absent — loudly, because a
 *   silently-defaulted flag is the drift the round trip exists to catch
 */
export function buildArgv(configuration) {
  const { runtime, model, case: theCase } = configuration ?? {};
  const options = runtime?.options;

  const missing = [];
  if (typeof theCase?.prompt !== "string") missing.push("case.prompt");
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
    theCase.prompt,
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
 * for display only — the real invocation passes an argv array with no shell.
 *
 * @param {string} argument
 * @returns {string}
 */
export function shellQuote(argument) {
  return /^[A-Za-z0-9_./:=-]+$/.test(argument) ? argument : `'${argument.replaceAll("'", `'\\''`)}'`;
}

/**
 * a one-turn, cost-free transcript shaped like the CLI's — so a dry run
 * exercises the whole pipeline, redaction and derivation included, rather
 * than only the half that precedes the spawn. mirrors
 * tools/effect-eval/evaluate.mjs's `syntheticTranscript`.
 *
 * @param {Configuration} configuration
 * @returns {string}
 */
export function syntheticTranscript(configuration) {
  return (
    [
      JSON.stringify({
        type: "system",
        subtype: "init",
        model: configuration.model.model,
        version: configuration.runtime.version ?? undefined,
        skills: [],
      }),
      JSON.stringify({ type: "result", subtype: "success", num_turns: 0, total_cost_usd: 0 }),
    ].join("\n") + "\n"
  );
}

/** one probe's worth of stdout, generously bounded for a read-only run. */
const MAX_BUFFER_BYTES = 32 * 1024 * 1024;

/**
 * run one probe: spawn the CLI in `workspace`, or fabricate a synthetic
 * transcript under `dryRun`. building the argv and running the CLI both live
 * here — see this module's header for why that differs from the effect side.
 *
 * @param {Configuration} configuration
 * @param {{ workspace: string, dryRun?: boolean }} options
 * @returns {{ rawStdout: string, cliExitCode: number|null, argv: string[] }}
 * @throws {Error} when the CLI cannot be spawned for any reason but its
 *   absence, which the caller is expected to report and exit on
 */
export function runProbe(configuration, { workspace, dryRun = false }) {
  const argv = buildArgv(configuration);

  if (dryRun) {
    return { rawStdout: syntheticTranscript(configuration), cliExitCode: null, argv };
  }

  const result = spawnSync("claude", argv, {
    cwd: workspace,
    encoding: "utf8",
    env: stripCredentials(process.env),
    maxBuffer: MAX_BUFFER_BYTES,
  });
  if (result.error) {
    if (result.error.code === "ENOENT") {
      const error = new Error(
        "The `claude` CLI is not on PATH. This probe drives the real CLI; install it or run " +
          "with --dry-run.",
      );
      error.code = "ENOENT";
      throw error;
    }
    throw result.error;
  }
  // a non-zero exit is expected here exactly as on the effect side: a
  // legitimately long situated run can end in error_max_turns, and a bare
  // probe is not guaranteed to spend its turn cap on a tool call at all. the
  // stream is complete either way, so the exit code is diagnostic, never
  // failure.
  return { rawStdout: result.stdout, cliExitCode: result.status, argv };
}
