// keeping a credential out of a spawned CLI's environment going in, and out of
// a stored transcript coming out.
//
// these are one requirement's two faces, which is why they are one module.
// before this there were two implementations of the first half alone and none
// of the second: two chances to get one security property wrong, and no
// implementation at all of the half that had not been thought of.
//
// it lives in tools/evaluation/lib because the requirement is the operating
// system's and the CLI's, not either evaluation's. a subprocess inherits its
// parent's environment unless something stops it, and a stored transcript is
// bytes someone will read later. neither fact changes when a second consumer
// arrives.

/**
 * a denylist by shape rather than an enumeration of known variables: a runner
 * adds secrets this repository has never heard of, and the safe default for an
 * unrecognised `*_TOKEN` is to drop it.
 */
const CREDENTIAL_NAME_RE = /(TOKEN|SECRET|PASSWORD|CREDENTIAL|KEY)/i;

/**
 * the two that survive that rule, because the subprocess IS the Claude CLI and
 * cannot authenticate without one of them — and therefore the two the redaction
 * below has to account for on the way out.
 */
export const CLI_AUTH_ENV_VARS = ["CLAUDE_CODE_OAUTH_TOKEN", "ANTHROPIC_API_KEY"];

const placeholderFor = (name) => `[redacted:${name}]`;

/**
 * a value shorter than this is never redacted by value.
 *
 * redacting a short one would be worse than not redacting it: `KEY=1` in the
 * environment would turn every `1` in the transcript into a placeholder,
 * destroying measured data to protect something that is not a secret. real
 * credentials are far longer, so the floor costs nothing.
 */
const MIN_REDACTABLE_LENGTH = 8;

/**
 * deliberately a small, high-confidence set. this is a backstop against a leak
 * the by-value pass could not have known about, not a general secret scanner,
 * and a false positive here costs a paid probe.
 */
const CREDENTIAL_SHAPES = [
  { name: "Anthropic API key", pattern: /sk-ant-[A-Za-z0-9_-]{16,}/ },
  { name: "GitHub token", pattern: /gh[pousr]_[A-Za-z0-9]{20,}/ },
  { name: "JSON Web Token", pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\./ },
];

/**
 * the environment a probe subprocess runs with.
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
 * every literal value that must not appear in a stored transcript.
 *
 * wider than what `stripCredentials` withholds, on purpose: it includes the CLI
 * auth variables, which are the ones actually handed to the subprocess and so
 * the ones that can plausibly come back out.
 *
 * @param {Record<string, string|undefined>} source usually `process.env`
 * @returns {Array<{ name: string, value: string }>} longest value first, so a
 *   credential containing another as a prefix is replaced whole rather than
 *   leaving its tail behind
 */
export function credentialValues(source) {
  const values = [];
  for (const [name, value] of Object.entries(source)) {
    if (typeof value !== "string" || value.length < MIN_REDACTABLE_LENGTH) continue;
    if (!CLI_AUTH_ENV_VARS.includes(name) && !CREDENTIAL_NAME_RE.test(name)) continue;
    values.push({ name, value });
  }
  return values.sort((a, b) => b.value.length - a.value.length);
}

/**
 * replaces each credential's literal bytes with a named placeholder.
 *
 * two forms per value, because a transcript is JSONL and a credential reaches
 * it through `JSON.stringify` — a no-op for the character set real tokens use,
 * but not for one holding a quote, a backslash, or a control character.
 * covering both removes the need to assume anything about a token's alphabet.
 *
 * @param {string} text
 * @param {Array<{ name: string, value: string }>} values from `credentialValues`
 * @returns {{ text: string, redacted: string[] }} `redacted` names each variable
 *   found, so a caller can report what happened without handling the bytes
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
 * the credential shapes still present after redaction.
 *
 * a non-empty result means the by-value pass missed something. the caller's job
 * is to refuse, not to redact the match: a shape this module guessed at is not
 * something it can claim to have removed completely.
 *
 * @param {string} text
 * @returns {string[]} names of the shapes that matched
 */
export function findCredentialShapes(text) {
  return CREDENTIAL_SHAPES.filter(({ pattern }) => pattern.test(text)).map(({ name }) => name);
}

/**
 * redacts by value, then refuses on any shape that survived.
 *
 * by value first because that is exact: it cannot miss a token whose format
 * this file has never heard of, and cannot corrupt an innocent string that
 * merely looks token-shaped. the shape scan then catches what this process
 * never held the bytes of — and losing a paid probe is the cheaper failure.
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
