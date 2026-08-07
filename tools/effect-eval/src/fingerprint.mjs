// fingerprint.mjs — digesting what a probe actually ran against, by content.
//
// WHY A DIGEST AND NOT A NAME. The instrument this replaces recorded
// `mock: "content-site"` and `skills: ["unit-testing"]`. A skill edited by one
// line between two measurements is a different treatment, and a record keyed on
// names cannot tell the two apart — so two records that must not be compared
// look identical to anything reading them.
//
// WHY NOT THE WORKSPACE'S HEAD COMMIT, WHICH WAS THE OBVIOUS CANDIDATE. A
// materialized workspace has a reproducible Git history, so its HEAD looked
// like a ready-made content key. It is not one, for four reasons:
//   * it covers only committed files, and `node_modules/` and `.claude/skills/`
//     are both gitignored — so the installed skill, which IS the treatment,
//     falls outside it;
//   * it moves without a content change, because a commit hash is over the tree
//     AND the message, so editing a commit message in history.jsonc moves HEAD
//     while the model sees identical bytes;
//   * it is a function of Git's object format rather than of content alone;
//   * its correctness would rest on the mock's .gitignore continuing to say
//     what it says today, and that line going missing is not hypothetical — it
//     is a defect this repository has already had and fixed.
//
// SO THE EXCLUSIONS HERE ARE EXPLICIT. `.git/`, `.claude/skills/`, and
// `node_modules/` are named in this file rather than inherited from whatever
// the mock's .gitignore happens to contain. `.claude/skills/` is excluded from
// the PROJECT digest deliberately and load-bearingly: a project fingerprint
// that included the installed skills would differ between the skill-absent and
// skill-present conditions by construction, which would make the one check
// that proves two probes are comparable always fail. The skills are digested
// separately, by `skillDigests`, precisely so they can be compared WITHIN a
// condition and required to be empty in the other.

import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";

/**
 * Directory names never digested, wherever they appear in the walk.
 *
 * See this module's header. These are matched by name at any depth rather than
 * only at the root, because a nested `node_modules/` is the same non-content it
 * is at the top.
 */
const EXCLUDED_DIRECTORIES = new Set([".git", "node_modules"]);

/** The one path excluded by position rather than by name — see the header. */
const EXCLUDED_PATHS = new Set([".claude/skills"]);

const sha256 = (input) => createHash("sha256").update(input).digest("hex");

/**
 * Every file under `root` as a POSIX-relative path, with the exclusions above
 * applied, sorted so the digest does not depend on directory-read order.
 *
 * @param {string} root
 * @returns {Promise<string[]>}
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
 * A content digest over a directory tree.
 *
 * The digested text is one `path\0mode\0sha256(content)` line per file, sorted
 * by path. Three properties are deliberate:
 *   * PATH is included, so moving a file changes the digest even when every
 *     byte in the tree is still present somewhere;
 *   * MODE is included — reduced to whether the file is executable, which is
 *     the only bit Git itself preserves and the only one that changes how a
 *     tree behaves — so a script losing its executable bit is a different tree;
 *   * CONTENT is hashed rather than concatenated, so the digest costs one pass
 *     and a constant amount of memory per file regardless of the tree's size.
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
    // eslint-disable-next-line no-bitwise -- the executable bit is the only mode Git preserves
    const mode = info.mode & 0o111 ? "755" : "644";
    lines.push(`${path}\0${mode}\0${sha256(content)}`);
  }
  return `sha256:${sha256(lines.join("\n"))}`;
}

/**
 * A digest per installed skill, keyed by skill name.
 *
 * Each skill is digested as its own tree, NOT as one digest over the whole
 * `.claude/skills/` directory. That is what makes the acceptance criterion
 * "editing one installed skill by one byte changes that skill's digest and no
 * other entry in the map" true: one combined digest would move for every skill
 * at once and name none of them.
 *
 * @param {string} skillsRoot the workspace's `.claude/skills` directory
 * @returns {Promise<Record<string, string>>} `{}` in the skill-absent condition
 */
export async function skillDigests(skillsRoot) {
  let entries;
  try {
    entries = await readdir(skillsRoot, { withFileTypes: true });
  } catch (error) {
    // No skills directory at all IS the skill-absent condition, not a failure.
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
