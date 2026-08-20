// the four script judgments that read the probe's transcript, held to the
// line docs/specs/skill-evaluation.md draws between a `false` and an error.
//
// each of them splits the stored stream-json stdout into lines and skips a
// line that does not parse as JSON, because a truncated final line is
// ordinary rather than corrupt (tools/evaluation/src/transcript/events.mjs's
// own header). What that tolerance costs, unguarded, is the ability to tell
// "the agent produced none of what was expected" — a real `false` — from
// "the stream I was handed is not one I can read" — a judgment that could
// not be made at all. Three of the four used to report the second as the
// first, with exit 0, which folded a failed measurement into the
// differential as a skill failure.
//
// so each script now makes two observations over the loop it already ran:
// whether any non-empty line was there at all, and whether any of them
// parsed. This file pins all three outcomes for all four scripts —
// the empty-transcript error, the unreadable-shape error, and the `false`
// that must survive beside them — and pins the two error reasons as
// textually distinct, since both leave the factor without a differential
// and the evidence string is the only place the cause can show.
//
// every script under test is invoked the way a real judgment run invokes
// it: as a child process, with a workspace directory as its cwd and a
// context.json as its one argument — the same process boundary
// tools/evaluation/src/factor-judgment.mjs's runScriptJudgment crosses.
// Nothing here imports the scripts.
//
// this sits beside tests/repository/scenario-script-false-versus-error.test.mjs,
// which holds the same line from the other direction, rather than inside it:
// that file's helper resolves a script path under
// tools/evaluation/scenarios/<scenario>/scripts/, and three of the four
// scripts here live under tools/evaluation/judgments/.

import { describe, expect, it } from "vitest";

import { tempDir, writeFileIn } from "../helpers/fixtures.mjs";
import { runScript } from "../helpers/run.mjs";

/** one `system` init event, the shape probe-runner.mjs stores first. */
const SYSTEM_LINE = JSON.stringify({ type: "system", subtype: "init", model: "claude-test", skills: [] });

/** one `result` event, the shape probe-runner.mjs stores last. */
const RESULT_LINE = JSON.stringify({ type: "result", subtype: "success", num_turns: 2 });

/** an `assistant` event carrying one text block — the agent's own words. */
function assistantSaid(text) {
  return JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text }] } });
}

/** an `assistant` event carrying one tool call — what the agent told a tool to do. */
function assistantCalled(name, input) {
  return JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name, input }] } });
}

/** a well-formed stream around one assistant event. */
function stream(assistantEvent) {
  return `${SYSTEM_LINE}\n${assistantEvent}\n${RESULT_LINE}\n`;
}

/** a final line cut off mid-write, exactly as a turn cap can leave one. */
const TRUNCATED_TAIL = '{"type":"assistant","message":{"content":[{"type":"text","tex';

/** a stream whose every line is content, and none of it JSON. */
const UNREADABLE_STREAM = "<!doctype html>\n<title>not a transcript</title>\nnot json{{{\n";

const NO_CONTENT_REASON = /carries no content/;
const UNREADABLE_SHAPE_REASON = /no line of context\.material\.transcript parsed as JSON/;

/** the five-line file the citation script resolves a `path:line` against. */
const APP_TSX = "import { Routes } from './routes';\n\nexport function App() {\n  return <Routes />;\n}\n";

/**
 * @typedef {object} TranscriptScript
 * @property {string} name
 * @property {string} path repository-relative path to the script
 * @property {unknown} input the `context.input` this script requires
 * @property {Record<string, string>} [workspace] files its cwd must hold
 * @property {string} passingTranscript a readable stream this script judges `true`
 * @property {string} failingTranscript a readable stream this script judges `false`
 */

/** @type {TranscriptScript[]} */
const TRANSCRIPT_SCRIPTS = [
  {
    name: "judgments/check-transcript-mentions.mjs",
    path: "tools/evaluation/judgments/check-transcript-mentions.mjs",
    input: { anyOf: ["npm test"] },
    passingTranscript: stream(assistantSaid("I ran npm test and the suite was green.")),
    failingTranscript: stream(assistantSaid("I read the config and stopped there.")),
  },
  {
    name: "judgments/check-transcript-mentions-all.mjs",
    path: "tools/evaluation/judgments/check-transcript-mentions-all.mjs",
    input: { mustMentionEachOf: [["npm test", "npm run test"], ["npm run lint"]] },
    passingTranscript: stream(assistantSaid("I ran npm test, then npm run lint.")),
    failingTranscript: stream(assistantSaid("I read the config and stopped there.")),
  },
  {
    name: "judgments/check-transcript-tool-input-mentions.mjs",
    path: "tools/evaluation/judgments/check-transcript-tool-input-mentions.mjs",
    input: { anyOf: ["src/App.tsx"] },
    passingTranscript: stream(assistantCalled("Read", { file_path: "src/App.tsx" })),
    failingTranscript: stream(assistantCalled("Read", { file_path: "README.md" })),
  },
  {
    name: "go-through-the-routes-commit-before-anyone-else-does/scripts/check-transcript-cites-changed-lines.mjs",
    path: "tools/evaluation/scenarios/go-through-the-routes-commit-before-anyone-else-does/scripts/check-transcript-cites-changed-lines.mjs",
    input: { files: ["src/App.tsx"], minimumDistinctCitations: 1 },
    workspace: { "src/App.tsx": APP_TSX },
    passingTranscript: stream(assistantSaid("The route table is rebuilt every render at src/App.tsx:4.")),
    failingTranscript: stream(assistantSaid("I looked over the routes and found nothing to flag.")),
  },
];

