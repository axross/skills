// exit-code contract for check-links.mjs, plus the content-skipping rules its
// header documents: links inside fenced code blocks, inline code spans, and HTML
// comments are illustrative and must never be resolved.
//
// documented contract: 0 when every relative link resolves, 1 when one or more
// are broken, 2 on a bad invocation.
//
// this file and fence-parsing.test.mjs both now take the links gate's own
// roster (gates.mjs's EXCLUDED_PATHS) for their corpus-wide case, instead of a
// bare no-argument sweep — the mocks moved three levels deep and forced the
// switch off one, so neither file demonstrates the validator passing over an
// unscoped tree any more.

import { mkdir, symlink } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { tempDir, writeFileIn } from "../helpers/fixtures.mjs";
import { SCRIPTS, validator } from "../helpers/run.mjs";
import { gate } from "../repository/gates.mjs";

const checkLinks = validator(SCRIPTS.checkLinks);

describe("check-links.mjs", () => {
  it("exits 0 when every relative link resolves", async () => {
    const root = await tempDir();
    await writeFileIn(root, "target.md", "# Target\n");
    await writeFileIn(root, "source.md", "See [target](./target.md).\n");

    const result = checkLinks(root);

    expect(result).toPassCleanly();
    expect(result.stdout).toMatch(/links OK/);
  });

  it("exits 1 and names the broken link when a target is missing", async () => {
    const root = await tempDir();
    await writeFileIn(root, "source.md", "See [gone](./missing.md).\n");

    const result = checkLinks(root);

    expect(result).toReportFailure(/BROKEN LINKS \(1\)/);
    expect(result.stdout).toMatch(/source\.md -> \.\/missing\.md/);
  });

  it("resolves a link carrying an anchor fragment against the file alone", async () => {
    const root = await tempDir();
    await writeFileIn(root, "target.md", "# Target\n\n## Section\n");
    await writeFileIn(root, "source.md", "See [x](./target.md#section).\n");

    expect(checkLinks(root)).toPassCleanly();
  });

  // each of these embeds a link to a file that does not exist. the link is
  // illustrative in every case, so resolving any of them would be the bug.
  it.each([
    {
      what: "a fenced code block",
      content: ["# Example", "", "```markdown", "[x](./missing.md)", "```", ""].join(
        "\n",
      ),
    },
    {
      what: "an inline code span",
      content: "Write it as `[x](./missing.md)` in prose.\n",
    },
    {
      what: "an HTML comment",
      content: "<!-- [x](./missing.md) -->\n",
    },
  ])("ignores a link inside $what", async ({ content }) => {
    const root = await tempDir();
    await writeFileIn(root, "source.md", content);

    expect(checkLinks(root)).toPassCleanly();
  });

  // the mirror image of the three cases above: text that only looks like it
  // opens a comment must not hide the real links after it. commonmark.mjs's
  // extractProse owns the ordering that decides this; these two drive the CLI,
  // because a correct module and a caller reading it correctly are different
  // claims.
  describe("a comment opener that never really opens a comment", () => {
    it("checks the links after a comment opener that is only being quoted", async () => {
      // README.md documents the `count:` marker rule with this exact sentence.
      // read raw, that opener swallowed everything up to the next `-->` — 90
      // lines of prose and three relative links the gate silently stopped
      // watching, while still reporting clean.
      const root = await tempDir();
      await writeFileIn(
        root,
        "source.md",
        [
          "A line beginning with `<!--` is an HTML block in CommonMark.",
          "",
          "See [gone](./missing.md).",
          "",
          "<!-- count:things -->three<!-- /count -->",
          "",
        ].join("\n"),
      );

      expect(checkLinks(root)).toReportFailure(/source\.md -> \.\/missing\.md/);
    });

    it("keeps checking after a dangling opener that closes nowhere", async () => {
      // a dangling `<!--` comments out the rest of a rendered document, but
      // honouring it here would silently stop checking — the failure mode that
      // looks like a clean result.
      const root = await tempDir();
      await writeFileIn(
        root,
        "source.md",
        "<!-- dangling\n\nSee [gone](./missing.md).\n",
      );

      expect(checkLinks(root)).toReportFailure(/source\.md -> \.\/missing\.md/);
    });
  });

  it("ignores absolute http(s) and mailto targets", async () => {
    const root = await tempDir();
    await writeFileIn(
      root,
      "source.md",
      "[a](https://example.com/x.md) [b](mailto:someone@example.com)\n",
    );

    expect(checkLinks(root)).toPassCleanly();
  });

  describe("a root whose entries are symlinks", () => {
    it("walks into a symlinked directory instead of skipping it", async () => {
      const root = await tempDir();
      await writeFileIn(root, "real/a-skill/SKILL.md", "See [ref](./r.md).\n");
      await writeFileIn(root, "real/a-skill/r.md", "# Ref\n");
      await mkdir(`${root}/mirror`, { recursive: true });
      await symlink("../real/a-skill", `${root}/mirror/a-skill`);

      const result = checkLinks(`${root}/mirror`);

      expect(
        result,
        "`withFileTypes` reports a symlinked directory as neither file nor directory, so filtering on isDirectory() walks past a whole skill tree and reports `links OK (0 links…)` — a pass that checked nothing",
      ).toPassCleanly();
      expect(result.stdout).toMatch(/1 links? across 2 Markdown files? checked/);
    });

    it("still reports a broken link reached through a symlink", async () => {
      const root = await tempDir();
      await writeFileIn(root, "real/a-skill/SKILL.md", "See [gone](./missing.md).\n");
      await mkdir(`${root}/mirror`, { recursive: true });
      await symlink("../real/a-skill", `${root}/mirror/a-skill`);

      expect(checkLinks(`${root}/mirror`)).toReportFailure(/missing\.md/);
    });

    it("ignores a link that does not resolve rather than crashing the walk", async () => {
      const root = await tempDir();
      await writeFileIn(root, "mirror/kept.md", "# Kept\n");
      await symlink("../nowhere/gone", `${root}/mirror/dangling`);

      const result = checkLinks(`${root}/mirror`);

      expect(result).toPassCleanly();
      expect(result.stdout).toMatch(/1 Markdown files? checked/);
    });
  });

  it("walks dot-directories, where a skill tree actually lives", async () => {
    const root = await tempDir();
    await writeFileIn(
      root,
      ".claude/skills/x/SKILL.md",
      "[gone](./missing.md)\n",
    );

    const result = checkLinks(root);

    expect(result).toReportFailure(/missing\.md/);
    expect(result.stdout).toMatch(/\.claude\/skills\/x\/SKILL\.md/);
  });

  it("skips a path that does not exist rather than failing on it", async () => {
    const root = await tempDir();

    const result = checkLinks(`${root}/nowhere`);

    expect(result).toPassCleanly();
    expect(result.stdout).toMatch(/0 links across 0 Markdown files/);
  });

  it("exits 2 on an unrecognized option", () => {
    expect(checkLinks("--nonsense")).toExitWith(2);
  });

  it("prints usage on --help", () => {
    const result = checkLinks("--help");

    expect(result).toPassCleanly();
    expect(result.stdout).toMatch(/^Usage: check-links\.mjs/);
  });

  it("passes over the repository's own corpus", () => {
    // the links gate's own roster (gates.mjs's EXCLUDED_PATHS), not a bare
    // no-argument sweep: check-links.mjs has no exclusion mechanism of its
    // own, so a sweep with no roots would walk straight into
    // tools/evaluation/mocks/. excluding it is policy, not a claim that the
    // mocks carry broken links — they don't. the mocks sit outside this
    // repository's own gates by decision, so a future mock file with an
    // unresolvable link must stay its own toolchain's business rather than
    // fail npm test here.
    const result = checkLinks(...gate("links").args);

    expect(result).toPassCleanly();
    expect(result.stdout).toMatch(/links OK/);
  });
});
