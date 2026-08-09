// the trust boundary between a pull request's head and a bare evaluation
// workspace.
//
// carried over WHOLE from scripts/discovery-eval/overlay.mjs — this is a
// security boundary, and the reasoning below is preserved rather than
// re-derived, per this instrument's own build plan.
//
// this evaluation is only worth running against a CHANGED skill — that is
// the head-evaluation question. but claude-review.yaml's load-bearing safety
// property is that untrusted head code never reaches the runner, and that
// property is not weakened here. the split:
//
//   * EXECUTABLE code always comes from the base-ref checkout. the head is
//     never checked out and nothing installs a dependency from head content.
//   * head SKILL.md text is fetched as DATA and copied into a bare
//     workspace — plan.mjs's `--head-skills` forces bare mode for exactly
//     this reason — that the evaluation subprocess reads with no
//     credentials in its environment and only the `Skill` tool enabled.
//
// skills are prompt content, so allowlisted text does reach a model. the
// bound is what that model can then do, which is nothing: a hostile skill
// can corrupt its own evaluation result and reach nothing else, because a
// bare workspace holds no filesystem worth reading and no shell to reach one.
//
// the list of changed files is attacker-controlled, so "we only mean skills"
// is an intention, not a bound. this module is the bound.
//
// only SKILL.md is allowed through — NOT references/*.md. discovery reads
// only the `description` frontmatter key (fingerprint.mjs), so a reference
// file cannot change what this measures and has no reason to cross the
// boundary at all.
//
// the allowed path is the INSTALLED copy (`.agents/skills/…`), not the
// source (`skills/…`), because the installed tree is what an agent actually
// loads — and `.agents/skills` rather than `.claude/skills` because the
// latter is a tree of SYMLINKS. Git records a symlink as one blob holding its
// target, so no path under `.claude/skills/<name>/` ever appears in a diff;
// an allowlist keyed to it would reject every changed skill and evaluate zero
// staged skills while reporting a clean run. on a green pull request the two
// agree, since the installed-copy drift check gates exactly that.
//
// THE CREDENTIAL FILTER TRAVELS WITH THIS BOUNDARY, THROUGH tools/lib. the
// predecessor this module replaces carried its own `evalEnvironment` —
// stripping anything credential-shaped from the subprocess environment by
// name, with the two Claude auth variables surviving because the subprocess
// IS the Claude CLI. that requirement is the operating system's and the
// CLI's, not either evaluation's, so it now lives once, in
// tools/lib/credentials.mjs, and spawn.mjs's `runProbe` calls
// `stripCredentials` there for every probe — bare, situated, and head alike.
// nothing here re-implements it; this module's own job stays the one thing
// specific to head evaluation: which paths and how much of them may cross
// the boundary at all.

import { lstat } from "node:fs/promises";
import { resolve, sep } from "node:path";

/** skill directory names, matching the shape the repository's own checks accept. */
export const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** the one head path shape that may be overlaid. */
const ALLOWED_RE = /^\.agents\/skills\/([^/]+)\/SKILL\.md$/;

/**
 * decide whether one changed head path may be overlaid onto the workspace.
 *
 * pure path logic — no filesystem access — so every rejection is
 * unit-testable without constructing a hostile repository.
 *
 * @param {string} path a repository-relative path from the head's
 *   changed-file list
 * @returns {{ allowed: true, skill: string } | { allowed: false, reason: string }}
 */
export function allowOverlayPath(path) {
  if (typeof path !== "string" || path === "") {
    return { allowed: false, reason: "empty path" };
  }
  // each of these is already implied by ALLOWED_RE, and each is checked
  // anyway: a specific reason is what makes a rejection reviewable, and
  // defence in depth costs nothing here.
  if (path.startsWith("/")) {
    return { allowed: false, reason: "absolute path" };
  }
  if (path.includes("\\")) {
    return { allowed: false, reason: "backslash in path" };
  }
  if (path.includes("\0")) {
    return { allowed: false, reason: "NUL byte in path" };
  }
  if (path.split("/").includes("..")) {
    return { allowed: false, reason: "parent-directory segment" };
  }

  const match = ALLOWED_RE.exec(path);
  if (!match) {
    return { allowed: false, reason: "not a .agents/skills/<name>/SKILL.md path" };
  }

  const skill = match[1];
  if (!SKILL_NAME_RE.test(skill)) {
    return { allowed: false, reason: `"${skill}" is not a kebab-case skill name` };
  }
  return { allowed: true, skill };
}

