#!/usr/bin/env node
// check-skill.mjs — structure validator for agentskills.io skills.
//
// Mechanically checks the parts of a skill an audit would otherwise eyeball:
// the discovery contract in frontmatter, the directory/name match, the
// description length caps, reference-file linkage (no orphans), the parent
// routing-section format, and the document-body rules below. It complements
// check-links.mjs (repo-wide Markdown link integrity) by adding the frontmatter,
// orphan-reference, and body-structure checks that link-checking cannot see.
//
// Scanned per skill: SKILL.md and every references/*.md. Those are the files a
// skill authors as prose; scripts/ and assets/ carry payload rather than
// rule-bearing text and are deliberately not scanned, so a rule placed there is
// a deliberate choice rather than a silent escape from these checks.
//
// The body checks are:
//   * section intro   a `##`+ heading with nothing but blank lines between it
//                     and its `**Guidelines:**` block states rules before
//                     demonstrating the topic. A fenced block, prose, table,
//                     list, or blockquote all count as the demonstration.
//   * guideline voice a top-level bullet inside a `**Guidelines:**` block must
//                     open with an RFC-2119 keyword. Nested bullets are exempt:
//                     they carry continuation detail, not rules. Neither a blank
//                     line nor a fence ends the block — see the note on
//                     guidelineKeywordFailures for where it does end.
//   * link scope      a relative link must resolve inside its own skill
//                     directory; a path link into another skill is what the
//                     topic-based cross-reference rule exists to prevent.
//   * anchor validity a link's `#fragment` must match a heading in the target
//                     file, using GitHub's slug rules. A fragment whose target
//                     file does not resolve is left to check-links.mjs rather
//                     than reported twice.
//
// It is dependency-light (Node standard library only) and host-agnostic: the
// spec-required rules (name, description) are the whole frontmatter contract,
// because they are the whole of what the Agent Skills specification defines and
// the only fields every host reads. A host-specific extension such as Claude
// Code's `when_to_use` is neither required nor rejected — an unknown key is
// simply not this validator's business. It is a starting point to adapt per
// project, not a fixed contract.
//
// Alongside failures it reports advisory WARN lines. Every rule behind them is
// SHOULD-level, or a MUST whose exception clause a threshold would misencode, so
// warnings NEVER affect the exit code: they surface a candidate for a human to
// weigh. Each detector is deliberately narrow and stays silent on the judgment
// calls its prose rule owns. The advisory checks are:
//   * framing       a document-style `name` suffix, or a `description` opening
//                   in document voice.
//   * size          a SKILL.md over the ~5,000-token budget, estimated from a
//                   byte proxy (see BYTES_PER_TOKEN) rather than a tokenizer.
//   * length        a section over the guideline-bullet ceiling — near seven is
//                   the target, and above ten the rule wants a stated reason.
//   * placement     an RFC-2119 bullet outside any `**Guidelines:**` block. The
//                   owning rule says "usually under a label", so this warns.
//   * labels        a stale plain `Guidelines:`/`Example:` label where the
//                   standard is a bold subheading-like paragraph.
//   * fences        a fenced `text` block where a blockquote usually reads
//                   better — occasionally the fence is right, hence a warning.
//   * hedging       an adverbial hedge immediately after an RFC-2119 keyword.
//                   Anchored to that position, and adverbs only: a volitional
//                   verb ("MUST NOT attempt …") is the prohibited action, not a
//                   hedged obligation, and reporting it would be wrong.
//   * citation      a `Verified against …` line carrying no URL, or a document
//                   that pins a version while carrying no documentation URL at
//                   all. Two readings of one rule pair; see the note above
//                   citationWarnings for why the second is document-level and
//                   fires only at a count of zero.
//   * routing       a routing bullet that gestures at a fact ("the flag", "the
//                   approaches available") while naming nothing. Silent as soon
//                   as the bullet names anything, which is the whole remedy.
//
// Usage:
//   node check-skill.mjs <path> [<path> ...]
//     <path>  a skill directory (one holding SKILL.md), OR a directory whose
//             immediate subdirectories are skills (e.g. the skill root). A shell
//             glob such as `.claude/skills/*` expands to the former. A symlinked
//             entry is followed, so a root whose skills are symlinks into
//             another agent's root is checked rather than silently skipped.
//
// When two paths hold the same skill — a source tree plus the generated copy
// installed from it — the two are reported once, under whichever path came
// first on the command line, so a failure points at the copy a fix belongs in.
// Only an identical verdict collapses; if the copies have diverged, both are
// reported, which is the signal you want.
//
// Exit codes:
//   0  every checked skill passed (warnings alone do not fail a skill)
//   1  one or more checks failed (each failure is listed per skill)
//   2  bad invocation, or a path that holds no SKILL.md and no skill subdirs
//
// Frontmatter parsing is intentionally minimal: it reads the leading `---`
// block and single-line `key: value` scalars, which is all a skill's discovery
// metadata uses. It does not implement full YAML.

import { readdir, readFile, stat } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

// The CommonMark fenced-block rule lives in a sibling module because
// check-links.mjs needs the identical rule. See commonmark.mjs for why one
// implementation with two callers replaced two implementations that drifted.
import { FENCE_RE, scanLines } from "./commonmark.mjs";

// The `**Guidelines:**` block boundary and the RFC-2119 rule likewise live in a
// sibling module. The guideline-voice check and the structural advisories below
// are two readings of ONE walk, and obligation-counting tooling is a third; see
// guidelines.mjs for why they cannot each carry their own copy of the boundary.
import { GUIDELINES_RE, RFC2119_RE, scanGuidelines } from "./guidelines.mjs";

