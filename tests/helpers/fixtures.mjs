// Fixture builders for the validator tests.
//
// Fixtures are written into a per-test temporary directory and removed when the
// test finishes. Nothing is committed: a fixture that intentionally represents
// an INVALID skill must never be discoverable as a real skill, and must stay out
// of reach of `npm run format:check`, `npm run lint`, and the link check the
// suite itself runs. A temp directory achieves that with no ignore-list entry
// anywhere — which matters most for the link check, whose prune list lives
// inside a distributable script that must not learn this repository's paths.
//
// Cleanup is registered with Vitest's `onTestFinished`, so a fixture is torn
// down even when the test that built it fails, and no test needs to thread a
// context object through to get one.

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { onTestFinished } from "vitest";

/**
 * Create a temporary directory removed when the current test finishes.
 * @returns {Promise<string>} absolute path of the directory
 */
export async function tempDir() {
  const dir = await mkdtemp(join(tmpdir(), "skills-validator-test-"));
  onTestFinished(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

/** A frontmatter value that renders a valid, passing skill. */
const DEFAULT_DESCRIPTION =
  "The ability to exercise the structure validator from a test, standing in for a real capability so the frontmatter checks have something well-formed to accept.";
const DEFAULT_WHEN_TO_USE =
  "Apply only inside the validator test suite; this skill exists to give the checks a passing baseline.";

const DEFAULT_BODY = `# Fixture Skill

Body prose for the fixture.

**Guidelines:**

- MUST stay outside the working tree so no real gate ever sees it.
`;

/**
 * Render a SKILL.md. Fields default to a valid skill; pass `null` for a field to
 * omit it, or a string to override it.
 * @param {string} dirName
 * @param {{ frontmatter?: Record<string, string | null>, body?: string }} options
 */
function renderSkill(dirName, { frontmatter = {}, body = DEFAULT_BODY } = {}) {
  const fields = {
    name: dirName,
    description: DEFAULT_DESCRIPTION,
    when_to_use: DEFAULT_WHEN_TO_USE,
    ...frontmatter,
  };
  const rendered = Object.entries(fields)
    .filter(([, value]) => value !== null)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
  return `---\n${rendered}\n---\n\n${body}`;
}

/**
 * Write a skill directory under `root`.
 * @param {string} root directory that will hold the skill directory
 * @param {string} dirName the skill's directory name
 * @param {{
 *   frontmatter?: Record<string, string | null>,
 *   body?: string,
 *   raw?: string,
 *   references?: Record<string, string>,
 * }} [options] `raw` replaces the whole file, bypassing frontmatter rendering
 * @returns {Promise<string>} absolute path of the skill directory
 */
export async function writeSkill(root, dirName, options = {}) {
  const dir = join(root, dirName);
  await mkdir(dir, { recursive: true });
  const content = options.raw ?? renderSkill(dirName, options);
  await writeFile(join(dir, "SKILL.md"), content, "utf8");

  const references = options.references ?? {};
  if (Object.keys(references).length > 0) {
    await mkdir(join(dir, "references"), { recursive: true });
    for (const [file, text] of Object.entries(references)) {
      await writeFile(join(dir, "references", file), text, "utf8");
    }
  }
  return dir;
}

/**
 * Write an arbitrary file, creating parent directories as needed.
 * @param {string} root
 * @param {string} relativePath
 * @param {string} content
 * @returns {Promise<string>} absolute path of the written file
 */
export async function writeFileIn(root, relativePath, content) {
  const path = join(root, relativePath);
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, content, "utf8");
  return path;
}
