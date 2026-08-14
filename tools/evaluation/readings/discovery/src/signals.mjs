// the per-probe signal extractor: what a transcript says a probe did, read
// deterministically and with no model judging anything.
//
// this is what lets a reader tell a finding from a failed exploration. a
// situated probe that never found the subject and a situated probe that read
// straight to it and still missed both end a run without a hit — nothing in
// `selectedSkills` alone tells them apart. reading the paths a probe touched
// BEFORE it made its first Skill selection is what does — a situated probe
// that stopped reading has read fewer files by construction, and that is
// visible where the outcome alone is not.
//
// built on tools/evaluation/lib/transcript's shared stream reading rather than
// reimplementing it — `readEvents`/`toolUseBlocks` frame the CLI's
// `stream-json` output, which is the CLI's decision and not this
// evaluation's. what this module adds is its own: `readBehaviour` in that
// module only understands Read, Skill and Bash, because that is what the
// effect side's task needs. discovery also needs Glob and Grep, which never
// appear in an effect-eval workspace's tool posture at all, so that reading
// lives here rather than widening a module the other evaluation depends on.
//
// A PROBE THAT TERMINATES ON `error_max_turns` HAVING SELECTED NOTHING IS
// MARKED UNREADABLE, NOT COUNTED AS SELECTING NOTHING. the runaway guard
// binding means the model was still working when the CLI cut it off — a
// zero-hit reading of that probe would misreport "found nothing" as an outcome
// the probe never reached. `selectedSkills` is `null` in that case, matching
// this codebase's existing idiom for "the stream did not say"
// (tools/evaluation/lib/transcript/parse.mjs's `loadedSkills`): a caller that
// tallies hits must never fold `null` into a count of zero.
//
// A PROBE THAT TERMINATES ON `error_max_turns` HAVING ALREADY SELECTED A
// SKILL IS READABLE, carrying the selection(s) it made. The reasoning above
// holds for a guard that fires while the model is still exploring — a
// situated probe cut off mid-search has not yet answered, so a zero-hit
// reading would misreport work in progress as a conclusion. It stops holding
// once a `Skill` call is already on the tape: the selection happened, and the
// cap firing on a later turn does not undo it. Discarding a decision the
// transcript plainly recorded would not be caution, it would be data loss —
// and it is exactly what plan.mjs's `BARE_TURN_CAP` raise from 1 to 2 exists
// to stop being structural: a bare probe that calls `Skill` spends its first
// turn doing so and is cut off on the very next one regardless, so under the
// old 1-turn cap every bare selection was unreadable not because the model
// failed to decide, but because the instrument never gave a completed
// decision anywhere to land.

import { readEvents, toolUseBlocks } from "../../lib/transcript/index.mjs";

/**
 * the path or pattern one tool call names, or `null` when the call reads
 * nothing filesystem-shaped.
 *
 * Glob and Grep both take an optional `path` alongside `pattern` — when given,
 * it is prefixed so two calls with the same pattern against different
 * directories are not collapsed into one entry.
 *
 * @param {{ name: string, input: Record<string, unknown> }} call
 * @returns {string|null}
 */
function targetOf(call) {
  if (call.name === "Read" && typeof call.input?.file_path === "string") {
    return call.input.file_path;
  }
  if (call.name === "Glob" && typeof call.input?.pattern === "string") {
    const path = typeof call.input?.path === "string" ? call.input.path : null;
    return path ? `${path}/${call.input.pattern}` : call.input.pattern;
  }
  if (call.name === "Grep" && typeof call.input?.pattern === "string") {
    const path = typeof call.input?.path === "string" ? call.input.path : null;
    return path ? `${path}: ${call.input.pattern}` : call.input.pattern;
  }
  return null;
}

/**
 * every Read/Glob/Grep target before a transcript's first Skill invocation,
 * each tagged with the tool that named it.
 *
 * @param {Array<{ name: string, input: Record<string, unknown> }>} toolCalls
 *   in stream order
 * @returns {Array<{ tool: string, target: string }>} deduplicated by
 *   (tool, target) in first-appearance order, matching this repository's
 *   existing `filesRead` convention
 */
