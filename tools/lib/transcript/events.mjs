// events.mjs — turning the CLI's `--output-format stream-json` stdout into
// events, and nothing beyond that.
//
// THE SHAPE HERE IS THE CLI'S, WHICH IS WHY IT IS SHARED. tools/lib holds only
// what is decided outside either evaluator's question, and the framing of this
// stream is decided by the tool that emits it. What a caller then READS out of
// these events is its own business and lives with it.
//
// PARSING IS DELIBERATELY FORGIVING. A truncated final line is ordinary rather
// than corrupt: the CLI can be terminated by its own turn cap mid-write.
// Discarding one unreadable line is better than discarding the paid run that
// produced it — the same rule scripts/discovery-eval/stream.mjs states for the
// same stream, and for the same reason.

/**
 * Every event the stream carried, in order, skipping any line that will not
 * parse.
 *
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
 * Every `tool_use` block across the stream's assistant messages, in the order
 * the stream reported them.
 *
 * Repeats are kept. Order and multiplicity are signal for a probe that reads
 * what the model DID, so collapsing them here would discard data a caller
 * cannot get back.
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
