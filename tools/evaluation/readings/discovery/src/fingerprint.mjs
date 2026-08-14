// digesting what a discovery probe ran against: the project tree it was
// situated in (the shared `treeDigest`, imported rather than reimplemented —
// see tools/evaluation/src/fingerprint.mjs) and — separately — each
// installed skill's `description`.
//
// THE SKILL DIGEST DOES NOT REUSE `treeDigest`. The effect side digests a
// skill's whole installed tree, because a skill-present probe's task is
// affected by anything in the skill it might read once selected. Discovery
// never gets that far: only `description` reaches the model before a
// selection is made, `when_to_use` having retired for good (see this
// repository's own CLAUDE.md and AGENTS.md — no skill here carries it, and
// the byte cap `check-skill-frontmatter.mjs` enforces is on `description`
// alone). A digest over the whole file would invalidate a discovery
// measurement on a body-only edit that could not have moved what was
// measured, so this module reads and hashes `description` and nothing else.
//
// each digest is per skill, not one over the whole corpus, so editing one
// skill's description by one byte moves that entry and names it — the same
// reasoning the shared fingerprint module gives for a per-skill digest, and
// the same shape the instrument this one replaces used.

import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const sha256 = (input) => createHash("sha256").update(input).digest("hex");

/** the frontmatter block's body, or `null` when the file carries none. */
function frontmatterBlock(text) {
  return /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? null;
}

/** the value of one frontmatter key, up to the next key or the block's end. */
function frontmatterValue(block, key) {
  const match = new RegExp(`^${key}:[ \\t]*([\\s\\S]*?)(?=\\n[A-Za-z_][A-Za-z0-9_-]*:|$)`, "m").exec(
    block,
  );
  return match ? match[1].trim() : "";
}

/**
 * read one SKILL.md's `description` — the one frontmatter field discovery
 * reads.
 *
 * @param {string} text the file's contents
 * @returns {string|null} `null` when the file carries no frontmatter block at all
 */
export function readDescription(text) {
  const block = frontmatterBlock(text);
  if (block === null) return null;
  return frontmatterValue(block, "description");
}

/**
 * @param {string} description
 * @returns {string} `sha256:<hex>`, matching the project tree digest's shape
 */
export function digestDescription(description) {
  return `sha256:${sha256(description)}`;
}

/**
 * every skill directory under a skill root, real or symlinked.
 *
 * a symlinked entry counts: `.claude/skills` mirrors `.agents/skills` by
 * symlink, and `Dirent.isDirectory()` is false for one — this repository's
 * own README calls that out as a repository gotcha ("a symlinked skill root
 * is invisible to a naive directory walk"). the SKILL.md read below stats
 * through the link and does the real filtering, exactly as
 * the replaced instrument's own skill walk did.
 *
 * @param {string} root a directory of skill directories
 * @yields {{ name: string, text: string }} in name order; a directory
 *   holding no readable SKILL.md is skipped
 */
async function* skillFiles(root) {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    let text;
    try {
      text = await readFile(join(root, entry.name, "SKILL.md"), "utf8");
    } catch {
      continue; // not a skill directory
    }
    yield { name: entry.name, text };
  }
}

/**
 * digest every installed skill's `description`, keyed by directory name.
 *
 * its keys double as the corpus's skill-name list — the one enumeration a
 * caller needs to know which skills a workspace should install, so nothing
 * else in this instrument re-lists a skill root by hand.
 *
 * @param {string} skillsRoot e.g. a workspace's `.claude/skills`, or this
 *   repository's own
 * @returns {Promise<Record<string, string>>} `{}` when the root does not exist
 */
export async function descriptionDigests(skillsRoot) {
  const digests = {};
  for await (const { name, text } of skillFiles(skillsRoot)) {
    digests[name] = digestDescription(readDescription(text) ?? "");
  }
  return digests;
}

/**
 * the three states a skill's `user-invocable` field can be read as — needed
 * by isolation.mjs to tell "one of ours" from "wearing our name" from
 * "genuinely foreign" among the skills the CLI reports loading.
 *
 * a tri-state, not a boolean, because "unrecognised" must never be mistaken
 * for "invocable" — see readInvocable below, ported unchanged in behaviour
 * from the instrument this one replaces.
 */
export const INVOCABLE = "invocable";
export const NOT_INVOCABLE = "not-invocable";
export const UNRECOGNISED = "unrecognised";

const INVOCABLE_KEY = "user-invocable";
const INVOCABLE_KEY_PRESENT = new RegExp(`^${INVOCABLE_KEY}:`, "m");

/**
 * read one SKILL.md's invocability.
 *
 * presence first, then value: `frontmatterValue` returns a string always, so
 * a boolean comparison (`!== false`) would classify every skill here as
 * invocable, since the field is written bare and unquoted. an absent key
 * really does mean invocable — the observed CLI default — and everything
 * else unrecognised fails loud, because `isolation.mjs` uses `INVOCABLE` to
 * suppress a contamination classification and must never read a parse
 * failure as "this one is ours".
 *
 * @param {string} text the file's contents
 * @returns {typeof INVOCABLE | typeof NOT_INVOCABLE | typeof UNRECOGNISED}
 */
export function readInvocable(text) {
  const block = frontmatterBlock(text);
  if (block === null) return UNRECOGNISED;
  if (!INVOCABLE_KEY_PRESENT.test(block)) return INVOCABLE;

  const value = frontmatterValue(block, INVOCABLE_KEY);
  if (value === "true") return INVOCABLE;
  if (value === "false") return NOT_INVOCABLE;
  return UNRECOGNISED;
}

/**
 * read every installed skill's invocability, keyed by directory name.
 *
 * shares `skillFiles` with `descriptionDigests` so the two can never disagree
 * about which directories are skills.
 *
 * @param {string} skillsRoot
 * @returns {Promise<Record<string, string>>}
 */
export async function corpusInvocability(skillsRoot) {
  const states = {};
  for await (const { name, text } of skillFiles(skillsRoot)) {
    states[name] = readInvocable(text);
  }
  return states;
}
