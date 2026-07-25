#!/usr/bin/env node
// check-skill.mjs — structure validator for agentskills.io skills.
//
// Mechanically checks the parts of a skill an audit would otherwise eyeball:
// the discovery contract in frontmatter, the directory/name match, the
// description length caps, reference-file linkage (no orphans), and the parent
// routing-section format. It complements check-links.sh (repo-wide Markdown
// link integrity) by adding the frontmatter and orphan-reference checks that
// link-checking alone cannot see.
//
// It is dependency-light (Node standard library only) and host-agnostic: the
// spec-required rules (name, description) always apply; the Claude-Code
// discovery fields (when_to_use, user-invocable) are checked only when present,
// so the validator stays useful on hosts that do not define them. It is a
// starting point to adapt per project, not a fixed contract.
//
// Usage:
//   node check-skill.mjs <path> [<path> ...]
//     <path>  a skill directory (one holding SKILL.md), OR a directory whose
//             immediate subdirectories are skills (e.g. the skill root). A shell
//             glob such as `.claude/skills/*` expands to the former.
//
// Exit codes:
//   0  every checked skill passed
//   1  one or more checks failed (each failure is listed per skill)
//   2  bad invocation, or a path that holds no SKILL.md and no skill subdirs
//
// Frontmatter parsing is intentionally minimal: it reads the leading `---`
// block and single-line `key: value` scalars, which is all a skill's discovery
// metadata uses. It does not implement full YAML.

import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const RFC2119_RE =
  /^(MUST NOT|MUST|SHOULD NOT|SHOULD|NOT RECOMMENDED|RECOMMENDED|REQUIRED|OPTIONAL|MAY)\b/;
const NAME_MAX = 64;
const DESCRIPTION_MAX = 1024;
const COMBINED_MAX = 1536;

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
 * { fields: Record<string,string> | null, body: string }; fields is null when
 * the leading `---` block is missing or unterminated.
 */
function splitFrontmatter(text) {
  const norm = text.replace(/\r\n/g, "\n");
  if (!norm.startsWith("---\n")) return { fields: null, body: norm };
  const close = norm.indexOf("\n---", 4);
  if (close === -1) return { fields: null, body: norm };

  const block = norm.slice(4, close + 1);
  const afterClose = norm.indexOf("\n", close + 1);
  const body = afterClose === -1 ? "" : norm.slice(afterClose + 1);

  const fields = {};
  for (const line of block.split("\n")) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s?(.*)$/);
    if (match) fields[match[1]] = match[2];
  }
  return { fields, body };
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
  let inFence = false;

  for (const line of body.split("\n")) {
    if (/^[ \t]*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

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

/** Run every structural check for one skill directory; returns failure strings. */
async function checkSkill(dir) {
  const failures = [];
  const dirName = basename(dir);

  let raw;
  try {
    raw = await readFile(join(dir, "SKILL.md"), "utf8");
  } catch (error) {
    return [`SKILL.md is unreadable: ${error.message}`];
  }

  const { fields, body } = splitFrontmatter(raw);
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
    }

    const description = fields.description;
    if (!description) {
      failures.push("frontmatter: `description` is missing or empty.");
    } else if (description.length > DESCRIPTION_MAX) {
      failures.push(`frontmatter: \`description\` is ${description.length} chars (max ${DESCRIPTION_MAX}).`);
    }

    if (fields.when_to_use && description) {
      const combined = description.length + fields.when_to_use.length;
      if (combined > COMBINED_MAX) {
        failures.push(`frontmatter: \`description\` + \`when_to_use\` is ${combined} chars (max ${COMBINED_MAX}).`);
      }
    }
  }

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
  return failures;
}

async function main() {
  const paths = process.argv.slice(2);
  if (paths.length === 0) {
    fail2("Usage: check-skill.mjs <skill-dir | skill-root> [more paths…]");
  }

  const skills = await resolveSkillDirs(paths);
  if (skills.length === 0) fail2("No skills found to check.");
  skills.sort();

  const lines = [];
  let failedCount = 0;
  for (const dir of skills) {
    const failures = await checkSkill(dir);
    if (failures.length === 0) {
      lines.push(`PASS  ${dir}`);
    } else {
      failedCount += 1;
      lines.push(`FAIL  ${dir}`);
      for (const failure of failures) lines.push(`        - ${failure}`);
    }
  }

  lines.push("");
  lines.push(
    failedCount === 0
      ? `All ${skills.length} skill(s) passed structural checks.`
      : `${failedCount} of ${skills.length} skill(s) failed structural checks.`,
  );
  process.stdout.write(`${lines.join("\n")}\n`);
  process.exit(failedCount === 0 ? 0 : 1);
}

main();
