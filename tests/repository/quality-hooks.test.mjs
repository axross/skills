// actual shell-hook contracts against disposable projects and the installed
// toolchain; fixture execution does not claim a live Claude or Codex session.

import { spawnSync } from "node:child_process";
import {
  chmod,
  copyFile,
  mkdir,
  readFile,
  symlink,
  lstat,
} from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { tempDir, writeFileIn } from "../helpers/fixtures.mjs";
import { repoPath } from "../helpers/run.mjs";

const DIRTY =
  "---\nvalue:   [one,two]\n---\n\n# Heading\n\nThis has ** spaced emphasis **.\n";
const LINT_REPAIRED =
  "---\nvalue:   [one,two]\n---\n\n# Heading\n\nThis has **spaced emphasis**.\n";
const REPAIRED =
  "---\nvalue: [one, two]\n---\n\n# Heading\n\nThis has **spaced emphasis**.\n";

/**
 * create an isolated project with the real command/configuration boundary.
 * @throws {Error} when temporary-project setup fails
 */
async function fixture() {
  const base = await tempDir();
  const root = join(base, "repo");
  await mkdir(root);
  for (const name of [
    "package.json",
    ".prettierrc.json",
    ".prettierignore",
    ".markdownlint-cli2.jsonc",
    ".gitignore",
  ]) {
    await copyFile(repoPath(name), join(root, name));
  }
  await symlink(repoPath("node_modules"), join(root, "node_modules"));
  return root;
}

/**
 * invoke the public shell entry point with a Claude-shaped stdin payload.
 * @throws {Error} when the subprocess cannot start
 */
