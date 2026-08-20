// the pinned model, the setting-sources flag that strips the user-level
// skill tier, and the display-only argv quoter — the parts of one probe's
// invocation that never vary. probe-process.mjs builds the rest of the
// configuration/argv round trip around these: the turn cap, the tool lists,
// and the appended non-interactive brief.
//
// there is one instrument now, not two readings each building their own
// invocation around a shared core — see
// docs/decisions/2026-08-15-rebuild-skill-evaluation-around-scenarios-and-factors.md.
// this module is what survived that merge unchanged.

/**
 * pinned rather than left to the CLI's default: changing it invalidates
 * every measurement taken before the change, because either evaluation
 * attributes a difference to the skill only while everything else — the
 * model most of all — is held constant across the measurements being
 * compared. a change here supersedes existing measurements rather than
 * extending them.
 *
 * it is also constrained to a model whose stored transcript actually
 * carries reasoning content: the `transcript` evaluation phase reads that
 * transcript and asks whether the agent reasoned as expected, and a model
 * that returns a `thinking` block with a signature and no content leaves
 * that phase nothing to judge. whether it does is governed by the
 * request's `thinking.display` setting, which defaults to `omitted` from
 * Claude Opus 4.7 onward and to `summarized` on every model before it; the
 * CLI offers no flag to set that field, so the model pin is the only
 * lever this instrument has. see
 * docs/decisions/2026-08-20-pin-the-probe-model-to-one-that-emits-reasoning.md
 * for the measurement that located the boundary and the model it settled
 * on.
 */
export const MODEL = "claude-sonnet-4-6";

/**
 * on every invocation, no exceptions.
 *
 * it strips the user-level skill tier for free. the skills a managed
 * environment injects cannot be stripped without also stripping a
 * workspace's own — which are exactly what either evaluation is measuring —
 * so this is the one isolation lever available, and every probe of either
 * reading takes it alike.
 */
export const SETTING_SOURCES = ["project"];

/**
 * for display only — the real invocation passes an argv array with no shell.
 * the quoting exists so a reader who pastes a printed command gets the
 * command that was described rather than a prompt split across several
 * arguments.
 *
 * @param {string} argument
 * @returns {string}
 */
export function shellQuote(argument) {
  return /^[A-Za-z0-9_./:=-]+$/.test(argument) ? argument : `'${argument.replaceAll("'", `'\\''`)}'`;
}
