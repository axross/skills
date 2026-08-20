// comparing the tool surface this instrument declared against the one the
// CLI reported for a probe.
//
// the two used to be assumed to agree, and nothing checked. they did not:
// `ALLOWED_TOOLS` named `TodoWrite`, a tool the CLI has not had for some
// time, while thirty-three tools it does expose were named by neither list.
// that was found by reading a stored artifact by hand, days before the
// artifact expired. this module is what reads it instead, on every probe.
//
// it decides nothing. `--allowed-tools` is additive and `--disallowed-tools`
// subtractive (see probe-process.mjs), so a disagreement here is a fact
// about the CLI a probe ran under, recorded with that probe — never a reason
// to fail one.

/**
 * @typedef {object} ToolSurfaceDisagreements
 * @property {string[]} allowedNotSurfaced declared allowances the CLI did not
 *   report — a name that allows nothing, as `TodoWrite` did
 * @property {string[]} deniedButSurfaced denials the CLI reported anyway — a
 *   bound that did not take, which is the one shape that makes every other
 *   denial here unreliable
 * @property {string[]} undeclared tools the CLI reported that neither list
 *   names — reachable by a probe, and nothing said so
 */

/** @param {string[]} of @param {Set<string>} without */
function excluding(of, without) {
  return of.filter((name) => !without.has(name));
}

/**
 * how the declared lists differ from what the CLI reported.
 *
 * `null` when the transcript carried no reported surface at all, matching
 * transcript/parse.mjs's own rule that `null` means the stream said nothing:
 * an older CLI that never emitted a `tools` array must not read as one that
 * surfaced every declared tool as missing.
 *
 * every returned list is sorted, so two probes of the same run produce
 * byte-identical records rather than records that differ by the CLI's own
 * ordering.
 *
 * @param {{ reported: string[]|null, allowed: string[], disallowed: string[] }} input
 * @returns {ToolSurfaceDisagreements|null}
 */
export function compareToolSurface({ reported, allowed, disallowed }) {
  if (reported === null || reported === undefined) return null;

  const surfaced = new Set(reported);
  const declared = new Set([...allowed, ...disallowed]);

  return {
    allowedNotSurfaced: excluding(allowed, surfaced).sort(),
    deniedButSurfaced: disallowed.filter((name) => surfaced.has(name)).sort(),
    undeclared: excluding([...surfaced], declared).sort(),
  };
}

/**
 * one line per non-empty disagreement, for a caller that writes them
 * somewhere a person reads. empty when the surface agreed with the
 * declarations, and empty when there was nothing to compare — a caller can
 * write every line it gets back without testing for either case.
 *
 * @param {ToolSurfaceDisagreements|null} disagreements
 * @returns {string[]}
 */
export function describeToolSurface(disagreements) {
  if (disagreements === null) return [];

  const lines = [];
  const say = (names, what) => {
    if (names.length > 0) lines.push(`${what}: ${names.join(", ")}`);
  };

  say(disagreements.deniedButSurfaced, "denied but reported available");
  say(disagreements.allowedNotSurfaced, "allowed but not reported available");
  say(disagreements.undeclared, "reported available but declared by neither list");
  return lines;
}
