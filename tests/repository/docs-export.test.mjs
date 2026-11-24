import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { expect, it } from "vitest";

import { tempDir } from "../helpers/fixtures.mjs";
import { runScript } from "../helpers/run.mjs";

const exporter = "scripts/export-docs.mjs";
const project = "https://github.com/axross/skills";

/** create a repository whose second revision adds a source file outside the bundle. */
async function repository() {
  const root = await tempDir();
  const git = (...args) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  git("init", "--quiet", "--initial-branch=main");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.com");
  await mkdir(join(root, "docs"));
  await writeFile(
    join(root, "docs/index.md"),
    '---\nokf_version: "0.3"\n---\n[Guide](guide.md)\n',
  );
  await writeFile(
    join(root, "docs/guide.md"),
    "---\ntype: Procedure\n---\n# Guide\n",
  );
  git("add", ".");
  git("commit", "--quiet", "-m", "initial guide");
  const base = git("rev-parse", "HEAD");
  git("checkout", "--quiet", "-b", "topic");
  await mkdir(join(root, "source files"));
  await writeFile(join(root, "source files/new.md"), "# Branch only\n");
  const guide = [
    "---",
    "type: Procedure",
    "---",
    "# Guide",
    "",
    "[Source](../source%20files/new.md?plain=1#branch-only 'Title')",
    "[Sources][folder]",
    "",
    "[folder]: <../source files/>",
    "",
    "[Home](index.md) ![bundled](local.png) [site](https://example.com/guide)",
    "",
    `[Historical](${project}/blob/${base}/docs/guide.md)`,
    "",
    "`[literal](../absent.md)`",
    "",
    "```md",
    "[example](../absent.md)",
    "```",
    "",
    "Example <template>[inert](../absent.md)</template>.",
    "",
  ].join("\n");
  await writeFile(join(root, "docs/guide.md"), guide);
  await writeFile(join(root, "docs/local.png"), Buffer.from([0, 128, 255]));
  git("add", ".");
  git("commit", "--quiet", "-m", "link the topic source");
  const topic = git("rev-parse", "HEAD");
  return { root, git, base, topic, guide };
}

it("exports the selected commit and pins only its active repository links", async () => {
  const { root, base, topic, guide } = await repository();
  await writeFile(join(root, "docs/guide.md"), "dirty copy");
  const destination = join(root, "topic-export");
  const result = runScript(exporter, [destination], { cwd: root });
  expect(result.output).toContain(`Exported docs/ at ${topic}`);
  expect(result.code).toBe(0);
  expect(await readFile(join(destination, "guide.md"), "utf8")).toBe(
    guide
      .replace(
        "../source%20files/new.md",
        `${project}/blob/${topic}/source%20files/new.md`,
      )
      .replace("../source files/", `${project}/tree/${topic}/source%20files`),
  );
  expect(await readFile(join(destination, "local.png"))).toEqual(
    Buffer.from([0, 128, 255]),
  );
  const old = join(root, "old-export");
  expect(runScript(exporter, [old, base], { cwd: root }).code).toBe(0);
  expect(await readFile(join(old, "guide.md"), "utf8")).toBe(
    "---\ntype: Procedure\n---\n# Guide\n",
  );
  expect(runScript(exporter, [destination, base], { cwd: root }).code).not.toBe(
    0,
  );
  expect(await readFile(join(destination, "guide.md"), "utf8")).toContain(
    topic,
  );
});

it.each([
  ["missing target", "[Missing](../missing.md)"],
  ["checkout escape", "[Outside](../../elsewhere)"],
  [
    "unsupported cross-bundle HTML reference",
    '<a href="../source%20files/new.md">source</a>',
  ],
])("rejects %s without leaving a partial bundle", async (_case, link) => {
  const { root, git, guide } = await repository();
  await writeFile(join(root, "docs/guide.md"), guide + "\n" + link + "\n");
  git("commit", "--quiet", "-am", "invalid link");
  const output = join(root, "result");
  expect(runScript(exporter, [output], { cwd: root }).code).not.toBe(0);
  expect(await readdir(root)).not.toContain("result");
});

it("refuses symlinks in the bundle instead of reading their working-tree targets", async () => {
  const { root, git } = await repository();
  await symlink("../source files/new.md", join(root, "docs/alias.md"));
  git("add", "docs/alias.md");
  git("commit", "--quiet", "-m", "link to source");
  const output = join(root, "result");
  const result = runScript(exporter, [output], { cwd: root });
  expect(result.output).toContain("unsupported entry: docs/alias.md");
  expect(await readdir(root)).not.toContain("result");
});

it("resolves an external heading in the requested revision even when the current tree has repaired it", async () => {
  const { root, git, topic } = await repository();
  await writeFile(join(root, "source files/new.md"), "# Renamed heading\n");
  git("commit", "--quiet", "-am", "move published heading");
  const broken = git("rev-parse", "HEAD");
  await writeFile(join(root, "source files/new.md"), "# Branch only\n");
  git("commit", "--quiet", "-am", "restore published heading");
  const output = join(root, "selected");
  const result = runScript(exporter, [output, broken], { cwd: root });
  expect(result.code).toBe(1);
  expect(result.output).toContain("has no matching fragment in " + broken);
  expect(await readdir(root)).not.toContain("selected");
  expect(runScript(exporter, [output, topic], { cwd: root }).code).toBe(0);
});

it("pins the Markdown-decoded file name when entity and literal spellings both exist", async () => {
  const { root, git, guide } = await repository();
  await writeFile(join(root, "a&b.md"), "# Right\n");
  await writeFile(join(root, "a&amp;b.md"), "# Wrong\n");
  await writeFile(
    join(root, "docs/guide.md"),
    guide + "\n[Decoded](../a&amp;b.md#right)\n",
  );
  git("add", ".");
  git("commit", "--quiet", "-m", "link entity-escaped filename");
  const output = join(root, "entity");
  expect(runScript(exporter, [output], { cwd: root }).code).toBe(0);
  expect(await readFile(join(output, "guide.md"), "utf8")).toContain(
    "/a%26b.md#right",
  );
});

it.each([
  "![Diagram](../diagram.png)",
  "![Diagram][asset] and [Download][asset]\n\n[asset]: ../diagram.png",
])("rejects an embedded image outside the bundle: %s", async (image) => {
  const { root, git, guide } = await repository();
  await writeFile(join(root, "diagram.png"), Buffer.from([0, 128, 255]));
  await writeFile(join(root, "docs/guide.md"), guide + "\n" + image);
  git("add", ".");
  git("commit", "--quiet", "-m", "embed an image outside docs");
  const result = runScript(exporter, [join(root, "bundle")], { cwd: root });
  expect(result.code).toBe(1);
  expect(result.output).toContain(
    "embed an image inside docs/ instead of ../diagram.png",
  );
  expect(await readdir(root)).not.toContain("bundle");
});
