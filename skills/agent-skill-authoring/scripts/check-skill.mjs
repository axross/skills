#!/usr/bin/env node
// check-skill.mjs — structure validator for agentskills.io skills.
//
// Mechanically checks the parts of a skill an audit would otherwise eyeball:
// the discovery contract in frontmatter, the directory/name match, the
// description length caps, reference-file linkage (no orphans), the parent
// routing-section format, and the document-body rules below. It complements
// check-links.sh (repo-wide Markdown link integrity) by adding the frontmatter,
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
//                     they carry continuation detail, not rules.
//   * link scope      a relative link must resolve inside its own skill
//                     directory; a path link into another skill is what the
//                     topic-based cross-reference rule exists to prevent.
//   * anchor validity a link's `#fragment` must match a heading in the target
//                     file, using GitHub's slug rules. A fragment whose target
//                     file does not resolve is left to check-links.sh rather
//                     than reported twice.
//
// It is dependency-light (Node standard library only) and host-agnostic: the
// spec-required rules (name, description) always apply; the Claude-Code
// discovery fields (when_to_use, user-invocable) are checked only when present,
// so the validator stays useful on hosts that do not define them. A project
// targeting Claude Code can require both with --require-claude-code-fields;
// that flag is off by default precisely to keep the sentence above true. It is
// a starting point to adapt per project, not a fixed contract.
//
// Alongside failures it reports advisory WARN lines for capability framing — a
// document-style name suffix, or a description opening in document voice. That
// rule is SHOULD-level, so warnings never affect the exit code; they surface a
// recast candidate for a human to weigh. The detectors are deliberately narrow
// and stay silent on the judgment calls the prose rule owns.
//
// Usage:
//   node check-skill.mjs [--require-claude-code-fields] <path> [<path> ...]
//     <path>  a skill directory (one holding SKILL.md), OR a directory whose
//             immediate subdirectories are skills (e.g. the skill root). A shell
//             glob such as `.claude/skills/*` expands to the former.
//     --require-claude-code-fields
//             additionally require `when_to_use` and `user-invocable` on every
//             skill. Presence only — which value `user-invocable` should carry
//             depends on the skill's archetype, which is not decidable here.
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

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const RFC2119_RE =
  /^(MUST NOT|MUST|SHOULD NOT|SHOULD|NOT RECOMMENDED|RECOMMENDED|REQUIRED|OPTIONAL|MAY)\b/;
const GUIDELINES_RE = /^\*\*Guidelines:\*\*\s*$/;
// An absolute URI (http:, https:, mailto:, …) or a protocol-relative URL: not a
// path this validator can resolve on disk.
const EXTERNAL_TARGET_RE = /^([a-z][a-z0-9+.-]*:|\/\/)/i;
const REQUIRE_CLAUDE_CODE_FIELDS = "--require-claude-code-fields";
const NAME_MAX = 64;
const DESCRIPTION_MAX = 1024;
const COMBINED_MAX = 1536;

// Capability-framing advisories (warnings only — see the header note).
const DOC_NAME_SUFFIX_RE =
  /-(guidelines|best-practices|principles|conventions|rules|requirements)$/;
const DOC_VOICE_DESC_RE =
  /^(This skill|This document|These guidelines|A collection of|Guidelines for|Rules for|Instructions for|Information about)\b/i;

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
      if (!entry.isDirectory()) continue;
      const child = join(path, entry.name);
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

