// commonmark.mjs — which lines of a Markdown document are prose, and which only
// show example text. shared by this skill's validators.
//
// two rules live here, and both exist for the same reason: a validator has to be
// able to read a document that shows the very syntax it checks for.
//
// the fenced-block rule (`scanLines`, `unterminatedFenceLine`). the skill-body
// and check-links.mjs must ignore content inside fenced code blocks, so the
// skill-authoring docs can show `[file.md](./references/file.md)` or a
// `- MUST …` bullet as an example without either validator reading it as the
// real thing. that rule lived twice — once here in JavaScript and once as an awk
// program inside check-links.sh — and the two drifted: both used to toggle state
// on any fence-looking line, so an inner ```ts block inverted the state and
// exposed the enclosing block's content as body text.
//
// the prose rule (`extractProse`). fenced blocks, inline code spans, and HTML
// comments all carry text a reader is meant to see and a checker is not meant to
// believe — and the order in which the three are removed decides whether a
// comment opener that is only being quoted gets believed. that rule also lived
// twice, and the two copies also drifted: check-links.mjs stripped comments from
// the raw source and silently discarded 90 lines of this repository's README
// behind such an opener, while scripts/link-freshness/urls.mjs blanked code
// spans first and did not.
//
// one implementation is what keeps either drift from recurring. this module is
// not an executable: it carries no CLI, and is imported by the two scripts
// beside it — which ship together in this skill — and by any repository tooling
// that must read the same corpus the same way.
//
// it is dependency-light (no imports at all) and makes no assumption about what
// a document means — it reports which lines are outside a fence and which text
// is prose, and callers decide what to read from them.

/**
 * a line that opens or closes a fenced block: 3+ backticks or 3+ tildes after
 * optional leading whitespace. group 1 is the marker, group 2 the rest of the
 * line (an info string on an opening fence, blank on a closing one).
 */
