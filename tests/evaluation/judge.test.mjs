// bareModel / parseVerdict / callReasoningJudge: asking a reasoning judge
// through a fake `claude` CLI spawn throughout — this file never spawns a
// real process and never reaches the network.

import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import {
  spawnFnEnvelope,
  spawnFnError,
  spawnFnExit,
  spawnFnStdout,
  spawnFnThrowSync,
} from "./helpers/fake-judge-process.mjs";
import { bareModel, buildJudgeArgv, callReasoningJudge, parseVerdict } from "../../tools/evaluation/src/judge.mjs";
import { ALLOWED_TOOLS, DISALLOWED_TOOLS } from "../../tools/evaluation/src/probe-process.mjs";

describe("bareModel", () => {
  it("strips a vendor prefix", () => {
    expect(bareModel("anthropic/claude-haiku-4-5-20251001")).toBe("claude-haiku-4-5-20251001");
  });

  it("passes a bare model through unchanged", () => {
    expect(bareModel("claude-haiku-4-5-20251001")).toBe("claude-haiku-4-5-20251001");
  });
});

describe("parseVerdict", () => {
  it("reads a well-formed verdict", () => {
    expect(parseVerdict('{"result": true, "evidence": "the transcript says so"}')).toEqual({
      result: true,
      evidence: "the transcript says so",
    });
  });

  it("finds the JSON object even with prose around it", () => {
    expect(
      parseVerdict('Sure, here you go: {"result": false, "evidence": "no such line"} — done.'),
    ).toEqual({ result: false, evidence: "no such line" });
  });

  // negative control 5/5 (the parsing half): a judge answering off-contract
  // — no JSON at all — is unreadable, never coerced to `false`.
  it("throws when the response holds no JSON object at all", () => {
    expect(() => parseVerdict("I think it looks fine, roughly.")).toThrow(/held no JSON object/);
  });

  it('throws when "result" is the string "true" rather than a boolean', () => {
    expect(() => parseVerdict('{"result": "true", "evidence": "x"}')).toThrow(/must be a JSON boolean/);
  });

  it('throws when the field is named "outcome" instead of "result"', () => {
    expect(() => parseVerdict('{"outcome": true, "evidence": "x"}')).toThrow(/must be a JSON boolean/);
  });

  it("throws when evidence is missing", () => {
    expect(() => parseVerdict('{"result": true}')).toThrow(/evidence/);
  });

  it("throws when evidence is an empty string", () => {
    expect(() => parseVerdict('{"result": true, "evidence": ""}')).toThrow(/evidence/);
  });
});

describe("buildJudgeArgv", () => {
  it("passes the prompt as --print, the bare model, and the system prompt verbatim", () => {
    const argv = buildJudgeArgv({
      userPrompt: "judge this",
      model: "anthropic/claude-haiku-4-5-20251001",
      systemPrompt: "you are a judge",
    });
    expect(argv).toEqual(
      expect.arrayContaining([
        "--print",
        "judge this",
        "--model",
        "claude-haiku-4-5-20251001",
        "--system-prompt",
        "you are a judge",
      ]),
    );
  });

  it("asks for a single JSON envelope on stdout", () => {
    const argv = buildJudgeArgv({ userPrompt: "x", model: "m", systemPrompt: "s" });
    expect(argv).toEqual(expect.arrayContaining(["--output-format", "json"]));
  });

  it("loads no setting sources", () => {
    const argv = buildJudgeArgv({ userPrompt: "x", model: "m", systemPrompt: "s" });
    expect(argv).toEqual(expect.arrayContaining(["--setting-sources", ""]));
  });

  it("denies every tool a probe's own module names — the union of ALLOWED_TOOLS and DISALLOWED_TOOLS — and nothing less", () => {
    const argv = buildJudgeArgv({ userPrompt: "x", model: "m", systemPrompt: "s" });
    const index = argv.indexOf("--disallowed-tools");
    expect(index).toBeGreaterThan(-1);
    const denied = argv[index + 1].split(",");
    expect(denied.sort()).toEqual([...ALLOWED_TOOLS, ...DISALLOWED_TOOLS].sort());
  });
});

