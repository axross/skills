// Exit-code contract for the repository's installed-copy drift check, exercised
// against fixture roots.
//
// Documented contract: 0 when every distributable skill matches its installed
// copy, 1 on drift, 2 on a bad invocation or a root that is not a directory.
//
// Running the check against THIS repository's own two roots is a gate rather
// than a contract test, and lives in tests/repository/installed-copies.test.mjs.

import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { tempDir, writeSkill } from "../helpers/fixtures.mjs";
import { SCRIPTS, validator } from "../helpers/run.mjs";

const checkCopies = validator(SCRIPTS.checkInstalledCopies);

/** Build a source root and a matching installed root holding the same skills. */
async function twoRoots(names) {
  const source = await tempDir();
  const installed = await tempDir();
  for (const name of names) {
    const references = { "detail.md": `# Detail for ${name}\n` };
    await writeSkill(source, name, { references });
    await writeSkill(installed, name, { references });
  }
  return { source, installed };
}

describe("check-installed-copies.mjs", () => {
  it("exits 0 when every installed copy matches its source", async () => {
    const { source, installed } = await twoRoots(["alpha-skill", "beta-skill"]);

    const result = checkCopies(source, installed);

    expect(result).toPassCleanly();
    expect(result.stdout).toMatch(
      /All 2 distributable skill\(s\) match their installed copies\./,
    );
  });

  it("exits 1 when an installed copy's content differs", async () => {
    const { source, installed } = await twoRoots(["alpha-skill"]);
    await writeFile(
      join(installed, "alpha-skill", "references", "detail.md"),
      "# Hand-edited\n",
      "utf8",
    );

    const result = checkCopies(source, installed);

    expect(result).toReportFailure(/DRIFT alpha-skill/);
    // Soft: each line is an independent part of one report, and seeing every
    // missing piece at once beats fixing them one rerun at a time.
    expect.soft(result.stdout).toMatch(/content differs: references\/detail\.md/);
    expect
      .soft(result.stdout)
      .toMatch(/regenerate the installed copies with `npx skills`/);
  });

  it("exits 1 when a file exists only in the source", async () => {
    const { source, installed } = await twoRoots(["alpha-skill"]);
    await rm(join(installed, "alpha-skill", "references", "detail.md"));

    expect(checkCopies(source, installed)).toReportFailure(
      /missing from the installed copy: references\/detail\.md/,
    );
  });

  it("exits 1 when a file exists only in the installed copy", async () => {
    const { source, installed } = await twoRoots(["alpha-skill"]);
    await writeFile(
      join(installed, "alpha-skill", "STRAY.md"),
      "# Stray\n",
      "utf8",
    );

    expect(checkCopies(source, installed)).toReportFailure(
      /present only in the installed copy: STRAY\.md/,
    );
  });

  it("exits 1 when a source skill has no installed copy at all", async () => {
    const { source, installed } = await twoRoots(["alpha-skill"]);
    await rm(join(installed, "alpha-skill"), { recursive: true });

    expect(checkCopies(source, installed)).toReportFailure(
      /no installed copy under/,
    );
  });

  it("accepts a known repository-local skill that has no source", async () => {
    const { source, installed } = await twoRoots(["alpha-skill"]);
    await writeSkill(installed, "github-operation");

    const result = checkCopies(source, installed);

    expect(result).toPassCleanly();
    expect(result.stdout).toMatch(/LOCAL github-operation \(repository-local/);
  });

  it("exits 1 on an installed skill that is neither sourced nor repository-local", async () => {
    const { source, installed } = await twoRoots(["alpha-skill"]);
    await writeSkill(installed, "orphaned-skill");

    const result = checkCopies(source, installed);

    expect(result).toReportFailure(/DRIFT orphaned-skill/);
    expect(result.stdout).toMatch(/not a known repository-local skill/);
  });

  it("exits 2 when a root is not a directory", async () => {
    const { installed } = await twoRoots(["alpha-skill"]);

    const result = checkCopies(join(installed, "nope"), installed);

    expect(result).toExitWith(2);
    expect(result.stderr).toMatch(/Not a directory:/);
  });

  it("exits 2 on too many arguments", () => {
    const result = checkCopies("a", "b", "c");

    expect(result).toExitWith(2);
    expect(result.stderr).toMatch(/Usage: check-installed-copies\.mjs/);
  });

  it("prints usage on --help", () => {
    const result = checkCopies("--help");

    expect(result).toPassCleanly();
    expect(result.stdout).toMatch(/^Usage: check-installed-copies\.mjs/);
  });
});
