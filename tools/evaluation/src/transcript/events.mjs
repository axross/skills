// framing the CLI's `--output-format stream-json` stdout into events.
//
// shared because the framing is the CLI's decision, not either evaluation's.
// what a caller then reads out of these events is its own business.
//
// the parse is forgiving because a truncated final line is ordinary rather than
// corrupt: the CLI can be terminated by its own turn cap mid-write, and
// discarding one unreadable line beats discarding the paid run that produced it.

/**
 * @param {string} stdout raw JSONL from one probe
 * @returns {Record<string, unknown>[]}
 */
export function readEvents(stdout) {
  const events = [];
  for (const line of stdout.split("\n")) {
    const text = line.trim();
    if (text === "") continue;
    try {
      events.push(JSON.parse(text));
    } catch {
      continue;
    }
  }
  return events;
}

/**
 * every `tool_use` block across the stream's assistant messages.
 *
 * repeats and order are kept: both are signal for a probe that reads what the
 * model did, and a caller cannot recover either once they are collapsed.
 *
 * @param {Record<string, unknown>[]} events
 * @returns {Array<{ name: string, input: Record<string, unknown> }>}
 */
export function toolUseBlocks(events) {
  const calls = [];
  for (const event of events) {
    const content = event?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block?.type !== "tool_use" || typeof block.name !== "string") continue;
      calls.push({ name: block.name, input: block.input ?? {} });
    }
  }
  return calls;
}
