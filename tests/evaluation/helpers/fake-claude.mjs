#!/usr/bin/env node
// a fake `claude` CLI: prints a small, valid `stream-json` transcript and
// exits 0. installed on PATH ahead of the real binary (see
// tests/evaluation/helpers/fake-cli.mjs's withFakeClaude), so a test can
// drive probe.mjs's real (non-dry-run) path through a real subprocess
// boundary without ever reaching the network or a real model.
//
// FAKE_CLAUDE_ASSISTANT_TURNS controls how many assistant-turn lines it
// prints (default 2, small); FAKE_CLAUDE_TURN_DELAY_MS pauses between them
// (default 0), which is what gives a turn-cap test room to observe the kill
// before every line has already been written.
//
// FAKE_CLAUDE_COMMIT_FILE is opt-in, and separate from the transcript
// entirely: when set, this writes a file at that path (workspace-relative,
// since `runProbeProcess` spawns this with `cwd: workspace`) and commits it
// on the branch it is already on, before printing anything — a probe that
// commits its own work, the shape capture.mjs's own `captureWorkspaceDiff`
// exists to still capture correctly. FAKE_CLAUDE_COMMIT_CONTENT names the
// file's content when the default is not wanted.

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const turns = Number(process.env.FAKE_CLAUDE_ASSISTANT_TURNS ?? 2);
const delayMs = Number(process.env.FAKE_CLAUDE_TURN_DELAY_MS ?? 0);
const invokesSkill = process.env.FAKE_CLAUDE_INVOKE_SKILL ?? "";
const commitFile = process.env.FAKE_CLAUDE_COMMIT_FILE ?? "";
const commitContent = process.env.FAKE_CLAUDE_COMMIT_CONTENT ?? "fake claude committed this\n";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** writes `commitFile` and commits it, isolated from the ambient git config the same way capture.mjs's own runGit is. */
function commitFakeWork() {
  mkdirSync(dirname(commitFile), { recursive: true });
  writeFileSync(commitFile, commitContent, "utf8");
  const env = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" };
  const add = spawnSync("git", ["add", "--", commitFile], { encoding: "utf8", env });
  if (add.status !== 0) throw new Error(`fake-claude: git add ${commitFile} exited ${add.status}:\n${add.stderr}`);
  const commit = spawnSync(
    "git",
    [
      "-c",
      "user.name=Fake Claude",
      "-c",
      "user.email=fake-claude@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "-q",
      "-m",
      "Fake Claude commits its own work",
    ],
    { encoding: "utf8", env },
  );
  if (commit.status !== 0) throw new Error(`fake-claude: git commit exited ${commit.status}:\n${commit.stderr}`);
}

async function main() {
  if (commitFile) commitFakeWork();

  process.stdout.write(
    `${JSON.stringify({
      type: "system",
      subtype: "init",
      model: "claude-sonnet-5-20260215",
      version: "2.1.233",
      skills: invokesSkill ? [invokesSkill] : [],
    })}\n`,
  );

  for (let turn = 1; turn <= turns; turn += 1) {
    const content = [{ type: "text", text: `turn ${turn}` }];
    if (turn === 1 && invokesSkill) {
      content.push({ type: "tool_use", id: `toolu_${turn}`, name: "Skill", input: { skill: invokesSkill } });
    }
    process.stdout.write(
      `${JSON.stringify({
        type: "assistant",
        message: {
          role: "assistant",
          content,
          usage: { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
        },
      })}\n`,
    );
    if (delayMs > 0) await sleep(delayMs);
  }

  process.stdout.write(
    `${JSON.stringify({ type: "result", subtype: "success", num_turns: turns, total_cost_usd: 0.01 })}\n`,
  );
}

main();
