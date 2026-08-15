// counts stated in this repository's prose, as data.
//
// prose here states numbers that are derivable from the files that own them —
// how many skills the library ships, how many validators report rather than
// judge, what a validator's own byte cap is. nothing tied the two together,
// and a pair drifted once already: a `--dry-run` against cc0c9eb reported 24
// installed skills and 22 fixture cases while three documents still claimed 20
// cases and 100 probes — a discovery-evaluation fixture and snapshot this
// repository has since rebuilt and re-expressed. CI was green throughout,
// because no check could see a sentence.
//
// grepping prose for digits cannot fix that. it misses a count spelled out as a
// word and fires on every unrelated number, so it would be both incomplete and
// noisy in the one repository whose deliverable is prose. a count is therefore
// marked where it is written:
//
//   the <!-- count:distributable-skills -->twenty-five<!-- /count --> here …
//
// the number stays in exactly one place — the sentence — and this module holds
// the derivation that proves it. rewriting the sentence around the marker never
// breaks the check, and the marker is invisible once the Markdown is rendered.
//
// a marker sits inline, whole, on one line, and never at the start of one. that
// is CommonMark rather than taste: a line beginning with `<!--` is an HTML
// block, so a marker placed there ends the paragraph it was meant to sit inside
// and the sentence renders in two halves. both halves of that rule are enforced
// below, because the failure is invisible in the source and obvious only once
// the page is rendered.
//
// what this deliberately does not do: find an unmarked count. marking is opt-in,
// so a number nobody wrapped still drifts silently, exactly as it did before.
// that is the accepted cost of not grepping for digits, and it is why a stale
// count remains a legitimate review finding rather than something REVIEW.md's
// do-not-report list may claim CI covers — the check is coextensive with marked
// counts alone.
//
// a marker is checked wherever it appears in a scanned file, fenced code blocks
// included: nothing is exempt, so there is no "did this one count?" question to
// answer. what a fence changes is visibility, not applicability — an HTML
// comment inside one renders as literal text — so a code sample a reader copies
// should not carry a marker, while a sample that demonstrates the syntax
// legitimately does. the one in README.md's own gotcha entry is a real, checked
// claim for that reason.
//
// scope is every Markdown file outside the two skill roots. a distributable
// skill installs into other people's projects, where these derivations name
// files that do not exist and nothing can verify anything — so a marker under
// `skills/` or `.claude/skills/` is itself a failure, not a claim.

import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";

import { REPO_ROOT, repoPath } from "../helpers/run.mjs";
import { GATES } from "./gates.mjs";

/**
 * roots whose Markdown ships to other projects, so a marker may never appear.
 *
 * `.agents/skills` holds the installed files and `.claude/skills` symlinks into
 * it. both are listed: the walk below records a symlinked file under whichever
 * root it reached first, and a marker must be a failure under either name.
 */
const SKILL_ROOTS = ["skills", ".agents/skills", ".claude/skills"];

/** directories no scan descends into. */
const SKIPPED_DIRS = new Set(["node_modules", ".git"]);

/**
 * one marker token: an opening `<!-- count:key -->` or a closing
 * `<!-- /count -->`. matched together rather than separately so the two are
 * seen in document order, which is what makes an unclosed marker detectable.
 */
const MARKER_TOKEN = /<!--\s*(?:count:(\S+?)|(\/count))\s*-->/g;

/** the shape a marker key must take, so a typo cannot pass as a new key. */
const KEY_SHAPE = /^[a-z0-9-]+$/;

const CARDINALS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];

const ORDINALS = [
  "zeroth",
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
  "tenth",
  "eleventh",
  "twelfth",
  "thirteenth",
  "fourteenth",
  "fifteenth",
  "sixteenth",
  "seventeenth",
  "eighteenth",
  "nineteenth",
];

const TENS = [
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
];

const TENS_ORDINALS = [
  "twentieth",
  "thirtieth",
  "fortieth",
  "fiftieth",
  "sixtieth",
  "seventieth",
  "eightieth",
  "ninetieth",
];

/**
 * every spelling of `value` a sentence may legitimately use.
 *
 * prose picks whichever reads best — "25", "twenty-five", or "twenty-fifth" —
 * so the check accepts all of them rather than forcing a house style onto a
 * sentence. above 99 only the numeric forms are offered; no count here is that
 * large, and a word-spelling table for the general case would be dead weight.
 *
 * @param {number} value
 * @returns {string[]}
 */
