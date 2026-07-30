// The corpus fingerprint: which discovery text a measurement ran against.
//
// baseline.json already refuses to compare across MODELS, because a result is
// not durable when the model changes. It is not durable when the CORPUS changes
// either, and that went unrecorded. Every installed skill goes into the
// evaluation workspace — see run.mjs's buildWorkspace, where installing the
// whole corpus is deliberate — so a skill ADDED, or an existing skill's
// discovery text REWRITTEN, competes for the same selection whether or not the
// fixture names it. Both had already happened on `main` before this module
// existed, and the report attributed the movement to whatever was being
// evaluated.
//
// WHAT IS DIGESTED IS THE COMPLETE DISCOVERY SURFACE, AND ONLY IT.
// `description` and `when_to_use` are the two frontmatter keys discovery reads,
// and DISCOVERY_KEYS below is the only place that claim is written down. It is
// the same premise overlay.mjs records for letting SKILL.md — and never
// references/*.md — cross the head-overlay boundary. Two consequences follow on
// purpose: a skill's BODY can change without invalidating a baseline, because
// the body is what a selected skill costs rather than what selects it; and if a
// future host ever reads a THIRD key for discovery, this digest silently stops
// covering the whole surface until that constant is updated.
//
// A DIGEST, NOT THE TEXT. Storing the discovery text verbatim would give exact
// diffs and make the baseline unreviewable — the corpus runs to some 22,000
// characters, in a file a human is expected to read before committing it.
//
// PER SKILL, NOT ONE DIGEST OVER THE WHOLE CORPUS. A single digest can say
// "something changed" and never which skill, so nothing selective could be
// built on it. Naming the drifted skills is what lets the report MARK the
// comparisons the drift could explain instead of discarding the whole delta,
// which is the difference between a usable harness and one whose baseline is
// stale almost continuously.

import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * The complete set of frontmatter keys skill discovery reads, in digest order.
 *
 * Named here rather than inlined because the digest is only as good as this
 * list: a key discovery reads and this omits is a change the fingerprint cannot
 * see. See this file's header.
 *
 * Extending it is NECESSARY BUT NOT SUFFICIENT. `readDiscoveryText` returns one
 * named field per key and `digestDiscoveryText` joins those fields, so a third
 * key means a third field in both — adding a name here alone would widen the
 * documented claim without widening what is actually digested, which is worse
 * than not touching it.
 */
export const DISCOVERY_KEYS = ["description", "when_to_use"];

/**
 * Hex characters kept from each digest. 48 bits — far past what a corpus of a
 * few dozen skills needs to avoid an accidental collision, and short enough to
 * stay readable in a file a human reviews line by line.
 */
export const DIGEST_LENGTH = 12;

/**
 * The two values are joined by a NUL byte, which cannot occur in either.
 * Without a separator, text MOVED from `description` to `when_to_use` would
 * digest identically — and that move changes what discovery reads.
 */
const SEPARATOR = "\u0000";

const DIGEST_RE = new RegExp(`^[0-9a-f]{${DIGEST_LENGTH}}$`);

/** Whether a value has the shape of a digest this module produces. */
export function isDigest(value) {
  return typeof value === "string" && DIGEST_RE.test(value);
}

/** The value of one frontmatter key, up to the next key or the block's end. */
function frontmatterValue(block, key) {
  const match = new RegExp(
    `^${key}:[ \\t]*([\\s\\S]*?)(?=\\n[A-Za-z_][A-Za-z0-9_]*:|$)`,
    "m",
  ).exec(block);
  return match ? match[1].trim() : "";
}

/**
 * Read one SKILL.md's discovery text.
 *
 * The single owner of "what discovery reads" — overlay.mjs caps the cost of
 * exactly these two fields and calls this rather than parsing them again.
 *
 * @param {string} text the file's contents
 * @returns {{ description: string, whenToUse: string } | null} `null` when the
 *   file carries no frontmatter block at all
 */
export function readDiscoveryText(text) {
  const block = /^---\n([\s\S]*?)\n---/.exec(text)?.[1];
  if (block === undefined) return null;
  const [description, whenToUse] = DISCOVERY_KEYS.map((key) =>
    frontmatterValue(block, key),
  );
  return { description, whenToUse };
}

/**
 * Fingerprint one skill's discovery text.
 *
 * @param {{ description: string, whenToUse: string }} discovery
 * @returns {string} a lowercase hex digest of DIGEST_LENGTH characters
 */
export function digestDiscoveryText({ description, whenToUse }) {
  return createHash("sha256")
    .update(`${description}${SEPARATOR}${whenToUse}`)
    .digest("hex")
    .slice(0, DIGEST_LENGTH);
}

/**
 * Digest every skill under a skill root, keyed by directory name.
 *
 * Its keys are also the corpus's skill list, so this is the ONE enumeration of
 * an installed root rather than a second copy of one.
 *
 * A SKILL.md carrying no frontmatter digests as two empty strings rather than
 * being dropped: a skill with no discovery text is a fact about the corpus
 * worth recording, not a reason to omit it from the record.
 *
 * @param {string} root a directory of skill directories, e.g. `.claude/skills`
 * @returns {Promise<Record<string, string>>} skill name → digest, sorted by name
 */
export async function corpusDigest(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const digests = {};
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    let text;
    try {
      text = await readFile(join(root, entry.name, "SKILL.md"), "utf8");
    } catch {
      // Not a skill directory.
      continue;
    }
    digests[entry.name] = digestDiscoveryText(
      readDiscoveryText(text) ?? { description: "", whenToUse: "" },
    );
  }
  return digests;
}

/**
 * Compare a recorded corpus against the one a run measured.
 *
 * Either side absent means there is nothing to compare — a baseline recorded
 * before this field existed, or a caller that computed no corpus — and that is
 * reported as "not recorded", which is honestly weaker than "no drift".
 *
 * @param {Record<string, string>|null|undefined} recorded from the baseline
 * @param {Record<string, string>|null|undefined} current  from this run
 * @returns {{ recorded: boolean, added: string[], removed: string[], changed: string[], drifted: boolean }}
 */
export function compareCorpus(recorded, current) {
  if (!recorded || !current) {
    return {
      recorded: false,
      added: [],
      removed: [],
      changed: [],
      drifted: false,
    };
  }

  const added = Object.keys(current)
    .filter((name) => !(name in recorded))
    .sort();
  const removed = Object.keys(recorded)
    .filter((name) => !(name in current))
    .sort();
  const changed = Object.keys(recorded)
    .filter((name) => name in current && current[name] !== recorded[name])
    .sort();

  return {
    recorded: true,
    added,
    removed,
    changed,
    drifted: added.length + removed.length + changed.length > 0,
  };
}