export const FENCE_RE = /^[ \t]*(`{3,}|~{3,})(.*)$/;

/** thematic-break syntax at the document margin or within the current list. */
export function isThematicBreak(line, listIndent) {
  const indent = columnWidth(line.match(/^[ \t]*/)[0]);
  return /^[ \t]*(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/.test(line) &&
    (indent <= 3 || (listIndent > 0 && indent >= listIndent && indent <= listIndent + 3));
}

const HTML_BLOCK_RE = /^<(?:\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?=[\s/>]|$)|(?:script|pre|style|textarea)(?=[\s>]|$))/i;

/** HTML-block terminators; comments retain the extractor's last-pass policy. */
export function htmlBlockEnd(content) {
  if (/^<(?:script|pre|style|textarea)(?=[\s>]|$)/i.test(content)) return /<\/(?:script|pre|style|textarea)>/i;
  if (/^<\?/.test(content)) return /\?>/;
  if (/^<!\[CDATA\[/.test(content)) return /\]\]>/;
  if (/^<![A-Z]/.test(content)) return />/;
  return HTML_BLOCK_RE.test(content) ? /^[ \t]*$/ : null;
}

/** block starts without a paragraph that could receive lazy continuation. */
export function closesParagraph(line) {
  const content = line.trimStart();
  return /^(?:#{1,6}(?:[ \t]|$)|(?:>[ \t]*)+$|(?:[-+*]|\d{1,9}[.)])[ \t]*$)/.test(content) ||
    htmlBlockEnd(content) !== null;
}

/** block starts at the margin or inside a list, respecting paragraph laziness. */
export function startsBlock(line, listIndent = 0, paragraphOpen = true) {
  const prefix = line.match(/^[ \t]*/)[0];
  const indent = columnWidth(prefix);
  if (indent > 3 && !(listIndent > 0 && indent >= listIndent && indent <= listIndent + 3)) return false;
  const content = line.slice(prefix.length);
  return /^(?:#{1,6}(?:[ \t]|$)|>|[-+*][ \t]+\S|1[.)][ \t]+\S)/.test(content) ||
    (!paragraphOpen && /^(?:[-+*]|\d{1,9}[.)])(?:[ \t]|$)/.test(content)) ||
    htmlBlockEnd(content) !== null;
}

/**
 * per CommonMark, a fence closes only on a marker of the same character, at
 * least as long as the opener, carrying no info string. that is what lets a
 * longer fence legally contain shorter ones — a ````markdown block wrapping a
 * ```ts block, as this repository's own references do. toggling on any
 * fence-looking line inverts the state inside such a block and exposes its
 * content as body text.
 *
 * @param {RegExpMatchArray | null} marker a FENCE_RE match, or null
 * @param {string} char the open fence's marker character
 * @param {number} length the open fence's marker length
 * @returns {boolean}
 */
export function closesFence(marker, char, length) {
  return (
    marker !== null &&
    marker[1][0] === char &&
    marker[1].length >= length &&
    marker[2].trim() === ""
  );
}

/**
 * walk a document once, tracking fenced blocks.
 *
 * the single state machine behind every export here — `scanLines` and
 * `unterminatedFenceLine` are two views of this one result, so a caller can
 * never observe the two disagreeing about where a fence opened or closed.
 *
 * @param {string} body
 * @returns {{
 *   lines: Array<{ line: number, text: string, fence: boolean }>,
 *   fenceBoundaries: Array<{ line: number, text: string }>,
 *   unterminatedAt: number | null,
 * }} `lines` holds every line outside a fence plus each fence's opening line
 *   marked `fence: true`; `unterminatedAt` is the 1-based line of a fence still
 *   open at end of file, or null.
 */
function scanDocument(body) {
  let fenceChar = null; // open fence's marker character, or null outside a fence
  let fenceLength = 0; // and its length — a closer must be at least this long
  let fenceOpenedAt = 0;
  const lines = [];
  const fenceBoundaries = [];
  const source = body.split("\n");

  for (let index = 0; index < source.length; index += 1) {
    const text = source[index];
    const marker = text.match(FENCE_RE);
    const boundary = marker ? { line: index + 1, text: text.slice(0, text.length - marker[2].length) } : null;
    if (fenceChar !== null) {
      if (closesFence(marker, fenceChar, fenceLength)) {
        fenceChar = null;
        fenceBoundaries.push(boundary);
      }
      continue;
    }
    if (marker) {
      fenceChar = marker[1][0];
      fenceLength = marker[1].length;
      fenceOpenedAt = index + 1;
      lines.push({ line: index + 1, text, fence: true });
      fenceBoundaries.push(boundary);
      continue;
    }
    lines.push({ line: index + 1, text, fence: false });
  }

  return { lines, fenceBoundaries, unterminatedAt: fenceChar === null ? null : fenceOpenedAt };
}

/**
 * every line outside a fenced block, plus each fence's opening line marked
 * `fence: true`, as `{ line, text, fence }`.
 *
 * surfacing the opener is what lets a caller treat a fenced block as content
 * without seeing inside it. the section-intro check needs exactly that: a
 * section whose demonstration is a code block must not read as a heading
 * abutting its `**Guidelines:**` label. callers that only care about prose skip
 * the marked lines.
 *
 * @param {string} body
 */
export function* scanLines(body) {
  yield* scanDocument(body).lines;
}

/**
 * the 1-based line where a fence was opened and never closed, or null when
 * every fence closed.
 *
 * an unterminated fence is legal CommonMark — the block simply runs to the end
 * of the document — so this module states only the fact; how a caller
 * responds to it is that caller's own contract, not a rule handed down here.
 * check-links.mjs treats it as a WARN, because the links it did see before
 * the opener still answer its question. check-skill-body.mjs treats the same
 * signal as a failure, because its own checks cannot see past the fence and
 * would otherwise report a false PASS. Either way, everything after that
 * opener went unread.
 *
 * @param {string} body
 * @returns {number | null}
 */
export function unterminatedFenceLine(body) {
  return scanDocument(body).unterminatedAt;
}

/**
 * inline code uses maximal, equal-length backtick strings. differing runs can
 * occur inside the span; unmatched strings remain literal prose.
 */
const CODE_SPAN_RE = /(?<!`)(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)/g;

/** blank inline examples without hiding unmatched literal backtick strings. */
export function stripCodeSpans(text) {
  return text.replace(CODE_SPAN_RE, newlinesOf);
}

/** the width of source indentation or list-marker padding in tab-stop columns. */
export function columnWidth(prefix) {
  return [...prefix].reduce(
    (column, character) => column + (character === "\t" ? 4 - column % 4 : 1),
    0,
  );
}

/**
 * a string of just the newlines in `text`, so a removed span leaves the lines
 * after it at their original numbers.
 *
 * @param {string} text
 * @returns {string}
 */
function newlinesOf(text) {
  return "\n".repeat((text.match(/\n/g) ?? []).length);
}

/**
 * drop every HTML comment, replacing each span with its own newlines.
 *
 * a dangling unclosed `<!--` is kept as content. it comments out the rest of a
 * rendered document, but honouring it here would silently stop reading at that
 * point — the failure mode that looks like a clean result rather than like a
 * failure.
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
    stripped += rest.slice(0, openAt) + newlinesOf(rest.slice(openAt, openAt + spanLength));
    rest = rest.slice(openAt + spanLength);
  }
  return stripped + rest;
}

/**
 * a document with everything that only shows text blanked out — fenced blocks,
 * inline code spans, and HTML comments — every line left in place, so line N of
 * the result is line N of the source.
 *
 * the order is the point here, and getting it backwards fails silently rather
 * than loudly. comments are stripped last, from text whose fences and code
 * spans are already blank, so a `<!--` has to be real prose to open one.
 * stripped first, from the raw source, an opener that is only being quoted is
 * believed and everything up to the next `-->` disappears: this repository's
 * own README documents the `count:` marker rule with the sentence "a line
 * beginning with `<!--` is an HTML block in CommonMark", and reading that raw
 * discarded the 90 lines after it, links and all, while every check over them
 * still reported clean.
 *
 * the limit that order accepts: a real comment whose closing `-->` sits inside a
 * fenced block loses that closer to the blanking pass, so the comment reads as
 * dangling and its body survives as content. strictly, CommonMark parses neither
 * construct that way — an HTML comment's contents are not Markdown at all — and
 * only a single interleaved pass gets both right. that is deliberately not built
 * here: it changes behavior only for a shape no document in this corpus has, and
 * this failure leaks text into the checks rather than hiding it from them, which
 * is the direction worth failing in.
 *
 * @param {string} body raw file content; `\r` is normalised away here so no
 *   caller has to remember to
 * @param {{ preserveFenceBoundaries?: boolean }} [options] keep actual opening
 *   and closing markers with their indentation for block-boundary checks; info
 *   strings, fenced content and HTML comments remain blanked.
 * @returns {{
 *   lines: Array<{ line: number, text: string }>,
 *   unterminatedFenceAt: number | null,
 * }} `lines` holds one entry per source line, numbered from 1;
 *   `unterminatedFenceAt` is the 1-based line of a fence still open at end of
 *   file, or null. both come from a single walk, so a caller can never observe
 *   the two disagreeing.
 */
export function extractProse(body, { preserveFenceBoundaries = false } = {}) {
  const source = body.replace(/\r/g, "");
  const { lines, fenceBoundaries, unterminatedAt } = scanDocument(source);

  const byLine = [];
  let paragraph = [];
  let listIndent = 0;
  let htmlEnd = null;
  const flush = () => {
    const prose = stripCodeSpans(paragraph.map(({ text }) => text).join("\n")).split("\n");
    paragraph.forEach(({ line }, index) => { byLine[line] = prose[index]; });
    paragraph = [];
  };

  for (const { line, text, fence } of lines) {
    const previous = paragraph.at(-1);
    const quote = text.match(/^(?: {0,3}>[ \t]?)+/)?.[0] ?? "";
    const previousQuote = paragraph[0]?.text.match(/^(?: {0,3}>[ \t]?)+/)?.[0] ?? "";
    const content = text.slice(quote.length);
    if (!htmlEnd && !fence && startsBlock(content, listIndent, paragraph.length > 0)) htmlEnd = htmlBlockEnd(content.trimStart());
    if (htmlEnd) {
      flush();
      byLine[line] = text;
      if (htmlEnd.test(content)) htmlEnd = null;
      continue;
    }
    const bullet = content.match(/^([ \t]*(?:[-+*]|\d{1,9}[.)]))([ \t]+|$)(.*)$/);
    const itemIndent = columnWidth(content.match(/^[ \t]*/)[0]);
    const newItem = bullet && listIndent > 0 && itemIndent < listIndent;
    const boundary = startsBlock(content, listIndent, paragraph.length > 0) || newItem ||
      (quote && quote.replace(/[^>]/g, "").length !== previousQuote.replace(/[^>]/g, "").length);
    const heading = /^[ \t]*#{1,6}(?:[ \t]|$)/.test(content) && startsBlock(content, listIndent);
    const thematic = isThematicBreak(content, listIndent);
    const setext = paragraph.length > 0 && /^ {0,3}(?:=+|-+)[ \t]*$/.test(content);
    if (fence || content.trim() === "" || (previous && line !== previous.line + 1) || boundary || thematic || setext) flush();
    if (fence) continue;
    if (content.trim() === "") {
      byLine[line] = text;
      continue;
    }
    if (thematic || setext) {
      byLine[line] = text;
      continue;
    }

    if (bullet && paragraph.length === 0) {
      const markerWidth = columnWidth(bullet[1]);
      const padding = columnWidth(bullet[1] + bullet[2]) - markerWidth;
      listIndent = markerWidth + (padding > 4 ? 1 : padding);
    }
    paragraph.push({ line, text });
    if (heading) flush();
  }
  flush();
  if (preserveFenceBoundaries) {
    for (const { line, text } of fenceBoundaries) byLine[line] = text;
  }

  const lineCount = source.split("\n").length;
  const blanked = Array.from(
    { length: lineCount },
    (_, index) => byLine[index + 1] ?? "",
  ).join("\n");

  return {
    lines: stripHtmlComments(blanked)
      .split("\n")
      .map((text, index) => ({ line: index + 1, text })),
    unterminatedFenceAt: unterminatedAt,
  };
}
