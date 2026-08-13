// digesting what a discovery probe ran against: the project tree, and —
// separately, and NOT via tools/evaluation/effect's whole-tree skill digest —
// each installed skill's `description` alone.

import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  corpusInvocability,
  descriptionDigests,
  digestDescription,
  digestibleFiles,
  INVOCABLE,
  NOT_INVOCABLE,
  readDescription,
  readInvocable,
  treeDigest,
  UNRECOGNISED,
} from "../../tools/evaluation/discovery/src/fingerprint.mjs";

let root;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "discovery-fingerprint-test-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const write = async (relative, content) => {
  const path = join(root, relative);
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, content, "utf8");
};

describe("digestibleFiles / treeDigest", () => {
  it("excludes .git, node_modules, and .claude/skills, matching the effect side's shape", async () => {
    await write("src/index.ts", "export {};\n");
    await write(".git/HEAD", "ref: refs/heads/main\n");
    await write("node_modules/dep/index.js", "module.exports = {};\n");
    await write(".claude/skills/unit-testing/SKILL.md", "# skill\n");
    await write(".claude/settings.json", "{}\n");

    expect(await digestibleFiles(root)).toEqual([".claude/settings.json", "src/index.ts"]);
  });

  it("is stable across two reads of an unchanged tree, and prefixed", async () => {
    await write("a.ts", "one\n");
    const digest = await treeDigest(root);
    expect(await treeDigest(root)).toBe(digest);
    expect(digest).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("does not move when a skill is installed under .claude/skills", async () => {
    await write("a.ts", "one\n");
    const before = await treeDigest(root);
    await write(".claude/skills/unit-testing/SKILL.md", "# unit testing\n");
    expect(await treeDigest(root)).toBe(before);
  });

  it("moves when a byte changes", async () => {
    await write("a.ts", "one\n");
    const before = await treeDigest(root);
    await write("a.ts", "onE\n");
    expect(await treeDigest(root)).not.toBe(before);
  });
});

describe("readDescription", () => {
  it("reads the description field alone", () => {
    const text = "---\nname: a\ndescription: routes on X\nuser-invocable: false\n---\nbody\n";
    expect(readDescription(text)).toBe("routes on X");
  });

  it("returns null for a file with no frontmatter block", () => {
    expect(readDescription("just a body\n")).toBeNull();
  });

  it("returns an empty string when the key is present but empty", () => {
    expect(readDescription("---\nname: a\ndescription:\n---\nbody\n")).toBe("");
  });
});

describe("digestDescription / descriptionDigests", () => {
  it("digests each skill's description separately, so editing one moves one entry", async () => {
    await write(
      ".claude/skills/alpha/SKILL.md",
      "---\nname: alpha\ndescription: alpha routes here\n---\nbody\n",
    );
    await write(
      ".claude/skills/beta/SKILL.md",
      "---\nname: beta\ndescription: beta routes here\n---\nbody\n",
    );
    const skillsRoot = join(root, ".claude", "skills");
    const before = await descriptionDigests(skillsRoot);

    // a BODY-ONLY edit must not move the digest — this is the whole point of
    // covering description alone rather than reusing the effect side's
    // whole-tree skill digest.
    await write(
      ".claude/skills/alpha/SKILL.md",
      "---\nname: alpha\ndescription: alpha routes here\n---\na wildly different body\n",
    );
    const sameDescription = await descriptionDigests(skillsRoot);
    expect(sameDescription.alpha).toBe(before.alpha);

    // a DESCRIPTION edit does move it, and only it.
    await write(
      ".claude/skills/alpha/SKILL.md",
      "---\nname: alpha\ndescription: alpha routes SOMEWHERE ELSE now\n---\na wildly different body\n",
    );
    const changed = await descriptionDigests(skillsRoot);
    expect(changed.alpha).not.toBe(before.alpha);
    expect(changed.beta).toBe(before.beta);
  });

  it("digests to the same sha256:<hex> shape as the project tree digest", () => {
    expect(digestDescription("anything")).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("returns {} for a skills root that does not exist", async () => {
    expect(await descriptionDigests(join(root, "nope"))).toEqual({});
  });

  it("follows a symlinked skill root, matching this repository's .claude/skills shape", async () => {
    await write("real-skills/alpha/SKILL.md", "---\nname: alpha\ndescription: d\n---\nbody\n");
    await symlink(join(root, "real-skills"), join(root, "linked-skills"));
    expect(Object.keys(await descriptionDigests(join(root, "linked-skills")))).toEqual(["alpha"]);
  });

  it("ignores a stray file beside the skill directories", async () => {
    await write(".claude/skills/alpha/SKILL.md", "---\nname: alpha\ndescription: d\n---\nbody\n");
    await write(".claude/skills/README.md", "not a skill\n");
    expect(Object.keys(await descriptionDigests(join(root, ".claude", "skills")))).toEqual([
      "alpha",
    ]);
  });
});

describe("readInvocable", () => {
  it("reads an absent key as invocable — the observed CLI default", () => {
    expect(readInvocable("---\nname: a\ndescription: d\n---\nbody\n")).toBe(INVOCABLE);
  });

  it("reads user-invocable: true as invocable", () => {
    expect(readInvocable("---\nname: a\nuser-invocable: true\n---\nbody\n")).toBe(INVOCABLE);
  });

  it("reads user-invocable: false as not-invocable", () => {
    expect(readInvocable("---\nname: a\nuser-invocable: false\n---\nbody\n")).toBe(NOT_INVOCABLE);
  });

  it("does not read the bare string 'false' as a boolean — it is a string comparison", () => {
    // the trap this module's header warns against: frontmatterValue always
    // returns a string, so a `!== false` boolean comparison would classify
    // every skill in this repository as invocable.
    expect(readInvocable("---\nname: a\nuser-invocable: false\n---\nbody\n")).not.toBe(INVOCABLE);
  });

  it("reads an unrecognised value as unrecognised, never as invocable", () => {
    expect(readInvocable("---\nname: a\nuser-invocable: maybe\n---\nbody\n")).toBe(UNRECOGNISED);
  });

  it("reads a present-but-empty key as unrecognised, not as the absent-key default", () => {
    expect(readInvocable("---\nname: a\nuser-invocable:\n---\nbody\n")).toBe(UNRECOGNISED);
  });

  it("reads a file with no frontmatter as unrecognised — a parse failure fails loud", () => {
    expect(readInvocable("no frontmatter here\n")).toBe(UNRECOGNISED);
  });

  it("does not mistake a quoted example inside a body for a real declaration", () => {
    // frontmatterBlock scopes the read to the block alone, so a documentation
    // example quoting `user-invocable: true` inside a fenced code block in
    // the BODY must not be read as this file's own declaration.
    const text =
      "---\nname: a\nuser-invocable: false\n---\n" +
      "Example:\n```yaml\nuser-invocable: true\n```\n";
    expect(readInvocable(text)).toBe(NOT_INVOCABLE);
  });
});

describe("corpusInvocability", () => {
  it("reads every skill's invocability, keyed by directory name", async () => {
    await write(".claude/skills/alpha/SKILL.md", "---\nname: alpha\n---\nbody\n");
    await write(
      ".claude/skills/beta/SKILL.md",
      "---\nname: beta\nuser-invocable: false\n---\nbody\n",
    );
    expect(await corpusInvocability(join(root, ".claude", "skills"))).toEqual({
      alpha: INVOCABLE,
      beta: NOT_INVOCABLE,
    });
  });

  it("returns {} for a skills root that does not exist", async () => {
    expect(await corpusInvocability(join(root, "nope"))).toEqual({});
  });
});
