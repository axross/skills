// Reading what a probe selected out of the CLI's JSONL stream.
//
// Split from run.mjs so it can be imported by a test: run.mjs is a CLI whose
// module body calls `main()` and then `process.exit`, exactly as the note in
// tests/helpers/run.mjs describes, so nothing importable may live there.
//
// The stream is `claude -p --output-format stream-json --verbose`. Three event
// shapes matter:
//   * `{"type":"system", ..., "model":"…"}`   the model actually used — the
//     field every baseline delta hangs on, so it is read rather than assumed
//     from whatever `--model` was requested.
//   * assistant messages carrying `tool_use` blocks named `Skill`, whose
//     `input.skill` is the selection being measured.
//   * `{"type":"result", "total_cost_usd": n}` for the run's cost.
//
// Parsing is deliberately forgiving of a line it cannot read. A truncated final
// line is normal when the CLI is terminated by its turn cap, and discarding one
// unreadable line is better than discarding the run that produced it.

/**
 * @param {string} stdout raw JSONL from one probe
 * @returns {{ skills: string[], model: string|null, cost: number }}
 *   `skills` may repeat a name if one turn invoked it twice; callers that count
 *   runs rather than calls de-duplicate.
 */
export function parseStream(stdout) {
  const skills = [];
  let model = null;
  let cost = 0;

  for (const line of stdout.split("\n")) {
    const text = line.trim();
    if (text === "") continue;

    let event;
    try {
      event = JSON.parse(text);
    } catch {
      continue;
    }

    if (event.type === "system" && typeof event.model === "string") {
      model ??= event.model;
    }
    if (event.type === "result" && typeof event.total_cost_usd === "number") {
      cost = event.total_cost_usd;
    }

    const content = event?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block?.type !== "tool_use" || block.name !== "Skill") continue;
      const selected = block.input?.skill;
      if (typeof selected !== "string" || selected === "") continue;
      // A plugin-qualified name ("plugin:skill") reduces to the skill itself, so
      // a fixture label never has to know how a skill was installed.
      skills.push(selected.includes(":") ? selected.split(":").pop() : selected);
    }
  }

  return { skills, model, cost };
}
