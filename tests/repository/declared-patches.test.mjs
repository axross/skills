// every patch a case declares, applied against the mock as it ships today.
//
// this is the drift class this repository already guards, in a new place. a
// case patch is written against one state of a mock and silently stops fitting
// the moment that mock moves — and the moment it stops fitting, the case it
// belongs to cannot be dispatched at all. nothing else would notice: the
// mocks are excluded from every other gate here, and the failure would
// otherwise surface in a dispatch that has already spent money reaching it.
//
// the fixture list is discovered from tools/evaluation/data/*/fixture.json
// rather than hard-coded, the same way mock-materialization.test.mjs
// discovers tools/evaluation/mocks/* rather than naming them: a third
// instrument that declares a patch is covered by this walk without an edit
// here.
//
// the walk is deliberately data-driven over the real fixtures. a check that
// can only pass is decoration, so the second describe below gives it teeth
// against a synthetic fixture: the same walk, over a case whose patch no
// longer applies, must report that case by name.

import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { tempDir } from "../helpers/fixtures.mjs";
import { patchFromMock } from "../helpers/mock-patch.mjs";
import { repoPath, runScript, SCRIPTS } from "../helpers/run.mjs";

const DATA_ROOT = repoPath("tools/evaluation/data");

/**
 * every `tools/evaluation/data/<name>/` directory that declares a
 * `fixture.json`, sorted for a stable test order. discovered rather than
 * named, so an instrument added beside `effect` and `discovery` is covered
 * without an edit here.
 *
 * @returns {Promise<Array<{ label: string, root: string }>>}
 */
async function discoverFixtures() {
  const names = (await readdir(DATA_ROOT, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const fixtures = [];
  for (const name of names) {
    const files = await readdir(join(DATA_ROOT, name));
    if (files.includes("fixture.json")) {
      fixtures.push({ label: name, root: join(DATA_ROOT, name) });
    }
  }
  return fixtures;
}

/** the fixtures whose cases may declare a patch. */
const FIXTURES = await discoverFixtures();

/**
 * materializes every case that declares a patch, and reports the ones that
 * failed — by case, which is the identity a reader has and `materialize` does
 * not.
 *
 * @param {string} root a data root holding fixture.json
 * @returns {Promise<Array<{ id: string, output: string }>>}
 * @throws {Error} when the root holds no fixture.json, or it does not parse
 */
async function failuresIn(root) {
  const fixture = JSON.parse(await readFile(join(root, "fixture.json"), "utf8"));
  const declaring = (fixture.cases ?? []).filter((entry) => entry.patch);

  const failures = [];
  for (const declared of declaring) {
    const result = runScript(SCRIPTS.setup, [
      "--mock",
      declared.mock,
      "--patch",
      join(root, declared.patch),
    ]);
    const workspace = result.stdout.trim();
    if (workspace) await rm(workspace, { recursive: true, force: true });
    if (result.code !== 0) failures.push({ id: declared.id, output: result.output });
  }
  return failures;
}

describe("every declared case patch", () => {
  // guards the discovery walk itself: an empty FIXTURES would make every case
  // below pass vacuously, which is indistinguishable from a walk that has
  // stopped finding tools/evaluation/data/*/fixture.json at all.
  it("finds at least one fixture, so the walk below is not vacuous", () => {
    expect(FIXTURES.length).toBeGreaterThan(0);
  });

  it.each(FIXTURES)("still applies to its mock in $label's fixture", async ({ root }) => {
    const failures = await failuresIn(root);

    expect(
      failures.map((failure) => `${failure.id}\n${failure.output}`),
      "a case whose patch no longer applies cannot be dispatched at all",
    ).toEqual([]);
  });
});

describe("the declared-patch walk", () => {
  it("reports the case when its patch no longer applies", async () => {
    // the negative control. with no case declaring a patch, the walk above
    // passes over an empty list, which is indistinguishable from a walk that
    // has stopped working — so the same function runs here against a fixture
    // built to fail.
    const root = join(await tempDir(), "data-root");
    await mkdir(join(root, "patches"), { recursive: true });
    await writeFile(
      join(root, "patches", "add-a-thing.patch"),
      [
        "diff --git a/README.md b/README.md",
        "--- a/README.md",
        "+++ b/README.md",
        "@@ -1,2 +1,2 @@",
        "-a line this mock has never contained",
        " and another",
        "+a replacement",
        "",
      ].join("\n"),
      "utf8",
    );
    await writeFile(
      join(root, "fixture.json"),
      `${JSON.stringify(
        {
          cases: [
            {
              id: "add-a-thing",
              mock: "tsuzuri",
              patch: "patches/add-a-thing.patch",
            },
          ],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const failures = await failuresIn(root);

    expect(failures.map((failure) => failure.id)).toEqual(["add-a-thing"]);
    expect(failures[0].output).toMatch(/did not apply to the mock/);
  });

  it("passes a patch that does fit, so the failure above is not the only outcome", async () => {
    const root = join(await tempDir(), "data-root");
    await mkdir(join(root, "patches"), { recursive: true });
    // generated against the real mock rather than hand-written, so what this
    // asserts is that the walk applies a fitting patch — not that one
    // particular diff was typed out correctly.
    const generated = await patchFromMock(async (tree) => {
      const path = join(tree, "README.md");
      await writeFile(path, `${await readFile(path, "utf8")}\n<!-- a case's note -->\n`, "utf8");
    });
    await copyFile(generated, join(root, "patches", "add-a-note.patch"));
    await writeFile(
      join(root, "fixture.json"),
      `${JSON.stringify(
        {
          cases: [{ id: "add-a-note", mock: "tsuzuri", patch: "patches/add-a-note.patch" }],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    expect(await failuresIn(root)).toEqual([]);
  });
});
