// case -> probe plan: which mode a case runs under, which tools that mode
// permits, how many turns it is capped at, and what kind of workspace it
// needs — before anything is materialized or spawned.
//
// two modes, and a single dispatch may not mix them:
//
//   situated   a materialized mock, the whole corpus installed, a runaway
//              turn guard, Read/Glob/Grep/Skill permitted. never runs `npm
//              ci` — the editing and shell tools are denied, so nothing a
//              probe does can depend on a dependency being installed.
//   bare       a scratch workspace holding `.claude/skills` and nothing
//              else — no project, no AGENTS.md — Skill only, capped at
//              BARE_TURN_CAP turns (2: one to select, one the cap absorbs).
//
// a case declaring no `mock` is bare by construction: situating removes the
// very thing its prompt is about (see data/discovery-eval/fixture.json's
// asa-tighten-description-shaped cases). `--head-skills` forces bare
// regardless of what the case declares, because a situated workspace's
// Read/Glob/Grep is exactly the capability that must never reach
// attacker-authored prompt content — see head-overlay.mjs's header.

/** the two probe modes, and the only two a case may resolve to. */
export const MODES = ["situated", "bare"];

/** situated tools: the model has to read the project to decide. */
export const SITUATED_ALLOWED_TOOLS = ["Read", "Glob", "Grep", "Skill"];

/** bare tools: the prompt is all the information there is. */
export const BARE_ALLOWED_TOOLS = ["Skill"];

/**
 * bare mode's turn cap. 2, not 1: measured turn accounting shows a probe that
 * calls any tool reports `num_turns: 2` (the call itself is one turn, the
 * model's follow-up is the next), so a 1-turn cap could only ever end a
 * transcript that called nothing — a bare probe that selected a skill was
 * cut off by construction before it could report success. Raising the cap to
 * 2 lets a bare probe that calls `Skill` once terminate `success` instead of
 * `error_max_turns`, without opening room for a second, unrelated tool call —
 * see signals.mjs's header for how a probe that still lands on
 * `error_max_turns` (say, from a tool call the cap does not expect) is read
 * once it has already selected something.
 */
export const BARE_TURN_CAP = 2;

/**
 * PROVISIONAL. the plan this instrument was built from says so explicitly:
 * "the value comes from the single-case pilot's observed turn distribution
 * rather than from a guess here; until then the plan carries a deliberately
 * loose guard." this is that guess — deliberately loose, so it is a guard
 * that must not bind rather than a budget that truncates a legitimately
 * longer situated exploration. it is not a tuning knob: do not lower it to
 * save money, for the same reason tools/effect-eval/src/spawn.mjs's TURN_CAP
 * must not be lowered. `--turn-cap` on evaluate.mjs overrides it per
 * invocation, and the pilot's own measurement is what should replace this
 * constant, not a second guess made here.
 */
export const PROVISIONAL_SITUATED_TURN_CAP = 40;

/**
 * @param {{ id: string, mock?: string|null }} testCase a resolved fixture case
 * @param {{ headSkills?: boolean, turnCap?: number }} [options]
 * @returns {{
 *   mode: "situated"|"bare",
 *   tools: string[],
 *   turns: number,
 *   workspace: { kind: "mock", mock: string } | { kind: "scratch" },
 *   forcedBare: boolean,
 * }}
 * @throws {Error} when `testCase` carries no `id`
 */
export function planFor(testCase, { headSkills = false, turnCap = PROVISIONAL_SITUATED_TURN_CAP } = {}) {
  if (!testCase || typeof testCase.id !== "string" || testCase.id === "") {
    throw new Error('planFor needs a case object carrying a non-empty "id".');
  }
  if (!Number.isInteger(turnCap) || turnCap < 1) {
    throw new Error(`planFor's turnCap must be a positive integer, got ${JSON.stringify(turnCap)}.`);
  }

  const declaresMock = typeof testCase.mock === "string" && testCase.mock !== "";
  const forcedBare = Boolean(headSkills) && declaresMock;
  const mode = headSkills || !declaresMock ? "bare" : "situated";

  if (mode === "bare") {
    return {
      mode,
      tools: [...BARE_ALLOWED_TOOLS],
      turns: BARE_TURN_CAP,
      workspace: { kind: "scratch" },
      forcedBare,
    };
  }

  return {
    mode,
    tools: [...SITUATED_ALLOWED_TOOLS],
    turns: turnCap,
    workspace: { kind: "mock", mock: testCase.mock },
    forcedBare: false,
  };
}
