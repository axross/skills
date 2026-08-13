// the trust boundary between a pull request's head and a bare evaluation
// workspace — the path allowlist and the content size caps.

import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  allowOverlayContent,
  allowOverlayPath,
  assertRealDirectory,
  DESCRIPTION_MAX_BYTES,
  FILE_BYTES_MAX,
  planOverlay,
  resolveInside,
} from "../../tools/evaluation/discovery/src/head-overlay.mjs";

describe("allowOverlayPath — accepted", () => {
  it("accepts a well-formed .agents/skills/<name>/SKILL.md path", () => {
    const verdict = allowOverlayPath(".agents/skills/agent-skill-authoring/SKILL.md");
    expect(verdict).toEqual({ allowed: true, skill: "agent-skill-authoring" });
  });

  it("accepts a single-word skill name", () => {
    expect(allowOverlayPath(".agents/skills/dataviz/SKILL.md").allowed).toBe(true);
  });
});

describe("allowOverlayPath — rejected", () => {
  it("rejects an empty path", () => {
    expect(allowOverlayPath("").allowed).toBe(false);
    expect(allowOverlayPath("").reason).toMatch(/empty path/);
  });

  it("rejects an absolute path", () => {
    const verdict = allowOverlayPath("/etc/passwd");
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toMatch(/absolute path/);
  });

  it("rejects a backslash", () => {
    const verdict = allowOverlayPath(".agents\\skills\\x\\SKILL.md");
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toMatch(/backslash/);
  });

  it("rejects a NUL byte", () => {
    const verdict = allowOverlayPath(".agents/skills/x/SKILL.md\0");
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toMatch(/NUL byte/);
  });

  it("rejects a parent-directory traversal segment", () => {
    const verdict = allowOverlayPath(".agents/skills/../../etc/passwd/SKILL.md");
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toMatch(/parent-directory segment/);
  });

  it("rejects references/*.md — only SKILL.md may cross the boundary", () => {
    const verdict = allowOverlayPath(".agents/skills/x/references/detail.md");
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toMatch(/not a \.agents\/skills/);
  });

  it("rejects the symlinked .claude/skills tier — the allowlist reads only the installed copy", () => {
    const verdict = allowOverlayPath(".claude/skills/x/SKILL.md");
    expect(verdict.allowed).toBe(false);
  });

  it("rejects the distributable source tier", () => {
    const verdict = allowOverlayPath("skills/x/SKILL.md");
    expect(verdict.allowed).toBe(false);
  });

  it("rejects a skill name that is not kebab-case", () => {
    const verdict = allowOverlayPath(".agents/skills/NotKebab/SKILL.md");
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toMatch(/not a kebab-case skill name/);
  });

  it("rejects a non-string input", () => {
    expect(allowOverlayPath(null).allowed).toBe(false);
    expect(allowOverlayPath(undefined).allowed).toBe(false);
  });
});

describe("planOverlay", () => {
  it("partitions a mixed list into allowed and rejected", () => {
    const { allowed, rejected } = planOverlay([
      ".agents/skills/a/SKILL.md",
      ".agents/skills/a/references/x.md",
      "/etc/passwd",
    ]);
    expect(allowed).toEqual([{ path: ".agents/skills/a/SKILL.md", skill: "a" }]);
    expect(rejected.map((entry) => entry.path)).toEqual([
      ".agents/skills/a/references/x.md",
      "/etc/passwd",
    ]);
  });
});

describe("allowOverlayContent — the credential/cost filter's size half", () => {
  const frontmatter = (description) => `---\nname: a\ndescription: ${description}\n---\nbody\n`;

  it("accepts an ordinary file", () => {
    expect(allowOverlayContent(frontmatter("routes on X")).allowed).toBe(true);
  });

  it("rejects a file with no frontmatter block", () => {
    const verdict = allowOverlayContent("no frontmatter\n");
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toMatch(/no frontmatter block/);
  });

  it("rejects a description over the byte cap", () => {
    const verdict = allowOverlayContent(frontmatter("x".repeat(DESCRIPTION_MAX_BYTES + 1)));
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toMatch(/description is \d+ bytes/);
  });

  it("accepts a description exactly at the byte cap", () => {
    expect(allowOverlayContent(frontmatter("x".repeat(DESCRIPTION_MAX_BYTES))).allowed).toBe(true);
  });

  it("rejects a whole file over the byte cap, independent of the description", () => {
    const huge = frontmatter("short") + "x".repeat(FILE_BYTES_MAX);
    const verdict = allowOverlayContent(huge);
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toMatch(/file is \d+ bytes/);
  });

  it("measures in bytes, not characters — a multi-byte description under the character count can still be over the byte cap", () => {
    // "€" is 3 bytes in UTF-8. DESCRIPTION_MAX_BYTES characters of it is well
    // past the byte cap even though the character count looks under it.
    const verdict = allowOverlayContent(frontmatter("€".repeat(DESCRIPTION_MAX_BYTES)));
    expect(verdict.allowed).toBe(false);
  });
});

describe("resolveInside", () => {
  it("resolves a relative path inside the root", () => {
    expect(resolveInside("/root", "a/SKILL.md")).toBe("/root/a/SKILL.md");
  });

  it("refuses a path that escapes the root via ..", () => {
    expect(() => resolveInside("/root", "../../etc/passwd")).toThrow(/resolves outside the workspace/);
  });

  it("derives the destination from the diff path, never from content inside the file", () => {
    // this is the property the module exists to enforce: nothing here reads
    // the file at all, so a `name:` field inside it cannot steer the write.
    expect(resolveInside("/root", "attacker-chosen-name/SKILL.md")).toBe(
      "/root/attacker-chosen-name/SKILL.md",
    );
  });
});

describe("assertRealDirectory", () => {
  let root;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "head-overlay-test-"));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("passes for a real directory", async () => {
    const dir = join(root, "real");
    await mkdir(dir);
    await expect(assertRealDirectory(dir)).resolves.toBeUndefined();
  });

  it("refuses a symlinked directory — path containment alone cannot catch it", async () => {
    const target = join(root, "target");
    await mkdir(target);
    const link = join(root, "link");
    await symlink(target, link);
    await expect(assertRealDirectory(link)).rejects.toThrow(/not a real directory/);
  });

  it("refuses a plain file", async () => {
    const file = join(root, "file.txt");
    await writeFile(file, "x", "utf8");
    await expect(assertRealDirectory(file)).rejects.toThrow(/not a real directory/);
  });
});