export function pathsBeforeFirstSelection(toolCalls) {
  const seen = new Set();
  const paths = [];
  for (const call of toolCalls) {
    if (call.name === "Skill") break;
    const target = targetOf(call);
    if (target === null) continue;
    const key = `${call.name}\0${target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    paths.push({ tool: call.name, target });
  }
  return paths;
}

/**
 * every skill this transcript's `Skill` tool selected, in call order,
 * deduplicated.
 *
 * @param {Array<{ name: string, input: Record<string, unknown> }>} toolCalls
 * @returns {string[]}
 */
export function skillsSelected(toolCalls) {
  const seen = new Set();
  const skills = [];
  for (const call of toolCalls) {
    if (call.name !== "Skill" || typeof call.input?.skill !== "string") continue;
    // a plugin-qualified name reduces to the skill itself, matching
    // tools/evaluation/lib/transcript/parse.mjs's readBehaviour — a fixture
    // label never has to know how a skill was installed.
    const selected = call.input.skill;
    const name = selected.includes(":") ? selected.split(":").pop() : selected;
    if (name === "" || seen.has(name)) continue;
    seen.add(name);
    skills.push(name);
  }
  return skills;
}

/**
 * the whole per-probe signal set, from one probe's raw transcript text.
 *
 * @param {string} transcriptText raw JSONL, exactly what evaluate.mjs wrote
 * @returns {{
 *   turns: number|null,
 *   terminalReason: "success"|"error_max_turns"|"unknown",
 *   readable: boolean,
 *   pathsBeforeSelection: Array<{ tool: string, target: string }>,
 *   selectedSkills: string[]|null,
 *   loadedSkills: string[]|null,
 *   model: string|null,
 *   runtimeVersion: string|null,
 *   costUsd: number|null,
 * }}
 */
export function extractSignals(transcriptText) {
  const events = readEvents(transcriptText);
  const toolCalls = toolUseBlocks(events);

  let turns = null;
  let truncated = false;
  let sawResult = false;
  let loadedSkills = null;
  let model = null;
  let runtimeVersion = null;
  let costUsd = null;

  for (const event of events) {
    if (event.type === "system") {
      if (typeof event.model === "string") model ??= event.model;
      if (Array.isArray(event.skills)) {
        loadedSkills ??= event.skills.filter((name) => typeof name === "string");
      }
      if (typeof event.version === "string") runtimeVersion ??= event.version;
    }
    if (event.type === "result") {
      sawResult = true;
      if (typeof event.num_turns === "number") turns = event.num_turns;
      if (typeof event.total_cost_usd === "number") costUsd = event.total_cost_usd;
      if (event.subtype === "error_max_turns") truncated = true;
    }
  }

  const terminalReason = !sawResult ? "unknown" : truncated ? "error_max_turns" : "success";
  const selections = skillsSelected(toolCalls);
  // a clean "success" is always readable. "error_max_turns" is readable too,
  // but only when a `Skill` call already appears in the transcript — see this
  // module's header for why that is not the same guard the situated runaway
  // cap protects. "unknown" means the stream carried no result event at all
  // (a crashed or truncated spawn): with no confirmed terminal state, even a
  // recorded `Skill` call cannot be trusted as the probe's finished answer,
  // so it stays unreadable regardless of what tool calls appear in it.
  const readable = terminalReason === "success" || (terminalReason === "error_max_turns" && selections.length > 0);

  return {
    turns,
    terminalReason,
    readable,
    pathsBeforeSelection: pathsBeforeFirstSelection(toolCalls),
    // null rather than [] when unreadable: a run with no confirmed selection
    // and no confirmed terminal state is not evidence the model concluded
    // nothing, only that it had not finished — see this module's header. A
    // readable error_max_turns probe carries the selection it actually made,
    // the same as a readable success does.
    selectedSkills: readable ? selections : null,
    loadedSkills,
    model,
    runtimeVersion,
    costUsd,
  };
}