// The byte→token proxy behind the size advisory, for the same reason: the
// reporting tooling that estimates a whole skill set's load must divide by the
// SAME calibrated figure, or the two report different numbers for one file.
import {
  BYTES_PER_TOKEN,
  estimateTokens,
  PROXY_UNCERTAINTY,
} from "./token-estimate.mjs";

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// An absolute URI (http:, https:, mailto:, …) or a protocol-relative URL: not a
// path this validator can resolve on disk.
const EXTERNAL_TARGET_RE = /^([a-z][a-z0-9+.-]*:|\/\/)/i;
const NAME_MAX = 64;
// The spec states 1024 CHARACTERS. It is measured here in BYTES because that
// is the stricter reading and the one a host has been observed to apply: Codex
// rejects a skill outright with "invalid description: exceeds maximum length of
// 1024 characters", and its limit is reported to be byte-measured, so a
// description of 1024 characters carrying any non-ASCII punctuation fails to
// load. UTF-8 never encodes a character in fewer than one byte, so a
// byte-conformant description is character-conformant too and one check covers
// both readings.
const DESCRIPTION_MAX_BYTES = 1024;

// A plain (unquoted) YAML scalar is read specially when it carries one of the
// constructs below, so a `description` containing one either fails to parse or
// — worse — parses to something other than what was written. Either way the
// skill does not load with the text its author meant, while a regex-based
// reader like this one sees nothing wrong.
//
// The set is EMPIRICAL, derived by running each construct through a real YAML
// parser rather than from the specification's indicator table, because the two
// disagree in both directions. `\` and `~` lead a plain scalar perfectly
// legally and rejecting them would fail correct skills; `#`, and `-`/`?`/`:`
// before a space, are hazards the indicator table alone does not obviously
// predict. A construct is listed here only if a parser was observed to reject
// or silently transform it.
//
// Silent transformation is the reason this is a failure rather than a warning.
// `a #b` parses to `a` and `&x text` parses to `text`: no error anywhere, and
// the skill loads carrying a description its author never wrote.

// `:` before whitespace or at end of value — opens a nested mapping.
const YAML_COLON_HAZARD_RE = /:(\s|$)/;
// `#` at the start, or after whitespace — opens a comment and truncates.
const YAML_COMMENT_HAZARD_RE = /(^|\s)#/;
// Hazardous as the FIRST character whatever follows.
const YAML_LEADING_ALWAYS = new Set(["[", "{", "]", "}", ",", "&", "*", "!", "|", ">", "%", "@", "`", '"', "'", "#"]);
// Hazardous as the first character only when a space (or nothing) follows;
// `- x` is a list item, `? x` a complex key, `: x` a value.
const YAML_LEADING_BEFORE_SPACE = new Set(["-", "?", ":"]);

// The escapes YAML defines inside a DOUBLE-quoted scalar, mapped to what they
// produce. The set is closed: `\d`, `\s`, `\w` and every other undefined
// sequence is a parse error, NOT a literal backslash. Accepting them would
// reintroduce this check's own defect through the quoting path — a value the
// validator passes and no host can load.
//
// Verified against a real parser rather than transcribed, on the same reasoning
// as the hazard set above.
const YAML_DQUOTE_ESCAPES = new Map([
  ["0", "\0"],
  ["a", "\x07"],
  ["b", "\b"],
  ["t", "\t"],
  ["\t", "\t"],
  ["n", "\n"],
  ["v", "\v"],
  ["f", "\f"],
  ["r", "\r"],
  ["e", "\x1b"],
  [" ", " "],
  ['"', '"'],
  ["/", "/"],
  ["\\", "\\"],
  ["N", "\x85"],
  ["_", "\xa0"],
  ["L", "\u2028"],
  ["P", "\u2029"],
]);
// The numeric forms, each taking a fixed run of hex digits after the marker.
const YAML_DQUOTE_HEX_ESCAPES = new Map([
  ["x", 2],
  ["u", 4],
  ["U", 8],
]);

// Capability-framing advisories (warnings only — see the header note).
const DOC_NAME_SUFFIX_RE =
  /-(guidelines|best-practices|principles|conventions|rules|requirements)$/;
const DOC_VOICE_DESC_RE =
  /^(This skill|This document|These guidelines|A collection of|Guidelines for|Rules for|Instructions for|Information about)\b/i;

// Structural advisories (warnings only — see the header note).
//
// The byte→token proxy behind the size budget — why bytes rather than a
// tokenizer, how the divisor was calibrated, and why it is only good to
// PROXY_UNCERTAINTY — belongs to token-estimate.mjs, which this imports rather
// than restating. The budget below is expressed in tokens and converted once.
const SKILL_TOKEN_MAX = 5000;
const SKILL_BYTES_MAX = Math.round(SKILL_TOKEN_MAX * BYTES_PER_TOKEN);
// Near seven bullets is the target; above ten the rule requires a stated
// reason, which a bare threshold cannot see — so both bands only warn.
const SECTION_BULLETS_NEAR = 8;
const SECTION_BULLETS_MAX = 10;
// Adverbs only, and only immediately after the keyword. A wider list, or an
// unanchored match, was measured at ~95% false positives on real skill prose.
const HEDGE_RE =
  /^(generally|usually|typically|ideally|probably|possibly|perhaps|maybe|often|sometimes|normally)\b/i;
// A label the project standard wants emphasized as `**Guidelines:**`.
const PLAIN_LABEL_RE = /^(Guidelines|Examples?):\s*$/;
const TEXT_FENCE_RE = /^text\b/i;

