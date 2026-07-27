// Exit-code contract for the repository's installed-copy drift check.
//
// Documented contract: 0 when every distributable skill matches its installed
// copy, 1 on drift, 2 on a bad invocation or a root that is not a directory.

import assert from "node:assert/strict";
import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";

import { tempDir, writeSkill } from "./helpers/fixtures.mjs";
import { SCRIPTS, runNodeScript } from "./helpers/run.mjs";

const checkCopies = (...args) =>
  runNodeScript(SCRIPTS.checkInstalledCopies, args);

/** Build a source root and a matching installed root holding the same skills. */
async function twoRoots(t, names) {
  const source = await tempDir(t);
  const installed = await tempDir(t);
  for (const name of names) {
    await writeSkill(source, name, {
      references: { "detail.md": `# Detail for ${name}\n` },
    });
    await writeSkill(installed, name, {
      references: { "detail.md": `# Detail for ${name}\n` },
    });
  }
  return { source, installed };
}

describe("check-installed-copies.mjs", () => {
  it("exits 0 when every installed copy matches its source", async (t) => {
    const { source, installed } = await twoRoots(t, ["alpha-skill", "beta-skill"]);

    const result = checkCopies(source, installed);

    assert.equal(result.code, 0, result.output);
    assert.match(
      result.stdout,
      /All 2 distributable skill\(s\) match their installed copies\./,
    );
  });

  it("exits 1 when an installed copy's content differs", async (t) => {
    const { source, installed } = await twoRoots(t, ["alpha-skill"]);
    await writeFile(
      join(installed, "alpha-skill", "references", "detail.md"),
      "# Hand-edited\n",
      "utf8",
    );

    const result = checkCopies(source, installed);

    assert.equal(result.code, 1);
    assert.match(result.stdout, /DRIFT alpha-skill/);
    assert.match(result.stdout, /content differs: references\/detail\.md/);
    assert.match(result.stdout, /regenerate the installed copies with `npx skills`/);
  });

  it("exits 1 when a file exists only in the source", async (t) => {
    const { source, installed } = await twoRoots(t, ["alpha-skill"]);
    await rm(join(installed, "alpha-skill", "references", "detail.md"));

    const result = checkCopies(source, installed);

    assert.equal(result.code, 1);
    assert.match(
      result.stdout,
      /missing from the installed copy: references\/detail\.md/,
    );
  });

  it("exits 1 when a file exists only in the installed copy", async (t) => {
    const { source, installed } = await twoRoots(t, ["alpha-skill"]);
    await writeFile(
      join(installed, "alpha-skill", "STRAY.md"),
      "# Stray\n",
      "utf8",
    );

    const result = checkCopies(source, installed);

    assert.equal(result.code, 1);
    assert.match(result.stdout, /present only in the installed copy: STRAY\.md/);
  });

  it("exits 1 when a source skill has no installed copy at all", async (t) => {
    const { source, installed } = await twoRoots(t, ["alpha-skill"]);
    await rm(join(installed, "alpha-skill"), { recursive: true });

    const result = checkCopies(source, installed);

    assert.equal(result.code, 1);
    assert.match(result.stdout, /no installed copy under/);
  });

  it("accepts a known repository-local skill that has no source", async (t) => {
    const { source, installed } = await twoRoots(t, ["alpha-skill"]);
    await writeSkill(installed, "github-operation");

    const result = checkCopies(source, installed);

    assert.equal(result.code, 0, result.output);
    assert.match(result.stdout, /LOCAL github-operation \(repository-local/);
  });

  it("exits 1 on an installed skill that is neither sourced nor repository-local", async (t) => {
    const { source, installed } = await twoRoots(t, ["alpha-skill"]);
    await writeSkill(installed, "orphaned-skill");

    const result = checkCopies(source, installed);

    assert.equal(result.code, 1);
    assert.match(result.stdout, /DRIFT orphaned-skill/);
    assert.match(result.stdout, /not a known repository-local skill/);
  });

  it("exits 2 when a root is not a directory", async (t) => {
    const { installed } = await twoRoots(t, ["alpha-skill"]);

    const result = checkCopies(join(installed, "nope"), installed);

    assert.equal(result.code, 2);
    assert.match(result.stderr, /Not a directory:/);
  });

  it("exits 2 on too many arguments", () => {
    const result = checkCopies("a", "b", "c");

    assert.equal(result.code, 2);
    assert.match(result.stderr, /Usage: check-installed-copies\.mjs/);
  });

  it("passes on this repository's own tree with no arguments", () => {
    const result = checkCopies();

    assert.equal(result.code, 0, result.output);
    assert.match(result.stdout, /LOCAL github-operation/);
  });
});
