// Contract for the obligation-load reporter.
//
// Unlike every other script in this suite, this one has no pass/fail semantics:
// its documented contract is exit 0 on EVERY valid invocation regardless of the
// numbers, and 2 only on a bad invocation. So the cases below assert two things
// the other validator tests never have to — that a large, alarming number still
// exits 0, and that the report says out loud it defines no threshold.
//
// The counts are asserted against fixtures whose obligation count is known BY
// CONSTRUCTION, so a case fails when the tool miscounts rather than when the
// corpus changes. The two figures that are pinned to the real corpus — the
// mandated set's floor and ceiling — are pinned deliberately: they are the
// numbers the tracking issue records, and a silent drift in them is exactly what
// a reader of this report would want to be told about.
//
// The definition itself is tested in tests/unit/guidelines.test.mjs. What this
// file adds is the claim that the reporter and check-skill.mjs READ that shared
// definition consistently — see the partition case.

import { access, readdir } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { estimateTokens } from "../../skills/agent-skill-authoring/scripts/token-estimate.mjs";
import { tempDir, writeSkill } from "../helpers/fixtures.mjs";
import { repoPath, SCRIPTS, validator } from "../helpers/run.mjs";

const report = validator(SCRIPTS.reportObligationLoad);
const checkSkill = validator(SCRIPTS.checkSkill);

/** The always-on set, mirroring the script's own MANDATED_SKILLS. */
const MANDATED_SKILLS = [
  "professional-behavior",
  "software-development",
  "loop-engineering",
];

/** A skill body stating `count` obligations under one Guidelines block. */
function bodyWithObligations(count, { heading = "Topic" } = {}) {
  const bullets = Array.from(
    { length: count },
    (_, index) => `- MUST hold rule number ${index + 1}.`,
  );
  return [
    `# Fixture`,
    "",
    `## ${heading}`,
    "",
    "Prose that demonstrates the topic before stating rules.",
    "",
    "**Guidelines:**",
    "",
    ...bullets,
    "",
  ].join("\n");
}

/** Parse the report's `total` row into its six numbers. */
function totalsOf(stdout) {
  const row = stdout
    .split("\n")
    .find((line) => line.startsWith("total"));
  if (!row) throw new Error(`No total row in report:\n${stdout}`);
  const numbers = row
    .slice("total".length)
    .trim()
    .split(/\s+/)
    .map((cell) => Number(cell.replace(/,/g, "")));
  const [floorObligations, floorBytes, floorTokens, ceilingObligations, ceilingBytes, ceilingTokens] =
    numbers;
  return {
    floorObligations,
    floorBytes,
    floorTokens,
    ceilingObligations,
    ceilingBytes,
    ceilingTokens,
  };
}

/**
 * The skill directory names directly under a repository skill root, read from
 * disk.
 *
 * An oracle for the selection cases below, independent of the code under test:
 * this answers only "what is on disk", while the reporter owns argument
 * resolution, cross-root dedup, ordering, and measurement. Deriving the
 * expectation rather than writing the count as a literal is what keeps those
 * cases failing when selection breaks instead of when a skill is added.
 */
async function skillNamesUnder(root) {
  const names = [];
  for (const entry of await readdir(repoPath(root), { withFileTypes: true })) {
    // A symlinked entry counts: `.claude/skills` mirrors `.agents/skills`
    // by symlink, and `isDirectory()` is false for one. The SKILL.md
    // test below stats through the link and does the real filtering.
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    const holdsSkillFile = await access(
      repoPath(root, entry.name, "SKILL.md"),
    ).then(
      () => true,
      () => false,
    );
    if (holdsSkillFile) names.push(entry.name);
  }
  return names.sort();
}

/**
 * The per-skill row names of a report, in printed order.
 *
 * Rows sit between the two dashed rules, and the `total` row follows the
 * second — so slicing between them drops the total without matching its name.
 */
function rowNamesOf(stdout) {
  const lines = stdout.split("\n");
  const rules = [];
  lines.forEach((line, index) => {
    if (/^-{3,}$/.test(line)) rules.push(index);
  });
  if (rules.length < 2) throw new Error(`No row block in report:\n${stdout}`);
  return lines.slice(rules[0] + 1, rules[1]).map((line) => line.split(/\s+/)[0]);
}

/** The skill count the report's headline states. */
function headlineCountOf(stdout) {
  const match = stdout.match(/^Obligation load for (\d+) skill\(s\)/m);
  if (!match) throw new Error(`No headline in report:\n${stdout}`);
  return Number(match[1]);
}

