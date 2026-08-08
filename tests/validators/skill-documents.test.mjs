// the behaviour every skill-structure validator shares, through
// skill-documents.mjs: how a path resolves to a skill directory, how two copies
// of one skill collapse into a single verdict, and the exit contract.
//
// exercised through check-skill-frontmatter.mjs because a command has to be run
// to observe any of it, and that one is the cheapest — it reads the leading
// `---` block and nothing else. nothing here is specific to the frontmatter
// rules; a reader checking a claim about the shared module should be able to
// swap the binding above for either sibling and see the same results.

import { join } from "node:path";

import { mkdir, symlink } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { tempDir, writeSkill } from "../helpers/fixtures.mjs";
import { SCRIPTS, validator } from "../helpers/run.mjs";

const checkSkill = validator(SCRIPTS.checkSkillFrontmatter);

/**
 * assert that a fixture fails with exit 1 and reports `expected`.
 *
 * the two framing assertions are soft: when a rule stops firing, the useful
 * signal is which of the three claims broke, and a hard assert on the first
 * hides the rest.
 * @param {string} dir
 * @param {RegExp} expected
 */
function expectFailure(dir, expected) {
  const result = checkSkill(dir);

  expect(result).toReportFailure(expected);
  expect.soft(result.stdout).toMatch(/^FAIL {2}/m);
  expect.soft(result.stdout).toMatch(/1 of 1 skill\(s\) failed structural checks\./);
}

/**
 * assert that a fixture raises `expected` as a WARN and still exits 0. every
 * case using this asserts the exit code, because the whole point of the
 * advisory tier is that none of it can fail a build.
 * @param {string} dir
 * @param {RegExp} expected
 */
function expectWarning(dir, expected) {
  const result = checkSkill(dir);

  expect(result, "a WARN must not fail the run").toPassCleanly();
  expect.soft(result.stdout).toMatch(/^WARN/m);
  expect(result.stdout).toMatch(expected);
}


