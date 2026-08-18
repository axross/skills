// judging one factor against a reconstructed probe workspace: running its
// script, or asking its reasoning judge, and normalizing either outcome into
// the record factors.json stores.
//
// docs/specs/skill-evaluation.md, "The factor": "A script judgment runs with
// the reconstructed workspace as its working directory and a context file as
// its argument, prints {"result", "evidence"} on stdout, and signals a
// failed judgment by a non-zero exit with a reason on stderr." This module
// is both sides of that contract: the CLI invocation it builds, and the
// normalization of whatever comes back — including a script that hands back
// something off-contract, which is not this instrument's problem to guess
// at, only to report.

import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { callReasoningJudge } from "./judge.mjs";
import { canonicalJson } from "./layout.mjs";

/**
 * the material one factor's judge is shown, bounded by its phase alone —
 * never by what else a probe happened to record. docs/specs/skill-evaluation.md,
 * "Three phases": discovery sees the skill invocations, outcome sees the
 * diff and the task, transcript sees the transcript.
 *
 * @param {"discovery"|"outcome"|"transcript"} phase
 * @param {{ skillsInvoked: string[], diff: string, task: { prompt: string }, transcript: string }} probe
 * @returns {Record<string, unknown>}
 * @throws {Error} on a phase this instrument does not know
 */
export function materialFor(phase, probe) {
  if (phase === "discovery") return { skillsInvoked: probe.skillsInvoked };
  if (phase === "outcome") return { diff: probe.diff, task: probe.task };
  if (phase === "transcript") return { transcript: probe.transcript };
  throw new Error(`Unknown phase ${JSON.stringify(phase)}.`);
}

/**
 * runs the script and normalizes its exit into a result — never throws for
 * anything the script itself did. split out of runScriptJudgment so that
 * function can capture this one's outcome in a variable rather than return
 * it directly, which is what lets a cleanup failure attach a warning to an
 * outcome already decided instead of replacing it (see #413).
 *
 * @param {{ scriptPath: string, workspace: string, context: Record<string, unknown>, scratch: string }} options
 * @returns {Promise<{ result: boolean, evidence: string } | { error: string }>}
 */
async function judgeWithScript({ scriptPath, workspace, context, scratch }) {
  const contextPath = join(scratch, "context.json");
  await writeFile(contextPath, canonicalJson(context), "utf8");

  const proc = spawnSync(process.execPath, [resolve(scriptPath), contextPath], {
    cwd: workspace,
    encoding: "utf8",
  });
  if (proc.error) return { error: `could not run ${scriptPath}: ${proc.error.message}` };
  if (proc.status !== 0) {
    return { error: proc.stderr.trim() || `${scriptPath} exited ${proc.status} with nothing on stderr` };
  }

  let parsed;
  try {
    parsed = JSON.parse(proc.stdout);
  } catch (error) {
    return { error: `${scriptPath} printed unparseable JSON on stdout: ${error.message}` };
  }
  if (typeof parsed.result !== "boolean") {
    return { error: `${scriptPath} printed a non-boolean "result": ${JSON.stringify(parsed.result)}` };
  }
  if (typeof parsed.evidence !== "string" || parsed.evidence.length === 0) {
    return { error: `${scriptPath} printed no non-empty "evidence".` };
  }
  return { result: parsed.result, evidence: parsed.evidence };
}

/**
 * runs one `script` judgment and normalizes its exit into a result — never
 * throws for anything the script itself did.
 *
 * @param {{ scriptPath: string, workspace: string, context: Record<string, unknown> }} options
 * @returns {Promise<
 *   { result: boolean, evidence: string, cleanupWarning?: string } |
 *   { error: string, cleanupWarning?: string }
 * >} `cleanupWarning` is present only when the scratch directory could not
 *   be removed afterward; this module has no CLI of its own and no other
 *   channel a person reads, so the warning rides along in what
 *   judgeFactor turns into the stored factor record — see #413.
 */
