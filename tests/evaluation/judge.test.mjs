// bareModel / parseVerdict / callReasoningJudge: asking a reasoning judge
// through a fake `claude` CLI spawn throughout — this file never spawns a
// real process and never reaches the network.

import { tmpdir } from "node:os";

import { describe, expect, it, vi } from "vitest";

import {
  spawnFnEnvelope,
  spawnFnError,
  spawnFnExit,
  spawnFnHangs,
  spawnFnNullStdio,
  spawnFnStdinWriteError,
  spawnFnStdout,
  spawnFnThrowSync,
} from "./helpers/fake-judge-process.mjs";
import { plantCleanupFailure } from "./helpers/planted-cleanup-failure.mjs";
import { bareModel, buildJudgeArgv, callReasoningJudge, parseVerdict } from "../../tools/evaluation/src/judge.mjs";

// spy-mode (not a replacing factory): every node:fs/promises call keeps its
// real behavior unless a test explicitly overrides one — see
// helpers/planted-cleanup-failure.mjs.
vi.mock(import("node:fs/promises"), { spy: true });

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
  // the user prompt is not here — it travels over stdin instead, because a
  // transcript-sized argv element can exceed the OS's own per-argument
  // ceiling. --print itself takes no positional value any more.
  it("passes --print with no positional prompt argument", () => {
    const argv = buildJudgeArgv({ model: "m", systemPrompt: "s" });
    expect(argv[argv.indexOf("--print") + 1]).toBe("--output-format");
  });

  it("passes the bare model and the system prompt verbatim", () => {
    const argv = buildJudgeArgv({
      model: "anthropic/claude-haiku-4-5-20251001",
      systemPrompt: "you are a judge",
    });
    expect(argv).toEqual(
      expect.arrayContaining(["--model", "claude-haiku-4-5-20251001", "--system-prompt", "you are a judge"]),
    );
  });

  it("asks for a single JSON envelope on stdout", () => {
    const argv = buildJudgeArgv({ model: "m", systemPrompt: "s" });
    expect(argv).toEqual(expect.arrayContaining(["--output-format", "json"]));
  });

  it("loads no setting sources", () => {
    const argv = buildJudgeArgv({ model: "m", systemPrompt: "s" });
    expect(argv).toEqual(expect.arrayContaining(["--setting-sources", ""]));
  });

  // an empty --allowed-tools does not itself deny anything — --print with
  // no --permission-mode still auto-approves reads under its own baseline.
  // --tools "" is the CLI's own closed-form primitive for disabling every
  // tool outright ("Use \"\" to disable all tools", per --help).
  it('disables every tool with --tools "", not an allow/deny-list pair', () => {
    const argv = buildJudgeArgv({ model: "m", systemPrompt: "s" });
    expect(argv).toEqual(expect.arrayContaining(["--tools", ""]));
    expect(argv).not.toContain("--allowed-tools");
    expect(argv).not.toContain("--disallowed-tools");
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

  // spawn() itself can throw synchronously (a non-string cwd, for instance)
  // rather than only ever emitting an async "error" event. Asserted with
  // `resolves`, not `rejects`, since a rejection here is exactly the
  // defect this guards against.
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

  // the HTTP path this replaced bounded a non-200 response body to 500
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

  // JSON.parse succeeds for a JSON value that is not an object — `null` is
  // the plausible case for a misbehaving CLI. Reading `envelope.is_error`
  // off `null` would throw a TypeError inside the "close" listener, never
  // converted into a promise rejection, taking evaluate.mjs down with it.
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

  // the exit-code branch above bounds its own detail to 500 characters;
  // the non-object-envelope branch beside it must carry the same bound, or
  // a large non-object payload (a long JSON string primitive, say) lands
  // in a stored factors.json whole.
  it("bounds a non-object envelope's error message the same way a non-zero exit's is bounded", async () => {
    const runawayString = JSON.stringify("x".repeat(10_000));
    const spawnFn = spawnFnStdout(`${runawayString}\n`);
    const outcome = await callReasoningJudge({ ...base, env: { CLAUDE_CODE_OAUTH_TOKEN: "tok" }, spawnFn });
    expect(outcome.error).toContain("not an object");
    expect(outcome.error.length).toBeLessThan(600);
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

  // evaluateMeasurement judges every factor of every probe sequentially in
  // one process, so a judge that never exits would cost every remaining
  // factor and probe its judgment. A real short timeoutMs (not fake
  // timers) proves the wall clock actually elapses and the promise settles.
  it("kills the child and resolves { error } naming the timeout, when the judge never finishes", async () => {
    const child = spawnFnHangs()();
    const spawnFn = () => child;
    const outcome = await callReasoningJudge({
      ...base,
      env: { CLAUDE_CODE_OAUTH_TOKEN: "tok" },
      spawnFn,
      timeoutMs: 30,
    });
    expect(outcome).toEqual({ error: expect.stringContaining("30ms") });
    expect(child.killed).toBe(true);
    expect(child.killSignal).toBe("SIGTERM");
  });

  // a spawnFn that hands back a child with `stdout: null` (a `stdio`
  // override, a malformed test double) must not throw inside the executor
  // — the "never rejects" guarantee has to hold structurally, not only for
  // the paths this file happens to exercise.
  it("resolves { error } rather than rejecting, when the child's stdout is null", async () => {
    const spawnFn = spawnFnNullStdio();
    await expect(
      callReasoningJudge({ ...base, env: { CLAUDE_CODE_OAUTH_TOKEN: "tok" }, spawnFn }),
    ).resolves.toEqual({ error: expect.stringContaining("not a single JSON object") });
  });

  // a judge-cwd- removal failure must not cost the verdict already decided
  // — the same parity with runScriptJudgment's own scratch-directory
  // cleanup this module's own doc comment claims.
  it("returns the verdict, carrying a cleanup warning, when the judge's working directory cleanup fails", async () => {
    const spawnFn = spawnFnEnvelope({ result: '{"result": true, "evidence": "stated plainly"}' });
    const cleanup = await plantCleanupFailure({ pathIncludes: "judge-cwd-" });

    try {
      const outcome = await callReasoningJudge({ ...base, env: { CLAUDE_CODE_OAUTH_TOKEN: "tok" }, spawnFn });

      expect(cleanup.triggered).toBe(true);
      expect(outcome).toMatchObject({ result: true, evidence: "stated plainly" });
      expect(outcome.cleanupWarning).toMatch(/could not remove/);
      expect(outcome.cleanupWarning).toMatch(/planted cleanup failure/);
    } finally {
      cleanup.restore();
    }
  });

  // the user prompt travels over stdin now, so a broken pipe there is a
  // real failure mode — resolved as { error } like any other judge
  // failure, never a throw and never a rejection.
  it("resolves { error } rather than throwing or rejecting, when writing the prompt to stdin fails", async () => {
    const spawnFn = spawnFnStdinWriteError("EPIPE: broken pipe");
    await expect(
      callReasoningJudge({ ...base, env: { CLAUDE_CODE_OAUTH_TOKEN: "tok" }, spawnFn }),
    ).resolves.toEqual({ error: expect.stringContaining("EPIPE") });
  });
});
