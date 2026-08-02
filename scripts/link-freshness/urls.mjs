// urls.mjs — external-URL extraction for the link-freshness audit.
//
// Answers "which external URLs does this tree claim, and where is each one
// written?" and nothing else. It performs no network I/O, so every rule here is
// testable offline and deterministically — which is what keeps the audit's
// extraction covered by `npm test` while the probing stays out of it.
//
// The fenced-block rule is NOT re-implemented: it comes from commonmark.mjs, the
// same module check-links.mjs and check-skill.mjs read. A skill that documents a
// URL inside a ```bash sample is showing it, not citing it, and probing an
// illustrative `https://example.com` would report a finding nobody can fix.
//
// WHY THIS IS A SEPARATE CONCERN FROM check-links.mjs. That script resolves
// RELATIVE `.md` links against the file system and deliberately ignores
// `http(s)://` targets — the two checks share no target set at all. It is also a
// merge gate, and gates here stay offline and deterministic; this is a scheduled
// audit that reaches the network. Same tree, disjoint questions.

import { readdir, readFile, stat } from "node:fs/promises";

import { scanLines } from "../../skills/agent-skill-authoring/scripts/commonmark.mjs";

/**
 * Directory names never worth walking, mirroring check-links.mjs's list for the
 * same reason: a `.md` under one of these is not authored content, and
 * node_modules alone would dominate the walk.
 */
const PRUNED_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "build",
  "out",
  "coverage",
  ".venv",
]);

/**
 * An `http(s)` URL, ending at the first character that cannot continue one in
 * running Markdown.
 *
 * `)` and `]` are excluded so an inline link's closing delimiter is not swallowed;
 * `<`, `>`, and the quote characters end an autolink or an HTML attribute. The
 * known limit is a URL that legitimately CONTAINS a closing paren — a Wikipedia
 * `…_(disambiguation)` target is the classic one — which truncates here. That is
 * accepted rather than solved: the truncated URL is probed, and a truncation
 * surfaces as a finding a human reads rather than as silence.
 */
const URL_RE = /https?:\/\/[^\s)\]"'`<>]+/g;

/**
 * Trailing characters that end a sentence rather than the URL. Stripped after
 * matching, because `…/api.` and `…/api,` are overwhelmingly prose punctuation
 * and a path segment ending in one of these is vanishingly rare.
 */
const TRAILING_PUNCTUATION_RE = /[.,;:!?]+$/;

/** A string of just the newlines in `text`, so a removed span keeps later line numbers intact. */
function newlinesOf(text) {
  return "\n".repeat((text.match(/\n/g) ?? []).length);
}

/**
 * Drop every HTML comment, replacing each span with its own newlines so the
 * lines after it keep their original numbers.
 *
 * A commented-out URL is text the reader never sees, so probing it would report
 * rot in prose nobody reads and nobody renders. This repository's own status
 * blocks and `count:` markers are HTML comments, and a section parked behind one
 * is a normal way to retire content here.
 *
 * A dangling unclosed `<!--` is KEPT rather than treated as running to end of
 * file: honouring it would silently stop extracting at that point, which is the
 * failure mode that looks like a clean result. check-links.mjs makes the same
 * call for the same reason.
 *
 * ORDERING IS LOAD-BEARING, and this is where this module deliberately differs
 * from check-links.mjs. That script strips comments from the RAW source, before
 * fenced blocks and inline code spans are removed. README.md documents the
 * `count:` marker rule with the sentence "a line beginning with `<!--` is an
 * HTML block in CommonMark" — an inline code span holding a comment opener. Read
 * raw, that opener is believed, and everything up to the next `-->` 89 lines
 * later is discarded as a comment: real prose, real links, silently unread.
 * `extractUrls` therefore blanks fences and code spans FIRST and calls this on
 * the result, so a comment opener has to be real text to count.
 *
 * The same defect is present in check-links.mjs today, where it means those 89
 * lines of README go unchecked for broken relative links. Fixing it there is an
 * edit to a merge gate's script inside a distributable skill, which this change
 * deliberately does not make — it is reported instead.
 *
 * @param {string} content
 * @returns {string}
 */
