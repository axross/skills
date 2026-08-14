// digesting what a probe ran against, by content, on the effect side's own
// terms: a digest per installed skill, over that skill's WHOLE tree — a
// skill-present probe's task is affected by anything in the skill it might
// read once selected, unlike discovery's read of `description` alone (see
// the discovery reading's own fingerprint.mjs). the project-tree digest
// itself — the walk, the hashing, the exclusions — is shared; see
// tools/evaluation/src/fingerprint.mjs.

import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { treeDigest } from "../../../src/fingerprint.mjs";

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
