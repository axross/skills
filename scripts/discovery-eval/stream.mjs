// Reading what a probe selected out of the CLI's JSONL stream.
//
// Split from run.mjs so it can be imported by a test: run.mjs is a CLI whose
// module body calls `main()` and then `process.exit`, exactly as the note in
// tests/helpers/run.mjs describes, so nothing importable may live there.
//
// The stream is `claude -p --output-format stream-json --verbose`. Four event
// shapes matter:
//   * `{"type":"system", ..., "model":"…"}`   the model actually used — the
//     field every selection-snapshot delta hangs on, so it is read rather than assumed
//     from whatever `--model` was requested.
//   * `{"type":"system","subtype":"init", ..., "skills":[…]}` the skills the CLI
//     LOADED, which is not the same set as the workspace installed — see
//     isolation.mjs. Read from `skills` and never from `slash_commands`, which
//     mixes skills with built-in commands (`/clear`, `/compact`) and would
//     over-report contamination by roughly a factor of two.
//   * assistant messages carrying `tool_use` blocks named `Skill`, whose
//     `input.skill` is the selection being measured.
//   * `{"type":"result", "total_cost_usd": n}` for the run's cost.
//
// Parsing is deliberately forgiving of a line it cannot read. A truncated final
// line is normal when the CLI is terminated by its turn cap, and discarding one
// unreadable line is better than discarding the run that produced it.

/**
 * @param {string} stdout raw JSONL from one probe
 * @returns {{ skills: string[], loaded: string[]|null, model: string|null, cost: number }}
 *   `skills` is what this probe SELECTED, and may repeat a name if one turn
 *   invoked it twice; callers that count runs rather than calls de-duplicate.
 *   `loaded` is what the CLI had available, or `null` when the stream carried no
 *   such field — `null` and `[]` are deliberately distinct, because an older CLI
 *   reporting nothing must never read as a run that loaded nothing foreign.
 */
export function parseStream(stdout) {
  const skills = [];
  let loaded = null;
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
    // Verbatim, with no `plugin:skill` reduction. That reduction is right for a
    // SELECTION — a fixture label should not have to know how a skill was
    // installed — and wrong here: folding a foreign `plugin:code-review` onto
    // this repository's own `code-review` would hide contamination rather than
    // report it.
    if (event.type === "system" && Array.isArray(event.skills)) {
      loaded ??= event.skills.filter((name) => typeof name === "string");
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

  return { skills, loaded, model, cost };
}

/**
 * A richer parse of the same JSONL stream `parseStream` reads, for a probe
 * that (unlike the discovery evaluation's) is not limited to the `Skill`
 * tool. ADDITIVE: a new export beside `parseStream`, which this function does
 * not call and does not change — `parseStream`'s return shape is asserted by
 * exact equality in tests/validators/discovery-eval.test.mjs, so nothing here
 * may alter what it returns. Used by scripts/value-eval/transcript.mjs.
 *
 * Reads every `tool_use` block, in stream order, regardless of tool name —
 * not only `Skill` — plus two fields from the `result` event that
 * `parseStream` does not read: `num_turns`, and `subtype`, whose
 * `"error_max_turns"` value is how run.mjs's header documents a turn-cap
 * truncation being detectable at all (never inferred from transcript length).
 * `loaded`, `model`, and `cost` are read exactly as `parseStream` reads them.
 *
 * @param {string} stdout raw JSONL from one probe
 * @returns {{
 *   toolCalls: Array<{ name: string, input: Record<string, unknown> }>,
 *   turns: number|null,
 *   truncated: boolean,
 *   cost: number,
 *   loaded: string[]|null,
 *   model: string|null,
 * }} `toolCalls` is every tool invocation in the order the stream reported it,
 *   including repeats; `turns` is `null` when no `result` event reported
 *   `num_turns` (an unparseable or absent final line — see this module's
 *   header on forgiving parse failure).
 */
export function parseTranscript(stdout) {
  const toolCalls = [];
  let turns = null;
  let truncated = false;
  let cost = 0;
  let loaded = null;
  let model = null;

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
    if (event.type === "system" && Array.isArray(event.skills)) {
      loaded ??= event.skills.filter((name) => typeof name === "string");
    }
    if (event.type === "result") {
      if (typeof event.total_cost_usd === "number") cost = event.total_cost_usd;
      if (typeof event.num_turns === "number") turns = event.num_turns;
      if (event.subtype === "error_max_turns") truncated = true;
    }

    const content = event?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block?.type !== "tool_use" || typeof block.name !== "string") continue;
      toolCalls.push({ name: block.name, input: block.input ?? {} });
    }
  }

  return { toolCalls, turns, truncated, cost, loaded, model };
}