function stripHtmlComments(content) {
  let stripped = "";
  let rest = content;

  for (;;) {
    const openAt = rest.indexOf("<!--");
    if (openAt === -1) break;
    const closeOffset = rest.slice(openAt + 4).indexOf("-->");
    if (closeOffset === -1) break;

    const spanLength = closeOffset + 7; // "<!--" + body + "-->"
    stripped +=
      rest.slice(0, openAt) + newlinesOf(rest.slice(openAt, openAt + spanLength));
    rest = rest.slice(openAt + spanLength);
  }
  return stripped + rest;
}

/**
 * Every external URL a document cites, with the 1-based line carrying it.
 *
 * Three kinds of text are removed first, all of them showing a URL rather than
 * claiming it: HTML comments, fenced code blocks, and inline code spans.
 *
 * @param {string} source raw file content
 * @returns {Array<{ url: string, line: number }>}
 */
export function extractUrls(source) {
  const content = source.replace(/\r/g, "");

  // Blank what a URL may not be read from, KEEPING every line in place, so the
  // comment pass below sees only real prose and the line numbers it reports are
  // still the file's own. scanLines omits fenced content entirely and marks each
  // opening fence, so anything it does not yield is blanked here by absence.
  const byLine = [];
  for (const { line, text, fence } of scanLines(content)) {
    byLine[line] = fence ? "" : text.replace(/`+[^`]+`+/g, "");
  }
  const lineCount = content.split("\n").length;
  const prose = Array.from(
    { length: lineCount },
    (_, index) => byLine[index + 1] ?? "",
  ).join("\n");

  const found = [];
  stripHtmlComments(prose)
    .split("\n")
    .forEach((text, index) => {
      for (const match of text.matchAll(URL_RE)) {
        const url = match[0].replace(TRAILING_PUNCTUATION_RE, "");
        if (url.length > 0) found.push({ url, line: index + 1 });
      }
    });
  return found;
}

/**
 * Markdown files under one root. A file argument is taken as-is when it is
 * Markdown, a directory argument is walked. Dot-directories are included —
 * `.claude/skills/` is exactly where the installed skill copies live — while
 * PRUNED_DIRS are not.
 *
 * A root that does not exist contributes no files rather than failing: the
 * question is "which URLs live under these roots", and an absent root holds none.
 *
 * @param {string} root
 * @returns {Promise<string[]>}
 */
export async function listMarkdownFiles(root) {
  let stats;
  try {
    stats = await stat(root);
  } catch {
    return [];
  }
  if (stats.isFile()) return root.endsWith(".md") ? [root] : [];
  if (!stats.isDirectory()) return [];

  const found = [];
  const pending = [root.length > 1 ? root.replace(/\/+$/, "") : root];

  while (pending.length > 0) {
    const dir = pending.pop();
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue; // an unreadable directory cites nothing
    }
    for (const entry of entries) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!PRUNED_DIRS.has(entry.name)) pending.push(path);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        found.push(path);
      }
    }
  }
  return found.sort();
}

/**
 * Collect every external URL under the given roots, DEDUPLICATED by URL and
 * carrying every site that cites it.
 *
 * Deduplication is what makes the generated `.claude/skills/` copies free: a
 * distributable skill's URL appears in both tiers and is probed once. It is also
 * what makes the RFC-2119 boilerplate — cited by every skill in the tree — one
 * request rather than one per skill.
 *
 * Sites are reported for every occurrence, because the finding a human acts on
 * is "this URL is dead, here is each file that cites it".
 *
 * @param {string[]} roots
 * @returns {Promise<{
 *   urls: Array<{ url: string, sites: string[] }>,
 *   fileCount: number,
 *   siteCount: number,
 * }>} `urls` is sorted by URL, and each `sites` list is sorted, so successive
 *   runs over an unchanged tree produce byte-identical output.
 */
export async function collectUrls(roots) {
  const sites = new Map();
  const files = new Set();

  for (const root of roots) {
    for (const file of await listMarkdownFiles(root)) files.add(file);
  }

  for (const file of [...files].sort()) {
    const source = await readFile(file, "utf8");
    for (const { url, line } of extractUrls(source)) {
      if (!sites.has(url)) sites.set(url, []);
      sites.get(url).push(`${file}:${line}`);
    }
  }

  const urls = [...sites.entries()]
    .map(([url, found]) => ({ url, sites: found.sort() }))
    .sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));

  return {
    urls,
    fileCount: files.size,
    siteCount: urls.reduce((sum, entry) => sum + entry.sites.length, 0),
  };
}
