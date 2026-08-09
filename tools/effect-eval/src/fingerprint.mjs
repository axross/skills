// digesting what a probe ran against, by content.
//
// by content because the instrument this replaced recorded names —
// `mock: "content-site"`, `skills: ["unit-testing"]` — and a skill edited by one
// line between two measurements produced two records nothing could tell apart.
//
// the workspace's HEAD commit looked like a ready-made content key and is not
// one, for four reasons: it covers only committed files, so the installed skill
// (gitignored) falls outside it; it moves without a content change, because a
// commit hash is over the message as well as the tree; it is a function of
// Git's object format rather than of content alone; and its correctness would
// rest on the mock's .gitignore continuing to say what it says today, which is
// a defect this repository has already had and fixed.
//
// so the exclusions below are named here rather than inherited from whatever
// that .gitignore contains.

import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";

/** matched at any depth: a nested `node_modules/` is the same non-content. */
const EXCLUDED_DIRECTORIES = new Set([".git", "node_modules"]);

/**
 * excluded by position rather than by name, so a directory called `skills`
 * elsewhere in the tree is still digested.
 *
 * load-bearing, and the one exclusion worth arguing about: a project
 * fingerprint that covered the installed skills would differ between the
 * skill-absent and skill-present conditions by construction rather than by
 * accident, so the check that proves two probes comparable would always fail.
 * `skillDigests` covers them separately, which is what lets them be compared
 * within a condition and required to be empty in the other.
 */
const EXCLUDED_PATHS = new Set([".claude/skills"]);

const sha256 = (input) => createHash("sha256").update(input).digest("hex");

/**
 * @param {string} root
 * @returns {Promise<string[]>} sorted, so a digest never depends on
 *   directory-read order
 */
export async function digestibleFiles(root) {
  const files = [];

  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(directory, entry.name);
      const rel = relative(root, full).split(sep).join("/");
      if (EXCLUDED_PATHS.has(rel)) continue;
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRECTORIES.has(entry.name)) continue;
        await walk(full);
      } else if (entry.isFile() || entry.isSymbolicLink()) {
        files.push(rel);
      }
    }
  }

  await walk(root);
  return files.sort();
}

/**
 * a content digest over a directory tree.
 *
 * three properties of the digested line are deliberate. the path is in it, so
 * moving a file changes the digest even when every byte is still present
 * somewhere. the mode is in it, reduced to the executable bit because that is
 * the only one Git preserves and so the only one whose change makes this a
 * different tree. and the content is hashed rather than concatenated, so the
 * cost is one pass and constant memory per file however large the tree.
 *
 * @param {string} root
 * @returns {Promise<string>} `sha256:<hex>`
 */
export async function treeDigest(root) {
  const files = await digestibleFiles(root);
  const lines = [];
  for (const path of files) {
    const full = join(root, path);
    const [info, content] = await Promise.all([stat(full), readFile(full)]);
    const mode = info.mode & 0o111 ? "755" : "644";
    lines.push(`${path}\0${mode}\0${sha256(content)}`);
  }
  return `sha256:${sha256(lines.join("\n"))}`;
}

/**
 * a digest per installed skill.
 *
 * per skill rather than one digest over the whole directory, so editing one
 * skill by one byte moves that entry and names it. a combined digest would move
 * for every skill at once and name none of them.
 *
 * @param {string} skillsRoot the workspace's `.claude/skills` directory
 * @returns {Promise<Record<string, string>>} `{}` in the skill-absent condition
 * @throws {Error} when `skillsRoot` cannot be read for any reason but its
 *   absence, or when any skill under it cannot be digested. absence alone is
 *   the skill-absent condition and returns `{}`
 */
export async function skillDigests(skillsRoot) {
  let entries;
  try {
    entries = await readdir(skillsRoot, { withFileTypes: true });
  } catch (error) {
    // no directory at all is the skill-absent condition, not a failure to read.
    if (error.code === "ENOENT") return {};
    throw error;
  }

  const digests = {};
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    digests[entry.name] = await treeDigest(join(skillsRoot, entry.name));
  }
  return digests;
}
