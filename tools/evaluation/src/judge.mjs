// asking a reasoning judge to render one factor's verdict, through the
// `claude` CLI rather than the Anthropic Messages API directly.
//
// the Messages API refuses a Claude Code OAuth token outright, and that
// token is the only model credential this repository's dispatch carries —
// this repository sets no ANTHROPIC_API_KEY. So a reasoning judgment is
// asked the same way a probe already gets one: by spawning the CLI a probe
// already spawns and already authenticates, non-interactively, with every
// tool this instrument knows about denied, no setting sources loaded, and a
// working directory holding none of this repository's files.
//
// docs/specs/skill-evaluation.md, "The factor": "a reasoning judgment asks a
// reasoning judge — a model — to read the material its factor's phase
// permits and report a verdict." This module is the one place that ask
// happens: it runs `claude --print`, reads the envelope's own `result`
// field as the model's final text, and refuses to read anything else out
// of the response.
//
// `spawnFn` is threaded through the one exported function that spawns a
// process, in the same style tools/evaluation/src/probe-process.mjs's
// `runProbeProcess` uses, so a test can hand this a fake child process — see
// tests/evaluation/judge.test.mjs. Nothing in this repository's own test
// suite spawns a real `claude` here.

import { spawn as nodeSpawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CLI_AUTH_ENV_VARS, stripCredentials } from "./credentials.mjs";
import { ALLOWED_TOOLS, DISALLOWED_TOOLS } from "./probe-process.mjs";

/**
 * every tool name this instrument's probe module knows about, denied
 * wholesale on a judge's own spawn: a judge reads a stored transcript —
 * untrusted model output — and must be able to act on nothing it says.
 */
const DENIED_TOOLS = [...ALLOWED_TOOLS, ...DISALLOWED_TOOLS];

/**
 * the route recorded on every reasoning factor's `judge` object, alongside
 * its model — see docs/specs/skill-evaluation.md, "What makes two
 * measurements comparable".
 */
export const JUDGE_ROUTE = "claude-code-cli";

/**
 * strips a model id's vendor prefix. the CLI's `--model` flag takes the bare
 * model name; `anthropic/…` is this instrument's own recorded, comparable
 * form (see docs/specs/skill-evaluation.md's "What a measurement stores"),
 * not the CLI's.
 *
 * @param {string} model e.g. "anthropic/claude-haiku-4-5-20251001"
 * @returns {string} e.g. "claude-haiku-4-5-20251001"
 */
export function bareModel(model) {
  return model.includes("/") ? model.slice(model.indexOf("/") + 1) : model;
}

/**
 * reads a verdict out of a judge's raw text response. the model is
 * instructed to answer with exactly one JSON object; this is the one place
 * that instruction is both relied on and checked.
 *
 * deliberately strict: `result` must be a JSON boolean, never the string
 * `"true"` and never a differently-named field such as `"outcome"` — which
 * is exactly the shape a judge answering off-contract would produce, and
 * exactly what the reasoning-path negative control plants.
 *
 * @param {string} text
 * @returns {{ result: boolean, evidence: string }}
 * @throws {Error} when `text` holds no JSON object, the object's `result` is
 *   not a boolean, or its `evidence` is not a non-empty string
 */
export function parseVerdict(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("the judge's response held no JSON object to read a verdict from.");

  let parsed;
  try {
    parsed = JSON.parse(match[0]);
  } catch (error) {
    throw new Error(`the judge's response was not valid JSON: ${error.message}`);
  }
  if (typeof parsed.result !== "boolean") {
    throw new Error(`the judge's "result" must be a JSON boolean, got ${JSON.stringify(parsed.result)}.`);
  }
  if (typeof parsed.evidence !== "string" || parsed.evidence.length === 0) {
    throw new Error('the judge\'s "evidence" must be a non-empty, quotable string.');
  }
  return { result: parsed.result, evidence: parsed.evidence };
}

/**
 * the argv for one judge's `claude` invocation. an argv array, never a
 * shell string — the same discipline probe-process.mjs's `buildProbeArgv`
 * follows. `--system-prompt` replaces the CLI's own default system prompt
 * rather than appending to it (`--append-system-prompt` would add to it),
 * so the judge's context carries the instrument's own system prompt in
 * place of the CLI's, not the CLI's plus the instrument's.
 *
 * @param {{ userPrompt: string, model: string, systemPrompt: string }} options
 * @returns {string[]}
 */
export function buildJudgeArgv({ userPrompt, model, systemPrompt }) {
  return [
    "--print",
    userPrompt,
    "--output-format",
    "json",
    "--model",
    bareModel(model),
    "--system-prompt",
    systemPrompt,
    "--setting-sources",
    "",
    "--disallowed-tools",
    DENIED_TOOLS.join(","),
  ];
}

/**
 * normalizes one judge process's raw exit into a result — never throws for
 * anything the judge itself did. The CLI writes exactly one JSON envelope to
 * stdout under `--output-format json`; this is the one place that
 * expectation is both relied on and checked.
 *
 * @param {{ stdout: string, stderr: string, exitCode: number|null }} options
 * @returns {{ result: boolean, evidence: string } | { error: string }}
 */
