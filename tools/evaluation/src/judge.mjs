// asking a reasoning judge to render one factor's verdict.
//
// docs/specs/skill-evaluation.md, "The factor": "a reasoning judgment asks a
// reasoning judge — a model — to read the material its factor's phase
// permits and report a verdict." This module is the one place that ask
// happens: it posts to the Anthropic Messages API directly (this repository
// carries no SDK dependency, and adding one is outside this rework's scope),
// instructs the model to answer as one JSON object, and refuses to read
// anything else out of the response.
//
// `fetchImpl` is threaded through every exported function that reaches the
// network, so a test can hand this a stub that never does — see
// tests/evaluation/judge.test.mjs. Nothing in this repository's own test
// suite calls the real `fetch` here, and nothing here is called for real
// during this phase — see this repository's own task package for why.

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_RESPONSE_TOKENS = 1024;

/**
 * strips a model id's vendor prefix. the wire API takes the bare model name;
 * `anthropic/…` is this instrument's own recorded, comparable form (see
 * docs/specs/skill-evaluation.md's "What a measurement stores"), not the
 * API's.
 *
 * @param {string} model e.g. "anthropic/claude-haiku-4-5-20251001"
 * @returns {string} e.g. "claude-haiku-4-5-20251001"
 */
export function bareModel(model) {
  return model.includes("/") ? model.slice(model.indexOf("/") + 1) : model;
}

/**
 * reads a verdict out of a judge's raw text response. the model is
 * instructed to answer with exactly one JSON object; this is the one place
 * that instruction is both relied on and checked.
 *
 * deliberately strict: `result` must be a JSON boolean, never the string
 * `"true"` and never a differently-named field such as `"outcome"` — which
 * is exactly the shape a judge answering off-contract would produce, and
 * exactly what the reasoning-path negative control plants.
 *
 * @param {string} text
 * @returns {{ result: boolean, evidence: string }}
 * @throws {Error} when `text` holds no JSON object, the object's `result` is
 *   not a boolean, or its `evidence` is not a non-empty string
 */
export function parseVerdict(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("the judge's response held no JSON object to read a verdict from.");

  let parsed;
  try {
    parsed = JSON.parse(match[0]);
  } catch (error) {
    throw new Error(`the judge's response was not valid JSON: ${error.message}`);
  }
  if (typeof parsed.result !== "boolean") {
    throw new Error(`the judge's "result" must be a JSON boolean, got ${JSON.stringify(parsed.result)}.`);
  }
  if (typeof parsed.evidence !== "string" || parsed.evidence.length === 0) {
    throw new Error('the judge\'s "evidence" must be a non-empty, quotable string.');
  }
  return { result: parsed.result, evidence: parsed.evidence };
}

/**
 * asks a reasoning judge to render one factor's verdict.
 *
 * never throws for anything the judge itself did or failed to do — a
 * network error, a non-200 response, an unreadable verdict — because a
 * judgment that could not be made is not a judgment that came out `false`
 * (docs/specs/skill-evaluation.md, "The factor"). It throws only for this
 * instrument's own misconfiguration: calling it with no API key at all.
 *
 * @param {{
 *   model: string,
 *   systemPrompt: string,
 *   userPrompt: string,
 *   apiKey: string,
 *   fetchImpl?: typeof fetch,
 * }} options `model` is vendor-prefixed, e.g. "anthropic/claude-haiku-4-5-20251001"
 * @returns {Promise<{ result: boolean, evidence: string } | { error: string }>}
 * @throws {Error} when `apiKey` is falsy
 */
export async function callReasoningJudge({ model, systemPrompt, userPrompt, apiKey, fetchImpl = fetch }) {
  if (!apiKey) throw new Error("callReasoningJudge needs an API key; none was given.");

  let response;
  try {
    response = await fetchImpl(ANTHROPIC_MESSAGES_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: bareModel(model),
        max_tokens: MAX_RESPONSE_TOKENS,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
  } catch (error) {
    return { error: `the judge could not be reached: ${error.message}` };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return { error: `the judge responded ${response.status} ${response.statusText}: ${body.slice(0, 500)}` };
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    return { error: `the judge's response body was not valid JSON: ${error.message}` };
  }

  const text = (payload.content ?? [])
    .filter((block) => block?.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n");
  if (text.length === 0) {
    return { error: "the judge's response carried no text content to read a verdict from." };
  }

  try {
    return parseVerdict(text);
  } catch (error) {
    return { error: error.message };
  }
}