describe("callReasoningJudge", () => {
  const base = { model: "anthropic/claude-haiku-4-5-20251001", systemPrompt: "sys", userPrompt: "user" };

  it("throws when called with no CLI credential in `env` — this instrument's own misconfiguration", async () => {
    await expect(callReasoningJudge({ ...base, env: {} })).rejects.toThrow(/needs one of/);
  });

  it("returns a verdict from a well-formed envelope", async () => {
    const spawnFn = spawnFnEnvelope({ result: '{"result": true, "evidence": "quoted line"}' });
    await expect(
      callReasoningJudge({ ...base, env: { CLAUDE_CODE_OAUTH_TOKEN: "tok" }, spawnFn }),
    ).resolves.toEqual({ result: true, evidence: "quoted line" });
  });

  it("spawns `claude` with the bare model name, never the vendor prefix", async () => {
    let seenCommand;
    let seenArgv;
    const spawnFn = (command, argv) => {
      seenCommand = command;
      seenArgv = argv;
      return spawnFnEnvelope({ result: '{"result": true, "evidence": "x"}' })();
    };
    await callReasoningJudge({ ...base, env: { ANTHROPIC_API_KEY: "sk-test" }, spawnFn });
    expect(seenCommand).toBe("claude");
    expect(seenArgv).toEqual(expect.arrayContaining(["--model", "claude-haiku-4-5-20251001"]));
  });

  it("runs with a working directory outside the repository, and an environment stripped of every credential but the CLI's own", async () => {
    let seenOptions;
    const spawnFn = (command, argv, options) => {
      seenOptions = options;
      return spawnFnEnvelope({ result: '{"result": true, "evidence": "x"}' })();
    };
    await callReasoningJudge({
      ...base,
      env: { CLAUDE_CODE_OAUTH_TOKEN: "tok", OTHER_SECRET_TOKEN: "should-not-survive" },
      spawnFn,
    });
    expect(seenOptions.cwd.startsWith(tmpdir())).toBe(true);
    expect(seenOptions.cwd).not.toBe(process.cwd());
    expect(seenOptions.env).toEqual({ CLAUDE_CODE_OAUTH_TOKEN: "tok" });
  });

  // negative control 5/5: a spawn failure is an error the caller can act
  // on, never a thrown exception and never a `false` verdict.
  it("returns an error, never throws, when the judge could not be spawned", async () => {
    const spawnFn = spawnFnError("ENOENT");
    const outcome = await callReasoningJudge({ ...base, env: { CLAUDE_CODE_OAUTH_TOKEN: "tok" }, spawnFn });
    expect(outcome).toEqual({ error: expect.stringContaining("ENOENT") });
  });

  // F1: spawn() itself can throw synchronously (a non-string cwd, for
  // instance) rather than only ever emitting an async "error" event. A
  // spawnFn that throws synchronously must resolve to `{ error }` — never
  // reject — on the same footing as the async path above. Asserted with
  // `resolves`, not `rejects`, since a rejection here is exactly the defect
  // this guards against.
  it("returns an error, never rejects, when spawnFn itself throws synchronously", async () => {
    const spawnFn = spawnFnThrowSync("EINVAL: spawn options were malformed");
    await expect(
      callReasoningJudge({ ...base, env: { CLAUDE_CODE_OAUTH_TOKEN: "tok" }, spawnFn }),
    ).resolves.toEqual({ error: expect.stringContaining("EINVAL") });
  });

  it("returns an error on a non-zero exit", async () => {
    const spawnFn = spawnFnExit(1, "could not authenticate");
    const outcome = await callReasoningJudge({ ...base, env: { CLAUDE_CODE_OAUTH_TOKEN: "tok" }, spawnFn });
    expect(outcome).toEqual({ error: expect.stringContaining("could not authenticate") });
  });

  // F3: the HTTP path this replaced bounded a non-200 response body to 500
  // characters (`body.slice(0, 500)`); a non-zero exit's stderr must carry
  // the same bound, or a runaway `claude` stderr bloats a stored
  // factors.json without limit.
  it("bounds a non-zero exit's stderr the same way the HTTP path bounded a non-200 body", async () => {
    const runawayStderr = "x".repeat(10_000);
    const spawnFn = spawnFnExit(1, runawayStderr);
    const outcome = await callReasoningJudge({ ...base, env: { CLAUDE_CODE_OAUTH_TOKEN: "tok" }, spawnFn });
    expect(outcome.error.length).toBeLessThan(600);
  });

  it("returns an error when the envelope's is_error is true", async () => {
    const spawnFn = spawnFnEnvelope({ result: "something went wrong", isError: true });
    const outcome = await callReasoningJudge({ ...base, env: { CLAUDE_CODE_OAUTH_TOKEN: "tok" }, spawnFn });
    expect(outcome).toEqual({ error: expect.stringContaining("is_error: true") });
  });

  it("returns an error when the envelope's subtype is not success", async () => {
    const spawnFn = spawnFnEnvelope({ result: "ran out of turns", subtype: "error_max_turns" });
    const outcome = await callReasoningJudge({ ...base, env: { CLAUDE_CODE_OAUTH_TOKEN: "tok" }, spawnFn });
    expect(outcome).toEqual({ error: expect.stringContaining("error_max_turns") });
  });

  // negative control 5/5: the judge answers, but not with a verdict this
  // instrument can read — an errored judgment carrying the reason, never a
  // `false` one.
  it("returns an error, never `false`, when stdout is not a single JSON object", async () => {
    const spawnFn = spawnFnStdout("not json at all\n");
    const outcome = await callReasoningJudge({ ...base, env: { CLAUDE_CODE_OAUTH_TOKEN: "tok" }, spawnFn });
    expect(outcome).toEqual({ error: expect.stringContaining("not a single JSON object") });
    expect(outcome).not.toHaveProperty("result");
  });

  it("returns an error when the envelope carries no readable result string", async () => {
    const spawnFn = spawnFnStdout(`${JSON.stringify({ type: "result", subtype: "success", is_error: false })}\n`);
    const outcome = await callReasoningJudge({ ...base, env: { CLAUDE_CODE_OAUTH_TOKEN: "tok" }, spawnFn });
    expect(outcome).toEqual({ error: expect.stringContaining('no readable "result" string') });
  });

  // F2: JSON.parse succeeds for a JSON value that is not an object — the
  // literal `null` being the plausible case for a misbehaving CLI. Reading
  // `envelope.is_error` off `null` would throw a TypeError inside the
  // "close" listener, which is NOT converted into a promise rejection and
  // would take the whole evaluate.mjs process down. Neither case may reject
  // or throw; both must resolve to `{ error }`.
  it("returns an error, never throws, when stdout parses as JSON null", async () => {
    const spawnFn = spawnFnStdout("null\n");
    await expect(
      callReasoningJudge({ ...base, env: { CLAUDE_CODE_OAUTH_TOKEN: "tok" }, spawnFn }),
    ).resolves.toEqual({ error: expect.stringContaining("not an object") });
  });

  it("returns an error, never throws, when stdout parses as a bare JSON primitive", async () => {
    const spawnFn = spawnFnStdout('"3"\n');
    await expect(
      callReasoningJudge({ ...base, env: { CLAUDE_CODE_OAUTH_TOKEN: "tok" }, spawnFn }),
    ).resolves.toEqual({ error: expect.stringContaining("not an object") });
  });

  // negative control 5/5: the envelope is well-formed, but its `result`
  // text holds no verdict — errored, never coerced to `false`.
  it("returns an error, never `false`, when the envelope's result text holds no verdict", async () => {
    const spawnFn = spawnFnEnvelope({ result: "I looked at it and it seems fine to me." });
    const outcome = await callReasoningJudge({ ...base, env: { CLAUDE_CODE_OAUTH_TOKEN: "tok" }, spawnFn });
    expect(outcome).toEqual({ error: expect.stringContaining("held no JSON object") });
    expect(outcome).not.toHaveProperty("result");
  });

  // this is the shape the plan's verification run actually observed: the
  // model's verdict fenced as a ```json code block inside `result`.
  it("reads a verdict fenced as a ```json code block inside the envelope's result", async () => {
    const spawnFn = spawnFnEnvelope({ result: '```json\n{"result": true, "evidence": "fenced"}\n```' });
    const outcome = await callReasoningJudge({ ...base, env: { CLAUDE_CODE_OAUTH_TOKEN: "tok" }, spawnFn });
    expect(outcome).toEqual({ result: true, evidence: "fenced" });
  });
});
