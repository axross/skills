#!/usr/bin/env node
// The document-body rules, across a skill's SKILL.md and every reference.
//
// Run it after editing prose. What it judges is the shape of the writing — a
// section that states rules before demonstrating anything, a guideline bullet
// that does not open with an RFC-2119 keyword, and the advisories around
// length, placement, style, hedging, and uncited version claims.
//
// It reads every document a skill has, which is what makes it the slowest of
// the three; the frontmatter command exists partly so that cost is not paid
// when only the frontmatter changed.

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { FENCE_RE, scanLines } from "./commonmark.mjs";
import { GUIDELINES_RE, RFC2119_RE, scanGuidelines } from "./guidelines.mjs";
import {
  runCli,
  siblingHelp,
  skillDocuments,
  splitFrontmatter,
} from "./skill-documents.mjs";
import {
  BYTES_PER_TOKEN,
  estimateTokens,
  PROXY_UNCERTAINTY,
} from "./token-estimate.mjs";

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

/** The body findings for one skill directory. */
async function check(dir) {
  const failures = [];
  const warnings = [];

  let raw;
  try {
    raw = await readFile(join(dir, "SKILL.md"), "utf8");
  } catch (error) {
    return { failures: [`SKILL.md is unreadable: ${error.message}`], warnings };
  }

  const size = skillSizeWarning(raw);
  if (size) warnings.push(size);

  const { body, offset } = splitFrontmatter(raw);
  const { documents } = await skillDocuments(dir, body, offset);

  for (const { file, body: text, offset: at } of documents) {
    failures.push(...sectionIntroFailures(text, file, at));
    failures.push(...guidelineKeywordFailures(text, file, at));
    warnings.push(...guidelineStructureWarnings(text, file, at));
    warnings.push(...staleStyleWarnings(text, file, at));
    warnings.push(...citationWarnings(text, file, at));
  }

  return { failures, warnings };
}

const USAGE = `Usage: check-skill-body.mjs <skill-dir | skill-root> [more paths…]

Check the document-body rules across a skill's SKILL.md and every
references/*.md: a section that states requirements with nothing demonstrating
the topic first, and a guidelines bullet that does not open with an RFC-2119
keyword. Advisories cover size, section length, bullet placement, stale label
and fence style, hedging, and a version claim with nothing to check it against.
Run it after editing prose.

A <path> is either a skill directory (one holding SKILL.md) or a directory whose
immediate subdirectories are skills. A symlinked entry is followed.

Exit codes: 0 all skills passed, 1 one or more failed, 2 bad invocation.
Advisory WARN lines never affect the exit code.
${siblingHelp("check-skill-body.mjs")}`;

await runCli({ usage: USAGE, check });