describe("skill-documents.mjs, through the commands that share it", () => {
  describe("resolving a path to skills", () => {

    it("passes a well-formed skill", async () => {
      const root = await tempDir();
      const dir = await writeSkill(root, "well-formed-skill");

      const result = checkSkill(dir);

      expect(result).toPassCleanly();
      expect(result.stdout).toMatch(/^PASS {2}/m);
      expect(result.stdout).toMatch(/All 1 skill\(s\) passed structural checks\./);
    });

    it("resolves a skill root into its immediate skill subdirectories", async () => {
      const root = await tempDir();
      await writeSkill(root, "first-skill");
      await writeSkill(root, "second-skill");

      const result = checkSkill(root);

      expect(result).toPassCleanly();
      expect(result.stdout).toMatch(/All 2 skill\(s\) passed structural checks\./);
    });

    it("fails the run when one skill in a root fails and another passes", async () => {
      const root = await tempDir();
      await writeSkill(root, "healthy-skill");
      await writeSkill(root, "broken-skill", {
        frontmatter: { description: null },
      });

      expect(checkSkill(root)).toReportFailure(
        /1 of 2 skill\(s\) failed structural checks\./,
      );
    });

  });

  describe("duplicate copies of one skill", () => {
    it("reports an identical copy once, under the path given first", async () => {
      const source = await tempDir();
      const installed = await tempDir();
      await writeSkill(source, "shared-skill");
      await writeSkill(installed, "shared-skill");

      const result = checkSkill(source, installed);

      expect(result).toPassCleanly();
      expect.soft(result.stdout).toMatch(/All 1 skill\(s\) passed structural checks\./);
      expect.soft(result.stdout).toMatch(/1 duplicate path\(s\) collapsed/);
      expect.soft(result.stdout).toMatch(/fix the reported path, not the copy/);
      expect
        .soft(result.stdout)
        .toMatch(
          new RegExp(
            `PASS {2}${source}/shared-skill {2}\\(= ${installed}/shared-skill\\)`,
          ),
        );
    });

    it("collapses a shared failure once rather than twice", async () => {
      const source = await tempDir();
      const installed = await tempDir();
      const broken = { frontmatter: { description: null } };
      await writeSkill(source, "shared-skill", broken);
      await writeSkill(installed, "shared-skill", broken);

      const result = checkSkill(source, installed);

      expect(result).toReportFailure(/1 of 1 skill\(s\) failed structural checks\./);
      expect(result.stdout.match(/^FAIL {2}/gm)).toHaveLength(1);
    });

    it("reports both copies separately when their verdicts diverge", async () => {
      const source = await tempDir();
      const installed = await tempDir();
      await writeSkill(source, "shared-skill");
      await writeSkill(installed, "shared-skill", {
        frontmatter: { description: null },
      });

      const result = checkSkill(source, installed);

      expect(result).toReportFailure(/1 of 2 skill\(s\) failed structural checks\./);
      expect(result.stdout).not.toMatch(/duplicate path\(s\) collapsed/);
    });

    it("leaves single-root output unchanged", async () => {
      const root = await tempDir();
      await writeSkill(root, "only-skill");

      const result = checkSkill(root);

      expect(result).toPassCleanly();
      expect.soft(result.stdout).not.toMatch(/duplicate path\(s\) collapsed/);
      expect.soft(result.stdout).not.toMatch(/\(= /);
    });
  });

  describe("a root whose entries are symlinks", () => {
    it("reports the real skill count instead of zero", async () => {
      const root = await tempDir();
      await writeSkill(`${root}/real`, "linked-skill");
      await mkdir(`${root}/mirror`, { recursive: true });
      await symlink("../real/linked-skill", `${root}/mirror/linked-skill`);

      const result = checkSkill(`${root}/mirror`);

      expect(
        result,
        "`Dirent.isDirectory()` is false for a symlink pointing at a directory, so filtering on it makes a symlinked root read as EMPTY — and an empty root prints `All 0 skill(s) passed`, which is indistinguishable from a real pass",
      ).toPassCleanly();
      expect(result.stdout).toMatch(/All 1 skill\(s\) passed/);
    });

    it("ignores a link that does not resolve rather than crashing", async () => {
      const root = await tempDir();
      await writeSkill(`${root}/mirror`, "real-skill");
      await symlink("../nowhere/gone", `${root}/mirror/dangling`);

      const result = checkSkill(`${root}/mirror`);

      expect(result).toPassCleanly();
      expect(result.stdout).toMatch(/All 1 skill\(s\) passed/);
    });
  });

  describe("exit 2 — bad invocation or no skill at the path", () => {
    it("exits 2 with usage when given no arguments", () => {
      const result = checkSkill();

      expect(result).toExitWith(2);
      expect(result.stderr).toMatch(/Usage: check-skill-frontmatter\.mjs/);
    });

    it("exits 2 on an unrecognized option", async () => {
      const root = await tempDir();
      const dir = await writeSkill(root, "a-skill");

      const result = checkSkill("--no-such-option", dir);

      expect(result).toExitWith(2);
      expect(result.stderr).toMatch(/Unknown option "--no-such-option"/);
    });

    it("exits 2 when a path is not a directory", async () => {
      const root = await tempDir();
      const dir = await writeSkill(root, "a-skill");

      const result = checkSkill(join(dir, "SKILL.md"));

      expect(result).toExitWith(2);
      expect(result.stderr).toMatch(/Not a directory:/);
    });

    it("exits 2 when a directory holds no SKILL.md and no skill subdirectory", async () => {
      const root = await tempDir();

      const result = checkSkill(root);

      expect(result).toExitWith(2);
      expect(result.stderr).toMatch(
        /No SKILL\.md in ".*" or its immediate subdirectories\./,
      );
    });
  });

  it("prints usage on --help", () => {
    const result = checkSkill("--help");

    expect(result).toPassCleanly();
    expect(result.stdout).toMatch(/^Usage: check-skill-frontmatter\.mjs/);
  });
});