// Upstream-citation advisories (warnings only — see the header note).
//
// The rule pair these mechanize sits in body-content-style.md: a MUST to cite
// the upstream URL in any section that pins a version or mirrors a vendor's
// option surface, and a SHOULD to attach that URL to a `Verified against` line.
// The SHOULD is checkable as written. The MUST is not: "mirrors a vendor's
// option surface" is a judgment about content that no pattern decides, which is
// exactly the exception clause the header says a threshold would misencode.
// So the second signal proxies only the half that IS mechanical — a version
// pin — and only in its least ambiguous form, a document citing NOTHING.
const VERIFIED_AGAINST_RE = /^\s*(?:[*_]{1,2})?Verified against\b/i;
const URL_RE = /https?:\/\/[^\s)>\]"']+/g;
// Separate and non-global, because a /g/ regex carries lastIndex between calls
// and `.test()` on one would skip every other line it was asked about.
const HAS_URL_RE = /https?:\/\//i;
// The RFC-2119 boilerplate every skill carries, and the tracker it redirects
// through. Counting these as documentation would make every skill look cited,
// which is why #171's own table measured "non-RFC URLs" rather than URLs.
const SPEC_BOILERPLATE_HOST_RE = /^https?:\/\/(?:www\.)?(?:rfc-editor\.org|datatracker\.ietf\.org)\//i;
// A version pin, in the four shapes this corpus actually writes. Each requires
// a digit bound to a version-bearing word, so prose numbers ("8px grid", "Top
// 10") cannot match: a package at a semver, an SDK or release line, a `v`-
// prefixed major, and a spelled-out "version <n>".
const VERSION_PIN_RES = [
  /(?:^|[\s`(])@?[a-z0-9][a-z0-9.@/-]*[a-z0-9]\s+\d+\.\d+\.\d+\b/i,
  /\bSDK\s+\d+\b/i,
  /(?:^|[\s`(])v\d+(?:\.\d+)*\b/,
  /\bversion\s+\d+\b/i,
];

// Routing-concreteness advisory (warnings only — see the header note).
//
// The abstract nouns a gestural routing bullet reaches for, held to the set the
// rule and its examples actually enumerate. Wider sets were measured on this
// corpus and cost more than they found: `function`, `property`, `value`,
// `field`, and `parameter` all appear in bullets that name their subject
// perfectly well ("separating the properties a component owns from the ones its
// consumer owns"), so including them bought noise only.
const GESTURE_NOUNS =
  "flags?|limits?|files?|rules?|options?|settings?|approaches|details?|caveats?|conditions?|requirements?|thresholds?|caps?";
// Three refinements, each measured against the corpus rather than assumed:
//   * emphasis markers are skipped, so a bolded gesture ("the **flag**") reads
//     the same as a plain one — the defect is the word, not its weight;
//   * `(?![\w-])` rather than `\b`, or "the file-notation set" matches on its
//     "file" prefix and reports a bullet for a noun it never used;
//   * a gerund immediately before it exempts the phrase, because "naming the
//     file" and "separating the properties" describe an ACTIVITY performed on
//     the thing rather than withholding its name.
const ROUTING_GESTURE_RE = new RegExp(
  `(?<!ing\\s)\\bthe\\s+[*_]{0,2}(?:${GESTURE_NOUNS})(?![\\w-])`,
  "i",
);
// A bullet instructing the reader to NAME something is stating this rule, not
// breaking it. `agent-skill-authoring`'s own A2 bullet — "the flag, limit, or
// rule BY NAME" — is the case every hand-run count of this defect has
// mis-flagged, so the exclusion is deliberate rather than incidental.
//
// Held to that one phrase. "rather than" and "instead of" were tried alongside
// it and silenced a real gesture — next-app-development's "the options that
// change behaviour RATHER THAN tune it" — because those phrases carry no
// connection to naming. An exclusion that hides the defect it was meant to
// measure around is worse than the false positive it was buying off.
const ROUTING_META_RE = /\bby name\b/i;

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

/**
 * Expand each argument into skill directories. An argument that holds a
 * SKILL.md is a skill; otherwise its immediate subdirectories holding a
 * SKILL.md are the skills. Exits 2 on a path that yields neither.
 */
async function resolveSkillDirs(paths) {
  const skills = [];
  const seen = new Set();
  const add = (dir) => {
    if (!seen.has(dir)) {
      seen.add(dir);
      skills.push(dir);
    }
  };

  for (const path of paths) {
    if (!(await isDir(path))) fail2(`Not a directory: "${path}".`);
    if (await isFile(join(path, "SKILL.md"))) {
      add(path);
      continue;
    }
    const entries = await readdir(path, { withFileTypes: true });
    let found = 0;
    for (const entry of entries) {
      // `isDirectory()` comes from lstat semantics and is FALSE for a symlink
      // pointing at a directory, so testing it here would skip every entry of a
      // symlinked skill root and report "All 0 skill(s) passed" — a pass that
      // checked nothing. `isDir` stats through the link instead. Installing one
      // source into two agents' roots by symlinking the second is a supported
      // layout (Claude Code documents following a symlinked `<skill-name>`
      // entry), so this is a real arrangement rather than a hypothetical one.
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      const child = join(path, entry.name);
      if (!(await isDir(child))) continue;
      if (await isFile(join(child, "SKILL.md"))) {
        found += 1;
        add(child);
      }
    }
    if (found === 0) {
      fail2(`No SKILL.md in "${path}" or its immediate subdirectories.`);
    }
  }
  return skills;
}

/**
 * Split a SKILL.md into its frontmatter fields and body. Returns
 * { fields: Record<string,string> | null, body: string, offset: number };
 * fields is null when the leading `---` block is missing or unterminated.
 *
 * `offset` is how many lines the frontmatter consumed, so a finding located at
 * body line N is reported at file line N + offset. Without it every SKILL.md
 * finding would cite a line several short of the one a reader opens to.
 */
function splitFrontmatter(text) {
  const norm = text.replace(/\r\n/g, "\n");
  if (!norm.startsWith("---\n")) return { fields: null, body: norm, offset: 0 };
  const close = norm.indexOf("\n---", 4);
  if (close === -1) return { fields: null, body: norm, offset: 0 };

  const block = norm.slice(4, close + 1);
  const afterClose = norm.indexOf("\n", close + 1);
  const body = afterClose === -1 ? "" : norm.slice(afterClose + 1);
  const offset =
    afterClose === -1 ? 0 : norm.slice(0, afterClose + 1).split("\n").length - 1;

  const fields = {};
  for (const line of block.split("\n")) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s?(.*)$/);
    if (match) fields[match[1]] = match[2];
  }
  return { fields, body, offset };
}

/**
 * Read a frontmatter scalar the way a YAML parser would, without being one.
 * Returns `{ value, error }`: `value` is the unwrapped string a parser would
 * produce, or null when `error` is set.
 *
 * Three forms are recognized. A double-quoted value unwraps and unescapes; a
 * single-quoted value unwraps and collapses `''` to `'`; anything else is a
 * plain scalar, which is returned as-is unless it carries a construct from the
 * hazard set above.
 *
 * Unwrapping has to happen BEFORE the byte cap and the framing check run.
 * Otherwise quotes and escapes count against the 1024-byte budget an author
 * did not spend, and the document-voice regex matches a leading `"` instead of
 * the first word.
 *
 * This is deliberately not a YAML implementation. It covers the forms a
 * frontmatter scalar is written in, and its job is to refuse anything it
 * cannot read confidently rather than to guess.
 */
