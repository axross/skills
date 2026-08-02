// Recovering what a probe FOUND out of the CLI's JSONL stream.
//
// Split from run.mjs so it can be imported by a test: run.mjs is a CLI whose
// module body calls `main()` and then `process.exit`, so nothing importable may
// live there. This mirrors scripts/discovery-eval/stream.mjs deliberately.
//
// The stream is `claude -p --output-format stream-json --verbose`. Four event
// shapes matter:
//   * `{"type":"system", ..., "model":"…"}`   the model actually used, read
//     rather than assumed from whatever `--model` was requested.
//   * assistant `tool_use` blocks whose name ends in `create_inline_comment` —
//     the ANCHORS, which are the measurement. See anchor-server.mjs for why an
//     anchor rather than a prose mention is the unit.
//   * the last assistant text block, which carries the review summary and is
//     where lens enumeration is looked for.
//   * `{"type":"result", "total_cost_usd": n}` for the run's cost.
//
// Parsing is deliberately forgiving of a line it cannot read. A truncated final
// line is normal when the CLI is terminated by its turn cap, and discarding one
// unreadable line is better than discarding the run that produced it.

/** Matches the stub and the real tool alike; the MCP prefix varies by server name. */
const ANCHOR_TOOL = /create_inline_comment$/;

/**
 * The five subtractive lenses REVIEW.md requires a content-adding review to walk.
 * One canonical keyword each — a lens is looked for by its distinctive word, not
 * by matching a sentence, so a reviewer's own phrasing is not being graded.
 */
export const LENS_KEYWORDS = [
  "duplicated judgment",
  "reproduced upstream",
  "general knowledge",
  "routing concreteness",
  "obligation load",
];

/**
 * @param {string} stdout raw JSONL from one probe
 * @returns {{
 *   anchors: {path: string, line: number|null}[],
 *   summary: string,
 *   model: string|null,
 *   cost: number,
 * }}
 *   `anchors` may repeat a path when a probe filed several findings against one
 *   file; callers that ask "was this path anchored at all" de-duplicate.
 */
export function parseStream(stdout) {
  const anchors = [];
  const texts = [];
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
      if (block?.type === "text" && typeof block.text === "string") {
        texts.push(block.text);
        continue;
      }
      if (block?.type !== "tool_use" || !ANCHOR_TOOL.test(block.name ?? "")) continue;
      const path = block.input?.path;
      if (typeof path !== "string" || path === "") continue;
      const line = block.input?.line;
      anchors.push({ path, line: typeof line === "number" ? line : null });
    }
  }

  // The summary is the review's closing statement, so the last text block is the
  // one that carries it. Joining every block instead would let a lens named in
  // passing mid-review count as an enumeration.
  return { anchors, summary: texts.at(-1) ?? "", model, cost };
}

/**
 * Whether a summary walks all five subtractive lenses.
 *
 * Presence of the lens name, not the quality of what is said about it. This is
 * the weakest assertion in the harness and is reported as such: a review can
 * name a lens and say nothing useful under it. It still separates a review that
 * enumerated from one that did not, which is what REVIEW.md made mandatory.
 *
 * @param {string} summary
 * @returns {{ enumerated: boolean, found: string[], missing: string[] }}
 */
export function lensEnumeration(summary) {
  const haystack = summary.toLowerCase();
  const found = LENS_KEYWORDS.filter((lens) => haystack.includes(lens));
  return {
    enumerated: found.length === LENS_KEYWORDS.length,
    found,
    missing: LENS_KEYWORDS.filter((lens) => !found.includes(lens)),
  };
}