function readJudgeEnvelope({ stdout, stderr, exitCode }) {
  if (exitCode !== 0) {
    // bounded the same way the HTTP path this replaced bounded a non-200
    // response body (`body.slice(0, 500)`): a runaway `claude` stderr must
    // not bloat a stored factors.json without limit.
    const detail = (stderr.trim() || stdout.trim() || "(nothing on stdout or stderr)").slice(0, 500);
    return { error: `the judge exited ${exitCode}: ${detail}` };
  }

  let envelope;
  try {
    envelope = JSON.parse(stdout.trim());
  } catch (error) {
    return { error: `the judge's stdout was not a single JSON object: ${error.message}` };
  }
  // JSON.parse succeeds for a JSON value that is not an object at all — the
  // literal `null` and a bare primitive both parse cleanly — so this is
  // checked before any property of `envelope` is read.
  if (typeof envelope !== "object" || envelope === null) {
    return { error: `the judge's stdout parsed as JSON but was not an object: ${JSON.stringify(envelope)}` };
  }

  if (envelope.is_error === true) {
    return { error: `the judge's envelope reported is_error: true (subtype ${JSON.stringify(envelope.subtype)}).` };
  }
  if (envelope.subtype !== "success") {
    return { error: `the judge's envelope carried subtype ${JSON.stringify(envelope.subtype)}, not "success".` };
  }
  if (typeof envelope.result !== "string") {
    return { error: 'the judge\'s envelope carried no readable "result" string.' };
  }

  try {
    return parseVerdict(envelope.result);
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * runs one judge's `claude` invocation to completion and reads its one JSON
 * envelope — never rejects; a spawn failure resolves as `{ error }`, the
 * same as every other way the judge can fail to answer.
 *
 * @param {{ argv: string[], cwd: string, env: Record<string,string>, spawnFn: typeof nodeSpawn }} options
 * @returns {Promise<{ result: boolean, evidence: string } | { error: string }>}
 */
function runJudgeProcess({ argv, cwd, env, spawnFn }) {
  return new Promise((resolvePromise) => {
    // guarded rather than left to the executor: an executor that throws
    // synchronously produces a REJECTED promise, not an `{ error }` result,
    // and spawn() does throw synchronously for some malformed options (a
    // non-string cwd, for instance) — "spawn only ever emits an error
    // event" holds for ENOENT/EACCES but is not universal.
    let child;
    try {
      child = spawnFn("claude", argv, { cwd, env });
    } catch (error) {
      resolvePromise({ error: `the judge could not be spawned: ${error.message}` });
      return;
    }

    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      resolvePromise({ error: `the judge could not be spawned: ${error.message}` });
    });
    child.on("close", (exitCode) => {
      resolvePromise(readJudgeEnvelope({ stdout, stderr, exitCode }));
    });
  });
}

/**
 * asks a reasoning judge to render one factor's verdict, by spawning the
 * `claude` CLI.
 *
 * never throws for anything the judge itself did or failed to do — a spawn
 * failure, a non-zero exit, an unreadable envelope — because a judgment
 * that could not be made is not a judgment that came out `false`
 * (docs/specs/skill-evaluation.md, "The factor"). It throws only for this
 * instrument's own misconfiguration: calling it with no CLI credential in
 * `env` at all.
 *
 * a cleanup failure on the temporary working directory is attached to the
 * outcome already decided as `cleanupWarning` rather than allowed to
 * discard it — the same pattern factor-judgment.mjs's own
 * `runScriptJudgment` uses for its own scratch directory.
 *
 * @param {{
 *   model: string,
 *   systemPrompt: string,
 *   userPrompt: string,
 *   env?: Record<string, string|undefined>,
 *   spawnFn?: typeof nodeSpawn,
 * }} options `model` is vendor-prefixed, e.g. "anthropic/claude-haiku-4-5-20251001";
 *   `env` is usually `process.env`
 * @returns {Promise<
 *   { result: boolean, evidence: string, cleanupWarning?: string } |
 *   { error: string, cleanupWarning?: string }
 * >}
 * @throws {Error} when `env` carries none of `CLI_AUTH_ENV_VARS`
 */
export async function callReasoningJudge({
  model,
  systemPrompt,
  userPrompt,
  env = process.env,
  spawnFn = nodeSpawn,
}) {
  if (!CLI_AUTH_ENV_VARS.some((name) => env[name])) {
    throw new Error(
      `callReasoningJudge needs one of ${CLI_AUTH_ENV_VARS.join(" or ")} set in its environment; neither was given.`,
    );
  }

  let scratch;
  try {
    scratch = await mkdtemp(join(tmpdir(), "judge-cwd-"));
  } catch (error) {
    return { error: `could not create the judge's working directory: ${error.message}` };
  }

  let outcome;
  try {
    outcome = await runJudgeProcess({
      argv: buildJudgeArgv({ userPrompt, model, systemPrompt }),
      cwd: scratch,
      env: stripCredentials(env),
      spawnFn,
    });
  } finally {
    try {
      await rm(scratch, { recursive: true, force: true });
    } catch (error) {
      // a cleanup that cannot complete must never discard the judgment
      // already decided above. carried into the outcome rather than thrown,
      // since throwing here would silently replace the judgment with the
      // cleanup error.
      outcome = { ...outcome, cleanupWarning: `could not remove ${scratch}: ${error.message}` };
    }
  }
  return outcome;
}
