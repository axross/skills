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

const turns = Number(process.env.FAKE_CLAUDE_ASSISTANT_TURNS ?? 2);
const delayMs = Number(process.env.FAKE_CLAUDE_TURN_DELAY_MS ?? 0);
const invokesSkill = process.env.FAKE_CLAUDE_INVOKE_SKILL ?? "";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
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
