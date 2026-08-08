// digesting what a probe ran against, by content rather than by name.

import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  digestibleFiles,
  skillDigests,
  treeDigest,
} from "../../tools/effect-eval/src/fingerprint.mjs";

let root;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "fingerprint-test-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const write = async (relative, content) => {
  const path = join(root, relative);
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, content, "utf8");
};

describe("digestibleFiles", () => {
  it("excludes .git, node_modules, and .claude/skills by name and position", async () => {
    await write("src/index.ts", "export {};\n");
    await write(".git/HEAD", "ref: refs/heads/main\n");
    await write("node_modules/dep/index.js", "module.exports = {};\n");
    await write("app/node_modules/nested/index.js", "module.exports = {};\n");
    await write(".claude/skills/unit-testing/SKILL.md", "# skill\n");
    await write(".claude/settings.json", "{}\n");

    // .claude/settings.json stays: only .claude/skills is excluded, and by
    // position, so a directory called `skills` elsewhere is kept.
    expect(await digestibleFiles(root)).toEqual([".claude/settings.json", "src/index.ts"]);
  });

  it("is sorted, so the digest does not depend on directory-read order", async () => {
    await write("z.ts", "");
    await write("a.ts", "");
    await write("m/n.ts", "");
    expect(await digestibleFiles(root)).toEqual(["a.ts", "m/n.ts", "z.ts"]);
  });
});

describe("treeDigest", () => {
  it("is stable across two reads of an unchanged tree", async () => {
    await write("a.ts", "one\n");
    await write("b/c.ts", "two\n");
    expect(await treeDigest(root)).toBe(await treeDigest(root));
  });

  it("moves when a byte changes", async () => {
    await write("a.ts", "one\n");
    const before = await treeDigest(root);
    await write("a.ts", "onE\n");
    expect(await treeDigest(root)).not.toBe(before);
  });

  it("moves when a file moves, even though every byte is still present", async () => {
    await write("a.ts", "one\n");
    const before = await treeDigest(root);
    await rm(join(root, "a.ts"));
    await write("b.ts", "one\n");
    expect(await treeDigest(root)).not.toBe(before);
  });

  it("does not move when a skill is installed under .claude/skills", async () => {
    // load-bearing: a project digest covering the installed skills would
    // differ between the two conditions by construction, and the check that
    // proves two probes comparable would always fail.
    await write("a.ts", "one\n");
    const before = await treeDigest(root);
    await write(".claude/skills/unit-testing/SKILL.md", "# unit testing\n");
    expect(await treeDigest(root)).toBe(before);
  });

  it("is prefixed so a reader can tell what produced it", async () => {
    await write("a.ts", "one\n");
    expect(await treeDigest(root)).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe("skillDigests", () => {
  const skillsRoot = () => join(root, ".claude", "skills");

  it("returns an empty map for the skill-absent condition", async () => {
    // no directory at all is the condition, not a failure to read one.
    expect(await skillDigests(skillsRoot())).toEqual({});
  });

  it("digests each skill separately, so one edit moves one entry", async () => {
    await write(".claude/skills/alpha/SKILL.md", "a\n");
    await write(".claude/skills/beta/SKILL.md", "b\n");
    const before = await skillDigests(skillsRoot());

    await write(".claude/skills/alpha/SKILL.md", "a!\n"); // one byte

    const after = await skillDigests(skillsRoot());
    expect(after.alpha).not.toBe(before.alpha);
    expect(after.beta).toBe(before.beta);
    expect(Object.keys(after)).toEqual(["alpha", "beta"]);
  });

  it("covers a skill's whole tree, not only its SKILL.md", async () => {
    await write(".claude/skills/alpha/SKILL.md", "a\n");
    await write(".claude/skills/alpha/references/detail.md", "one\n");
    const before = await skillDigests(skillsRoot());
    await write(".claude/skills/alpha/references/detail.md", "two\n");
    expect((await skillDigests(skillsRoot())).alpha).not.toBe(before.alpha);
  });

  it("ignores a stray file beside the skill directories", async () => {
    await write(".claude/skills/alpha/SKILL.md", "a\n");
    await write(".claude/skills/README.md", "not a skill\n");
    expect(Object.keys(await skillDigests(skillsRoot()))).toEqual(["alpha"]);
  });

  it("digests a symlinked file rather than walking past it", async () => {
    // setup.mjs dereferences on install so this should not arise, but a digest
    // that skipped links would under-report the treatment if it ever did.
    await write(".claude/skills/alpha/SKILL.md", "a\n");
    await writeFile(join(root, "target.md"), "linked\n", "utf8");
    await symlink(join(root, "target.md"), join(skillsRoot(), "alpha", "linked.md"));
    expect(await digestibleFiles(join(skillsRoot(), "alpha"))).toEqual([
      "SKILL.md",
      "linked.md",
    ]);
  });
});
