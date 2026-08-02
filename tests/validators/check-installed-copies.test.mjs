// Exit-code contract for the installed-copy drift check agent-skill-management
// bundles, exercised against fixture roots.
//
// Documented contract: 0 when every distributable skill matches its installed
// copy, 1 on drift, 2 on a bad invocation or a root that is not a directory.
//
// BOTH ROOTS ARE REQUIRED, and the two invocation cases at the bottom are what
// hold that. The script used to default them from its own location, which
// stopped being safe once it moved inside a skill: two levels up now lands in
// `.claude/`, and a root that matches nothing reports "0 skills, no drift" —
// a pass indistinguishable from a real one. Requiring the roots converts that
// silent nothing into an exit 2.
//
// Running the check against THIS repository's own two roots is a gate rather
// than a contract test, and lives in tests/repository/gate-runs.test.mjs, which
// takes its invocation from tests/repository/gates.mjs.

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

  // This repository's own repository-local set is empty — every skill here is
  // distributable — so `--local` is what keeps this code path exercised. The
  // fixture is named neutrally on purpose: naming it after a real skill is what
  // made the previous version of this case read as a claim about the corpus.
  it("accepts a known repository-local skill that has no source", async () => {
    const { source, installed } = await twoRoots(["alpha-skill"]);
    await writeSkill(installed, "local-only-skill");

    const result = checkCopies("--local", "local-only-skill", source, installed);

    expect(result).toPassCleanly();
    expect(result.stdout).toMatch(/LOCAL local-only-skill \(repository-local/);
  });

  it("exits 1 on an installed skill that is neither sourced nor repository-local", async () => {
    const { source, installed } = await twoRoots(["alpha-skill"]);
    await writeSkill(installed, "orphaned-skill");

    const result = checkCopies(source, installed);

    expect(result).toReportFailure(/DRIFT orphaned-skill/);
    expect(result.stdout).toMatch(/not a known repository-local skill/);
  });

  it("exits 1 on a sourceless installed skill that --local does not name", async () => {
    // --local must accept exactly what it names, not widen into "accept any
    // installed skill with no source" — which would make the whole check
    // vacuous for anyone who passes the flag once.
    const { source, installed } = await twoRoots(["alpha-skill"]);
    await writeSkill(installed, "local-only-skill");
    await writeSkill(installed, "orphaned-skill");

    const result = checkCopies("--local", "local-only-skill", source, installed);

    expect(result).toReportFailure(/DRIFT orphaned-skill/);
    expect.soft(result.stdout).toMatch(/LOCAL local-only-skill \(repository-local/);
  });

  it("exits 2 when --local is given no name", () => {
    const result = checkCopies("--local");

    expect(result).toExitWith(2);
    expect(result.stderr).toMatch(/--local requires a skill name\./);
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

  // The case the removed default made unreachable: with no roots the script
  // once inspected two guessed directories, and a wrong guess passed.
  it("exits 2 when both roots are omitted", () => {
    const result = checkCopies();

    expect(result).toExitWith(2);
    expect(result.stderr).toMatch(/Both a source root and an installed root are required \(got 0\)/);
  });

  it("exits 2 when only one root is given", async () => {
    const { source } = await twoRoots(["alpha-skill"]);

    const result = checkCopies(source);

    expect(result).toExitWith(2);
    expect(result.stderr).toMatch(/\(got 1\)/);
  });

  it("prints usage on --help", () => {
    const result = checkCopies("--help");

    expect(result).toPassCleanly();
    expect(result.stdout).toMatch(/^Usage: check-installed-copies\.mjs/);
  });
});
