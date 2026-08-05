#!/usr/bin/env node
// report-skill-duplication.mjs — cross-skill rule duplication reporter for THIS
// repository.
//
// Answers a question no per-skill check can: "which rule is stated in more than
// one skill?" The skill-structure checks validate one skill directory at a time and are
// host-agnostic — it has no view of a sibling skill, and should not grow one,
// because it ships to projects whose skill trees are none of its business. So
// the comparison lives here, beside report-obligation-load.mjs, for the same
// reason that one does: it reports on a tree rather than validating one.
//
// THIS REPORTS AND NEVER JUDGES, and here the reason is stronger than a missing
// threshold — it is that the defect is not decidable from the text at all.
// scoping-and-mece.md's Portable Source Exception permits a self-contained
// distributable skill to restate a rule another skill owns, and EVERY skill in
// this repository is distributable. Two identical bullets may therefore be:
//
//   * a defect     — one rule with two sources of truth, free to drift apart,
//                    which REVIEW.md rates Major; or
//   * correct      — a portable skill carrying what it needs to stand alone.
//
// Nothing in the two bullets distinguishes those. Only intent does, and intent
// is not in the corpus. A gate here would fail correct text, so this ranks
// candidates and a human adjudicates — which is what #174 is doing, by hand,
// for the nine pairs a one-off scan already found.
//
// The obligation definition is NOT re-implemented here. It is imported from
// guidelines.mjs, the same module check-skill-body.mjs reads for its `guidelines:`
// failures and report-obligation-load.mjs counts through, so all three agree on
// what a rule is and a boundary fix reaches every reader at once.
//
// SIMILARITY IS A PLACE TO LOOK, NOT A VERDICT. Two rules are compared as sets
// of content words: shared-words ÷ total-distinct-words, after markdown, the
// leading RFC-2119 keyword, and a closed stopword list are stripped. That is
// deliberately crude. It cannot see that "MUST NOT log a secret" and "MUST
// redact credentials before logging" are the same rule, and it will happily
// rank two unrelated rules that share a vocabulary. Both directions are why the
// output is a ranked list to read rather than a count to act on.
//
// Comparison is CROSS-SKILL ONLY. A skill restating its own rule in two
// sections is a different defect with a different remedy, and mixing the two
// would bury the cross-skill pairs this exists to surface.
//
// Usage:
//   node scripts/report-skill-duplication.mjs [--min <0-1>] [--top <n>]
//                                             [<path | name> ...]
//
//     <path>  a skill directory (one holding SKILL.md), OR a directory whose
//             immediate subdirectories are skills (e.g. `skills`).
//     <name>  a skill name resolved against this repository's `skills` root,
//             then its `.claude/skills` root.
//     --min   similarity floor, 0 to 1 (default 0.6). Lower surfaces more
//             candidates and more noise.
//     --top   report at most this many pairs (default 40).
//
//   With no arguments it compares every skill in the repository.
//
// Exit codes:
//   0  a report was produced — ALWAYS, whatever it found
//   2  bad invocation: an unknown flag, an out-of-range value, or a name or
//      path that resolves to no skill

import { readdir, readFile, stat } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { scanGuidelines } from "../skills/agent-skill-authoring/scripts/guidelines.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_ROOT = join(REPO_ROOT, "skills");
const INSTALLED_ROOT = join(REPO_ROOT, ".claude", "skills");

const DEFAULT_MIN_SIMILARITY = 0.6;
const DEFAULT_TOP = 40;

/**
 * Words carrying no topical signal, so two rules are not called similar for
 * agreeing about English. Closed and short on purpose: an aggressive list
 * starts deciding which words are topical, which is the judgment this script
 * exists NOT to make.
 */
const STOPWORDS = new Set([
  "a", "an", "and", "any", "are", "as", "at", "be", "been", "but", "by",
  "can", "do", "does", "each", "every", "for", "from", "has", "have", "in",
  "into", "is", "it", "its", "not", "of", "on", "one", "only", "or", "over",
  "per", "same", "so", "than", "that", "the", "their", "them", "then",
  "there", "these", "they", "this", "those", "to", "up", "was", "were",
  "what", "when", "where", "which", "while", "who", "with", "would",
]);

/**
 * A token common enough that sharing it says nothing. Used only to skip
 * candidate generation — a pair that also shares a rarer token is still
 * compared on its full token set, so this changes speed and never a score.
 */
