// credentials.mjs — keeping a credential out of a spawned CLI's environment
// going in, and out of a stored transcript coming out.
//
// WHY THESE TWO LIVE IN ONE MODULE, AND WHY THIS MODULE IS SHARED AT ALL.
// tools/lib holds only what is shaped OUTSIDE either evaluator's own question.
// The requirement here is the operating system's and the CLI's: a subprocess
// inherits its parent's environment unless something stops it, and a stored
// transcript is bytes on disk that someone will read later. Neither fact is
// answerable by reference to what an evaluation is measuring, so neither
// distorts when a second consumer arrives. Everything an evaluator DOES decide
// — its tool posture, its turn cap, what its fingerprint covers — stays with
// the evaluator.
//
// Stripping the environment going in and redacting the transcript coming out
// are one requirement's two faces, so they are one module. Before this there
// were two implementations of the first half alone —
// scripts/discovery-eval/overlay.mjs's `evalEnvironment` and
// scripts/value-eval/spawn.mjs's `buildProbeEnvironment` — which is two chances
// to get one security property wrong, and no chance at all for the second half,
// which did not exist.
//
// REDACTION IS BY VALUE, NOT BY SHAPE. The literal bytes of the credentials
// this process is holding are replaced before anything is written. That is
// exact: it cannot miss a token whose format this file has never heard of, and
// it cannot corrupt an innocent string that merely looks token-shaped. A
// shape-based scan runs afterwards as a BACKSTOP — it does not redact, it
// refuses, because a transcript matching a credential shape this module could
// not account for by value is a transcript it cannot vouch for, and writing it
// anyway would be the one outcome worse than losing the probe.

/**
 * Anything whose NAME looks like a credential is withheld from a spawned
 * subprocess. A denylist by shape rather than an enumeration of known
 * variables: a runner adds secrets this repository has never heard of, and the
 * safe default for an unrecognised `*_TOKEN` is to drop it.
 */
const CREDENTIAL_NAME_RE = /(TOKEN|SECRET|PASSWORD|CREDENTIAL|KEY)/i;

/**
 * The two variables that survive that rule, because the subprocess IS the
 * Claude CLI and cannot authenticate without one of them. They are exactly the
 * two the redaction below then has to account for on the way out.
 */
export const CLI_AUTH_ENV_VARS = ["CLAUDE_CODE_OAUTH_TOKEN", "ANTHROPIC_API_KEY"];

/** What a redacted value is replaced with. Names the variable, never the bytes. */
const placeholderFor = (name) => `[redacted:${name}]`;

/**
 * A value shorter than this is never redacted by value.
 *
 * Redacting a short value would be worse than not redacting it: `KEY=1` in the
 * environment would turn every `1` in the transcript into a placeholder,
 * destroying the measured data to protect something that is not a secret. Real
 * credentials are far longer than this floor, so it costs nothing.
 */
const MIN_REDACTABLE_LENGTH = 8;

/**
 * Credential shapes worth refusing on. Deliberately a small, high-confidence
 * set: this is a backstop against a leak the by-value pass could not have
 * known about, not a general secret scanner, and a false positive here costs a
 * paid probe.
 */
const CREDENTIAL_SHAPES = [
  { name: "Anthropic API key", pattern: /sk-ant-[A-Za-z0-9_-]{16,}/ },
  { name: "GitHub token", pattern: /gh[pousr]_[A-Za-z0-9]{20,}/ },
  { name: "JSON Web Token", pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\./ },
];

/**
 * The environment a probe subprocess runs with: the caller's, minus anything
 * whose name looks like a credential, plus the CLI's own authentication.
 *
 * Replaces `evalEnvironment` and `buildProbeEnvironment`, which agreed on the
 * rule and were nonetheless two copies of it.
 *
 * @param {Record<string, string|undefined>} source usually `process.env`
 * @returns {Record<string, string>}
 */
export function stripCredentials(source) {
  const env = {};
  for (const [name, value] of Object.entries(source)) {
    if (value === undefined) continue;
    if (CLI_AUTH_ENV_VARS.includes(name)) {
      env[name] = value;
      continue;
    }
    if (CREDENTIAL_NAME_RE.test(name)) continue;
    env[name] = value;
  }
  return env;
}