// A line that opens or closes a fenced block: 3+ backticks or 3+ tildes after
// optional leading whitespace. Group 1 is the marker, group 2 the rest of the
// line (an info string on an opening fence, blank on a closing one).
const FENCE_RE = /^[ \t]*(`{3,}|~{3,})(.*)$/;

/**
 * Per CommonMark, a fence closes only on a marker of the SAME character, at
 * least as long as the opener, carrying no info string. That is what lets a
 * longer fence legally contain shorter ones — a ````markdown block wrapping a
 * ```ts block, as this repository's own references do. Toggling on any
 * fence-looking line inverts the state inside such a block and exposes its
 * content as body text.
 */
function closesFence(marker, char, length) {
  return (
    marker !== null &&
    marker[1][0] === char &&
    marker[1].length >= length &&
    marker[2].trim() === ""
  );
}

/**
 * Walk a document's lines while tracking fenced blocks, yielding
 * { line, text, fence } for every line OUTSIDE a fence, plus each fence's
 * OPENING line marked `fence: true`.
 *
 * Surfacing the opener is what lets a caller treat a fenced block as content
 * without seeing inside it. The section-intro check needs exactly that: a
 * section whose demonstration IS a code block must not read as a heading
 * abutting its `**Guidelines:**` label. Callers that only care about prose
 * skip the marked lines.
 */
function* scanLines(body) {
  let fenceChar = null; // open fence's marker character, or null outside a fence
  let fenceLength = 0; // and its length — a closer must be at least this long
  const lines = body.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const text = lines[index];
    const marker = text.match(FENCE_RE);
    if (fenceChar !== null) {
      if (closesFence(marker, fenceChar, fenceLength)) fenceChar = null;
      continue;
    }
    if (marker) {
      fenceChar = marker[1][0];
      fenceLength = marker[1].length;
      yield { line: index + 1, text, fence: true };
      continue;
    }
    yield { line: index + 1, text, fence: false };
  }
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
 * RFC-2119 keyword. Only bullets at zero indentation are rules; nested items
 * carry continuation detail and are exempt.
 *
 * A blank line does NOT end the block — a loose list is still one list, and
 * treating the gap as a boundary would silently stop checking every bullet
 * after it. The block ends at a heading or at an unindented non-bullet line.
 */
function guidelineKeywordFailures(body, file, offset) {
  const failures = [];
  let inBlock = false;

  for (const { line, text, fence } of scanLines(body)) {
    if (fence) {
      // An indented fence belongs to a bullet; an unindented one ends the block.
      if (inBlock && !/^\s/.test(text)) inBlock = false;
      continue;
    }
    if (GUIDELINES_RE.test(text)) {
      inBlock = true;
      continue;
    }
    if (!inBlock) continue;
    if (/^#{1,6}\s/.test(text)) {
      inBlock = false;
      continue;
    }
    const bullet = text.match(/^-\s+(.*)$/);
    if (bullet) {
      const rule = bullet[1].trim();
      if (!RFC2119_RE.test(rule)) {
        failures.push(
          `guidelines: ${file}:${line + offset} bullet does not open with an RFC-2119 keyword: "${rule.slice(0, 60)}…"`,
        );
      }
      continue;
    }
    if (text.trim() === "" || /^\s/.test(text)) continue;
    inBlock = false;
  }
  return failures;
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
 * Routing-section bullets must stay descriptive — no RFC-2119 keywords. Only
 * the contiguous bullet list immediately following a `See […](./references/…)
 * for:` line is a routing list; a later `**Guidelines:**` block in the same
 * section (as a self-contained workflow skill may carry) is left alone.
 */
function routingKeywordFailures(body) {
  const failures = [];
  let section = "(top)";
  let inRouting = false; // inside the See…for: bullet list (or its lead-in gap)
  let seenBullet = false; // a routing bullet has appeared since the See line

  for (const { text: line, fence } of scanLines(body)) {
    if (fence) continue;

    const heading = line.match(/^#{2,}\s+(.*)$/);
    if (heading) {
      section = heading[1].trim();
      inRouting = false;
      seenBullet = false;
      continue;
    }
    if (/See \[[^\]]+\.md\]\(\.\/references\/[^)]+\) for:/.test(line)) {
      inRouting = true;
      seenBullet = false;
      continue;
    }
    if (!inRouting) continue;

    const bullet = line.match(/^\s*-\s+(.*)$/);
    if (bullet) {
      seenBullet = true;
      if (RFC2119_RE.test(bullet[1].trim())) {
        const preview = bullet[1].trim().slice(0, 60);
        failures.push(
          `routing: section "${section}" has a routing bullet starting with an RFC-2119 keyword: "${preview}…"`,
        );
      }
      continue;
    }
    // A blank line before the first bullet is the lead-in gap; any other line,
    // or a blank line after the bullets, ends the routing list.
    if (line.trim() === "" && !seenBullet) continue;
    inRouting = false;
  }
  return failures;
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
 * guideline voice, link scope, and anchor validity.
 */
async function documentFailures(dir, documents) {
  const failures = [];
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
      // A target that does not resolve is check-links.sh's finding, not this
      // one; reporting it here would put the same defect behind two gates.
      if (anchors === null) continue;
      if (!anchors.has(fragment)) {
        failures.push(
          `anchors: ${at} link "${target}" resolves to no heading in ${skillRelative(skillRoot, resolved)}.`,
        );
      }
    }
  }
  return failures;
}

/**
 * Run every structural check for one skill directory. Returns
 * { failures, warnings }: failures decide the exit code, warnings are advisory
 * capability-framing notes that do not.
 */
async function checkSkill(dir, { requireClaudeCodeFields = false } = {}) {
  const failures = [];
  const warnings = [];
  const dirName = basename(dir);

  let raw;
  try {
    raw = await readFile(join(dir, "SKILL.md"), "utf8");
  } catch (error) {
    return { failures: [`SKILL.md is unreadable: ${error.message}`], warnings };
  }

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

    const description = fields.description;
    if (!description) {
      failures.push("frontmatter: `description` is missing or empty.");
    } else {
      if (description.length > DESCRIPTION_MAX) {
        failures.push(`frontmatter: \`description\` is ${description.length} chars (max ${DESCRIPTION_MAX}).`);
      }
      const opening = description.match(DOC_VOICE_DESC_RE);
      if (opening) {
        warnings.push(
          `framing: \`description\` opens in document voice ("${opening[0]}…") — name the ability the skill gives the agent.`,
        );
      }
    }

    if (fields.when_to_use && description) {
      const combined = description.length + fields.when_to_use.length;
      if (combined > COMBINED_MAX) {
        failures.push(`frontmatter: \`description\` + \`when_to_use\` is ${combined} chars (max ${COMBINED_MAX}).`);
      }
    }

    // Opt-in only: on a host that defines neither field, requiring them would
    // fail a correct skill tree. See the header's host-agnosticism note.
    if (requireClaudeCodeFields) {
      if (!fields.when_to_use) {
        failures.push("frontmatter: `when_to_use` is missing.");
      }
      if (fields["user-invocable"] === undefined) {
        failures.push("frontmatter: `user-invocable` is missing.");
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
  failures.push(...(await documentFailures(dir, documents)));
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

const USAGE = `Usage: check-skill.mjs [${REQUIRE_CLAUDE_CODE_FIELDS}] <skill-dir | skill-root> [more paths…]`;

async function main() {
  const args = process.argv.slice(2);
  const paths = [];
  let requireClaudeCodeFields = false;

  for (const arg of args) {
    if (!arg.startsWith("--")) {
      paths.push(arg);
    } else if (arg === REQUIRE_CLAUDE_CODE_FIELDS) {
      requireClaudeCodeFields = true;
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
    const { failures, warnings } = await checkSkill(dir, { requireClaudeCodeFields });
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
      `${warnedCount} skill(s) raised advisory capability-framing warnings (they do not affect the exit code).`,
    );
  }
  process.stdout.write(`${lines.join("\n")}\n`);
  process.exit(failedCount === 0 ? 0 : 1);
}

main();