const COMMON_TOKEN_POSTINGS = 200;

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
 * Resolve one argument into skill directories: a path first, then a skill name
 * against the source root and the installed root. Mirrors
 * report-obligation-load.mjs, so the two accept the same selectors.
 *
 * @returns {Promise<string[]>} zero directories means the argument resolved to
 *   nothing, which the caller reports as a bad invocation
 */
async function resolveArgument(argument) {
  if (await isDir(argument)) {
    if (await isSkillDir(argument)) return [resolve(argument)];
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
 * copies are identical whenever the drift gate passes, so including both would
 * report every skill as a perfect duplicate of itself.
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

/**
 * A rule's comparable content words.
 *
 * Markdown is flattened rather than dropped — a link's label and a code span's
 * contents are the most topical words a rule has, and stripping them would make
 * two rules about `cacheComponents` look unrelated. The leading RFC-2119
 * keyword goes because every rule has one; keeping it would raise every score
 * by the same amount and compress the range the floor has to discriminate over.
 *
 * @param {string} rule the bullet's trimmed text
 * @param {string | null} keyword its matched RFC-2119 keyword
 * @returns {Set<string>}
 */
function contentTokens(rule, keyword) {
  const body = keyword ? rule.slice(keyword.length) : rule;
  const flattened = body
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // link → its label
    .replace(/[`*_~]/g, "")
    .toLowerCase();

  const tokens = new Set();
  for (const token of flattened.split(/[^a-z0-9]+/)) {
    if (token.length < 2 || STOPWORDS.has(token)) continue;
    tokens.add(token);
  }
  return tokens;
}

/**
 * Every RFC-2119 rule one skill states, across SKILL.md and every
 * references/*.md — the same file set check-skill-body.mjs scans, and for the same
 * reason: scripts/ and assets/ carry payload rather than rule-bearing text.
 *
 * @returns {Promise<Array<{ skill: string, at: string, rule: string, tokens: Set<string> }>>}
 */
async function skillRules(dir) {
  const skill = basename(dir);
  const files = ["SKILL.md"];

  const refDir = join(dir, "references");
  if (await isDir(refDir)) {
    for (const file of (await readdir(refDir)).filter((f) => f.endsWith(".md")).sort()) {
      files.push(`references/${file}`);
    }
  }

  const rules = [];
  for (const file of files) {
    const body = await readFile(join(dir, file), "utf8");
    for (const event of scanGuidelines(body)) {
      if (event.kind !== "bullet" || !event.inBlock || !event.keyword) continue;
      rules.push({
        skill,
        at: `${skill}/${file}:${event.line}`,
        rule: event.rule,
        tokens: contentTokens(event.rule, event.keyword),
      });
    }
  }
  return rules;
}

/** Shared tokens ÷ distinct tokens across both rules. */
function similarity(left, right) {
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  const distinct = left.size + right.size - shared;
  return distinct === 0 ? 0 : shared / distinct;
}

/**
 * Rank every cross-skill pair scoring at or above `minSimilarity`.
 *
 * Candidates come from an inverted index rather than from all-pairs: comparing
 * every rule with every other is quadratic in a corpus with thousands of rules,
 * and two rules sharing no content word at all cannot clear any positive floor.
 * Tokens appearing in more than COMMON_TOKEN_POSTINGS rules are skipped as
 * candidate generators only — a pair they would have produced is either
 * produced by a rarer shared token or scores too low to report.
 */
function rankPairs(rules, minSimilarity) {
  const postings = new Map();
  rules.forEach((rule, index) => {
    for (const token of rule.tokens) {
      if (!postings.has(token)) postings.set(token, []);
      postings.get(token).push(index);
    }
  });

  const seen = new Set();
  const pairs = [];
  for (const indices of postings.values()) {
    if (indices.length > COMMON_TOKEN_POSTINGS) continue;
    for (let i = 0; i < indices.length; i += 1) {
      for (let j = i + 1; j < indices.length; j += 1) {
        const [left, right] = [rules[indices[i]], rules[indices[j]]];
        if (left.skill === right.skill) continue;

        const key = `${indices[i]}:${indices[j]}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const score = similarity(left.tokens, right.tokens);
        if (score >= minSimilarity) pairs.push({ score, left, right });
      }
    }
  }

  return pairs.sort((a, b) => b.score - a.score || (a.left.at < b.left.at ? -1 : 1));
}

/**
 * Render the report.
 *
 * Both sites are printed with `file:line` and the rule text in full, because
 * the reader's next act is to open the two and decide which case they are —
 * and a truncated rule cannot be judged. Nothing checkout-dependent appears, so
 * successive runs diff cleanly.
 */
function render(pairs, { rules, skills, minSimilarity, top, selectionLabel }) {
  const shown = pairs.slice(0, top);
  const lines = [
    `Cross-skill rule duplication across ${skills} skill(s), ${rules} rule(s) — ${selectionLabel}.`,
    `Similarity floor ${minSimilarity}; ${pairs.length} candidate pair(s) at or above it.`,
    "",
  ];

  if (shown.length === 0) {
    lines.push("No pair scored at or above the floor.");
  } else {
    shown.forEach((pair, index) => {
      lines.push(
        `${String(index + 1).padStart(3)}. ${pair.score.toFixed(2)}  ${pair.left.skill} ↔ ${pair.right.skill}`,
        `       ${pair.left.at}`,
        `         ${pair.left.rule}`,
        `       ${pair.right.at}`,
        `         ${pair.right.rule}`,
        "",
      );
    });
    if (pairs.length > shown.length) {
      lines.push(`${pairs.length - shown.length} further pair(s) not shown — raise --top to see them.`);
      lines.push("");
    }
  }

  lines.push(
    "These are CANDIDATES, not findings. scoping-and-mece.md's Portable Source",
    "Exception lets a self-contained distributable skill restate a rule another",
    "skill owns, and every skill here is distributable — so a pair may be one",
    "rule with two sources of truth (a defect) or a portable skill standing on",
    "its own (correct). Only intent tells them apart, and intent is not in the",
    "text. See #174, which adjudicates such pairs by hand.",
    "",
    "No threshold is enforced — this reports a ranking, it never passes or fails.",
  );
  return lines.join("\n");
}

const USAGE = `Usage: report-skill-duplication.mjs [--min <0-1>] [--top <n>] [<path | name> …]

Report candidate duplicated RFC-2119 rules across skills, ranked by how many
content words two rules share. With no arguments, compares every skill.

  <path>   a skill directory, or a directory whose subdirectories are skills
  <name>   a skill name, resolved against this repository's skill roots
  --min    similarity floor, 0 to 1 (default ${DEFAULT_MIN_SIMILARITY})
  --top    report at most this many pairs (default ${DEFAULT_TOP})

Exit codes: 0 a report was produced (always), 2 bad invocation.
Candidates are for a human to adjudicate — the Portable Source Exception makes
a restated rule legitimate, and no pattern can tell that from a duplication.`;

/** Parse `--flag value` into a number, failing loudly on anything unusable. */
function numericOption(args, index, flag, { min, max, integer = false }) {
  const raw = args[index + 1];
  const value = Number(raw);
  if (raw === undefined || !Number.isFinite(value) || value < min || value > max) {
    fail2(`${flag} takes a number between ${min} and ${max}; got "${raw ?? ""}".\n${USAGE}`);
  }
  if (integer && !Number.isInteger(value)) {
    fail2(`${flag} takes a whole number; got "${raw}".\n${USAGE}`);
  }
  return value;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(`${USAGE}\n`);
    process.exit(0);
  }

  const selectors = [];
  let minSimilarity = DEFAULT_MIN_SIMILARITY;
  let top = DEFAULT_TOP;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      selectors.push(arg);
    } else if (arg === "--min") {
      minSimilarity = numericOption(args, index, "--min", { min: 0, max: 1 });
      index += 1;
    } else if (arg === "--top") {
      top = numericOption(args, index, "--top", { min: 1, max: 1000, integer: true });
      index += 1;
    } else {
      fail2(`Unknown option "${arg}".\n${USAGE}`);
    }
  }

  const dirs = [];
  const seen = new Set();
  for (const selector of selectors) {
    const resolved = await resolveArgument(selector);
    if (resolved.length === 0) {
      fail2(`No skill found for "${selector}" — not a skill directory, a directory of skills, or a known skill name.`);
    }
    for (const dir of resolved) {
      if (seen.has(dir)) continue;
      seen.add(dir);
      dirs.push(dir);
    }
  }
  if (selectors.length === 0) dirs.push(...(await allSkills()));

  if (dirs.length === 0) fail2("No skills selected — nothing to compare.");

  const rules = [];
  for (const dir of dirs) rules.push(...(await skillRules(dir)));

  const report = render(rankPairs(rules, minSimilarity), {
    rules: rules.length,
    skills: dirs.length,
    minSimilarity,
    top,
    selectionLabel:
      selectors.length === 0 ? "every skill in the repository" : "the skills named",
  });

  process.stdout.write(`${report}\n`);
  // Always 0: this reports, it never judges. See the header's no-verdict note.
  process.exit(0);
}

main();