async function runScriptJudgment({ scriptPath, workspace, context }) {
  const scratch = await mkdtemp(join(tmpdir(), "evaluate-context-"));
  let outcome;
  try {
    outcome = await judgeWithScript({ scriptPath, workspace, context, scratch });
  } finally {
    try {
      await rm(scratch, { recursive: true, force: true });
    } catch (error) {
      // a cleanup that cannot complete must never discard the judgment
      // already decided above — see #413. carried into the outcome rather
      // than thrown, since throwing here is exactly the bug this fixes.
      outcome = { ...outcome, cleanupWarning: `could not remove ${scratch}: ${error.message}` };
    }
  }
  return outcome;
}

/**
 * judges one factor and returns the record factors.json stores it as.
 *
 * @param {{
 *   id: string, phase: "discovery"|"outcome"|"transcript",
 *   judgment: { method: "script", script: string, input?: unknown }
 *            | { method: "reasoning", model: string, instructions: string },
 * }} factor one scenario's own factor declaration
 * @param {{
 *   scenarioDir: string,
 *   workspace: string,
 *   probe: { skillsInvoked: string[], diff: string, task: { prompt: string }, transcript: string },
 *   apiKey?: string,
 *   fetchImpl?: typeof fetch,
 * }} context
 * @returns {Promise<{
 *   id: string, phase: string, method: "script"|"reasoning",
 *   result: true|false|{error:string}, evidence?: string,
 *   judge?: { model: string }, prompt?: string, cleanupWarning?: string,
 * }>} `cleanupWarning`, when present, means the script judgment's scratch
 *   directory could not be removed — see runScriptJudgment.
 */
export async function judgeFactor(factor, { scenarioDir, workspace, probe, apiKey, fetchImpl }) {
  const material = materialFor(factor.phase, probe);

  if (factor.judgment.method === "script") {
    const outcome = await runScriptJudgment({
      scriptPath: join(scenarioDir, factor.judgment.script),
      workspace,
      context: {
        phase: factor.phase,
        factorId: factor.id,
        input: factor.judgment.input ?? null,
        material,
      },
    });
    // spread only when present, so a clean cleanup leaves the record exactly
    // as it was before #413's fix.
    const cleanup = "cleanupWarning" in outcome ? { cleanupWarning: outcome.cleanupWarning } : {};
    if ("error" in outcome) {
      return { id: factor.id, phase: factor.phase, method: "script", result: { error: outcome.error }, ...cleanup };
    }
    return {
      id: factor.id,
      phase: factor.phase,
      method: "script",
      result: outcome.result,
      evidence: outcome.evidence,
      ...cleanup,
    };
  }

  const userPrompt =
    `${factor.judgment.instructions}\n\nMaterial:\n${JSON.stringify(material, null, 2)}\n\n` +
    'Answer with exactly one JSON object and nothing else: {"result": true|false, ' +
    '"evidence": "<a short, specific quote or description of what you based the verdict on>"}.';

  // a missing API key cannot reach the judge at all, and is exactly as
  // unreached as a network failure would be — recorded as an error on this
  // one factor, never as a thrown exception that would abort every other
  // factor's judgment, and never as `false`.
  if (!apiKey) {
    return {
      id: factor.id,
      phase: factor.phase,
      method: "reasoning",
      result: { error: "no reasoning-judge API key was provided; the judge was never asked." },
      judge: { model: factor.judgment.model },
      prompt: userPrompt,
    };
  }

  const outcome = await callReasoningJudge({
    model: factor.judgment.model,
    systemPrompt:
      "You are a strict, literal-minded judge for one checkable expectation about a single " +
      "piece of software work. Answer only the JSON object asked for; never anything outside it.",
    userPrompt,
    apiKey,
    fetchImpl,
  });
  const common = {
    id: factor.id,
    phase: factor.phase,
    method: "reasoning",
    judge: { model: factor.judgment.model },
    prompt: userPrompt,
  };
  if ("error" in outcome) return { ...common, result: { error: outcome.error } };
  return { ...common, result: outcome.result, evidence: outcome.evidence };
}