/**
 * run one script the way a real judgment run does: a fresh directory as its
 * cwd, holding whatever files it reads plus the context.json it is handed.
 *
 * @param {TranscriptScript} script
 * @param {unknown} material the `context.material` for this run
 */
async function judge(script, material) {
  const dir = await tempDir();
  for (const [relativePath, content] of Object.entries(script.workspace ?? {})) {
    await writeFileIn(dir, relativePath, content);
  }
  const contextPath = await writeFileIn(dir, "context.json", JSON.stringify({ input: script.input, material }));
  return runScript(script.path, [contextPath], { cwd: dir });
}

const cases = TRANSCRIPT_SCRIPTS.map((script) => [script.name, script]);

describe("a transcript-phase script errors when the transcript never arrived in a shape it can read", () => {
  it.each(cases)("%s: a transcript no line of which parses is an error, not a false", async (_name, script) => {
    const result = await judge(script, { transcript: UNREADABLE_STREAM });

    expect(result.code, `expected a non-zero exit; the script's own output was:\n${result.output}`).not.toBe(0);
    expect(result.stderr).toMatch(UNREADABLE_SHAPE_REASON);
    expect(result.stdout).not.toMatch(/"result"/);
  });

  it.each(cases)("%s: an empty transcript is an error under its own reason", async (_name, script) => {
    const result = await judge(script, { transcript: "" });

    expect(result.code, `expected a non-zero exit; the script's own output was:\n${result.output}`).not.toBe(0);
    expect(result.stderr).toMatch(NO_CONTENT_REASON);
    expect(result.stderr).not.toMatch(UNREADABLE_SHAPE_REASON);
    expect(result.stdout).not.toMatch(/"result"/);
  });

  it.each(cases)("%s: a whitespace-only transcript reads as no content too", async (_name, script) => {
    const result = await judge(script, { transcript: "\n   \n\t\n" });

    expect(result.code, `expected a non-zero exit; the script's own output was:\n${result.output}`).not.toBe(0);
    expect(result.stderr).toMatch(NO_CONTENT_REASON);
  });

  it.each(cases)("%s: the unreadable-shape reason is not the no-content one", async (_name, script) => {
    const unreadable = await judge(script, { transcript: UNREADABLE_STREAM });

    expect(unreadable.stderr).not.toMatch(NO_CONTENT_REASON);
  });

  it.each(cases)("%s: a missing transcript stays an error", async (_name, script) => {
    const result = await judge(script, {});

    expect(result.code, `expected a non-zero exit; the script's own output was:\n${result.output}`).not.toBe(0);
  });

  it.each(cases)("%s: a transcript that is not a string stays an error", async (_name, script) => {
    const result = await judge(script, { transcript: 42 });

    expect(result.code, `expected a non-zero exit; the script's own output was:\n${result.output}`).not.toBe(0);
  });

  it.each(cases)("%s: a context file that will not parse stays an error", async (_name, script) => {
    const dir = await tempDir();
    const contextPath = await writeFileIn(dir, "context.json", "not json{{{");

    const result = runScript(script.path, [contextPath], { cwd: dir });

    expect(result.code, `expected a non-zero exit; the script's own output was:\n${result.output}`).not.toBe(0);
  });
});

describe("a transcript that did arrive is judged, not errored", () => {
  it.each(cases)("%s: a readable stream carrying nothing it looks for is a false", async (_name, script) => {
    const result = await judge(script, { transcript: script.failingTranscript });

    expect(result.code, `expected exit 0; the script's own output was:\n${result.output}`).toBe(0);

    let parsed;
    expect(() => {
      parsed = JSON.parse(result.stdout);
    }, `stdout did not parse as JSON:\n${result.output}`).not.toThrow();
    expect(parsed.result).toBe(false);
    expect(typeof parsed.evidence).toBe("string");
    expect(parsed.evidence.length).toBeGreaterThan(0);
  });

  it.each(cases)("%s: a readable stream carrying what it looks for is a true", async (_name, script) => {
    const result = await judge(script, { transcript: script.passingTranscript });

    expect(result.code, `expected exit 0; the script's own output was:\n${result.output}`).toBe(0);
    expect(JSON.parse(result.stdout).result).toBe(true);
  });

  it.each(cases)("%s: a truncated final line changes nothing about the verdict", async (_name, script) => {
    const whole = await judge(script, { transcript: script.passingTranscript });
    const truncated = await judge(script, { transcript: `${script.passingTranscript}${TRUNCATED_TAIL}` });

    expect(truncated.code, `expected exit 0; the script's own output was:\n${truncated.output}`).toBe(0);
    expect(JSON.parse(truncated.stdout)).toEqual(JSON.parse(whole.stdout));
  });
});