/**
 * partition a changed-file list into what may be overlaid and what may not.
 *
 * @param {string[]} paths
 * @returns {{ allowed: Array<{ path: string, skill: string }>, rejected: Array<{ path: string, reason: string }> }}
 */
export function planOverlay(paths) {
  const allowed = [];
  const rejected = [];
  for (const path of paths) {
    const verdict = allowOverlayPath(path);
    if (verdict.allowed) {
      allowed.push({ path, skill: verdict.skill });
    } else {
      rejected.push({ path, reason: verdict.reason });
    }
  }
  return { allowed, rejected };
}

/**
 * resolve a relative path inside a root, refusing anything that escapes it.
 *
 * the destination is derived from the DIFF PATH and never from a `name:`
 * field inside the head file — a head-controlled name must not be able to
 * steer a filesystem write. this is the last check before that write.
 *
 * @param {string} root
 * @param {string} relative
 * @returns {string} absolute path, guaranteed to sit under `root`
 * @throws {Error} when the result would escape `root`
 */
export function resolveInside(root, relative) {
  const rootPath = resolve(root);
  const target = resolve(rootPath, relative);
  if (target !== rootPath && !target.startsWith(rootPath + sep)) {
    throw new Error(`Refusing to write "${relative}": it resolves outside the workspace.`);
  }
  return target;
}

/**
 * size caps on overlaid content.
 *
 * the allowlist above bounds what a hostile skill can DO. these bound what
 * it can COST. overlaid discovery text enters the system prompt of every
 * bare probe in the run, at real money, so a pull request shipping a
 * megabyte `description`, innocently or otherwise, would inflate the bill
 * far past what a maintainer applying the label expects.
 *
 * `DESCRIPTION_MAX_BYTES` is the cap `check-skill-frontmatter.mjs` already
 * enforces on that field, copied rather than imported — that constant is not
 * exported, and importing it would mean reaching into a distributable
 * skill's script for a value this module needs to enforce independently of
 * whether that check has run yet. measured in BYTES for the same reason: a
 * multi-byte description under 1024 characters but over 1024 bytes would be
 * accepted here and rejected by the merge gate, which is permissive in
 * exactly the wrong direction.
 *
 * `FILE_BYTES_MAX` is a coarser backstop for the whole file, which discovery
 * never reads past `description` but which still has to be read off disk and
 * held in memory to get there.
 */
export const DESCRIPTION_MAX_BYTES = 1024;
export const FILE_BYTES_MAX = 64 * 1024;

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
 * decide whether an overlaid file's CONTENT is within the cost bounds.
 *
 * over-cap content is refused and reported like an out-of-allowlist path,
 * not treated as a fatal error: the head of an in-progress pull request has
 * not necessarily passed `check-skill-frontmatter.mjs` yet, and the useful
 * behaviour is to skip that file and say why, not to abort the whole run.
 *
 * @param {string} text the head file's contents
 * @returns {{ allowed: true } | { allowed: false, reason: string }}
 */
export function allowOverlayContent(text) {
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes > FILE_BYTES_MAX) {
    return { allowed: false, reason: `file is ${bytes} bytes (max ${FILE_BYTES_MAX})` };
  }

  const block = frontmatterBlock(text);
  if (block === null) {
    return { allowed: false, reason: "no frontmatter block" };
  }

  const description = frontmatterValue(block, "description");
  const descriptionBytes = Buffer.byteLength(description, "utf8");
  if (descriptionBytes > DESCRIPTION_MAX_BYTES) {
    return {
      allowed: false,
      reason: `description is ${descriptionBytes} bytes (max ${DESCRIPTION_MAX_BYTES})`,
    };
  }
  return { allowed: true };
}

/**
 * refuse to write into anything that is not a real directory.
 *
 * `resolveInside` proves a path is TEXTUALLY inside the workspace, but
 * `path.resolve` does not follow symlinks — so a symlinked skill directory
 * would satisfy it while pointing anywhere on disk, and the overlay would
 * write straight through it. the workspace this instrument builds is
 * populated with `dereference: true` (see spawn.mjs and
 * tools/lib/mock-workspace.mjs's header for why that is load-bearing rather
 * than a detail), which should mean no symlink ever reaches this point —
 * this is the check that proves it rather than assuming it.
 *
 * @param {string} path
 * @throws {Error} when `path` is a symlink, a file, or anything but a directory
 */
export async function assertRealDirectory(path) {
  const stats = await lstat(path);
  if (!stats.isDirectory()) {
    throw new Error(`Refusing to write into "${path}": not a real directory.`);
  }
}
