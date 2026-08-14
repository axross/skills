// the constants and the one helper that are the same regardless of which
// reading is building an invocation: the pinned model, the setting-sources
// flag that strips the user-level skill tier, and the display-only argv
// quoter. each reading's own spawn.mjs builds the rest of the
// configuration/argv round trip — its own turn cap, its own tool lists, and
// (on the effect side) the appended non-interactive brief — around these.

/**
 * pinned rather than left to the CLI's default: changing it invalidates
 * every measurement taken before the change, because either evaluation
 * attributes a difference to the skill only while everything else — the
 * model most of all — is held constant across the measurements being
 * compared. a change here supersedes existing measurements rather than
 * extending them.
 */
export const MODEL = "claude-sonnet-5";

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
