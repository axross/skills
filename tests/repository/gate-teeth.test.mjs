// negative controls: every folded gate must still be able to fail.
//
// folding the three checks into `npm test` is only worth anything if they still
// gate. a test that runs a checker over a clean tree passes just as happily when
// the checker has been broken, silently converting a merge gate into decoration.
//
// each case here plants the violation that gate exists to catch into a throwaway
// tree and requires that same invocation from gates.mjs to report it — except
// where the roster itself is under test. linksGateRoots() walks REPO_ROOT, not
// the fixture, so a path that exists only in a throwaway tree never becomes a
// root and the gate passes whatever the roster does; the collectRoots() case
// below therefore asserts on the roster directly.

import { describe, expect, it } from "vitest";

import {
  tempDir,
  writeDocs,
  writeFileIn,
  writeSkill,
} from "../helpers/fixtures.mjs";
import { runScript } from "../helpers/run.mjs";
import { collectRoots, gate } from "./gates.mjs";

describe("repository gates have teeth", () => {
  it("the links gate fails on a broken relative link", async () => {
    const { script, args } = gate("links");
    const root = await tempDir();
    // the gate names its roots explicitly now (see gates.mjs's
    // linksGateRoots) rather than sweeping the whole working directory, so
    // the planted file has to sit at one of those names — "AGENTS.md" is a
    // real top-level file of this repository, and always among them.
    await writeFileIn(root, "AGENTS.md", "See [gone](./missing.md).\n");

    const result = runScript(script, args, { cwd: root });

    expect(result).toReportFailure(/BROKEN LINKS/);
  });

  it("the links gate fails on a broken link inside a dot-directory", async () => {
    const { script, args } = gate("links");
    const root = await tempDir();
    await writeFileIn(root, ".claude/skills/x/SKILL.md", "[gone](./missing.md)\n");

    const result = runScript(script, args, { cwd: root });

    expect(
      result,
      "a dot-directory is exactly where this repository's skills live",
    ).toReportFailure(/missing\.md/);
  });

  it("the links gate never walks into tools/evaluation/mocks/", async () => {
    const { script, args } = gate("links");
    const root = await tempDir();
    // same broken-link shape as the first case above, planted under
    // tools/evaluation/mocks/ instead — linksGateRoots() excludes it on
    // purpose (the mock fixtures there carry their own toolchain), so this
    // must never be reported.
    await writeFileIn(
      root,
      "tools/evaluation/mocks/tsuzuri/doc.md",
      "See [gone](./missing.md).\n",
    );
    await writeFileIn(root, "AGENTS.md", "No broken links here.\n");

    const result = runScript(script, args, { cwd: root });

    expect(result).toPassCleanly();
  });

  it("the links gate reaches a sibling of the excluded path", async () => {
    const { script, args } = gate("links");
    const root = await tempDir();
    // `args` is the real repository's own root list (gates.mjs computes it
    // once, from the real tree), so the planted file has to sit under a name
    // that list actually contains — tools/evaluation/src is that name today,
    // the one real child tools/evaluation/ has besides the excluded mocks/.
    // reaching it is only possible if collectRoots() descends past tools/,
    // tools/evaluation/, and tools/evaluation/src/ instead of pruning any of
    // them wholesale — the case the mocks-exclusion test above cannot cover,
    // since a clean file there passes whether the roster reached it or never
    // saw it.
    await writeFileIn(
      root,
      "tools/evaluation/src/doc.md",
      "See [gone](./missing.md).\n",
    );

    const result = runScript(script, args, { cwd: root });

    expect(result).toReportFailure(/missing\.md/);
  });

  it("collectRoots() never turns a nested node_modules into a root", async () => {
    const root = await tempDir();
    // EXCLUDED_PATHS only names tools/evaluation/mocks by path now — .git and
    // node_modules are matched by name instead, at any depth, because
    // collectRoots() descends into tools/evaluation/ and an `npm install` run
    // there would otherwise hand the links gate a whole dependency tree that
    // `git status` never shows (node_modules/ is gitignored at any depth).
    await writeFileIn(
      root,
      "tools/evaluation/node_modules/somepkg/index.js",
      "",
    );
    await writeFileIn(root, "tools/evaluation/src/doc.md", "");

    const roots = collectRoots(root, "");

    expect(roots).not.toContain("tools/evaluation/node_modules");
    // collectRoots() only descends as far as an ancestor of the excluded
    // tools/evaluation/mocks path — src/ is a sibling of mocks/, not an
    // ancestor of it, so it is the root pushed, not src/doc.md's parent.
    expect(roots).toContain("tools/evaluation/src");
  });

  it("the links gate still reaches an ordinary top-level directory", async () => {
    const { script, args } = gate("links");
    const root = await tempDir();
    // the two cases above prove the roster reaches the repository root and a
    // dot-directory, and that it stops at tools/evaluation/mocks/. neither
    // would notice the roster being over-pruned — linksGateRoots() builds it
    // by descending past an excluded path's own ancestors, so one careless
    // widening of that exclusion set silently drops a whole tree while the
    // gate keeps reporting "links OK" (its success pattern accepts a count
    // of zero). an ordinary, non-dot, non-excluded directory is the case
    // that fails when that happens.
    await writeFileIn(root, "docs/guide.md", "See [gone](./missing.md).\n");

    const result = runScript(script, args, { cwd: root });

    expect(result).toReportFailure(/missing\.md/);
  });

  // the frontmatter gate is the one with teeth for a missing `description`.
  // its two siblings read the body and the reference wiring, and a skill can be
  // malformed in the way below while both of those pass — which is the point of
  // splitting them, and the reason this case names one gate rather than looping
  // over all three.
  it("the skill-frontmatter gate fails on a malformed skill", async () => {
    const { script, args } = gate("skill-frontmatter");
    const root = await tempDir();
    // the gate names its roots relatively, so a tree of the same shape under a
    // different cwd exercises the real invocation.
    await writeSkill(`${root}/skills`, "broken-skill", {
      frontmatter: { description: null },
    });
    await writeSkill(`${root}/.agents/skills`, "broken-skill", {
      frontmatter: { description: null },
    });

    const result = runScript(script, args, { cwd: root });

    expect(result).toReportFailure(/`description` is missing or empty/);
  });

  it("the installed-copies gate fails on a hand-edited installed copy", async () => {
    const { script } = gate("installed-copies");
    const source = await tempDir();
    const installed = await tempDir();
    await writeSkill(source, "alpha-skill", {
      references: { "detail.md": "# Detail\n" },
    });
    await writeSkill(installed, "alpha-skill", {
      references: { "detail.md": "# Hand-edited\n" },
    });

    // unlike the two gates above, this one resolves its default roots from the
    // script's own location rather than the working directory, so a planted
    // tree has to be named explicitly. everything downstream of that resolution
    // is the same code path the no-argument gate runs.
    const result = runScript(script, [source, installed]);

    expect(result).toReportFailure(/content differs: references\/detail\.md/);
  });

  // the five docs/ gates need no argument override at all. each names `docs`,
  // which the validator resolves against the working directory, and
  // `writeDocs` plants exactly that layout — so every case below runs the
  // real invocation with nothing changed but `cwd`.
  //
  // `corpus-glossary`'s case was once the only evidence that gate could fail:
  // with no spec under docs/ it reported "Nothing to check", which no passing
  // run can tell apart from a check that has stopped working. docs/ has a
  // spec now and the gate requires the counted message, so the real-repository
  // run in gate-runs.test.mjs carries teeth evidence too. this case still earns
  // its place by covering the shape a planted spec produces — an unpaired
  // heading — which a tree that is currently correct cannot exercise.

  it("the corpus-index gate fails on a document nothing links", async () => {
    const { script, args } = gate("corpus-index");
    const root = await tempDir();
    await writeDocs(root, { "glossary.md": "# Glossary\n" });

    const result = runScript(script, args, { cwd: root });

    expect(result).toReportFailure(/glossary\.md is not linked from index\.md/);
  });

  it("the corpus-references gate fails on a link that does not resolve", async () => {
    const { script, args } = gate("corpus-references");
    const root = await tempDir();
    await writeDocs(root, {
      "index.md": "# Documentation\n\n- [gone](./missing.md)\n",
    });

    const result = runScript(script, args, { cwd: root });

    expect(result).toReportFailure(/index\.md:3 → \.\/missing\.md does not resolve/);
  });

  it("the corpus-glossary gate fails on a spec with no glossary heading", async () => {
    const { script, args } = gate("corpus-glossary");
    const root = await tempDir();
    await writeDocs(root, {
      "glossary.md": "# Glossary\n\n## Something Else\n",
      "specs/billing.md": "# Billing\n",
    });

    const result = runScript(script, args, { cwd: root });

    expect(result).toReportFailure(
      /specs\/billing\.md has no matching heading in glossary\.md/,
    );
  });

  it("the decision-naming gate fails on a non-conforming record filename", async () => {
    const { script, args } = gate("decision-naming");
    const root = await tempDir();
    await writeDocs(root, {
      "decisions/use_a_queue.md": "---\nstatus: accepted\n---\n\n# Use a queue\n",
    });

    const result = runScript(script, args, { cwd: root });

    expect(result).toReportFailure(/filename: decisions\/use_a_queue\.md/);
  });

  it("the decision-supersede gate fails on a record superseded by nothing", async () => {
    const { script, args } = gate("decision-supersede");
    const root = await tempDir();
    await writeDocs(root, {
      "decisions/2026-07-02-use-a-queue.md":
        "---\nstatus: superseded\n---\n\n# Use a queue\n",
    });

    const result = runScript(script, args, { cwd: root });

    expect(result).toReportFailure(/is superseded but names no superseded_by/);
  });
});