/**
 * Every `[name, value]` pair from `source` whose literal bytes must not appear
 * in a stored transcript.
 *
 * This is deliberately WIDER than what `stripCredentials` withholds: it
 * includes the CLI auth variables, which are the ones actually handed to the
 * subprocess and therefore the ones that can plausibly come back out. A
 * variable that was never passed in cannot appear in the transcript by way of
 * this process — but it can appear because the model read it from somewhere
 * else, and redacting it costs nothing.
 *
 * @param {Record<string, string|undefined>} source usually `process.env`
 * @returns {Array<{ name: string, value: string }>}
 */
export function credentialValues(source) {
  const values = [];
  for (const [name, value] of Object.entries(source)) {
    if (typeof value !== "string" || value.length < MIN_REDACTABLE_LENGTH) continue;
    if (!CLI_AUTH_ENV_VARS.includes(name) && !CREDENTIAL_NAME_RE.test(name)) continue;
    values.push({ name, value });
  }
  // Longest first, so a credential that contains another as a prefix is
  // replaced whole rather than leaving its tail behind as loose bytes.
  return values.sort((a, b) => b.value.length - a.value.length);
}

/**
 * Replaces every credential's literal bytes in `text` with a named placeholder.
 *
 * Each value is replaced in two forms: as-is, and as it would appear inside a
 * JSON string literal. A transcript is JSONL, so a credential reaches it
 * through `JSON.stringify` — which is a no-op for the character set real tokens
 * use, but not for one containing a quote, a backslash, or a control
 * character. Covering both costs one extra pass and removes the need to assume
 * anything about a token's alphabet.
 *
 * @param {string} text
 * @param {Array<{ name: string, value: string }>} values from `credentialValues`
 * @returns {{ text: string, redacted: string[] }} `redacted` names each variable
 *   whose value was actually found, so a caller can report what happened
 *   without ever handling the bytes.
 */
export function redactCredentials(text, values) {
  let output = text;
  const redacted = [];

  for (const { name, value } of values) {
    const placeholder = placeholderFor(name);
    const encoded = JSON.stringify(value).slice(1, -1);
    let hit = false;

    if (output.includes(value)) {
      output = output.replaceAll(value, placeholder);
      hit = true;
    }
    if (encoded !== value && output.includes(encoded)) {
      output = output.replaceAll(encoded, placeholder);
      hit = true;
    }
    if (hit) redacted.push(name);
  }

  return { text: output, redacted };
}

/**
 * The credential shapes still present in `text` after redaction.
 *
 * A non-empty result means the by-value pass missed something — a token this
 * process never held, or one that reached the transcript in a form its literal
 * bytes do not cover. The caller's job is to REFUSE, not to redact the match:
 * a shape this module guessed at is not something it can claim to have
 * removed completely.
 *
 * @param {string} text
 * @returns {string[]} the names of the shapes that matched, empty when clean
 */
export function findCredentialShapes(text) {
  return CREDENTIAL_SHAPES.filter(({ pattern }) => pattern.test(text)).map(({ name }) => name);
}

/**
 * Redacts by value, then refuses on any shape that survived.
 *
 * The one call site a transcript writer needs: it either returns bytes this
 * module vouches for, or it throws and nothing is written.
 *
 * @param {string} text the raw transcript
 * @param {Record<string, string|undefined>} [source] usually `process.env`
 * @returns {{ text: string, redacted: string[] }}
 * @throws {Error} when a credential shape survives redaction
 */
export function redactTranscript(text, source = process.env) {
  const { text: output, redacted } = redactCredentials(text, credentialValues(source));
  const surviving = findCredentialShapes(output);
  if (surviving.length > 0) {
    throw new Error(
      `Refusing to write this transcript: it still matches ${surviving.join(", ")} after ` +
        "redaction by value, so it holds a credential this process does not know the bytes " +
        "of. The probe is lost; a transcript that cannot be vouched for is not written.",
    );
  }
  return { text: output, redacted };
}
