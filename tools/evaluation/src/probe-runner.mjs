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

import { redactTranscript, stripCredentials } from "./credentials.mjs";
import { treeDigest } from "./fingerprint.mjs";
import { materialize } from "./mock-workspace.mjs";
import { buildProbeArgv, DEFAULT_TURN_CAP, runProbeProcess } from "./probe-process.mjs";
import { MODEL } from "./spawn.mjs";
import { skillsForCondition } from "./scenario.mjs";
import { parseTranscript, readBehaviour } from "./transcript/index.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** this repository's own HEAD commit, recorded so a probe's metadata says which instrument took it. */
function instrumentCommit() {
  const proc = spawnSync("git", ["rev-parse", "HEAD"], { cwd: REPO_ROOT, encoding: "utf8" });
  return proc.status === 0 ? proc.stdout.trim() : null;
}

/** the workspace's own uncommitted diff against HEAD — the probe artefact. */
function workspaceDiff(workspace) {
  const proc = spawnSync("git", ["diff"], { cwd: workspace, encoding: "utf8" });
  if (proc.status !== 0) throw new Error(`git diff (in ${workspace}) exited ${proc.status}:\n${proc.stderr}`);
  return proc.stdout;
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

    const diff = workspaceDiff(workspace);

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
    await rm(workspace, { recursive: true, force: true });
  }
}