function runHook(name, root, filePath, { input, env = {} } = {}) {
  const result = spawnSync("bash", [repoPath(".claude/hooks", name)], {
    cwd: root,
    env: { ...process.env, CLAUDE_PROJECT_DIR: root, ...env },
    input: input ?? JSON.stringify({ tool_input: { file_path: filePath } }),
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  return result;
}

/**
 * run local fixture-only Git operations, failing with their actual output.
 * @throws {Error} when a fixture Git command fails
 */
function git(root, ...args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
  }
  return result.stdout.trim();
}

/**
 * prepare the actual Stop dependencies and a clean local Git baseline.
 * @throws {Error} when fixture setup or a Git command fails
 */
async function stopFixture() {
  const root = await fixture();
  const scripts = "skills/agent-skill-authoring/scripts";
  await mkdir(join(root, scripts), { recursive: true });
  for (const name of ["check-links.mjs", "commonmark.mjs"]) {
    await copyFile(repoPath(scripts, name), join(root, scripts, name));
  }
  git(root, "init", "-b", "main");
  git(root, "config", "user.name", "Hook fixture");
  git(root, "config", "user.email", "fixture@example.invalid");
  git(root, "add", ".");
  git(root, "commit", "-m", "fixture baseline");
  return root;
}

describe("format.sh", () => {
  it("repairs both independent defect classes without changing dirty siblings", async () => {
    const root = await fixture();
    const target = await writeFileIn(root, "edited file.md", DIRTY);
    const neighbor = await writeFileIn(root, "neighbor.md", DIRTY);
    const json = await writeFileIn(root, "neighbor.json", '{"dirty":true}\n');
    const result = runHook("format.sh", root, target, {
      env: { CLAUDE_PROJECT_DIR: `${root}/` },
    });

    expect(result.status, result.stderr).toBe(0);
    expect(await readFile(target, "utf8")).toBe(REPAIRED);
    expect(await readFile(neighbor, "utf8")).toBe(DIRTY);
    expect(await readFile(json, "utf8")).toBe('{"dirty":true}\n');
  });

  it("retains the existing JavaScript trigger without visiting Markdown siblings", async () => {
    const root = await fixture();
    const target = await writeFileIn(
      root,
      "edited.js",
      "export const value=1\n",
    );
    const neighbor = await writeFileIn(root, "neighbor.md", DIRTY);

    expect(runHook("format.sh", root, target).status).toBe(0);
    expect(await readFile(target, "utf8")).toBe("export const value = 1;\n");
    expect(await readFile(neighbor, "utf8")).toBe(DIRTY);
  });

  it("does not add configured positive lint globs to repair", async () => {
    const root = await fixture();
    const config = await readFile(
      join(root, ".markdownlint-cli2.jsonc"),
      "utf8",
    );
    await writeFileIn(
      root,
      ".markdownlint-cli2.jsonc",
      config.replace('"ignores":', '"globs": ["neighbor.md"], "ignores":'),
    );
    const target = await writeFileIn(root, "edited.md", DIRTY);
    const neighbor = await writeFileIn(root, "neighbor.md", DIRTY);

    expect(runHook("format.sh", root, target).status).toBe(0);
    expect(await readFile(target, "utf8")).toBe(REPAIRED);
    expect(await readFile(neighbor, "utf8")).toBe(DIRTY);
  });

  it.each(["*", "?", "{", "[", "!", "#", ":", "\\", "(a|b)"])(
    "skips a glob/control-sensitive %s filename and its dirty matching sibling",
    async (character) => {
      const root = await fixture();
      const target = await writeFileIn(root, `edited${character}.md`, DIRTY);
      const neighbor = await writeFileIn(root, "editedX.md", DIRTY);

      expect(runHook("format.sh", root, target).status).toBe(0);
      expect(await readFile(target, "utf8")).toBe(DIRTY);
      expect(await readFile(neighbor, "utf8")).toBe(DIRTY);
    },
  );

  it.each(["", null, 17, ["edited.md"], { path: "edited.md" }])(
    "skips an unusable file_path %j without repairing another file",
    async (path) => {
      const root = await fixture();
      const neighbor = await writeFileIn(root, "neighbor.md", DIRTY);

      expect(runHook("format.sh", root, path).status).toBe(0);
      expect(await readFile(neighbor, "utf8")).toBe(DIRTY);
    },
  );

  it.each(["{", "{}", '{"tool_input":{}}'])(
    "skips malformed or missing payload %s without writes",
    async (input) => {
      const root = await fixture();
      const neighbor = await writeFileIn(root, "neighbor.md", DIRTY);

      expect(runHook("format.sh", root, undefined, { input }).status).toBe(0);
      expect(await readFile(neighbor, "utf8")).toBe(DIRTY);
    },
  );

  it("skips a missing target rather than falling back to repository traversal", async () => {
    const root = await fixture();
    const neighbor = await writeFileIn(root, "neighbor.md", DIRTY);

    expect(runHook("format.sh", root, join(root, "missing.md")).status).toBe(0);
    expect(await readFile(neighbor, "utf8")).toBe(DIRTY);
  });

  it("skips a directory rather than falling back to repository traversal", async () => {
    const root = await fixture();
    const neighbor = await writeFileIn(root, "neighbor.md", DIRTY);
    const target = join(root, "directory.md");
    await mkdir(target);

    expect(runHook("format.sh", root, target).status).toBe(0);
    expect(await readFile(neighbor, "utf8")).toBe(DIRTY);
  });

  it("skips an unsupported input rather than falling back to repository traversal", async () => {
    const root = await fixture();
    const neighbor = await writeFileIn(root, "neighbor.md", DIRTY);
    const target = await writeFileIn(
      root,
      "unsupported.json",
      '{"dirty":true}\n',
    );

    expect(runHook("format.sh", root, target).status).toBe(0);
    expect(await readFile(neighbor, "utf8")).toBe(DIRTY);
    expect(await readFile(target, "utf8")).toBe('{"dirty":true}\n');
  });

  it.each([
    ".agents/skills/x/doc.md",
    ".claude/skills/x/doc.md",
    "nested/node_modules/doc.md",
    ".git/doc.md",
    "tools/evaluation/mocks/example/doc.md",
  ])("does not repair protected material at %s", async (path) => {
    const root = await fixture();
    const target = await writeFileIn(root, path, DIRTY);

    expect(runHook("format.sh", root, target).status).toBe(0);
    expect(await readFile(target, "utf8")).toBe(DIRTY);
  });

  it.each([
    [".agents/skills/x/doc.md", DIRTY],
    [".claude/skills/x/doc.md", DIRTY],
    ["tools/evaluation/mocks/doc.md", DIRTY],
    ["tools/evaluation/measurements/doc.md", LINT_REPAIRED],
  ])(
    "preserves original-path exclusions through a %s alias into source",
    async (aliasPath, expected) => {
      const root = await fixture();
      const target = await writeFileIn(root, "source/doc.md", DIRTY);
      await mkdir(join(root, aliasPath, ".."), { recursive: true });
      const alias = join(root, aliasPath);
      await symlink(target, alias);

      expect(runHook("format.sh", root, alias).status).toBe(0);
      expect(await readFile(target, "utf8")).toBe(expected);
      expect((await lstat(alias)).isSymbolicLink()).toBe(true);
    },
  );

  it.each([
    [".agents/skills/x/doc.md", DIRTY],
    [".claude/skills/x/doc.md", DIRTY],
    ["tools/evaluation/mocks/doc.md", DIRTY],
    ["tools/evaluation/measurements/doc.md", LINT_REPAIRED],
  ])(
    "preserves canonical-path exclusions through a source alias to %s",
    async (targetPath, expected) => {
      const root = await fixture();
      const target = await writeFileIn(root, targetPath, DIRTY);
      const alias = join(root, "alias.md");
      await symlink(target, alias);

      expect(runHook("format.sh", root, alias).status).toBe(0);
      expect(await readFile(target, "utf8")).toBe(expected);
    },
  );

  it.each([
    ["tools/evaluation/measurements/doc.md", LINT_REPAIRED],
    ["tools/evaluation/README.md", REPAIRED],
  ])("preserves tool-specific eligibility for %s", async (path, expected) => {
    const root = await fixture();
    const target = await writeFileIn(root, path, DIRTY);

    expect(runHook("format.sh", root, target).status).toBe(0);
    expect(await readFile(target, "utf8")).toBe(expected);
  });

  it("repairs only an owned canonical target of an internal source symlink", async () => {
    const root = await fixture();
    const target = await writeFileIn(root, "source/doc.md", DIRTY);
    const neighbor = await writeFileIn(root, "neighbor.md", DIRTY);
    const alias = join(root, "alias.md");
    await symlink(target, alias);

    expect(runHook("format.sh", root, alias).status).toBe(0);
    expect(await readFile(target, "utf8")).toBe(REPAIRED);
    expect(await readFile(neighbor, "utf8")).toBe(DIRTY);
    expect((await lstat(alias)).isSymbolicLink()).toBe(true);
  });

  it("rejects external symlinks and outside-to-inside aliases", async () => {
    const root = await fixture();
    const outside = await writeFileIn(join(root, ".."), "outside.md", DIRTY);
    const target = await writeFileIn(root, "source.md", DIRTY);
    await symlink(outside, join(root, "external.md"));
    const outsideAlias = join(root, "..", "outside-alias.md");
    await symlink(target, outsideAlias);

    expect(runHook("format.sh", root, join(root, "external.md")).status).toBe(
      0,
    );
    expect(runHook("format.sh", root, outsideAlias).status).toBe(0);
    expect(await readFile(outside, "utf8")).toBe(DIRTY);
    expect(await readFile(target, "utf8")).toBe(DIRTY);
  });

  it("rejects lexical traversal and a project-prefix sibling", async () => {
    const root = await fixture();
    await mkdir(join(root, "subdir"));
    const target = await writeFileIn(root, "doc.md", DIRTY);
    const outside = await writeFileIn(`${root}-peer`, "doc.md", DIRTY);

    expect(runHook("format.sh", root, `${root}/subdir/../doc.md`).status).toBe(
      0,
    );
    expect(runHook("format.sh", root, outside).status).toBe(0);
    expect(await readFile(target, "utf8")).toBe(DIRTY);
    expect(await readFile(outside, "utf8")).toBe(DIRTY);
  });

  it("never trims a control-sensitive canonical name into a sibling target", async () => {
    const root = await fixture();
    const target = await writeFileIn(root, "doc.md\n", DIRTY);
    const neighbor = await writeFileIn(root, "doc.md", DIRTY);
    const alias = join(root, "alias.md");
    await symlink(target, alias);

    expect(runHook("format.sh", root, alias).status).toBe(0);
    expect(runHook("format.sh", root, `${neighbor}\n`).status).toBe(0);
    expect(await readFile(target, "utf8")).toBe(DIRTY);
    expect(await readFile(neighbor, "utf8")).toBe(DIRTY);
  });

  it("skips repair when canonical resolution is unavailable", async () => {
    const root = await fixture();
    const target = await writeFileIn(root, "doc.md", DIRTY);
    const bin = join(root, "bin");
    const resolver = await writeFileIn(
      root,
      "bin/realpath",
      "#!/bin/sh\nexit 1\n",
    );
    await chmod(resolver, 0o755);

    expect(
      runHook("format.sh", root, target, {
        env: { PATH: `${bin}:${process.env.PATH}` },
      }).status,
    ).toBe(0);
    expect(await readFile(target, "utf8")).toBe(DIRTY);
  });
});

describe("check.sh", () => {
  it("keeps successful checks non-writing and silent", async () => {
    const root = await stopFixture();
    const content = "# Heading\n\nText.\n";
    const target = await writeFileIn(root, "doc.md", content);

    const result = runHook("check.sh", root);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
    expect(await readFile(target, "utf8")).toBe(content);
  });

  it.each([
    ["lint failure", "# Heading\n\n** spaced emphasis **\n", "MD037"],
    ["link failure", "# Heading\n\n[Missing](./missing.md)\n", "BROKEN LINKS"],
  ])(
    "keeps %s non-writing and preserves the Stop exit contract",
    async (_name, content, diagnostic) => {
      const root = await stopFixture();
      const target = await writeFileIn(root, "doc.md", content);

      const result = runHook("check.sh", root);

      expect(result.status, result.stderr).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(diagnostic);
      expect(result.stderr).toContain("Pre-completion checks failed");
      expect(await readFile(target, "utf8")).toBe(content);
    },
  );

  it("exits silently with no pending content", async () => {
    const root = await stopFixture();
    const result = runHook("check.sh", root);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });

  it("does not emit a reminder on a clean pushed-ahead topic branch", async () => {
    const root = await stopFixture();
    const base = git(root, "rev-parse", "HEAD");
    git(root, "remote", "add", "origin", "https://example.invalid/fixture.git");
    git(root, "update-ref", "refs/remotes/origin/main", base);
    git(root, "switch", "-c", "topic");
    await writeFileIn(root, "doc.md", "# Heading\n\nText.\n");
    git(root, "add", "doc.md");
    git(root, "commit", "-m", "fixture content");
    git(
      root,
      "update-ref",
      "refs/remotes/origin/topic",
      git(root, "rev-parse", "HEAD"),
    );
    git(root, "branch", "--set-upstream-to=origin/topic");

    expect(git(root, "status", "--porcelain")).toBe("");
    expect(git(root, "rev-list", "origin/main..HEAD", "--count")).toBe("1");
    const result = runHook("check.sh", root);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });
});
