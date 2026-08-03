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

/** The frontmatter block's body, or `null` when the file carries none. */
function frontmatterBlock(text) {
  return /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? null;
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
  const block = frontmatterBlock(text);
  if (block === null) return null;
  const [description, whenToUse] = DISCOVERY_KEYS.map((key) =>
    frontmatterValue(block, key),
  );
  return { description, whenToUse };
}

/**
 * The three states a skill's `user-invocable` field can be read as.
 *
 * A TRI-STATE, not a boolean, because "the field says something this parser
 * does not understand" is a distinct outcome from either answer — and for the
 * isolation check that consumes this, it is the outcome that must never be
 * mistaken for "invocable". See `readInvocable`.
 */
export const INVOCABLE = "invocable";
export const NOT_INVOCABLE = "not-invocable";
export const UNRECOGNISED = "unrecognised";

const INVOCABLE_KEY = "user-invocable";

/**
 * Whether the key is written at all, judged over the frontmatter block ALONE.
 *
 * Scoping matters: skill bodies in this repository quote frontmatter inside
 * fenced code blocks — the authoring skill's own references do — so testing
 * this against raw file text would read a documentation example as a
 * declaration. `frontmatterValue` never had this exposure because it is only
 * ever handed an extracted block; presence testing reintroduces it unless it is
 * scoped the same way.
 */
const INVOCABLE_KEY_PRESENT = new RegExp(`^${INVOCABLE_KEY}:`, "m");

/**
 * Read one SKILL.md's invocability.
 *
 * PRESENCE FIRST, THEN VALUE, and both halves are load-bearing. Two traps sit
 * on this one predicate, and each was written before it was caught:
 *
 *   1. `frontmatterValue` returns a STRING, always — this repository writes the
 *      field bare and unquoted, so it yields `"false"`, and `"false" !== false`
 *      is `true`. A boolean comparison therefore classifies every skill here as
 *      invocable. Do NOT reintroduce `!== false`.
 *   2. A PRESENT-BUT-EMPTY key (`user-invocable:` with nothing after it) yields
 *      `""` — byte-identical to what an absent key yields. A value-only
 *      predicate maps it to the absent-key default, and it is the one spelling
 *      that also passes `check-skill.mjs`, which checks presence only.
 *
 * An absent key really does mean invocable — that is the observed CLI default,
 * and it is the ONLY state where "nothing to read" is an answer rather than a
 * parse failure. Everything else unrecognised fails LOUD, because the consumer
 * uses `INVOCABLE` to suppress a contamination warning: reading "I could not
 * parse this" as "this one is ours" would silence the alarm this exists to ring.
 *
 * @param {string} text the file's contents
 * @returns {typeof INVOCABLE | typeof NOT_INVOCABLE | typeof UNRECOGNISED}
 */
export function readInvocable(text) {
  const block = frontmatterBlock(text);
  // No frontmatter at all is not a well-formed skill. `corpusDigest` tolerates
  // it — a fingerprint can honestly record two empty strings — but here it is a
  // parse failure, and parse failures go to the loud side.
  if (block === null) return UNRECOGNISED;
  if (!INVOCABLE_KEY_PRESENT.test(block)) return INVOCABLE;

  const value = frontmatterValue(block, INVOCABLE_KEY);
  if (value === "true") return INVOCABLE;
  if (value === "false") return NOT_INVOCABLE;
  return UNRECOGNISED;
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
 * an installed root rather than a second copy of one — and the reason the walk
 * lives in `skillFiles` below rather than in either reader.
 *
 * @param {string} root a directory of skill directories, e.g. `.agents/skills`
 * @yields {{ name: string, text: string }} directory name and raw SKILL.md text,
 *   in name order; a directory holding no readable SKILL.md is skipped
 */
async function* skillFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    // A symlinked entry counts: `.claude/skills` mirrors `.agents/skills`
    // by symlink, and `isDirectory()` is false for one. The SKILL.md
    // test below stats through the link and does the real filtering.
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    let text;
    try {
      text = await readFile(join(root, entry.name, "SKILL.md"), "utf8");
    } catch {
      // Not a skill directory.
      continue;
    }
    yield { name: entry.name, text };
  }
}

/**
 * Digest every skill's discovery text under a skill root, keyed by directory name.
 *
 * A SKILL.md carrying no frontmatter digests as two empty strings rather than
 * being dropped: a skill with no discovery text is a fact about the corpus
 * worth recording, not a reason to omit it from the record.
 *
 * @param {string} root a directory of skill directories, e.g. `.agents/skills`
 * @returns {Promise<Record<string, string>>} skill name → digest, sorted by name
 */
export async function corpusDigest(root) {
  const digests = {};
  for await (const { name, text } of skillFiles(root)) {
    digests[name] = digestDiscoveryText(
      readDiscoveryText(text) ?? { description: "", whenToUse: "" },
    );
  }
  return digests;
}

/**
 * Read every skill's invocability under a skill root, keyed by directory name.
 *
 * Shares `skillFiles` with `corpusDigest` rather than duplicating the traversal,
 * so the two can never disagree about which directories are skills. It stays a
 * SEPARATE function, and `user-invocable` stays out of `DISCOVERY_KEYS`:
 * discovery does not read this field, so folding it into the digest would
 * invalidate every recorded baseline over a value no probe can see.
 *
 * @param {string} root a directory of skill directories, e.g. `.agents/skills`
 * @returns {Promise<Record<string, string>>} skill name → one of the three states
 */
export async function corpusInvocability(root) {
  const states = {};
  for await (const { name, text } of skillFiles(root)) {
    states[name] = readInvocable(text);
  }
  return states;
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
