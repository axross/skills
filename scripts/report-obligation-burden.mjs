#!/usr/bin/env node
// report-obligation-burden.mjs — concurrent obligation burden reporter for THIS
// repository.
//
// Answers a question no per-skill check can: "how many rules is an agent holding
// right now?" check-skill-body.mjs measures one skill at a time, and its advisory
// tier warns when a single SKILL.md crosses a byte budget. But the quantity that
// governs whether an agent actually follows a rule is the CONCURRENT obligation
// count across every skill a session has loaded — and that depends on which
// reference files get read, a decision made at runtime that no per-skill check
// can see.
//
// So this reports a RANGE, never a single number:
//   * the FLOOR   — the SKILL.md bodies alone, what loading those skills costs
//                   before any reference is opened
//   * the CEILING — the same skills with every references/*.md read too
// The spread between them is the finding. professional-behavior, for one,
// carries zero obligations in its SKILL.md and 110 across its references: a
// single number would misrepresent that skill entirely.
//
// THERE IS NO THRESHOLD, AND THIS NEVER FAILS. It exits 0 on every valid
// invocation no matter how large the numbers are, joins no npm script chain, no
// CI job, and no hook. That is deliberate rather than unfinished: there is no
// evidence for any particular limit in this corpus, and an indefensible
// threshold becomes either a rule people route around or a warning people stop
// reading. Ship the number first; a threshold, if ever, comes after there is
// something to calibrate it against.
//
// The obligation definition is NOT re-implemented here — it is imported from
// guidelines.mjs, the same module check-skill-body.mjs reads for its `guidelines:`
// failures and `placement:` advisories, so all three agree on what a rule is.
// The three views partition the same bullets:
//   obligations    in-block bullets WITH an RFC-2119 keyword  (counted here)
//   guidelines:    in-block bullets WITHOUT one               (a failure there)
//   placement:     out-of-block bullets WITH one              (an advisory there)
//
// Scanned per skill: SKILL.md and every references/*.md — the same file set
// check-skill-body.mjs scans, and for the same reason. scripts/ and assets/ carry
// payload rather than rule-bearing text.
//
// It lives at the repository root rather than inside a skill because it reports
// on a tree rather than validating one, and because every script bundled in a
// skill is named in that skill's prose; adding one there is an authoring change,
// which this is not.
//
// Usage:
//   node scripts/report-obligation-burden.mjs [--mandated] [<path | name> ...]
//
//     <path>  a skill directory (one holding SKILL.md), OR a directory whose
//             immediate subdirectories are skills (e.g. `skills`).
//     <name>  a skill name resolved against this repository's `skills` root,
//             then its `.claude/skills` root — so `code-review` works from
//             anywhere without typing a path.
//     --mandated
//             the set CLAUDE.md mandates, reported in the three tiers it is
//             actually scoped to — every session, tasks that touch the project,
//             and tasks that change something — cumulatively, so the first row
//             is what a question-answering session carries and the last is what
//             a change-delivering one does. Combines with further paths or
//             names, so `--mandated code-review` reports what a review round
//             actually carries; extra selectors land in the total, not in the
//             tiers, which describe the mandated set alone.
//
//   With no arguments it reports every skill in the repository.
//
// Exit codes:
//   0  a report was produced — ALWAYS, whatever the numbers are
//   2  bad invocation: an unknown flag, a name or path that resolves to no
//      skill, or a selection that ends up empty
//
// Token figures are a byte proxy, not a tokenizer count — the divisor and its
// uncertainty are imported from token-estimate.mjs, the same module
// check-skill-body.mjs's size advisory divides by, so the two can never report a
// different estimate for the same file. The obligation counts are exact, and
// they are the figure the instruction-following evidence actually concerns.

import { readdir, readFile, stat } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { countObligations } from "../skills/agent-skill-authoring/scripts/guidelines.mjs";
import {
  BYTES_PER_TOKEN,
  estimateTokens,
  PROXY_UNCERTAINTY,
} from "../skills/agent-skill-authoring/scripts/token-estimate.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_ROOT = join(REPO_ROOT, "skills");
const INSTALLED_ROOT = join(REPO_ROOT, ".claude", "skills");

