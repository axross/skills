// The trust boundary between a pull request's head and the evaluation workspace.
//
// This evaluation is only worth running against a CHANGED skill — that is the
// regression question it exists to answer. But claude-review.yaml's second
// load-bearing safety property is that untrusted head code never reaches the
// runner, and that property is not being weakened here. The split:
//
//   * EXECUTABLE code always comes from the base-ref checkout. The head is never
//     checked out and `npm install` never runs against head content.
//   * Head SKILL.md text is fetched as DATA and copied into a scratch workspace
//     that the evaluation subprocess reads with no credentials in its
//     environment and only the `Skill` tool enabled.
//
// Skills are prompt content, so allowlisted text does reach a model. The bound
// is what that model can then do, which is nothing: a hostile skill can corrupt
// its own evaluation result and reach nothing else.
//
// The list of changed files is attacker-controlled, so "we only mean skills" is
// an intention, not a bound. This module is the bound.
//
// Only SKILL.md is allowed through — NOT references/*.md. Discovery reads only
// the `description` and `when_to_use` frontmatter keys, so a reference file
// cannot change what this measures and therefore has no reason to cross the
// boundary at all.
//
// The allowed path is the INSTALLED copy (`.agents/skills/…`), not the source
// (`skills/…`), because the installed tree is what an agent actually loads —
// and `.agents/skills` rather than `.claude/skills` because the latter is now a
// tree of SYMLINKS. Git records a symlink as one blob holding its target, so no
// path under `.claude/skills/<name>/` ever appears in a diff; an allowlist
// keyed to it would reject every changed skill, leave `changed.txt` empty, and
// evaluate zero staged skills while reporting a clean run —
// the same tier the evaluation workspace is built from. On a green pull request
// the two agree, since the installed-copy drift check gates exactly that. The
// consequence when they do not: a pull request that edits a skill's source and
// forgets to reinstall is evaluated against the STALE installed text, and the
// report will look unchanged. That is the correct reading of what the agent
// would load, but it is easy to misread as "my edit changed no routing".

import { lstat } from "node:fs/promises";
import { resolve, sep } from "node:path";

import { readDiscoveryText } from "./corpus.mjs";

/**
 * Anything whose NAME looks like a credential is withheld from the evaluation
 * subprocess. A denylist by shape rather than an enumeration of known variables:
 * a runner adds secrets this repository has never heard of, and the safe default
 * for an unrecognised `*_TOKEN` is to drop it.
 */
const CREDENTIAL_RE = /(TOKEN|SECRET|PASSWORD|CREDENTIAL|KEY)/i;

/**
 * The two variables that survive that rule, because the subprocess IS the Claude
 * CLI and cannot authenticate without one of them. Keeping them is safe for the
 * same reason the overlay is: the subprocess runs one turn with only the `Skill`
 * tool, so it has no Bash, no network fetch, and no way to read them back out.
 */
const CLAUDE_AUTH = ["CLAUDE_CODE_OAUTH_TOKEN", "ANTHROPIC_API_KEY"];

/**
 * Build the environment the evaluation subprocess runs with.
 *
 * @param {Record<string, string|undefined>} source usually `process.env`
 * @returns {Record<string, string>}
 */
export function evalEnvironment(source) {
  const env = {};
  for (const [name, value] of Object.entries(source)) {
    if (value === undefined) continue;
    if (CLAUDE_AUTH.includes(name)) {
      env[name] = value;
      continue;
    }
    if (CREDENTIAL_RE.test(name)) continue;
    env[name] = value;
  }
  return env;
}

/** Skill directory names, matching the shape the repository's own checks accept. */
export const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The one head path shape that may be overlaid. */
const ALLOWED_RE = /^\.agents\/skills\/([^/]+)\/SKILL\.md$/;

/**
 * Decide whether one changed head path may be overlaid onto the workspace.
 *
 * Pure path logic — no filesystem access — so every rejection is unit-testable
 * without constructing a hostile repository.
 *
 * @param {string} path a repository-relative path from the head's changed-file list
 * @returns {{ allowed: true, skill: string } | { allowed: false, reason: string }}
 */
