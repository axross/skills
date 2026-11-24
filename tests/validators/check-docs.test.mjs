import { spawnSync } from "node:child_process";
import { chmod, cp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { readMarkdown } from "../../skills/living-project-documentation/scripts/okf.mjs";
import { loadDocs } from "../../skills/living-project-documentation/scripts/docs.mjs";
import {
  checkGlossary,
  checkIndex,
  checkReferences,
} from "../../skills/living-project-documentation/scripts/navigation.mjs";
import { tempDir, writeDocs, writeFileIn } from "../helpers/fixtures.mjs";
import { repoPath, runScript } from "../helpers/run.mjs";

const skill = "skills/living-project-documentation";
const command = skill + "/scripts/check-docs.mjs";
const review = "references/documentation-structure.md#review-the-declared-type";
const pinned = process.env.OKF_VALIDATOR;
const indexHeader = '---\nokf_version: "0.3"\n---\n';
const pageHeader = "---\ntype: Procedure\n---\n";

/**
 * inspect engineering findings independently of the optional upstream installation.
 * @throws when a test tree cannot be inspected.
 */
async function engineering(dir, evidence = [], sourceRoot) {
  const docs = await loadDocs(dir, sourceRoot, { wholeRoot: true });
  return [
    ...(await checkIndex(docs, new Set(evidence))),
    ...(await checkReferences(docs, sourceRoot)),
    ...checkGlossary(docs),
  ].map(({ category, message }) => `${category}: ${message}`);
}

describe("whole-root engineering checks", () => {
  it("keeps checking each page and fragment through removal of the last type or version marker", async () => {
    const dir = await writeDocs(await tempDir(), {
      "index.md": indexHeader + "[Guide](guide.md#absent) [Notes](notes.md)",
      "guide.md": pageHeader + "# Guide",
      "notes.md": "# Notes",
      ".private/unfinished.md": "Hidden",
    });
    expect(await engineering(dir)).toEqual([
      "type: notes.md needs a nonempty string type",
      "link: index.md:4 → guide.md#absent has no matching fragment",
    ]);
    await writeFile(
      join(dir, "index.md"),
      "[Guide](guide.md#absent) [Notes](notes.md)",
    );
    await writeFile(join(dir, "guide.md"), "# Guide");
    expect(await engineering(dir)).toEqual([
      "type: guide.md needs a nonempty string type",
      "type: notes.md needs a nonempty string type",
      "link: index.md:1 → guide.md#absent has no matching fragment",
    ]);
    await writeFile(join(dir, "guide.md"), pageHeader + "# Absent");
    await writeFile(join(dir, "notes.md"), pageHeader + "# Notes");
    expect(await engineering(dir)).toEqual([]);
  });

  it("checks available pages, path fields and legacy glossary domains when the index is absent", async () => {
    const dir = await writeDocs(await tempDir(), {
      "index.md": null,
      "specs/guide.md":
        "---\nresource: missing.txt\n---\n[Link](absent.md) [Heading](#gone)",
    });
    const findings = await engineering(dir);
    expect(findings).toHaveLength(6);
    expect(findings).toContain(
      "index: index.md is missing from the populated documentation root",
    );
    expect(findings).toContain(
      "type: specs/guide.md needs a nonempty string type",
    );
    expect(findings).toContain(
      "resource: specs/guide.md:2 → missing.txt does not resolve",
    );
    expect(findings).toContain(
      "link: specs/guide.md:4 → absent.md does not resolve",
    );
    expect(findings).toContain(
      "link: specs/guide.md:4 → #gone has no matching fragment",
    );
    expect(findings.join("\n")).toContain("glossary.md is missing");
  });

  it("requires an index for a root containing only a visible asset", async () => {
    const root = await tempDir();
    const dir = await writeDocs(root, {
      "index.md": null,
      ".draft/note.md": "hidden",
    });
    expect(await engineering(dir)).toEqual([]);
    await writeFileIn(dir, "media/diagram.png", "asset");
    expect(await engineering(dir)).toEqual([
      "index: index.md is missing from the populated documentation root",
    ]);
  });

  it("requires a nonblank string type even when an invalid declaration is named as evidence", async () => {
    const dir = await writeDocs(await tempDir(), {
      "index.md": "[A](a.md) [B](b.md)",
      "a.md": "---\ntype: '  '\n---\n",
      "b.md": "---\ntype: [Description]\n---\n",
    });
    const findings = await engineering(dir, ["a.md", "b.md"]);
    expect(findings).toContain("type: a.md needs a nonempty string type");
    expect(findings).toContain("type: b.md needs a nonempty string type");
  });

  it("checks links from each published Markdown path whose target is a non-Markdown file", async () => {
    const root = await tempDir();
    const dir = await writeDocs(root, {
      "index.md": "[Guide](old/guide.md#working) [Ordinary](same.md#ordinary)",
      "topics/help.txt": "help",
      "data/content.txt":
        pageHeader + "# Working\n[Help](help.txt) [Missing](gone.txt)",
      "ordinary.md": pageHeader + "# Ordinary",
      ".private.txt": "hidden",
    });
    await writeFileIn(root, "outside.txt", "outside");
    await symlink("../data/content.txt", join(dir, "topics/guide.md"));
    await symlink("topics", join(dir, "old"), "dir");
    await symlink("ordinary.md", join(dir, "same.md"));
    await symlink(".private.txt", join(dir, "hidden.md"));
    await symlink("../outside.txt", join(dir, "external.md"));
    const docs = await loadDocs(dir, undefined, { wholeRoot: true });
    expect(docs.documents.map(({ relative }) => relative)).toEqual([
      "index.md",
      "ordinary.md",
      "topics/guide.md",
    ]);
    expect(await engineering(dir)).toEqual([
      "link: topics/guide.md:5 → gone.txt does not resolve",
    ]);
    await writeFileIn(dir, "topics/gone.txt", "now present");
    expect(await engineering(dir)).toEqual([]);
    await writeFile(join(dir, "data/content.txt"), "untyped");
    const findings = await engineering(dir);
    expect(findings).toContain(
      "type: topics/guide.md needs a nonempty string type",
    );
    expect(findings).toContain(
      "link: index.md:1 → old/guide.md#working has no matching fragment",
    );
  });

  it("permits checkout links with --source-root and checks their fragments", async () => {
    const root = await tempDir();
    const dir = await writeDocs(root, {
      "index.md": "[Guide](guide.md)",
      "guide.md": pageHeader + "[Checkout](../README.md#setup)",
    });
    await writeFileIn(root, "README.md", "# Setup");
    expect(await engineering(dir, [], root)).toEqual([]);
    expect((await engineering(dir)).join("\n")).toContain("leaves the bundle");
    await writeFile(join(root, "README.md"), "# Changed");
    expect((await engineering(dir, [], root)).join("\n")).toContain(
      "has no matching fragment",
    );
  });
});

describe("check-docs.mjs", () => {
  it.skipIf(process.platform === "win32")(
    "lists every page under a low file descriptor limit",
    async () => {
      const root = await tempDir();
      const names = Array.from({ length: 150 }, (_, i) => `guide-${i}.md`);
      const files = Object.fromEntries(
        names.map((name) => [name, pageHeader + "# Guide"]),
      );
      const dir = await writeDocs(root, {
        ...files,
        "index.md": names.map((name) => `[${name}](${name}#guide)`).join("\n"),
      });
      const result = spawnSync(
        "sh",
        [
          "-c",
          'ulimit -n 64 && exec "$@"',
          "sh",
          process.execPath,
          repoPath(command),
          "--validator",
          pinned ?? join(root, "missing.py"),
          dir,
        ],
        { encoding: "utf8" },
      );
      expect(result.status, result.stderr).toBe(pinned ? 0 : 2);
      expect(result.stderr).not.toContain("EMFILE");
      expect(result.stdout).not.toContain("ENGINEERING");
      expect(result.stdout.match(/^REVIEW /gm)).toHaveLength(names.length);
    },
  );

  it.skipIf(!pinned)(
    "keeps an upstream W120 advisory for a valid YAML 1.2 type",
    async () => {
      const dir = await writeDocs(await tempDir(), {
        "index.md": indexHeader + "[Guide](guide.md)",
        "guide.md": "---\ntype: On\n---\n# Guide",
      });
      await symlink("guide.md", join(dir, "alias.md"));
      const result = runScript(command, ["--validator", pinned, dir]);
      expect(result.code, result.output).toBe(0);
      expect(result.stdout).toContain("OKF WARNING W120 guide.md");
      expect(result.stdout).toContain("OKF WARNING W120 alias.md");
      expect(result.stdout.match(/^REVIEW /gm)).toHaveLength(1);
      expect(result.stdout).toContain('REVIEW guide.md — "On"');
      expect(result.stdout).not.toContain("living-page type required");
    },
  );

  it("shows the review on a mixed tree even if the validator cannot run", async () => {
    const root = await tempDir();
    const dir = await writeDocs(root, {
      "index.md": indexHeader + "[Typed](typed.md) [Untyped](untyped.md)",
      "typed.md": pageHeader,
      "untyped.md": "Missing type",
    });
    const result = runScript(command, [
      "--validator",
      join(root, "missing.py"),
      dir,
    ]);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("Could not complete OKF validation");
    expect(result.stdout).toContain(review);
    expect(result.stdout).toContain('REVIEW typed.md — "Procedure"');
    expect(result.stdout).toContain("ENGINEERING type: untyped.md");
    expect(result.stdout).not.toMatch(/^PASS/m);
    const unpinned = await writeFileIn(
      root,
      "other.py",
      'print("unexpected execution")',
    );
    const mismatch = runScript(command, ["--validator", unpinned, dir]);
    expect(mismatch.code).toBe(2);
    expect(mismatch.stderr).toContain(
      "does not match the pinned validator SHA-256",
    );
  });

  it.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
    "lists readable typed pages alongside unreadable directories",
    async () => {
      const root = await tempDir();
      const dir = await writeDocs(root, {
        "index.md": "[Guide](guide.md)",
        "guide.md": pageHeader,
        "private/memo.md": pageHeader,
      });
      const privateDir = join(dir, "private");
      await chmod(privateDir, 0o000);
      try {
        const result = runScript(command, [
          "--validator",
          pinned ?? join(root, "missing.py"),
          dir,
        ]);
        expect(result.code).toBe(2);
        expect(result.stderr).toContain(privateDir);
        expect(result.stdout).toContain('REVIEW guide.md — "Procedure"');
        expect(result.stdout).not.toMatch(/^PASS/m);
      } finally {
        await chmod(privateDir, 0o700);
      }
    },
  );

  it("runs the copied installation offline and identifies its missing Node dependencies", async () => {
    const root = await tempDir();
    const installed = join(root, "living-project-documentation");
    await cp(repoPath(skill), installed, {
      recursive: true,
      filter: (path) => !path.endsWith("node_modules"),
    });
    const script = relative(
      repoPath(),
      join(installed, "scripts/check-docs.mjs"),
    );
    const example = join(installed, "assets/type-review-example");
    const args = ["--validator", pinned ?? join(root, "missing.py"), example];
    const missing = runScript(script, args, { cwd: root });
    expect(missing.code).toBe(2);
    expect(missing.stderr).toContain("npm ci --ignore-scripts");
    const install = spawnSync(
      "npm",
      ["ci", "--offline", "--ignore-scripts", "--no-audit", "--no-fund"],
      {
        cwd: join(installed, "scripts"),
        encoding: "utf8",
      },
    );
    expect(install.status, install.stderr).toBe(0);
    const result = runScript(script, args, { cwd: root });
    expect(result.code, result.stderr).toBe(pinned ? 0 : 2);
    expect(result.stdout).toContain(review);
    expect(result.stdout).toContain('REVIEW delivery-notes.md — "Description"');
    expect(result.stdout).toContain('REVIEW services.md — "ServiceRegistry"');
    expect(result.stdout).not.toContain("ENGINEERING");
    const [file, anchor] = review.split("#");
    const guidance = await readFile(join(installed, file), "utf8");
    expect(readMarkdown(guidance).anchors.has(anchor)).toBe(true);
  });

  it.skipIf(!pinned)(
    "surfaces pinned upstream errors and advisory warnings alongside local findings",
    async () => {
      const dir = await writeDocs(await tempDir(), {
        "index.md": "[Sub](nested/index.md)",
        "nested/index.md": "---\ntitle: Invalid\n---\n[Guide](guide.md)",
        "nested/guide.md": pageHeader + "[Missing](#gone)",
        "log.md": "---\ntitle: Invalid\n---\n",
      });
      const result = runScript(command, ["--validator", pinned, dir]);
      expect(result.code).toBe(1);
      expect(result.stdout).toMatch(
        /OKF ERROR E004 nested\/index.md:1: .*frontmatter/,
      );
      expect(result.stdout).toMatch(/OKF ERROR E006 log.md:1: .*frontmatter/);
      expect(result.stdout).toContain("OKF WARNING W125 index.md");
      expect(result.stdout).toContain(
        "ENGINEERING link: nested/guide.md:4 → #gone has no matching fragment",
      );
      expect(result.stdout).toContain('REVIEW nested/guide.md — "Procedure"');

      await rm(join(dir, "index.md"));
      expect(runScript(command, ["--validator", pinned, dir]).stdout).toContain(
        "ENGINEERING index: index.md is missing",
      );
    },
  );

  it.skipIf(!pinned)(
    "requires an exact evidence exception for a second name reported by upstream",
    async () => {
      const dir = await writeDocs(await tempDir(), {
        "index.md": indexHeader + "[Source](raw.md)",
        "raw.md": "# Original evidence",
      });
      await symlink("raw.md", join(dir, "alias.md"));
      const args = ["--validator", pinned, "--evidence", "raw.md"];
      const extra = runScript(command, [...args, dir]);
      expect(extra.code, extra.output).toBe(1);
      expect(extra.stdout).toContain(
        "ENGINEERING type: alias.md needs a nonempty string type",
      );
      const both = runScript(command, [...args, "--evidence", "alias.md", dir]);
      expect(both.code, both.output).toBe(0);
      expect(both.stdout).toMatch(/W120 alias.md:1: .*named evidence/);
    },
  );

  it.skipIf(!pinned)(
    "checks the living file used as a root index alias",
    async () => {
      const dir = await writeDocs(await tempDir(), {
        "index.md": null,
        "guide.md": "# Guide",
      });
      await symlink("guide.md", join(dir, "index.md"));
      const result = runScript(command, ["--validator", pinned, dir]);
      expect(result.code).toBe(1);
      expect(result.stdout).toContain(
        "ENGINEERING type: guide.md needs a nonempty string type",
      );
      await writeFile(join(dir, "guide.md"), pageHeader + "# Guide");
      const corrected = runScript(command, ["--validator", pinned, dir]);
      expect(corrected.code, corrected.output).toBe(0);
      expect(corrected.stdout).toContain('REVIEW guide.md — "Procedure"');
    },
  );

  it.skipIf(!pinned)(
    "preserves two exact W120 exceptions without hiding independent failures",
    async () => {
      const root = await tempDir();
      const dir = await writeDocs(root, {
        "index.md": indexHeader + "[Guide](guide.md)",
        "guide.md":
          pageHeader + "[One](evidence/one.md) [Two](evidence/two.md)",
        "evidence/one.md": "# Source\r\n",
        "evidence/two.md": "[Original](record.txt)\r\n",
        "evidence/record.txt": "Record",
      });
      const sources = ["evidence/one.md", "evidence/two.md"];
      const bytes = () =>
        Promise.all(sources.map((name) => readFile(join(dir, name))));
      const original = await bytes();
      const args = [
        "--validator",
        pinned,
        ...sources.flatMap((path) => ["--evidence", path]),
        dir,
      ];
      const pass = runScript(command, args);
      expect(pass.code, pass.output).toBe(0);
      for (const source of sources) {
        expect(pass.stdout).toContain(`OKF WARNING W120 ${source}:1:`);
      }
      expect(await bytes()).toEqual(original);
      await writeFile(join(dir, "extra.md"), "# Untyped");
      const extra = runScript(command, args);
      expect(extra.code).toBe(1);
      expect(extra.stdout).toContain("ENGINEERING type: extra.md");
      expect(await bytes()).toEqual(original);
      await rm(join(dir, "extra.md"));
      await rm(join(dir, "evidence/record.txt"));
      const broken = runScript(command, args);
      expect(broken.code).toBe(1);
      expect(broken.stdout).toContain(
        "ENGINEERING link: evidence/two.md:1 → record.txt does not resolve",
      );
      expect(await bytes()).toEqual(original);
    },
  );
});