function readScalar(raw) {
  // Whitespace around a scalar is syntax, not value — a parser strips it on
  // both sides. Trimming BOTH matters: with only the trailing side stripped,
  // `description:  "x"` (a second space before the quote) would not be seen as
  // quoted at all, and would be read as plain text that happens to start with
  // a quote character.
  const text = raw.trim();
  if (text === "") return { value: "", error: null };

  const quote = text[0];
  if (quote === '"' || quote === "'") {
    if (text.length < 2 || text[text.length - 1] !== quote) {
      return {
        value: null,
        error: `opens with ${quote === '"' ? "a double" : "a single"} quote but does not close — a quoted value must end with the same quote.`,
      };
    }
    const inner = text.slice(1, -1);

    if (quote === "'") {
      // Inside single quotes only `''` is special. An odd-length run of quotes
      // means one of them terminates the scalar early.
      for (const run of inner.match(/'+/g) ?? []) {
        if (run.length % 2 !== 0) {
          return {
            value: null,
            error: "carries an unpaired `'` inside a single-quoted value — double it to `''` to mean a literal quote.",
          };
        }
      }
      return { value: inner.replace(/''/g, "'"), error: null };
    }

    // Inside double quotes a `"` must be backslash-escaped. Walk the string so
    // an escaped backslash before a quote (`\\"`) is read as terminating.
    let out = "";
    for (let i = 0; i < inner.length; i++) {
      const ch = inner[i];
      if (ch !== "\\") {
        if (ch === '"') {
          return {
            value: null,
            error: 'carries an unescaped `"` inside a double-quoted value — write it as `\\"`.',
          };
        }
        out += ch;
        continue;
      }
      const next = inner[i + 1];
      if (next === undefined) {
        return { value: null, error: "ends with a dangling `\\` inside a double-quoted value." };
      }
      const hexDigits = YAML_DQUOTE_HEX_ESCAPES.get(next);
      if (hexDigits !== undefined) {
        const digits = inner.slice(i + 2, i + 2 + hexDigits);
        if (digits.length < hexDigits || !/^[0-9a-fA-F]+$/.test(digits)) {
          return {
            value: null,
            error: `carries \`\\${next}\` with fewer than ${hexDigits} hex digits after it inside a double-quoted value.`,
          };
        }
        out += String.fromCodePoint(Number.parseInt(digits, 16));
        i += 1 + hexDigits;
        continue;
      }
      if (!YAML_DQUOTE_ESCAPES.has(next)) {
        return {
          value: null,
          error: `carries \`\\${next}\`, which YAML does not define as an escape inside a double-quoted value — use single quotes, or double the backslash.`,
        };
      }
      out += YAML_DQUOTE_ESCAPES.get(next);
      i++;
    }
    return { value: out, error: null };
  }

  const lead = text[0];
  if (YAML_LEADING_ALWAYS.has(lead)) {
    return {
      value: null,
      error: `begins with \`${lead}\`, which YAML reads as an indicator rather than text — quote the value.`,
    };
  }
  if (YAML_LEADING_BEFORE_SPACE.has(lead) && (text.length === 1 || /\s/.test(text[1]))) {
    return {
      value: null,
      error: `begins with \`${lead}\` followed by a space, which YAML reads as an indicator rather than text — quote the value.`,
    };
  }
  if (YAML_COLON_HAZARD_RE.test(text)) {
    return {
      value: null,
      error: "contains `: ` (a colon before a space or at the end), which YAML reads as opening a nested mapping — quote the value.",
    };
  }
  if (YAML_COMMENT_HAZARD_RE.test(text)) {
    return {
      value: null,
      error: "contains ` #`, which YAML reads as starting a comment and silently truncates the value — quote it.",
    };
  }
  return { value: text, error: null };
}

/**
 * A heading's GitHub anchor slug: lowercase, delete everything that is not a
 * letter, number, mark, ASCII space, `-`, or `_`, then replace each remaining
 * space with a hyphen.
 *
 * Replacing spaces INDIVIDUALLY rather than collapsing runs is the load-bearing
 * detail. GitHub deletes an em dash and leaves both flanking spaces, so
 * `## Phase 1 — Plan` is `phase-1--plan`, not `phase-1-plan`; a collapsing
 * implementation reports every such link as broken. Link syntax is reduced to
 * its text first, since the slug comes from the rendered heading. Emphasis
 * markers are not unwrapped — `_x_` would slug as `_x_` rather than `x` — which
 * is a known divergence with no instances in a heading to date.
 */
function slugify(heading) {
  return heading
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s+#+\s*$/, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M} _-]/gu, "")
    .replace(/ /g, "-");
}

/**
 * Every anchor a document's headings define, including GitHub's `-1`, `-2`
 * suffixes for repeated headings. Headings inside fences are illustrative and
 * define no anchor.
 *
 * Line endings are normalized here rather than by the caller: this reads an
 * anchor's TARGET file, which need not be one of the documents already
 * normalized on the way in. A CRLF-authored target would otherwise leave a
 * trailing `\r` on every heading — which `.` does not match — so the file would
 * report zero anchors and every link into it would read as broken.
 */
function headingAnchors(source) {
  const anchors = new Set();
  const seen = new Map();
  const text = source.replace(/\r\n/g, "\n");

  for (const { text: line, fence } of scanLines(text)) {
    if (fence) continue;
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (!heading) continue;
    const base = slugify(heading[1].trim());
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${count}`);
  }
  return anchors;
}

/**
 * Sections that state requirements without demonstrating the topic first: a
 * `##`+ heading separated from its `**Guidelines:**` block by nothing but blank
 * lines. Any other line — including a fence opener — is the demonstration.
 */
function sectionIntroFailures(body, file, offset) {
  const failures = [];
  let pending = null;

  for (const { line, text, fence } of scanLines(body)) {
    if (!fence) {
      const heading = text.match(/^#{2,}\s+(.*)$/);
      if (heading) {
        pending = { line, title: heading[1].trim() };
        continue;
      }
      if (text.trim() === "") continue;
      if (pending && GUIDELINES_RE.test(text)) {
        failures.push(
          `section: "${pending.title}" (${file}:${pending.line + offset}) lists requirements with nothing between the heading and its \`**Guidelines:**\` block.`,
        );
      }
    }
    pending = null;
  }
  return failures;
}

/**
 * Top-level bullets inside a `**Guidelines:**` block that do not open with an
 * RFC-2119 keyword.
 *
 * The block boundary — what opens it, and why neither a blank line nor a fence
 * closes it — belongs to guidelines.mjs, which this reads through
 * `scanGuidelines`. `guidelineStructureWarnings` reads the SAME walk, so the two
 * cannot disagree about whether a given bullet is inside a block.
 */
function guidelineKeywordFailures(body, file, offset) {
  const failures = [];

  for (const event of scanGuidelines(body)) {
    if (event.kind !== "bullet" || !event.inBlock || event.keyword) continue;
    failures.push(
      `guidelines: ${file}:${event.line + offset} bullet does not open with an RFC-2119 keyword: "${event.rule.slice(0, 60)}…"`,
    );
  }
  return failures;
}

/**
 * The advisory warnings a document's guideline structure raises, in one walk:
 * section length, bullet placement, and hedging.
 *
 * Reads the same `scanGuidelines` walk `guidelineKeywordFailures` does, so
 * "outside a block" is exactly the complement of "inside" one. That shared
 * boundary is the point: two definitions would let the two checks disagree about
 * the same bullet, each silently believing the other covered it.
 *
 * A section is the span under one heading of ANY level, so a nested subsection
 * is counted independently of its parent: the ceiling rule applies to each.
 */
function guidelineStructureWarnings(body, file, offset) {
  const warnings = [];
  let section = null; // { line, title, bullets } of the heading in scope

  const flushSection = () => {
    if (!section || section.bullets < SECTION_BULLETS_NEAR) return;
    const at = `${file}:${section.line + offset}`;
    warnings.push(
      section.bullets > SECTION_BULLETS_MAX
        ? `length: "${section.title}" (${at}) has ${section.bullets} guideline bullets — over the ceiling of ten; split it or state why the exception is necessary.`
        : `length: "${section.title}" (${at}) has ${section.bullets} guideline bullets — approaching the ceiling of ten; the target is near seven.`,
    );
  };

  for (const event of scanGuidelines(body)) {
    if (event.kind === "heading") {
      flushSection();
      section = { line: event.line, title: event.title, bullets: 0 };
      continue;
    }
    const { line, rule, keyword, inBlock } = event;
    if (inBlock) {
      if (section) section.bullets += 1;
      const hedge = keyword
        ? rule.slice(keyword.length).trimStart().match(HEDGE_RE)
        : null;
      if (hedge) {
        warnings.push(
          `hedging: ${file}:${line + offset} "${keyword}" is followed by the hedge "${hedge[0]}": "${rule.slice(0, 60)}…"`,
        );
      }
    } else if (keyword) {
      warnings.push(
        `placement: ${file}:${line + offset} RFC-2119 bullet sits outside any \`**Guidelines:**\` block: "${rule.slice(0, 60)}…"`,
      );
    }
  }
  flushSection();
  return warnings;
}

/**
 * Stale document style: a plain `Guidelines:`/`Example:` label where the
 * standard is a bold subheading-like paragraph, and a fenced `text` block where
 * a blockquote usually reads better.
 *
 * Two findings rather than one, because they mechanize different rules at
 * different requirement levels and their remedies are unrelated — one merged
 * message would have to misstate one of them.
 */
function staleStyleWarnings(body, file, offset) {
  const warnings = [];

  for (const { line, text, fence } of scanLines(body)) {
    if (fence) {
      // The scanner yields a fence's opener so callers can treat the block as
      // content; re-matching it here is how its info string is read, which
      // keeps the shared scanner's shape unchanged.
      if (TEXT_FENCE_RE.test(text.match(FENCE_RE)[2].trim())) {
        warnings.push(
          `fences: ${file}:${line + offset} fenced \`text\` block — a blockquote under a bold example label is usually clearer.`,
        );
      }
      continue;
    }
    const label = text.match(PLAIN_LABEL_RE);
    if (label) {
      warnings.push(
        `labels: ${file}:${line + offset} plain "${label[1]}:" label — emphasize it as a bold paragraph (\`**${label[1]}:**\`).`,
      );
    }
  }
  return warnings;
}

/**
 * Upstream-citation advisories for one document.
 *
 * Signal 1 fires once per uncited `Verified against` line, so a document
 * carrying several reports several. Signal 2 fires at most once, and only when
 * signal 1 found nothing. No document in this corpus repeats a `Verified
 * against` line today, which makes the two indistinguishable here — an
 * observation about this tree, not a cap the code enforces.
 *
 * Two signals, in priority order:
 *
 *   1. A `Verified against …` line carrying no URL ON THAT LINE. This one is
 *      exact, and needs no document-level context: the line asserts that
 *      something WAS checked, the rule is that the URL rides the claim, and a
 *      citation three sections away does not discharge it.
 *   2. Failing that, a document that pins a version anywhere in its prose while
 *      citing no documentation URL at all.
 *
 * The second is deliberately the weaker half of its rule. The MUST it proxies
 * turns on "pins a version OR mirrors a vendor's option surface", and only the
 * first disjunct is mechanical — so a document that reproduces an option table
 * without naming a version stays silent here, and remains a reviewer's finding.
 * It is document-level rather than section-level because this corpus puts the
 * citation in a document's opening line, which a section-scoped check would read
 * as absent from every section below it. And it fires only at a count of ZERO,
 * so one URL anywhere silences it: at one citation the question stops being
 * "was anything checked?" and becomes "is this the right page?", which is
 * judgment.
 *
 * Signal 1 suppresses signal 2 in the same document. Both have the identical
 * remedy — add the URL — and reporting one missing citation twice would inflate
 * the count that scopes the cleanup.
 *
 * URLs are counted across the WHOLE document including fenced blocks, because a
 * link in a code sample still tells a reader where to look. Version pins are
 * read from prose only, so a lockfile excerpt showing `"vitest": "^4.1.10"` is
 * not read as the document pinning Vitest. Both choices push toward silence.
 */
function citationWarnings(body, file, offset) {
  const warnings = [];
  let pin = null;

  for (const { line, text, fence } of scanLines(body)) {
    if (fence) continue;

    if (VERIFIED_AGAINST_RE.test(text)) {
      // Judged on THIS line, not on the document: the rule is that the URL
      // rides the claim, so a citation three sections away does not discharge
      // it. This is the exact half, and it needs no document-level context.
      if (!HAS_URL_RE.test(text)) {
        warnings.push(
          `citation: ${file}:${line + offset} "${text.trim().slice(0, 60)}…" states a verification with no URL to check it against.`,
        );
      }
      continue;
    }
    if (!pin && VERSION_PIN_RES.some((pattern) => pattern.test(text))) {
      pin = { line, text };
    }
  }

  if (warnings.length > 0 || !pin) return warnings;

  const cited = (body.match(URL_RE) ?? []).some(
    (url) => !SPEC_BOILERPLATE_HOST_RE.test(url),
  );
  if (cited) return warnings;

  return [
    `citation: ${file}:${pin.line + offset} pins a version ("${pin.text.trim().slice(0, 60)}…") but the document cites no documentation URL.`,
  ];
}

/**
 * The SKILL.md size advisory, or null when the file is within budget. Reports
 * the raw byte count alongside the estimate so a reader can redo the division
 * and judge a borderline case themselves — the proxy is only good to ±5%.
 */
function skillSizeWarning(raw) {
  const bytes = Buffer.byteLength(raw, "utf8");
  if (bytes <= SKILL_BYTES_MAX) return null;
  const estimate = estimateTokens(bytes);
  return `size: SKILL.md is ${bytes} bytes, ~${estimate} estimated tokens (÷ ${BYTES_PER_TOKEN}, ${PROXY_UNCERTAINTY}) — over the ~${SKILL_TOKEN_MAX}-token budget of ${SKILL_BYTES_MAX} bytes; move detail into references/.`;
}

/**
 * Every on-disk link target in a document — relative paths and bare `#fragment`
 * references — outside fenced blocks and inline code spans. External schemes
 * are dropped: this validator resolves files, not URLs.
 */
function documentLinks(body) {
  const links = [];

  for (const { line, text, fence } of scanLines(body)) {
    if (fence) continue;
    const prose = text.replace(/`+[^`]+`+/g, "");
    for (const match of prose.matchAll(/\]\(([^)\s]+)\)/g)) {
      if (EXTERNAL_TARGET_RE.test(match[1])) continue;
      links.push({ line, target: match[1] });
    }
  }
  return links;
}

/**
 * Every routing bullet in a SKILL.md, with the section heading above it.
 *
 * Only the contiguous bullet list immediately following a
 * `See […](./references/…) for:` line is a routing list; a later
 * `**Guidelines:**` block in the same section (as a self-contained workflow
 * skill may carry) is left alone.
 *
 * One walk with one boundary, for the same reason guidelines.mjs owns the
 * `**Guidelines:**` boundary: two readers ask different questions of a routing
 * bullet — "does it open with an RFC-2119 keyword?" (a failure) and "does it
 * name what it points at?" (an advisory) — and a second copy of this boundary
 * would let them disagree about which bullets are routing bullets at all.
 *
 * @yields {{ line: number, section: string, rule: string }} `line` is 1-based
 *   within `body`; `rule` is the bullet's trimmed text.
 */
function* routingBullets(body) {
  let section = "(top)";
  let inRouting = false; // inside the See…for: bullet list (or its lead-in gap)
  let seenBullet = false; // a routing bullet has appeared since the See line

  for (const { line, text, fence } of scanLines(body)) {
    if (fence) continue;

    const heading = text.match(/^#{2,}\s+(.*)$/);
    if (heading) {
      section = heading[1].trim();
      inRouting = false;
      seenBullet = false;
      continue;
    }
    if (/See \[[^\]]+\.md\]\(\.\/references\/[^)]+\) for:/.test(text)) {
      inRouting = true;
      seenBullet = false;
      continue;
    }
    if (!inRouting) continue;

    const bullet = text.match(/^\s*-\s+(.*)$/);
    if (bullet) {
      seenBullet = true;
      yield { line, section, rule: bullet[1].trim() };
      continue;
    }
    // A blank line before the first bullet is the lead-in gap; any other line,
    // or a blank line after the bullets, ends the routing list.
    if (text.trim() === "" && !seenBullet) continue;
    inRouting = false;
  }
}

/** Routing-section bullets must stay descriptive — no RFC-2119 keywords. */
function routingKeywordFailures(body) {
  const failures = [];

  for (const { section, rule } of routingBullets(body)) {
    if (!RFC2119_RE.test(rule)) continue;
    failures.push(
      `routing: section "${section}" has a routing bullet starting with an RFC-2119 keyword: "${rule.slice(0, 60)}…"`,
    );
  }
  return failures;
}

/**
 * Whether a routing bullet names anything a reader could look up: a code span,
 * a camelCased identifier, an acronym, or a proper noun past the first word.
 *
 * The first word is excluded from the proper-noun test because a leading
 * capital may only be opening the sentence. Every other form is positional
 * evidence that a specific thing is being named rather than alluded to.
 */
function namesSomething(rule) {
  if (/`[^`]+`/.test(rule)) return true;
  return rule
    .split(/\s+/)
    .some(
      (word, index) =>
        /[a-z]\w*[A-Z]/.test(word) ||
        /^[A-Z]{2,}/.test(word) ||
        (index > 0 && /^[A-Z][a-z]/.test(word)),
    );
}

/**
 * Routing bullets that gesture at a fact instead of stating it.
 *
 * A bullet warns only when all three hold: it opens an abstract noun with a
 * bare `the`, it names nothing anywhere in the bullet, and it is not itself
 * describing the rule. All three conditions push toward silence, which is what
 * the advisory tier is for — the prose rule owns the judgment about whether a
 * particular bullet earns its reference, and a pattern cannot make it.
 *
 * The third condition is not a nicety. `agent-skill-authoring`'s own bullet for
 * this rule reads "the flag, limit, or rule BY NAME", and every hand-run count
 * of this defect has reported it as a violation of the rule it states. A metric
 * that reproduces the error it was built to replace is worse than no metric.
 *
 * KNOWN FALSE POSITIVE, stated rather than papered over: a compound noun whose
 * modifier is a gesture noun — "the file system", "the rule set" — reads as a
 * gesture and is not one. It cannot be separated by pattern, because the shape
 * is identical to a real gesture that happens to be compound ("the option sets
 * that differ between them"), and silencing one silences the other. On this
 * corpus that is one hit in ten. An advisory surfaces candidates for a human to
 * weigh, so the miscount is visible where a suppression would not be.
 */
function routingConcretenessWarnings(body, file, offset) {
  const warnings = [];

  for (const { line, section, rule } of routingBullets(body)) {
    if (!ROUTING_GESTURE_RE.test(rule)) continue;
    if (ROUTING_META_RE.test(rule) || namesSomething(rule)) continue;
    warnings.push(
      `routing: ${file}:${line + offset} section "${section}" gestures at a fact without naming it: "${rule.slice(0, 60)}…"`,
    );
  }
  return warnings;
}

/** A skill-relative path, always forward-slashed so a message reads the same on any platform. */
function skillRelative(skillRoot, path) {
  return relative(skillRoot, path).split(sep).join("/");
}

/**
 * The prose documents of a skill: SKILL.md plus every references/*.md, each
 * with the body to scan and the line offset its frontmatter consumed.
 * Reference files are scanned whole — only SKILL.md carries frontmatter, and a
 * reference legitimately opening with a `---` thematic break must not have its
 * first section eaten by a frontmatter parse.
 */
async function skillDocuments(dir, skillBody, skillOffset) {
  const documents = [
    { file: "SKILL.md", path: join(dir, "SKILL.md"), body: skillBody, offset: skillOffset },
  ];
  const unreadable = [];

  const refDir = join(dir, "references");
  if (await isDir(refDir)) {
    const refFiles = (await readdir(refDir)).filter((file) => file.endsWith(".md")).sort();
    for (const file of refFiles) {
      const path = join(refDir, file);
      try {
        documents.push({
          file: `references/${file}`,
          path,
          body: (await readFile(path, "utf8")).replace(/\r\n/g, "\n"),
          offset: 0,
        });
      } catch (error) {
        // Listed by readdir but unreadable: report it like an unreadable
        // SKILL.md rather than rejecting and losing the exit-code contract.
        unreadable.push(`references: "references/${file}" is unreadable: ${error.message}`);
      }
    }
  }
  return { documents, unreadable };
}

/**
 * The body-structure checks across a skill's documents: section intros,
 * guideline voice, link scope, and anchor validity as failures, plus the
 * structural advisories as warnings. Both come out of the same pass so a
 * document is walked once per concern, not once per finding kind.
 */
async function documentFindings(dir, documents) {
  const failures = [];
  const warnings = [];
  const skillRoot = resolve(dir);
  const anchorCache = new Map();

  /** A document's anchor set, or null when it cannot be read. */
  const anchorsOf = async (path) => {
    if (!anchorCache.has(path)) {
      try {
        anchorCache.set(path, headingAnchors(await readFile(path, "utf8")));
      } catch {
        anchorCache.set(path, null);
      }
    }
    return anchorCache.get(path);
  };

  for (const { file, path, body, offset } of documents) {
    failures.push(...sectionIntroFailures(body, file, offset));
    failures.push(...guidelineKeywordFailures(body, file, offset));
    warnings.push(...guidelineStructureWarnings(body, file, offset));
    warnings.push(...staleStyleWarnings(body, file, offset));
    warnings.push(...citationWarnings(body, file, offset));

    for (const { line, target } of documentLinks(body)) {
      const at = `${file}:${line + offset}`;
      const hash = target.indexOf("#");
      const targetPath = hash === -1 ? target : target.slice(0, hash);
      const fragment = hash === -1 ? "" : target.slice(hash + 1);

      let resolved = path;
      if (targetPath !== "") {
        resolved = resolve(dirname(path), targetPath);
        if (relative(skillRoot, resolved).startsWith("..")) {
          failures.push(
            `links: ${at} relative link "${target}" resolves outside the skill directory.`,
          );
          continue; // reported once, and nothing outside the skill is read
        }
      }

      if (fragment === "" || !resolved.endsWith(".md")) continue;
      const anchors = await anchorsOf(resolved);
      // A target that does not resolve is check-links.mjs's finding, not this
      // one; reporting it here would put the same defect behind two gates.
      if (anchors === null) continue;
      if (!anchors.has(fragment)) {
        failures.push(
          `anchors: ${at} link "${target}" resolves to no heading in ${skillRelative(skillRoot, resolved)}.`,
        );
      }
    }
  }
  return { failures, warnings };
}

/**
 * Run every structural check for one skill directory. Returns
 * { failures, warnings }: failures decide the exit code, warnings are advisory
 * capability-framing notes that do not.
 */
async function checkSkill(dir) {
  const failures = [];
  const warnings = [];
  const dirName = basename(dir);

  let raw;
  try {
    raw = await readFile(join(dir, "SKILL.md"), "utf8");
  } catch (error) {
    return { failures: [`SKILL.md is unreadable: ${error.message}`], warnings };
  }

  const size = skillSizeWarning(raw);
  if (size) warnings.push(size);

  const { fields, body, offset } = splitFrontmatter(raw);
  if (!fields) {
    failures.push("frontmatter: missing or unterminated leading `---` block.");
  } else {
    const name = fields.name;
    if (!name) {
      failures.push("frontmatter: `name` is missing.");
    } else {
      if (!NAME_RE.test(name)) {
        failures.push(`frontmatter: \`name\` "${name}" is not kebab-case (^[a-z0-9]+(-[a-z0-9]+)*$).`);
      }
      if (name.length > NAME_MAX) {
        failures.push(`frontmatter: \`name\` is ${name.length} chars (max ${NAME_MAX}).`);
      }
      if (name !== dirName) {
        failures.push(`frontmatter: \`name\` "${name}" does not match directory "${dirName}".`);
      }
      const suffix = name.match(DOC_NAME_SUFFIX_RE);
      if (suffix) {
        warnings.push(
          `framing: \`name\` ends in "${suffix[0]}" — names the document, not the capability; consider the activity beneath it.`,
        );
      }
    }

    const rawDescription = fields.description;
    const scalar = rawDescription === undefined ? { value: null, error: null } : readScalar(rawDescription);
    const description = scalar.value;
    if (scalar.error) {
      // Reported instead of the length and framing checks, not alongside them:
      // until the value can be read, its length and opening words are unknown.
      failures.push(`frontmatter: \`description\` ${scalar.error}`);
    } else if (!description) {
      failures.push("frontmatter: `description` is missing or empty.");
    } else {
      const descriptionBytes = Buffer.byteLength(description, "utf8");
      if (descriptionBytes > DESCRIPTION_MAX_BYTES) {
        const width =
          descriptionBytes === description.length
            ? `${descriptionBytes} bytes`
            : `${descriptionBytes} bytes (${description.length} chars)`;
        failures.push(
          `frontmatter: \`description\` is ${width} (max ${DESCRIPTION_MAX_BYTES} bytes) — a host that measures the cap in bytes refuses to load the skill.`,
        );
      }
      const opening = description.match(DOC_VOICE_DESC_RE);
      if (opening) {
        warnings.push(
          `framing: \`description\` opens in document voice ("${opening[0]}…") — name the ability the skill gives the agent.`,
        );
      }
    }

  }

  const { documents, unreadable } = await skillDocuments(dir, body, offset);
  failures.push(...unreadable);

  const refDir = join(dir, "references");
  if (await isDir(refDir)) {
    const refFiles = (await readdir(refDir)).filter((file) => file.endsWith(".md")).sort();
    for (const file of refFiles) {
      if (!body.includes(`](./references/${file})`)) {
        failures.push(`references: "references/${file}" is not linked from SKILL.md (orphan reference).`);
      }
    }
  }

  failures.push(...routingKeywordFailures(body));
  warnings.push(...routingConcretenessWarnings(body, "SKILL.md", offset));
  const documentResults = await documentFindings(dir, documents);
  failures.push(...documentResults.failures);
  warnings.push(...documentResults.warnings);
  return { failures, warnings };
}

/**
 * Collapse results that describe the same skill twice. Two entries merge only
 * when they share a skill name AND produce an identical verdict, so a project
 * that keeps generated copies of its skills (a source tree plus an installed
 * one) reports each skill once instead of once per copy. The path given
 * earliest on the command line is canonical, which is how the caller decides
 * which copy a fix belongs in. Differing verdicts never merge — that divergence
 * is exactly what the reader needs to see.
 */
function collapseDuplicates(results) {
  const collapsed = [];
  const byVerdict = new Map();

  for (const result of results) {
    const key = JSON.stringify([result.name, result.failures, result.warnings]);
    const seen = byVerdict.get(key);
    if (seen) {
      seen.duplicates.push(result.dir);
      continue;
    }
    const entry = { ...result, duplicates: [] };
    byVerdict.set(key, entry);
    collapsed.push(entry);
  }
  return collapsed;
}

const USAGE = `Usage: check-skill.mjs <skill-dir | skill-root> [more paths…]

Check each skill's frontmatter, naming, reference linkage, and body structure.
A <path> is either a skill directory (one holding SKILL.md) or a directory whose
immediate subdirectories are skills. A symlinked entry is followed, so a root
whose skills are symlinks into another agent's root is checked, not skipped.

Exit codes: 0 all skills passed, 1 one or more failed, 2 bad invocation.
Advisory WARN lines never affect the exit code.`;

async function main() {
  const args = process.argv.slice(2);
  const paths = [];

  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(`${USAGE}\n`);
    process.exit(0);
  }

  for (const arg of args) {
    if (!arg.startsWith("--")) {
      paths.push(arg);
    } else {
      fail2(`Unknown option "${arg}".\n${USAGE}`);
    }
  }
  if (paths.length === 0) fail2(USAGE);

  // Resolution order follows the command line, which decides which of two
  // identical copies is canonical; display is sorted afterwards for stability.
  const skills = await resolveSkillDirs(paths);
  if (skills.length === 0) fail2("No skills found to check.");

  const results = [];
  for (const dir of skills) {
    const { failures, warnings } = await checkSkill(dir);
    results.push({ dir, name: basename(dir), failures, warnings });
  }

  const collapsed = collapseDuplicates(results);
  collapsed.sort((a, b) => (a.dir < b.dir ? -1 : a.dir > b.dir ? 1 : 0));
  const duplicateCount = skills.length - collapsed.length;

  const lines = [];
  let failedCount = 0;
  let warnedCount = 0;
  for (const { dir, failures, warnings, duplicates } of collapsed) {
    const also =
      duplicates.length > 0 ? `  (= ${duplicates.join(", ")})` : "";
    if (failures.length === 0) {
      lines.push(`PASS  ${dir}${also}`);
    } else {
      failedCount += 1;
      lines.push(`FAIL  ${dir}${also}`);
      for (const failure of failures) lines.push(`        - ${failure}`);
    }
    if (warnings.length > 0) {
      warnedCount += 1;
      for (const warning of warnings) lines.push(`WARN    - ${warning}`);
    }
  }

  lines.push("");
  lines.push(
    failedCount === 0
      ? `All ${collapsed.length} skill(s) passed structural checks.`
      : `${failedCount} of ${collapsed.length} skill(s) failed structural checks.`,
  );
  if (duplicateCount > 0) {
    lines.push(
      `${duplicateCount} duplicate path(s) collapsed into an identical result above — fix the reported path, not the copy.`,
    );
  }
  if (warnedCount > 0) {
    lines.push(
      `${warnedCount} skill(s) raised advisory warnings (they do not affect the exit code).`,
    );
  }
  process.stdout.write(`${lines.join("\n")}\n`);
  process.exit(failedCount === 0 ? 0 : 1);
}

main();
