// Negative controls: every folded gate must still be able to fail.
//
// Folding the three checks into `npm test` is only worth anything if they still
// gate. A test that runs a checker over a clean tree passes just as happily when
// the checker has been broken, silently converting a merge gate into decoration.
//
// Each case here plants the violation that gate exists to catch into a throwaway
// tree and requires the SAME invocation from gates.mjs to report it.

import { describe, expect, it } from "vitest";

import { tempDir, writeFileIn, writeSkill } from "../helpers/fixtures.mjs";
import { runScript } from "../helpers/run.mjs";
import { gate } from "./gates.mjs";

describe("repository gates have teeth", () => {
  it("the links gate fails on a broken relative link", async () => {
    const { script, args } = gate("links");
    const root = await tempDir();
    await writeFileIn(root, "doc.md", "See [gone](./missing.md).\n");

    // The gate takes no path arguments, so it checks the working directory —
    // which makes `cwd` enough to point the real invocation at a planted tree.
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

  // The frontmatter gate is the one with teeth for a missing `description`.
  // Its two siblings read the body and the reference wiring, and a skill can be
  // malformed in the way below while both of those pass — which is the point of
  // splitting them, and the reason this case names one gate rather than looping
  // over all three.
  it("the skill-frontmatter gate fails on a malformed skill", async () => {
    const { script, args } = gate("skill-frontmatter");
    const root = await tempDir();
    // The gate names its roots relatively, so a tree of the same shape under a
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

    // Unlike the two gates above, this one resolves its default roots from the
    // script's own location rather than the working directory, so a planted
    // tree has to be named explicitly. Everything downstream of that resolution
    // is the same code path the no-argument gate runs.
    const result = runScript(script, [source, installed]);

    expect(result).toReportFailure(/content differs: references\/detail\.md/);
  });
});