export function allowOverlayPath(path) {
  if (typeof path !== "string" || path === "") {
    return { allowed: false, reason: "empty path" };
  }
  // Each of these is already implied by ALLOWED_RE, and each is checked anyway:
  // a specific reason is what makes a rejection reviewable, and defence in depth
  // costs nothing here.
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
    return {
      allowed: false,
      reason: "not a .agents/skills/<name>/SKILL.md path",
    };
  }

  const skill = match[1];
  if (!SKILL_NAME_RE.test(skill)) {
    return { allowed: false, reason: `"${skill}" is not a kebab-case skill name` };
  }
  return { allowed: true, skill };
}

/**
 * Partition a changed-file list into what may be overlaid and what may not.
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
 * Resolve a relative path inside a root, refusing anything that escapes it.
 *
 * The destination is derived from the DIFF PATH and never from a `name:` field
 * inside the head file — a head-controlled name must not be able to steer a
 * filesystem write. This is the last check before that write.
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
    throw new Error(
      `Refusing to write "${relative}": it resolves outside the workspace.`,
    );
  }
  return target;
}

/**
 * Size caps on overlaid content.
 *
 * The allowlist above bounds what a hostile skill can DO. These bound what it
 * can COST. Overlaid discovery text enters the system prompt of every probe in
 * the run — 100 of them in the current fixture, at real money — so a pull
 * request shipping a megabyte `description`, innocently or otherwise, would
 * inflate the bill far past what a maintainer applying the label expects.
 *
 * The frontmatter figure is the cap `check-skill-frontmatter.mjs` already enforces on that
 * field. It is copied rather than imported: that constant is not exported, and
 * exporting it would mean editing a distributable skill's script, which is an
 * authoring change this is not. The coupling is therefore by convention — the
 * same trade `report-obligation-load.mjs` documents for `MANDATED_SKILLS` — and
 * `tests/validators/discovery-eval.test.mjs` reads both sources so the two
 * cannot drift silently.
 *
 * It is measured in BYTES for the same reason `check-skill-frontmatter.mjs` is. A
 * character-counted copy is not the "conservative rather than wrong" failure
 * this comment used to claim: a multi-byte description under 1024 characters
 * but over 1024 bytes would be ACCEPTED here and REJECTED by the merge gate,
 * which is permissive in exactly the wrong direction.
 *
 * There is deliberately no combined `description` + `when_to_use` cap. One used
 * to live here, mirroring a check `check-skill-frontmatter.mjs` no longer has. A cap the
 * merge gate does not enforce refuses a legitimate head file, and the
 * evaluation then silently measures the BASE text for that skill — the
 * reads-like-a-pass failure this tool exists to avoid. `FILE_BYTES_MAX` bounds
 * the cost on its own.
 *
 * `FILE_BYTES_MAX` is a coarser backstop for the body, which discovery never
 * reads but a selected skill does.
 */
export const DESCRIPTION_MAX_BYTES = 1024;
export const FILE_BYTES_MAX = 64 * 1024;

/**
 * Decide whether an overlaid file's CONTENT is within the cost bounds.
 *
 * Over-cap content is refused and reported like an out-of-allowlist path, not
 * treated as a fatal error: the head of an in-progress pull request has not
 * necessarily passed `check-skill-frontmatter.mjs` yet, and the useful behaviour there is to
 * evaluate the base text for that skill and say so — not to abort the run.
 *
 * @param {string} text the head file's contents
 * @returns {{ allowed: true } | { allowed: false, reason: string }}
 */
export function allowOverlayContent(text) {
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes > FILE_BYTES_MAX) {
    return { allowed: false, reason: `file is ${bytes} bytes (max ${FILE_BYTES_MAX})` };
  }

  // Read through corpus.mjs rather than parsed again here: "what discovery
  // reads" is one claim, and the digest that fingerprints a corpus and the cap
  // that bounds an overlay's cost must never disagree about which fields it
  // covers.
  const discovery = readDiscoveryText(text);
  if (discovery === null) {
    return { allowed: false, reason: "no frontmatter block" };
  }

  const { description } = discovery;
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
 * Refuse to write into anything that is not a real directory.
 *
 * `resolveInside` proves a path is TEXTUALLY inside the workspace, but
 * `path.resolve` does not follow symlinks — so a symlinked skill directory
 * would satisfy it while pointing anywhere on disk, and the overlay would write
 * straight through it. That is not hypothetical: the skills CLI installs
 * symlinks back into the source tree unless `--copy` is passed, so a workspace
 * built by copying an installed root can legitimately contain them.
 *
 * The workspace is built with `dereference`, which should mean no symlink ever
 * reaches this point. This is the check that proves it rather than assuming it.
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
