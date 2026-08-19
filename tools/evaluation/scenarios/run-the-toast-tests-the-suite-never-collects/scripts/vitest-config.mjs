// the one read of vitest.config.ts both of this scenario's outcome factors
// need, kept in one place because they need the same one.
//
// this is shared inside a single scenario's own scripts/ directory, which is
// a different thing from the check-discovery.mjs copy that appears in several
// scenario directories: that duplication is deliberate, so each scenario
// directory stays independently portable. Here both callers are siblings in
// one directory, so a shared module crosses no such boundary — and two hand-
// maintained copies of the same regex would drift the first time one of them
// is touched and the other is not.

/**
 * the string literals inside the first `include: [...]` array appearing after
 * `name: "<projectName>"` in `content` — a textual read, not a real
 * TypeScript parser. That is deliberate: this scenario has no
 * glob-or-TypeScript parsing dependency to reach for, and each caller states
 * the limit this imprecision leaves it with.
 *
 * @param {string} content the text of vitest.config.ts
 * @param {string} projectName the `name` a Vitest project declares
 * @returns {string[] | null} null when the project, or its include array,
 *   cannot be located at all — which each caller turns into a judgment it
 *   cannot make rather than into a `false` result
 */
export function projectInclude(content, projectName) {
  const nameIndex = content.indexOf(`name: "${projectName}"`);
  if (nameIndex === -1) return null;
  const includeMatch = content.slice(nameIndex).match(/include:\s*\[([^\]]*)\]/);
  if (!includeMatch) return null;
  return [...includeMatch[1].matchAll(/["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
}
