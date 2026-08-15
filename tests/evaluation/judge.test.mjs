// callReasoningJudge / parseVerdict: asking a reasoning judge, with a stub
// `fetchImpl` throughout — this file never reaches the real network.

import { describe, expect, it } from "vitest";

import { bareModel, callReasoningJudge, parseVerdict } from "../../tools/evaluation/src/judge.mjs";

function textResponse(text) {
  return { ok: true, json: async () => ({ content: [{ type: "text", text }] }) };
}

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

describe("callReasoningJudge", () => {
  const base = { model: "anthropic/claude-haiku-4-5-20251001", systemPrompt: "sys", userPrompt: "user" };

  it("throws when called with no API key — this instrument's own misconfiguration", async () => {
    await expect(callReasoningJudge({ ...base, apiKey: "" })).rejects.toThrow(/needs an API key/);
  });

  it("returns a verdict from a well-formed response", async () => {
    const fetchImpl = async () => textResponse('{"result": true, "evidence": "quoted line"}');
    await expect(callReasoningJudge({ ...base, apiKey: "k", fetchImpl })).resolves.toEqual({
      result: true,
      evidence: "quoted line",
    });
  });

  it("sends the bare model name and the API key header, never the vendor prefix", async () => {
    let seenBody;
    let seenHeaders;
    const fetchImpl = async (url, init) => {
      seenBody = JSON.parse(init.body);
      seenHeaders = init.headers;
      return textResponse('{"result": true, "evidence": "x"}');
    };
    await callReasoningJudge({ ...base, apiKey: "sk-test", fetchImpl });
    expect(seenBody.model).toBe("claude-haiku-4-5-20251001");
    expect(seenHeaders["x-api-key"]).toBe("sk-test");
  });

  // negative control 5/5: a network failure is an error the caller can act
  // on, never a thrown exception and never a `false` verdict.
  it("returns an error, never throws, when the judge cannot be reached", async () => {
    const fetchImpl = async () => {
      throw new Error("ECONNREFUSED");
    };
    const outcome = await callReasoningJudge({ ...base, apiKey: "k", fetchImpl });
    expect(outcome).toEqual({ error: expect.stringContaining("ECONNREFUSED") });
  });

  it("returns an error on a non-200 response", async () => {
    const fetchImpl = async () => ({ ok: false, status: 529, statusText: "Overloaded", text: async () => "busy" });
    const outcome = await callReasoningJudge({ ...base, apiKey: "k", fetchImpl });
    expect(outcome).toEqual({ error: expect.stringContaining("529") });
  });

  // negative control 5/5: the judge answers, but not with a verdict this
  // instrument can read — an errored judgment carrying the reason, never a
  // `false` one.
  it("returns an error, never `false`, when the response cannot be read as a verdict", async () => {
    const fetchImpl = async () => textResponse("I looked at it and it seems fine to me.");
    const outcome = await callReasoningJudge({ ...base, apiKey: "k", fetchImpl });
    expect(outcome).toEqual({ error: expect.stringContaining("held no JSON object") });
    expect(outcome).not.toHaveProperty("result");
  });

  it("returns an error when the response body itself is not valid JSON", async () => {
    const fetchImpl = async () => ({
      ok: true,
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    });
    const outcome = await callReasoningJudge({ ...base, apiKey: "k", fetchImpl });
    expect(outcome).toEqual({ error: expect.stringContaining("not valid JSON") });
  });

  it("returns an error when the response carries no text content block", async () => {
    const fetchImpl = async () => ({ ok: true, json: async () => ({ content: [] }) });
    const outcome = await callReasoningJudge({ ...base, apiKey: "k", fetchImpl });
    expect(outcome).toEqual({ error: expect.stringContaining("no text content") });
  });
});