/**
 * The mandated set, in the three tiers CLAUDE.md's Response Approach actually
 * scopes it to — NOT one always-on set, which is what this constant used to
 * claim and what the report used to print.
 *
 * Each tier states the condition under which a session carries it, and the
 * tiers are cumulative: a session that changes something carries all three, a
 * session that only touches the project carries the first two, and a session
 * that does neither carries the first alone. Reporting the sum of all three as
 * "every session" overstates what an ordinary question-answering session holds
 * by the whole of the last two tiers.
 *
 * The scoping is quoted rather than invented. `professional-behavior` is
 * required "in every session, before anything else … they apply to a task that
 * changes nothing as fully as to a delivered change". `software-development` is
 * required "at the start of every task that touches the project", and its own
 * description adds "Not for a session that touches nothing".
 * `loop-engineering` governs "any code change or document update", and the same
 * section says "Tasks that change nothing stay outside the loop".
 *
 * CLAUDE.md's Response Approach is the AUTHORITY for all of it; this constant is
 * a convenience copy, and the coupling is by convention rather than by parse —
 * for the tier boundaries exactly as for the membership. That is a deliberate
 * limit, not an oversight: a prose parse cannot see all three skills.
 * `professional-behavior` appears in CLAUDE.md as a literal hyphenated name and
 * `loop-engineering` as a link path, but `software-development` is named only
 * descriptively — "the project's baseline development practices" — so a parser
 * would silently report two of three and look like it worked. A parse of the
 * conditions would fail the same way, and less visibly.
 *
 * What IS pinned mechanically: a test asserts every name here resolves to a real
 * skill, so renaming or deleting one fails loudly rather than silently dropping
 * it from the floor. Claiming a stronger pin than that would be worse than
 * documenting this one.
 */
const MANDATED_TIERS = [
  { condition: "every session", skills: ["professional-behavior"] },
  { condition: "+ task touches the project", skills: ["software-development"] },
  { condition: "+ task changes something", skills: ["loop-engineering"] },
];

/** Flat membership in tier order, for resolution and for the resolves-to-a-real-skill test. */
const MANDATED_SKILLS = MANDATED_TIERS.flatMap((tier) => tier.skills);

