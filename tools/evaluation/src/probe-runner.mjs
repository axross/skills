// running one probe end to end and returning the four files it produces —
// the verbatim transcript, the workspace diff, the skill invocations, and
// metadata carrying the runtime, the model, and the digest of every
// installed skill (docs/specs/skill-evaluation.md, "What a measurement
// stores").
//
// filesystem-write-free on purpose: this module materializes a workspace,
// spawns (or, in a test, is handed a stub for) the CLI, and returns the four
// records in memory. probe.mjs's CLI layer decides where they land on disk,
// which keeps this module runnable against a fake `spawnFn` with nothing
// written outside a throwaway temporary directory it owns and removes.

import { spawnSync } from "node:child_process";
import { rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { captureWorkspaceDiff } from "./capture.mjs";
import { redactTranscript, stripCredentials } from "./credentials.mjs";
import { treeDigest } from "./fingerprint.mjs";
import { materialize } from "./mock-workspace.mjs";
import {
  ALLOWED_TOOLS,
  buildProbeArgv,
  DEFAULT_TURN_CAP,
  DISALLOWED_TOOLS,
  runProbeProcess,
} from "./probe-process.mjs";
import { MODEL } from "./spawn.mjs";
import { skillsForCondition } from "./scenario.mjs";
import { compareToolSurface, describeToolSurface } from "./tool-surface.mjs";
import { parseTranscript, readBehaviour } from "./transcript/index.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** this repository's own HEAD commit, recorded so a probe's metadata says which instrument took it. */
function instrumentCommit() {
  const proc = spawnSync("git", ["rev-parse", "HEAD"], { cwd: REPO_ROOT, encoding: "utf8" });
  return proc.status === 0 ? proc.stdout.trim() : null;
}

/** the workspace's own HEAD commit — the base state the probe started from. */
function workspaceCommit(workspace) {
  const proc = spawnSync("git", ["rev-parse", "HEAD"], { cwd: workspace, encoding: "utf8" });
  if (proc.status !== 0) throw new Error(`git rev-parse HEAD (in ${workspace}) exited ${proc.status}`);
  return proc.stdout.trim();
}

/**
 * runs one probe and returns what it produced, without writing anything to
 * a measurement directory.
 *
 * @param {{
 *   scenario: object, condition: "skill-present"|"skill-absent", repetition: number,
 *   spawnFn?: Function, turnCap?: number, apiKeyEnv?: Record<string,string|undefined>,
 * }} options `scenario` is an already-loaded, already-validated scenario
 *   (see scenario.mjs's loadScenario). `spawnFn` is threaded to
 *   probe-process.mjs's runProbeProcess, so a test can run this module's
 *   whole orchestration against a fake child process. `apiKeyEnv` defaults
 *   to `process.env` and is credential-stripped before the CLI sees it.
 * @returns {Promise<{
 *   metadata: Record<string, unknown>,
 *   transcript: string,
 *   diff: string,
 *   invocations: Record<string, unknown>,
 * }>}
 * @throws {Error} when materialization fails or the CLI cannot be spawned
 */
export async function runProbe({
  scenario,
  condition,
  repetition,
  spawnFn,
  turnCap = DEFAULT_TURN_CAP,
  apiKeyEnv = process.env,
}) {
  const skills = skillsForCondition(scenario, condition);
  const workspace = await materialize({
    mock: scenario.mock,
    skills,
    patch: scenario.patch === null ? null : resolve(scenario.dir, scenario.patch),
    install: false,
  });

  try {
    const projectTree = await treeDigest(workspace);
    const commit = workspaceCommit(workspace);

    const skillDigests = {};
    for (const name of skills) {
      skillDigests[name] = await treeDigest(join(workspace, ".claude", "skills", name));
    }

    const argv = buildProbeArgv({ prompt: scenario.task.prompt });
    const env = stripCredentials(apiKeyEnv);
    const startedAt = new Date();
    const { stdout, exitCode, killedByTurnCap } = await runProbeProcess({
      argv,
      cwd: workspace,
      env,
      turnCap,
      ...(spawnFn ? { spawnFn } : {}),
    });

    const { text: redactedStdout } = redactTranscript(stdout, apiKeyEnv);
    const parsed = parseTranscript(redactedStdout);
    const behaviour = readBehaviour(parsed);

    const diff = captureWorkspaceDiff(workspace, { baseCommit: commit });

    const toolSurface = compareToolSurface({
      reported: parsed.availableTools,
      allowed: ALLOWED_TOOLS,
      disallowed: DISALLOWED_TOOLS,
    });
    // written where the cleanup warning below is written, so a dispatch log
    // names the drift on the probe that hit it. the record under `runtime`
    // is what survives the run; this is what someone watching it sees.
    for (const line of describeToolSurface(toolSurface)) {
      process.stderr.write(`  warning: tool surface — ${line}\n`);
    }

    const metadata = {
      scenario: scenario.id,
      condition,
      repetition,
      timestamp: startedAt.toISOString(),
      runtime: {
        model: `anthropic/${parsed.model ?? MODEL}`,
        cliVersion: parsed.runtimeVersion,
        node: process.version,
        os: process.platform,
        instrumentCommit: instrumentCommit(),
        project: { mock: scenario.mock, tree: projectTree, commit },
        tools: {
          reported: parsed.availableTools,
          allowed: ALLOWED_TOOLS,
          disallowed: DISALLOWED_TOOLS,
          disagreements: toolSurface,
        },
      },
      harness: {
        skills: skillDigests,
        agentsMd: scenario.harness.agentsMd,
      },
      task: { prompt: scenario.task.prompt },
      cliExitCode: exitCode,
      turns: parsed.turns,
      truncated: parsed.truncated || killedByTurnCap,
      costUsd: parsed.cost,
      usage: parsed.usage,
      loadedSkills: parsed.loadedSkills,
    };

    return {
      metadata,
      transcript: redactedStdout,
      diff,
      invocations: { skillsInvoked: behaviour.skillsInvoked },
    };
  } finally {
    try {
      await rm(workspace, { recursive: true, force: true });
    } catch (error) {
      // a cleanup that cannot complete must never discard the probe record
      // this call already produced. the leak is reported, not swallowed, so
      // an unremovable workspace on a runner is still visible.
      process.stderr.write(`  warning: could not remove ${workspace}: ${error.message}\n`);
    }
  }
}
