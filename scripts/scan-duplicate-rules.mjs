#!/usr/bin/env node
// Reports pairs of RFC-2119 guideline bullets, in *different* skills, whose
// content-word sets overlap above a Jaccard threshold — the measurement behind
// the cross-skill duplication remediation in issue #174.
//
// It reports similarity, never a verdict. A high score means two skills state
// something close enough that the copies can drift apart unnoticed; whether
// that is a defect, a sanctioned Portable Source Exception, or two skills
// deliberately holding independent rules is a judgment a human or a reviewer
// makes. Committed so the next review re-derives the list instead of trusting
// a table someone typed once.
//
// Like the other two scripts under this directory, it reports and never gates:
// it defines no threshold of acceptability and exits 0 on every valid run.
//
// Usage: node scripts/scan-duplicate-rules.mjs [skillsRoot] [threshold]

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.argv[2] ?? "skills";
const THRESHOLD = Number(process.argv[3] ?? 0.62);

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(
    [
      "Usage: node scripts/scan-duplicate-rules.mjs [skillsRoot] [threshold]",
      "",
      "  skillsRoot  directory of skill sources to scan (default: skills)",
      "  threshold   minimum Jaccard similarity to report (default: 0.62)",
      "",
      "Reports cross-skill guideline-bullet pairs above the threshold.",
      "Always exits 0 — it measures, it does not judge.",
    ].join("\n"),
  );
  process.exit(0);
}

// Common words carry no signal about what a rule *says*, so they would inflate
// every pair's overlap toward a floor that hides the real duplicates.
const STOPWORDS = new Set(
  `a an the and or but not no nor so as at by for from in into of on onto to with without
   is are was were be been being am do does did doing have has had having
   it its this that these those there here they them their he she his her him you your
   when while where which who whom what whose how why if then than because since
   must should may shall will would can could might rather instead also both either each
   one two other another same such only just even own per via up down out over under
   more most less least very much many any all some none than about after before between
   during through against above below off again further once now`
    .split(/\s+/)
    .filter(Boolean),
);

/** Every Markdown file beneath `dir`, recursively. */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".md")) out.push(full);
  }
  return out;
}

// A fenced example may legitimately repeat a neighbour's wording, so scanning
// inside fences reports pairs no one should act on.
function stripFences(lines) {
  let inFence = false;
  return lines.map((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return "";
    }
    return inFence ? "" : line;
  });
}

/** A bullet's content words: link text without targets, code spans dropped. */
function normalize(text) {
  const words = text
    .toLowerCase()
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`[^`]*`/g, " ") // code spans carry vendor identifiers, not meaning
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  return new Set(words);
}

function jaccard(a, b) {
  let shared = 0;
  for (const w of a) if (b.has(w)) shared += 1;
  return shared / (a.size + b.size - shared);
}

const bullets = [];
for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file);
  const skill = rel.split(sep)[0];
  const lines = stripFences(readFileSync(file, "utf8").split("\n"));
  lines.forEach((line, i) => {
    const m = /^\s*-\s+(MUST NOT|MUST|SHOULD NOT|SHOULD|MAY)\b(.*)$/.exec(line);
    if (!m) return;
    const words = normalize(m[2]);
    // A bullet this short cannot produce a meaningful overlap ratio.
    if (words.size < 4) return;
    bullets.push({
      skill,
      loc: `${relative(process.cwd(), file)}:${i + 1}`,
      text: `- ${m[1]}${m[2]}`.trim(),
      words,
    });
  });
}

const pairs = [];
for (let i = 0; i < bullets.length; i += 1) {
  for (let j = i + 1; j < bullets.length; j += 1) {
    if (bullets[i].skill === bullets[j].skill) continue;
    const score = jaccard(bullets[i].words, bullets[j].words);
    if (score >= THRESHOLD) pairs.push({ score, a: bullets[i], b: bullets[j] });
  }
}
pairs.sort((x, y) => y.score - x.score);

console.log(
  `${bullets.length} guideline bullets across ${new Set(bullets.map((b) => b.skill)).size} skills; ` +
    `${pairs.length} cross-skill pairs at Jaccard >= ${THRESHOLD}\n`,
);
for (const { score, a, b } of pairs) {
  console.log(`${score.toFixed(2)}  ${a.skill} <-> ${b.skill}`);
  console.log(`      ${a.loc}\n        ${a.text}`);
  console.log(`      ${b.loc}\n        ${b.text}\n`);
}
