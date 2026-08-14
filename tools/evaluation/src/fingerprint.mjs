// the project-tree content digest both readings share: walk a directory,
// hash each file's content, and fold path, executable bit, and content hash
// into one sha256 over the sorted result — so moving a file, or changing
// what it can do, moves the digest even when every other byte in the tree is
// unchanged.
//
// by content, not by name: a record keyed on `mock: "tsuzuri"` or
// `skills: ["unit-testing"]` cannot tell "skill edited by one line" apart
// from "skill unchanged". a workspace's own HEAD commit looked like a
// ready-made content key and is not one, for four reasons: it covers only
// committed files, so an installed (gitignored) skill falls outside it; it
// moves without a content change, because a commit hash is over the message
// as well as the tree; it is a function of Git's object format rather than
// of content alone; and its correctness would rest on a mock's `.gitignore`
// continuing to say what it says today, which is a defect this repository
// has already had and fixed. so the exclusions below are named here rather
// than inherited from whatever a mock's `.gitignore` happens to contain.
//
// each reading builds its OWN further digest on top of this, and
// differently. the effect side calls `treeDigest` again, per installed
// skill, for a digest over that skill's whole tree — a skill-present probe's
// task is affected by anything in the skill it might read once selected.
// discovery never gets that far: only a SKILL.md's `description`
// frontmatter reaches the model before a selection is made, so it reads and
// hashes that one field instead of walking a skill's tree at all. Neither
// reading's own digest lives here — see each reading's own fingerprint.mjs.

import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";

/** matched at any depth: a nested `node_modules/` is the same non-content. */
const EXCLUDED_DIRECTORIES = new Set([".git", "node_modules"]);

/**
 * excluded by position rather than by name, so a directory called `skills`
 * elsewhere in the tree is still digested.
 *
 * load-bearing: a project fingerprint that covered the installed skills
 * would differ between a skill-absent and skill-present probe, or between a
 * situated and bare one, BY CONSTRUCTION rather than by accident — so a
 * check that proves two probes comparable would always fail. each reading
 * digests its installed skills separately, which is what lets them be
 * compared within a condition instead.
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
 * three properties of the digested line are deliberate. the path is in it,
 * so moving a file changes the digest even when every byte is still present
 * somewhere. the mode is in it, reduced to the executable bit because that
 * is the only one Git preserves and so the only one whose change makes this
 * a different tree. and the content is hashed rather than concatenated, so
 * the cost is one pass and constant memory per file however large the tree.
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