function fail2(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

async function isFile(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function isDir(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/** A directory is a skill when it holds a SKILL.md. */
const isSkillDir = (path) => isFile(join(path, "SKILL.md"));

/**
 * Resolve one argument into skill directories. An argument is tried as a path
 * first, then as a skill name against the source root and the installed root, so
 * a name that happens to match a directory in the cwd still behaves predictably.
 *
 * @returns {Promise<string[]>} zero directories means the argument resolved to
 *   nothing, which the caller reports as a bad invocation
 */
async function resolveArgument(argument) {
  if (await isDir(argument)) {
    if (await isSkillDir(argument)) return [resolve(argument)];
    // A root whose immediate subdirectories are skills.
    const entries = await readdir(argument, { withFileTypes: true });
    const found = [];
    for (const entry of entries) {
      // A symlinked entry counts: `.claude/skills` mirrors `.agents/skills`
      // by symlink, and `isDirectory()` is false for one. The SKILL.md
      // test below stats through the link and does the real filtering.
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      const child = join(argument, entry.name);
      if (await isSkillDir(child)) found.push(resolve(child));
    }
    return found.sort();
  }

  for (const root of [SOURCE_ROOT, INSTALLED_ROOT]) {
    const candidate = join(root, argument);
    if (await isSkillDir(candidate)) return [candidate];
  }
  return [];
}

/**
 * Every skill in the repository, preferring the source tier. The installed
 * copies are identical whenever the drift gate passes, so counting both would
 * double every figure; the source tier is the one an edit lands in.
 */
async function allSkills() {
  const dirs = [];
  const seen = new Set();
  for (const root of [SOURCE_ROOT, INSTALLED_ROOT]) {
    if (!(await isDir(root))) continue;
    for (const dir of await resolveArgument(root)) {
      const name = basename(dir);
      if (seen.has(name)) continue;
      seen.add(name);
      dirs.push(dir);
    }
  }
  return dirs;
}

/** The obligation count and UTF-8 byte size of one Markdown file. */
async function measureFile(path) {
  const raw = await readFile(path, "utf8");
  return {
    obligations: countObligations(raw),
    bytes: Buffer.byteLength(raw, "utf8"),
  };
}

/**
 * Measure one skill at both depths.
 *
 * `floor` is SKILL.md alone; `ceiling` is SKILL.md plus every references/*.md,
 * so the ceiling always includes the floor rather than sitting beside it.
 *
 * @returns {Promise<{ name: string, floor: {obligations, bytes}, ceiling: {obligations, bytes} }>}
 */
async function measureSkill(dir) {
  const floor = await measureFile(join(dir, "SKILL.md"));
  const ceiling = { ...floor };

  const refDir = join(dir, "references");
  if (await isDir(refDir)) {
    const refFiles = (await readdir(refDir))
      .filter((file) => file.endsWith(".md"))
      .sort();
    for (const file of refFiles) {
      const measured = await measureFile(join(refDir, file));
      ceiling.obligations += measured.obligations;
      ceiling.bytes += measured.bytes;
    }
  }
  return { name: basename(dir), floor, ceiling };
}

const tokens = estimateTokens;
const group = (value) => value.toLocaleString("en-US");

/**
 * The cumulative-by-tier block, printed under the totals when `--mandated` ran.
 *
 * It exists because the single total above it answers "what does the whole
 * selection cost", and that is not the question a reader of a *mandated* report
 * has. Theirs is "what is a session of this kind holding", which only the
 * cumulative tiers answer — the last row is the figure this report used to
 * print alone, and the first is what an ordinary question-answering session
 * actually carries.
 */
function tierBlock(tiers) {
  const headers = ["session kind", "oblig.", "~tokens", "oblig.", "~tokens"];
  const rows = tiers.map((tier) => [
    tier.condition,
    group(tier.floor.obligations),
    group(tokens(tier.floor.bytes)),
    group(tier.ceiling.obligations),
    group(tokens(tier.ceiling.bytes)),
  ]);
  const widths = headers.map((header, column) =>
    Math.max(header.length, ...rows.map((row) => row[column].length)),
  );
  const layout = (cells) =>
    [
      cells[0].padEnd(widths[0]),
      ...cells.slice(1).map((cell, index) => cell.padStart(widths[index + 1] + 2)),
    ].join("");
  const width = widths.reduce((sum, w) => sum + w, 0) + (widths.length - 1) * 2;
  const floorSpan = widths[1] + widths[2] + 4;
  const ceilingSpan = widths[3] + widths[4] + 4;

  return [
    "Cumulative by session kind — each tier carries the ones above it, and",
    "only the last is what this report used to print as a single total.",
    "",
    "".padEnd(widths[0]) +
      "SKILL.md only".padStart(Math.floor((floorSpan + "SKILL.md only".length) / 2)).padEnd(floorSpan) +
      "+ all references".padStart(Math.floor((ceilingSpan + "+ all references".length) / 2)),
    layout(headers),
    "-".repeat(width),
    ...rows.map(layout),
    "",
  ];
}

/**
 * Render the report.
 *
 * Per-skill rows plus a total, so a maintainer diffing two runs sees WHICH skill
 * moved rather than only that the total did. Nothing checkout-dependent appears
 * — no timestamps, no absolute paths — so successive runs diff cleanly.
 *
 * `tiers`, when given, appends the cumulative block above; without it the output
 * is byte-identical to what this function produced before that block existed.
 */
function render(measurements, selectionLabel, tiers = null) {
  const total = measurements.reduce(
    (sum, { floor, ceiling }) => ({
      floor: {
        obligations: sum.floor.obligations + floor.obligations,
        bytes: sum.floor.bytes + floor.bytes,
      },
      ceiling: {
        obligations: sum.ceiling.obligations + ceiling.obligations,
        bytes: sum.ceiling.bytes + ceiling.bytes,
      },
    }),
    { floor: { obligations: 0, bytes: 0 }, ceiling: { obligations: 0, bytes: 0 } },
  );

  const cellsFor = (label, { floor, ceiling }) => [
    label,
    group(floor.obligations),
    group(floor.bytes),
    group(tokens(floor.bytes)),
    group(ceiling.obligations),
    group(ceiling.bytes),
    group(tokens(ceiling.bytes)),
  ];
  const rows = measurements.map((measurement) =>
    cellsFor(measurement.name, measurement),
  );
  const totalRow = cellsFor("total", total);

  const headers = ["skill", "oblig.", "bytes", "~tokens", "oblig.", "bytes", "~tokens"];
  const widths = headers.map((header, column) =>
    Math.max(
      header.length,
      ...[...rows, totalRow].map((row) => row[column].length),
    ),
  );
  const layout = (cells) =>
    [
      cells[0].padEnd(widths[0]),
      ...cells.slice(1).map((cell, index) => cell.padStart(widths[index + 1] + 2)),
    ].join("");

  const width = widths.reduce((sum, w) => sum + w, 0) + (widths.length - 1) * 2;
  const floorSpan = widths[1] + widths[2] + widths[3] + 6;
  const ceilingSpan = widths[4] + widths[5] + widths[6] + 6;

  const lines = [
    `Obligation burden for ${measurements.length} skill(s) — ${selectionLabel}.`,
    "",
    "".padEnd(widths[0]) +
      "SKILL.md only".padStart(Math.floor((floorSpan + "SKILL.md only".length) / 2)).padEnd(floorSpan) +
      "+ all references".padStart(Math.floor((ceilingSpan + "+ all references".length) / 2)),
    layout(headers),
    "-".repeat(width),
    ...rows.map(layout),
    "-".repeat(width),
    layout(totalRow),
    "",
    `Floor   (SKILL.md bodies alone):    ${group(total.floor.obligations).padStart(5)} obligations, ~${group(tokens(total.floor.bytes))} tokens`,
    `Ceiling (every reference read too): ${group(total.ceiling.obligations).padStart(5)} obligations, ~${group(tokens(total.ceiling.bytes))} tokens`,
    "",
    ...(tiers ? tierBlock(tiers) : []),
    "Obligation counts are exact. Token figures divide UTF-8 bytes by",
    `${BYTES_PER_TOKEN} and are good to ${PROXY_UNCERTAINTY}; the raw byte counts are shown so the`,
    "division can be redone. No threshold is defined — this reports a",
    "range, it never passes or fails.",
  ];
  return lines.join("\n");
}

const USAGE = `Usage: report-obligation-burden.mjs [--mandated] [<path | name> …]

Report the concurrent RFC-2119 obligation burden a session carries when it loads
the given skills, as a floor (SKILL.md bodies alone) and a ceiling (every
references/*.md read too). With no arguments, reports every skill.

  <path>      a skill directory, or a directory whose subdirectories are skills
  <name>      a skill name, resolved against this repository's skill roots
  --mandated  the set CLAUDE.md mandates, in its three cumulative tiers

Exit codes: 0 a report was produced (always), 2 bad invocation.
No threshold is defined — this never fails on the numbers it reports.`;

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(`${USAGE}\n`);
    process.exit(0);
  }

  const selectors = [];
  let mandated = false;
  for (const arg of args) {
    if (!arg.startsWith("--")) {
      selectors.push(arg);
    } else if (arg === "--mandated") {
      mandated = true;
    } else {
      fail2(`Unknown option "${arg}".\n${USAGE}`);
    }
  }

  const dirs = [];
  const seen = new Set();
  const add = (dir) => {
    if (seen.has(dir)) return;
    seen.add(dir);
    dirs.push(dir);
  };

  if (mandated) {
    for (const name of MANDATED_SKILLS) {
      const resolved = await resolveArgument(name);
      if (resolved.length === 0) {
        fail2(
          `The mandated skill "${name}" resolves to no skill under "${SOURCE_ROOT}" or "${INSTALLED_ROOT}". CLAUDE.md's Response Approach owns this set and its per-tier scoping; update MANDATED_TIERS to match it — MANDATED_SKILLS is derived from it, not edited directly.`,
        );
      }
      resolved.forEach(add);
    }
  }
  for (const selector of selectors) {
    const resolved = await resolveArgument(selector);
    if (resolved.length === 0) {
      fail2(`No skill found for "${selector}" — not a skill directory, a directory of skills, or a known skill name.`);
    }
    resolved.forEach(add);
  }
  if (!mandated && selectors.length === 0) {
    (await allSkills()).forEach(add);
  }

  if (dirs.length === 0) fail2("No skills selected — nothing to report.");

  const measurements = [];
  for (const dir of dirs) measurements.push(await measureSkill(dir));
  measurements.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  const selectionLabel =
    mandated && selectors.length === 0
      ? "the set CLAUDE.md mandates, tiered by session kind below"
      : mandated
        ? "the set CLAUDE.md mandates, plus the skills named"
        : selectors.length === 0
          ? "every skill in the repository"
          : "the skills named";

  // Cumulative tiers, computed only for --mandated: they describe the mandated
  // set's own scoping, so they would be meaningless over an arbitrary selection.
  // Extra selectors are excluded here and remain in the total above, where a
  // reader of `--mandated code-review` wants them.
  let tiers = null;
  if (mandated) {
    const byName = new Map(measurements.map((m) => [m.name, m]));
    const running = {
      floor: { obligations: 0, bytes: 0 },
      ceiling: { obligations: 0, bytes: 0 },
    };
    tiers = MANDATED_TIERS.map((tier) => {
      for (const name of tier.skills) {
        const m = byName.get(name);
        if (!m) continue;
        running.floor.obligations += m.floor.obligations;
        running.floor.bytes += m.floor.bytes;
        running.ceiling.obligations += m.ceiling.obligations;
        running.ceiling.bytes += m.ceiling.bytes;
      }
      return {
        condition: tier.condition,
        floor: { ...running.floor },
        ceiling: { ...running.ceiling },
      };
    });
  }

  process.stdout.write(`${render(measurements, selectionLabel, tiers)}\n`);
  // Always 0: this reports, it never judges. See the header's no-threshold note.
  process.exit(0);
}

main();