describe("report-obligation-load.mjs", () => {
  describe("counting", () => {
    it("counts the obligations a single skill's SKILL.md states", async () => {
      const root = await tempDir();
      await writeSkill(root, "alpha-skill", { body: bodyWithObligations(4) });

      const result = report(`${root}/alpha-skill`);

      expect(result).toPassCleanly();
      expect(totalsOf(result.stdout).floorObligations).toBe(4);
    });

    it("sums the obligations across every selected skill", async () => {
      const root = await tempDir();
      await writeSkill(root, "alpha-skill", { body: bodyWithObligations(4) });
      await writeSkill(root, "beta-skill", { body: bodyWithObligations(3) });

      const result = report(root);

      expect(result).toPassCleanly();
      expect(totalsOf(result.stdout).floorObligations).toBe(7);
    });

    it("excludes reference obligations from the floor and includes them in the ceiling", async () => {
      const root = await tempDir();
      await writeSkill(root, "alpha-skill", {
        body: `${bodyWithObligations(2)}\nSee [detail.md](./references/detail.md) for:\n\n- the detail\n`,
        references: { "detail.md": bodyWithObligations(5) },
      });

      const totals = totalsOf(report(`${root}/alpha-skill`).stdout);

      expect(totals.floorObligations).toBe(2);
      // The ceiling always CONTAINS the floor rather than sitting beside it.
      expect(totals.ceilingObligations).toBe(7);
    });

    it("counts every references/*.md, not only the first", async () => {
      const root = await tempDir();
      await writeSkill(root, "alpha-skill", {
        body: bodyWithObligations(1),
        references: {
          "one.md": bodyWithObligations(2),
          "two.md": bodyWithObligations(3),
        },
      });

      expect(totalsOf(report(`${root}/alpha-skill`).stdout).ceilingObligations).toBe(6);
    });

    it("reports a floor equal to the ceiling for a skill with no references", async () => {
      const root = await tempDir();
      await writeSkill(root, "alpha-skill", { body: bodyWithObligations(3) });

      const totals = totalsOf(report(`${root}/alpha-skill`).stdout);

      expect(totals.floorObligations).toBe(3);
      expect(totals.ceilingObligations).toBe(3);
    });

    it("counts zero for a skill that states no rules", async () => {
      const root = await tempDir();
      await writeSkill(root, "alpha-skill", {
        body: "# Fixture\n\nProse only, routing to nothing.\n",
      });

      const result = report(`${root}/alpha-skill`);

      expect(result).toPassCleanly();
      expect(totalsOf(result.stdout).floorObligations).toBe(0);
    });

    it("derives the token estimate from the byte count it reports", async () => {
      const root = await tempDir();
      await writeSkill(root, "alpha-skill", { body: bodyWithObligations(2) });

      const totals = totalsOf(report(`${root}/alpha-skill`).stdout);

      // The reader is told they can redo the division from the bytes shown; this
      // holds the report's two columns to that. Derived through the shared
      // estimator rather than a literal divisor, so re-calibrating the proxy —
      // which its own header invites — moves this assertion with it instead of
      // failing it.
      expect(totals.floorTokens).toBe(estimateTokens(totals.floorBytes));
    });
  });

  describe("selection", () => {
    it("selects the always-on set from --mandated with no skill named", async () => {
      const result = report("--mandated");

      expect(result).toPassCleanly();
      expect(result.stdout).toMatch(/the always-on set CLAUDE\.md mandates/);
      for (const name of MANDATED_SKILLS) {
        expect(result.stdout).toMatch(new RegExp(`^${name}\\s`, "m"));
      }
    });

    it("resolves a skill by bare name", async () => {
      const result = report("code-review");

      expect(result).toPassCleanly();
      expect(result.stdout).toMatch(/^code-review\s/m);
    });

    it("resolves a skill by path", async () => {
      const result = report("skills/code-review");

      expect(result).toPassCleanly();
      expect(result.stdout).toMatch(/^code-review\s/m);
    });

    it("expands a directory whose subdirectories are skills", async () => {
      // The claim is that the expansion is COMPLETE — every skill under the
      // root, not merely the first one found. A literal count said that only
      // until the corpus next changed size, which is how this suite went red on
      // main; the oracle says it for any corpus.
      const expected = await skillNamesUnder("skills");

      const result = report("skills");

      expect(result).toPassCleanly();
      expect(rowNamesOf(result.stdout)).toEqual(expected);
      expect(headlineCountOf(result.stdout)).toBe(expected.length);
    });

    it("combines --mandated with further named skills", async () => {
      const result = report("--mandated", "code-review", "quality-assurance");

      expect(result).toPassCleanly();
      expect(result.stdout).toMatch(/Obligation load for 5 skill\(s\)/);
    });

    it("counts a skill once when it is selected twice", async () => {
      const both = report("--mandated", "loop-engineering");
      const once = report("--mandated");

      expect(totalsOf(both.stdout)).toEqual(totalsOf(once.stdout));
    });

    it("reports every skill in the repository when given no arguments", async () => {
      // "Every skill" is the DEDUPLICATED UNION of the two roots, and that is
      // what this asserts — not a total, which a broken union and a broken
      // dedup could both produce by coincidence. The installed root holds a copy
      // of every distributable skill, so a missing `seen` guard reports each one
      // twice, and that is the tooth this case still has.
      //
      // It used to have a second one: while some skill lived only under the
      // installed root, `union.length > sourceTier.length` caught a root left
      // unscanned. No skill is repository-local any more — every skill is
      // authored under `skills/` and installed — so the two roots hold the same
      // names and NO assertion over them can tell "scanned both" from "scanned
      // one". That tooth is therefore gone rather than weakened, and it returns
      // on its own the moment a repository-local skill is added back. The
      // previous assertion is deleted instead of relaxed to `>=`, which would
      // have left a line reading as a guard that guards nothing.
      const sourceTier = await skillNamesUnder("skills");
      const installedTier = await skillNamesUnder(".claude/skills");
      const union = [...new Set([...sourceTier, ...installedTier])].sort();

      const result = report();

      expect(result).toPassCleanly();
      expect(rowNamesOf(result.stdout)).toEqual(union);
      expect(headlineCountOf(result.stdout)).toBe(union.length);
      // Keeps the dedup tooth sharp: both roots must actually be populated and
      // overlapping, or "reports each one twice" is not a failure mode here.
      expect(sourceTier.length).toBeGreaterThan(0);
      expect(installedTier).toEqual(expect.arrayContaining(sourceTier));
    });

    it("resolves every mandated skill name to a real skill", async () => {
      // The one mechanical pin available on MANDATED_SKILLS: CLAUDE.md's prose
      // owns the set, and a prose parse cannot see all three (software-development
      // is never named by its skill name there), so a rename or deletion is what
      // this catches. `--mandated` exits 2 when a name resolves to nothing.
      const result = report("--mandated");

      expect(result).toExitWith(0);
      expect(result.stdout).toMatch(/Obligation load for 3 skill\(s\)/);
    });
  });

  describe("report content", () => {
    it("labels the two figures a floor and a ceiling", async () => {
      const result = report("--mandated");

      expect.soft(result.stdout).toMatch(/^Floor\s+\(SKILL\.md bodies alone\):/m);
      expect.soft(result.stdout).toMatch(/^Ceiling\s+\(every reference read too\):/m);
    });

    it("shows raw bytes alongside each token estimate and names the proxy uncertainty", async () => {
      const result = report("--mandated");

      expect.soft(result.stdout).toMatch(/bytes/);
      expect.soft(result.stdout).toMatch(/~tokens/);
      expect.soft(result.stdout).toMatch(/±5%/);
      expect.soft(result.stdout).toMatch(/4\.76/);
    });

    it("states that it defines no threshold", async () => {
      // The recorded risk is that a number with no threshold invites someone to
      // invent one informally; the report saying so is the mitigation.
      expect(report("--mandated").stdout).toMatch(/No threshold is defined/);
    });

    it("reports per-skill rows as well as a total", async () => {
      const stdout = report("--mandated").stdout;

      for (const name of MANDATED_SKILLS) {
        expect.soft(stdout).toMatch(new RegExp(`^${name}\\s+\\d`, "m"));
      }
      expect.soft(stdout).toMatch(/^total\s+\d/m);
    });

    it("produces byte-identical output across runs", async () => {
      // "Stable enough to diff between runs" is a stated requirement, so nothing
      // checkout-dependent — a timestamp, an absolute path — may leak in.
      expect(report("--mandated").stdout).toBe(report("--mandated").stdout);
    });

    it("orders per-skill rows by name", async () => {
      const names = report("--mandated")
        .stdout.split("\n")
        .filter((line) => MANDATED_SKILLS.some((name) => line.startsWith(name)))
        .map((line) => line.split(/\s+/)[0]);

      expect(names).toEqual([...names].sort());
    });
  });

  describe("the mandated set's recorded figures", () => {
    it("reproduces the floor and ceiling the tracking issue records", async () => {
      const totals = totalsOf(report("--mandated").stdout);

      expect.soft(totals.floorObligations).toBe(20);
      // Drifted from 6,958 in #195, which folded each skill's `when_to_use`
      // into its `description` and rewrote both to a ~512-byte target. The
      // frontmatter is part of the floor's prose, so shortening it lowers the
      // floor without touching a single obligation — which is why the counts
      // beside these token figures did not move.
      expect.soft(totals.floorTokens).toBe(6_724);
      // Drifted from 299 in #174. All ten come from loop-engineering's
      // github-conventions.md, which gave the GitHub-operation mechanics back
      // to their owner: twelve restated bullets out, two loop-specific ones
      // kept — the loop's own write routing, and the fixing-commit hash each
      // resolved review thread is tied to. The other two mandated skills are
      // unchanged in count.
      expect.soft(totals.ceilingObligations).toBe(289);
      // Drifted from 25,265 in #195, by the same frontmatter shortening as the
      // floor above and by exactly the same amount — the reference files the
      // ceiling adds carry no frontmatter of their own.
      expect.soft(totals.ceilingTokens).toBe(25_031);
    });
  });

  describe("exit-code contract", () => {
    it("exits 0 on the whole repository, where the numbers are largest", async () => {
      const result = report();

      // A four-figure obligation count is an alarming number and still not a
      // failure: this tool has no threshold to cross. Stated as a magnitude
      // rather than the figure of the day, which drifts with every skill added.
      expect(result).toExitWith(0);
      expect(totalsOf(result.stdout).ceilingObligations).toBeGreaterThan(1_000);
    });

    it("exits 0 on a skill with no obligations at all", async () => {
      const root = await tempDir();
      await writeSkill(root, "alpha-skill", { body: "# Fixture\n\nProse only.\n" });

      expect(report(`${root}/alpha-skill`)).toExitWith(0);
    });

    it("exits 0 for --help and prints usage", async () => {
      const result = report("--help");

      expect(result).toExitWith(0);
      expect(result.stdout).toMatch(/Usage: report-obligation-load\.mjs/);
    });

    it.each([
      { label: "an unknown flag", args: ["--bogus"] },
      { label: "an unknown skill name", args: ["no-such-skill-anywhere"] },
      { label: "a path holding no skill", args: ["tests"] },
    ])("exits 2 on $label", async ({ args }) => {
      expect(report(...args)).toExitWith(2);
    });

    it("never exits 1", async () => {
      // The documented contract is 0 or 2 only. A 1 would mean a threshold crept
      // in, which is the one thing this tool must not grow.
      for (const args of [[], ["--mandated"], ["skills"], ["code-review"]]) {
        expect.soft(report(...args).code).not.toBe(1);
      }
    });
  });

  describe("agreement with check-skill.mjs", () => {
    it("partitions the same bullets the structure validator does", async () => {
      // Three readings of ONE definition, over a fixture built so each lands:
      //   2 in-block bullets WITH a keyword     → obligations
      //   1 in-block bullet WITHOUT one         → a `guidelines:` failure
      //   1 out-of-block bullet WITH a keyword  → a `placement:` warning
      // If the reporter and the validator ever disagreed about where a block
      // starts or ends, these three counts would stop adding up.
      const root = await tempDir();
      await writeSkill(root, "alpha-skill", {
        body: [
          "# Fixture",
          "",
          "## Topic",
          "",
          "Prose that demonstrates the topic.",
          "",
          "- MUST sit outside any Guidelines block.",
          "",
          "**Guidelines:**",
          "",
          "- MUST be counted as an obligation.",
          "- SHOULD be counted as an obligation.",
          "- Consider this one, which opens with no keyword.",
          "",
        ].join("\n"),
      });
      const dir = `${root}/alpha-skill`;

      const reported = totalsOf(report(dir).stdout);
      const structure = checkSkill(dir);

      const guidelineFailures = (structure.output.match(/^\s*- guidelines: /gm) ?? []).length;
      const placementWarnings = (structure.output.match(/- placement: /g) ?? []).length;

      expect.soft(reported.floorObligations).toBe(2);
      expect.soft(guidelineFailures).toBe(1);
      expect.soft(placementWarnings).toBe(1);
      // The partition: every in-block bullet is either an obligation or a
      // `guidelines:` failure, and nothing is both.
      expect(reported.floorObligations + guidelineFailures).toBe(3);
    });

    it("agrees with the structure validator across a fence", async () => {
      // The edge the shared boundary exists for: a fenced block is CONTINUATION,
      // so a rule after it is still in the block — and an example inside it is
      // not a rule at all. Both readers must see that identically.
      const root = await tempDir();
      await writeSkill(root, "alpha-skill", {
        body: [
          "# Fixture",
          "",
          "## Topic",
          "",
          "Prose that demonstrates the topic.",
          "",
          "**Guidelines:**",
          "",
          "- MUST be counted before the fence.",
          "",
          "```markdown",
          "- MUST NOT be counted: this is an example.",
          "```",
          "",
          "- MUST be counted after the fence.",
          "",
        ].join("\n"),
      });
      const dir = `${root}/alpha-skill`;

      expect(totalsOf(report(dir).stdout).floorObligations).toBe(2);
      // Still inside the block after the fence, so no bullet is misread as a
      // stray keyword bullet outside one.
      expect(checkSkill(dir).output).not.toMatch(/placement:/);
    });
  });
});