export function renderings(value) {
  const forms = [String(value), `${value}${numericOrdinalSuffix(value)}`];
  if (value < 0 || value > 99 || !Number.isInteger(value)) return forms;
  if (value < 20) return [...forms, CARDINALS[value], ORDINALS[value]];

  const tens = Math.floor(value / 10) - 2;
  const unit = value % 10;
  if (unit === 0) return [...forms, TENS[tens], TENS_ORDINALS[tens]];
  return [
    ...forms,
    `${TENS[tens]}-${CARDINALS[unit]}`,
    `${TENS[tens]}-${ORDINALS[unit]}`,
  ];
}

/** the `st`/`nd`/`rd`/`th` an English numeric ordinal takes. */
function numericOrdinalSuffix(value) {
  const lastTwo = Math.abs(value) % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return "th";
  switch (Math.abs(value) % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

/**
 * whether the text a marker wraps states `value`.
 *
 * surrounding whitespace is normalized first, so `<!-- count:x --> 25 <!-- …`
 * reads the same as the tight form.
 *
 * @param {string} text
 * @param {number} value
 */
export function states(text, value) {
  const normalized = text.trim().replace(/\s+/g, " ");
  return renderings(value).includes(normalized);
}

/**
 * whether only whitespace precedes `index` on its line.
 *
 * this is the constraint the convention discovered the hard way. a line
 * beginning with `<!--` is an HTML block in CommonMark (up to three spaces of
 * indent still counts), so a marker placed there ends the paragraph it was
 * meant to sit inside — Prettier makes the split visible by inserting the blank
 * line the block implies, and the rendered sentence comes apart. keeping a word
 * in front of the marker keeps it inline, where it is invisible.
 *
 * @param {string} markdown
 * @param {number} index
 */
function beginsItsLine(markdown, index) {
  const lineStart = markdown.lastIndexOf("\n", index - 1) + 1;
  return markdown.slice(lineStart, index).trim() === "";
}

/**
 * @typedef {object} Marker
 * @property {string} key    the registry key the marker names
 * @property {string} text   the text it wraps, verbatim
 * @property {number} line   1-based line of the opening token
 *
 * @typedef {object} MarkerProblem
 * @property {number} line
 * @property {string} message
 */

/**
 * every marker in one Markdown document, plus every way one is malformed.
 *
 * a malformed marker is reported rather than skipped. silently ignoring an
 * unclosed marker would leave an author believing a number is checked when
 * nothing reads it — the precise failure this whole module exists to end.
 *
 * @param {string} markdown
 * @returns {{ markers: Marker[], problems: MarkerProblem[] }}
 */
export function parseMarkers(markdown) {
  const markers = [];
  const problems = [];
  const lineOf = (index) => markdown.slice(0, index).split("\n").length;

  let open = null;
  for (const match of markdown.matchAll(MARKER_TOKEN)) {
    const [token, key] = match;
    const line = lineOf(match.index);

    if (key !== undefined) {
      if (open) {
        problems.push({
          line: open.line,
          message: `\`<!-- count:${open.key} -->\` is never closed; a marker ends with \`<!-- /count -->\``,
        });
      }
      if (!KEY_SHAPE.test(key)) {
        problems.push({
          line,
          message: `"${key}" is not a usable marker key; keys are lowercase, digits, and hyphens`,
        });
      }
      if (beginsItsLine(markdown, match.index)) {
        problems.push({
          line,
          message: `\`<!-- count:${key} -->\` begins its line, which CommonMark reads as an HTML block — it would split the paragraph in two. Keep a word before it`,
        });
      }
      open = { key, line, end: match.index + token.length };
      continue;
    }

    if (!open) {
      problems.push({
        line,
        message: "`<!-- /count -->` closes a marker that was never opened",
      });
      continue;
    }

    const text = markdown.slice(open.end, match.index);
    if (text.trim() === "") {
      problems.push({
        line: open.line,
        message: `\`<!-- count:${open.key} -->\` wraps no text; the number goes between the two markers`,
      });
    } else if (text.includes("\n")) {
      problems.push({
        line: open.line,
        message: `\`<!-- count:${open.key} -->\` spans a line break, which puts \`<!-- /count -->\` at the start of a line and splits the paragraph. Keep the whole marker on one line`,
      });
    } else {
      markers.push({ key: open.key, text, line: open.line });
    }
    open = null;
  }

  if (open) {
    problems.push({
      line: open.line,
      message: `\`<!-- count:${open.key} -->\` is never closed; a marker ends with \`<!-- /count -->\``,
    });
  }

  return { markers, problems };
}

/**
 * pull one capture out of a file's text, or explain what stopped it.
 *
 * a derivation that reads a number out of prose is a coupling to that prose,
 * and this is the half that keeps the coupling honest: when the sentence it
 * anchors on is rewritten, the check fails loudly instead of quietly deriving
 * something else. that is the intended behaviour — a rewrite of the owning rule
 * is exactly when the sentence quoting it needs a second look.
 *
 * @param {string} text
 * @param {RegExp} pattern
 * @param {string} file      repository-relative path, for the message
 * @param {string} what      what the pattern was looking for
 * @returns {string}
 */
export function anchored(text, pattern, file, what) {
  const match = text.match(pattern);
  if (!match) {
    throw new Error(
      `${file} no longer contains ${what} (looked for ${pattern}). ` +
        "Its wording changed, so the prose deriving from it needs re-checking — " +
        "update this pattern once you have confirmed the number.",
    );
  }
  return match[1];
}

/** the body of one Markdown section, from its heading to the next one. */
export function sectionOf(markdown, heading) {
  const start = markdown.indexOf(`\n${heading}\n`);
  if (start === -1) {
    throw new Error(
      `README.md no longer has a "${heading}" section; the count derived from it has nothing to read.`,
    );
  }
  const body = markdown.slice(start + heading.length + 2);
  const next = body.search(/^#{1,3} /m);
  return next === -1 ? body : body.slice(0, next);
}

async function isFile(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/** directory names under `skills/` that hold a SKILL.md. */
async function distributableSkillDirs() {
  const root = repoPath("skills");
  const names = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (await isFile(join(root, entry.name, "SKILL.md"))) names.push(entry.name);
  }
  return names;
}

/**
 * the entries under the Claude Code skill root that are symlinks.
 *
 * counted as symlinks rather than as directories, because that is what the
 * prose claims and it is the load-bearing half: a `--copy` install would land
 * real directories there, still loading correctly while making the sentence
 * false. `Dirent.isSymbolicLink()` is the one predicate that tells them apart —
 * `isDirectory()` is false for a symlink to a directory, which is the trap the
 * repository's own enumerations already stat through.
 */
async function claudeSkillSymlinks() {
  const entries = await readdir(repoPath(".claude/skills"), {
    withFileTypes: true,
  });
  return entries.filter((entry) => entry.isSymbolicLink()).map((entry) => entry.name);
}

/**
 * the standalone validator CLIs README.md enumerates: this repository's own
 * gates, plus the ones that ship inside a skill for the projects that install
 * it. a module imported by a validator is not one of them, which is what the
 * shebang distinguishes — those files are executable entry points and say so.
 *
 * the walk is recursive. a multi-module tool groups its files in a subdirectory
 * of `scripts/` rather than flattening them among a skill's other scripts, and
 * an immediate-entries-only walk stops seeing that tool's CLI entirely — a
 * validator would silently drop out of the count while the prose kept claiming
 * it. recursing costs nothing here and removes the layout dependency.
 */
async function countDocumentedValidators() {
  const gateScripts = new Set(GATES.map((entry) => entry.script));
  let bundled = 0;

  for (const name of await distributableSkillDirs()) {
    const dir = repoPath("skills", name, "scripts");
    let files;
    try {
      files = await readdir(dir, { recursive: true });
    } catch {
      continue; // Most skills bundle no scripts.
    }
    for (const file of files.sort()) {
      if (!file.endsWith(".mjs")) continue;
      // not named `relative`: this module imports node:path's `relative`, and
      // shadowing it here would be a trap for the next edit in this scope.
      const relativePath = file.split(sep).join("/");
      if (gateScripts.has(`skills/${name}/scripts/${relativePath}`)) continue;
      const source = await readFile(join(dir, file), "utf8");
      if (source.startsWith("#!")) bundled += 1;
    }
  }

  return GATES.length + bundled;
}

/**
 * @typedef {object} Claim
 * @property {string} owner   what the number is derived from, for the message
 * @property {string} note    what else moves when this number does
 * @property {() => Promise<number>} derive
 */

/**
 * every count this repository's prose may mark.
 *
 * a key is registered here and used at least once in prose; the test enforces
 * both directions, so neither a marker naming nothing nor a derivation nothing
 * uses can survive.
 *
 * @type {Record<string, Claim>}
 */
export const CLAIMS = {
  "distributable-skills": {
    owner: "the directories under skills/ that hold a SKILL.md",
    note: "the skill catalog lists these one row at a time, so a new skill needs a row there too",
    derive: async () => (await distributableSkillDirs()).length,
  },

  "claude-skill-symlinks": {
    owner: "the symlink entries under .claude/skills/",
    note: "each installed skill needs one, so adding or removing a skill moves this with it",
    derive: async () => (await claudeSkillSymlinks()).length,
  },

  "first-reporting-tool-ordinal": {
    owner:
      "one past the gates in tests/repository/gates.mjs plus the shebang-carrying CLIs under skills/*/scripts/",
    note: 'the code fence above splits the same total across four comments — "three gates", "Five more", "One more", and "Three more" — which a reader copies verbatim, so they carry no marker and move by hand',
    derive: async () => (await countDocumentedValidators()) + 1,
  },

  "second-reporting-tool-ordinal": {
    owner:
      "two past the gates in tests/repository/gates.mjs plus the shebang-carrying CLIs under skills/*/scripts/",
    note: 'the code fence above splits the same total across four comments — "three gates", "Five more", "One more", and "Three more" — which a reader copies verbatim, so they carry no marker and move by hand',
    derive: async () => (await countDocumentedValidators()) + 2,
  },

  "third-reporting-tool-ordinal": {
    owner:
      "three past the gates in tests/repository/gates.mjs plus the shebang-carrying CLIs under skills/*/scripts/",
    note: 'the code fence above splits the same total across four comments — "three gates", "Five more", "One more", and "Three more" — which a reader copies verbatim, so they carry no marker and move by hand',
    derive: async () => (await countDocumentedValidators()) + 3,
  },

  "skill-description-byte-cap": {
    owner: "DESCRIPTION_MAX_BYTES in skills/agent-skill-authoring/scripts/check-skill-frontmatter.mjs",
    note: "AGENTS.md and REVIEW.md both state this cap, and nothing else ties the two copies together — the validator is the only authority",
    derive: async () => {
      const source = await readFile(
        repoPath("skills/agent-skill-authoring/scripts/check-skill-frontmatter.mjs"),
        "utf8",
      );
      return Number(
        anchored(
          source,
          /const DESCRIPTION_MAX_BYTES = (\d+);/,
          "skills/agent-skill-authoring/scripts/check-skill-frontmatter.mjs",
          "the DESCRIPTION_MAX_BYTES constant",
        ),
      );
    },
  },

};

/** every Markdown file in the repository, as repository-relative paths. */
export async function markdownFiles() {
  const found = [];

  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (SKIPPED_DIRS.has(entry.name)) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
      } else if (entry.name.endsWith(".md")) {
        found.push(relative(REPO_ROOT, path).split(sep).join("/"));
      }
    }
  }

  await walk(REPO_ROOT);
  return found.sort();
}

/** whether a repository-relative path belongs to a skill root. */
export function shipsWithASkill(path) {
  return SKILL_ROOTS.some((root) => path.startsWith(`${root}/`));
}

/**
 * the failure a reader acts on.
 *
 * it names the site, what was claimed, what the owning file actually holds, a
 * spelling to write, and what else moves with the number — so the fix needs no
 * trip through this module.
 *
 * @param {{ file: string, marker: Marker, claim: Claim, derived: number }} mismatch
 */
export function describeMismatch({ file, marker, claim, derived }) {
  const accepted = renderings(derived)
    .map((form) => `"${form}"`)
    .join(", ");
  return [
    `${file}:${marker.line} — count:${marker.key} claims "${marker.text.trim()}", but the truth is ${derived}.`,
    `  Derived from: ${claim.owner}.`,
    `  Write one of: ${accepted}.`,
    `  When it moves: ${claim.note}.`,
  ].join("\n");
}
