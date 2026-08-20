// contract for the obligation-burden reporter.
//
// unlike every other script in this suite, this one has no pass/fail semantics:
// its documented contract is exit 0 on every valid invocation regardless of the
// numbers, and 2 only on a bad invocation. so the cases below assert two things
// the other validator tests never have to — that a large, alarming number still
// exits 0, and that the report says out loud it defines no threshold.
//
// the counts are asserted against fixtures whose obligation count is known by
// construction, so a case fails when the tool miscounts rather than when the
// corpus changes. the two figures that are pinned to the real corpus — the
// mandated set's floor and ceiling — are pinned deliberately: they are the
// numbers the tracking issue records, and a silent drift in them is exactly what
// a reader of this report would want to be told about.
//
// the definition itself is tested in tests/unit/guidelines.test.mjs. what this
// file adds is the claim that the reporter and check-skill-body.mjs read that shared
// definition consistently — see the partition case.

import { access, readdir } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { estimateTokens } from "../../skills/agent-skill-authoring/scripts/token-estimate.mjs";
import { tempDir, writeSkill } from "../helpers/fixtures.mjs";
import { repoPath, SCRIPTS, validator } from "../helpers/run.mjs";

const report = validator(SCRIPTS.reportObligationBurden);
const checkSkill = validator(SCRIPTS.checkSkillBody);

/** the always-on set, mirroring the script's own MANDATED_SKILLS. */
const MANDATED_SKILLS = [
  "professional-behavior",
  "software-development",
  "loop-engineering",
];

/** a skill body stating `count` obligations under one Guidelines block. */
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

/** parse the report's `total` row into its six numbers. */
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
 * the cumulative tier rows `--mandated` prints, keyed by their condition.
 *
 * parsed from the block's own rows rather than recomputed from the per-skill
 * table, so a case fails when the tiering breaks rather than when the corpus
 * moves the figures it happens to sum to.
 */
function tiersOf(stdout) {
  const lines = stdout.split("\n");
  const start = lines.findIndex((line) => line.startsWith("Cumulative by session kind"));
  if (start === -1) throw new Error(`No tier block in report:\n${stdout}`);
  const rule = lines.findIndex((line, index) => index > start && /^-{3,}$/.test(line));
  const rows = [];
  for (let index = rule + 1; index < lines.length && lines[index].trim() !== ""; index += 1) {
    const cells = lines[index].trim().split(/\s{2,}/);
    const numbers = cells.slice(-4).map((cell) => Number(cell.replace(/,/g, "")));
    rows.push({
      condition: cells.slice(0, -4).join(" ").trim() || cells[0].trim(),
      floorObligations: numbers[0],
      floorTokens: numbers[1],
      ceilingObligations: numbers[2],
      ceilingTokens: numbers[3],
    });
  }
  return rows;
}

/**
 * the skill directory names directly under a repository skill root, read from
 * disk.
 *
 * an oracle for the selection cases below, independent of the code under test:
 * this answers only "what is on disk", while the reporter owns argument
 * resolution, cross-root dedup, ordering, and measurement. deriving the
 * expectation rather than writing the count as a literal is what keeps those
 * cases failing when selection breaks instead of when a skill is added.
 */
async function skillNamesUnder(root) {
  const names = [];
  for (const entry of await readdir(repoPath(root), { withFileTypes: true })) {
    // a symlinked entry counts: `.claude/skills` mirrors `.agents/skills`
    // by symlink, and `isDirectory()` is false for one. the SKILL.md
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
 * the per-skill row names of a report, in printed order.
 *
 * rows sit between the two dashed rules, and the `total` row follows the
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

/** the skill count the report's headline states. */
function headlineCountOf(stdout) {
  const match = stdout.match(/^Obligation burden for (\d+) skill\(s\)/m);
  if (!match) throw new Error(`No headline in report:\n${stdout}`);
  return Number(match[1]);
}

describe("report-obligation-burden.mjs", () => {
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
      // the ceiling always contains the floor rather than sitting beside it.
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

      // the reader is told they can redo the division from the bytes shown; this
      // holds the report's two columns to that. derived through the shared
      // estimator rather than a literal divisor, so re-calibrating the proxy —
      // which its own header invites — moves this assertion with it instead of
      // failing it.
      expect(totals.floorTokens).toBe(estimateTokens(totals.floorBytes));
    });
  });

  describe("selection", () => {
    it("selects the mandated set from --mandated with no skill named", async () => {
      const result = report("--mandated");

      expect(result).toPassCleanly();
      // not "the always-on set": two of the three mandated skills carry a
      // condition (the session touches the project, or changes something),
      // so only `professional-behavior` applies unconditionally.
      expect(result.stdout).toMatch(/the set CLAUDE\.md mandates/);
      expect(result.stdout).not.toMatch(/always-on/);
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
      // the claim is that the expansion is complete — every skill under the
      // root, not merely the first one found. a literal count said that only
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
      expect(result.stdout).toMatch(/Obligation burden for 5 skill\(s\)/);
    });

    it("counts a skill once when it is selected twice", async () => {
      const both = report("--mandated", "loop-engineering");
      const once = report("--mandated");

      expect(totalsOf(both.stdout)).toEqual(totalsOf(once.stdout));
    });

    it("reports every skill in the repository when given no arguments", async () => {
      // "Every skill" is the deduplicated union of the two roots, and that is
      // what this asserts — not a total, which a broken union and a broken
      // dedup could both produce by coincidence. the installed root holds a copy
      // of every distributable skill, so a missing `seen` guard reports each one
      // twice, and that is the tooth this case still has.
      //
      // it used to have a second one: while some skill lived only under the
      // installed root, `union.length > sourceTier.length` caught a root left
      // unscanned. no skill is repository-local any more — every skill is
      // authored under `skills/` and installed — so the two roots hold the same
      // names and no assertion over them can tell "scanned both" from "scanned
      // one". that tooth is therefore gone rather than weakened, and it returns
      // on its own the moment a repository-local skill is added back. the
      // previous assertion is deleted instead of relaxed to `>=`, which would
      // have left a line reading as a guard that guards nothing.
      const sourceTier = await skillNamesUnder("skills");
      const installedTier = await skillNamesUnder(".claude/skills");
      const union = [...new Set([...sourceTier, ...installedTier])].sort();

      const result = report();

      expect(result).toPassCleanly();
      expect(rowNamesOf(result.stdout)).toEqual(union);
      expect(headlineCountOf(result.stdout)).toBe(union.length);
      // keeps the dedup tooth sharp: both roots must actually be populated and
      // overlapping, or "reports each one twice" is not a failure mode here.
      expect(sourceTier.length).toBeGreaterThan(0);
      expect(installedTier).toEqual(expect.arrayContaining(sourceTier));
    });

    it("resolves every mandated skill name to a real skill", async () => {
      // the one mechanical pin available on MANDATED_SKILLS: CLAUDE.md's prose
      // owns the set, and a prose parse cannot see all three (software-development
      // is never named by its skill name there), so a rename or deletion is what
      // this catches. `--mandated` exits 2 when a name resolves to nothing.
      const result = report("--mandated");

      expect(result).toExitWith(0);
      expect(result.stdout).toMatch(/Obligation burden for 3 skill\(s\)/);
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
      // the recorded risk is that a number with no threshold invites someone to
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

      // both figures are pinned to a live measurement of this repository's
      // own mandated skills, not computed — see this file's header for why.
      // when a change moves them, the fix is to re-run the reporter against
      // the merged base and update the pinned value here, not to compute a
      // new one from a diff.
      //
      // both grew by the same 2 here, and from the same source:
      // loop-engineering's Phase 1 gained two `**Guidelines:**` bullets — the
      // harness-permission determination and the context-ownership.md read
      // obligation. subagent-delegation.md's standing-mandate recording
      // requirement moved no count at all, because it widened an existing
      // bullet rather than adding one; it shows up in the ceiling's token
      // growth (+2,259 bytes against the floor's +1,374) and nowhere else.
      expect.soft(totals.floorObligations).toBe(51);
      expect.soft(totals.floorTokens).toBe(10_776);
      expect.soft(totals.ceilingObligations).toBe(484);
      expect.soft(totals.ceilingTokens).toBe(51_629);
    });

    it("reports the three tiers CLAUDE.md scopes the set to, cumulatively", async () => {
      const tiers = tiersOf(report("--mandated").stdout);

      // each tier is a session kind CLAUDE.md scopes the mandated set to,
      // from the lightest a session can be to the heaviest — an ordinary
      // question-answering session carries only the first.
      expect(tiers.map((tier) => tier.condition)).toEqual([
        "every session",
        "+ task touches the project",
        "+ task changes something",
      ]);

      // cumulative, not disjoint — each row contains the ones above it. all
      // four figures are pinned per tier, not only the ceiling obligations,
      // because the point of the block is to say which tier moved, by how
      // much, and in which dimension.
      //
      // tier 1 — `professional-behavior`, the only genuinely unconditional
      // member.
      expect.soft(tiers[0].floorObligations).toBe(10);
      expect.soft(tiers[0].floorTokens).toBe(2_014);
      expect.soft(tiers[0].ceilingObligations).toBe(133);
      expect.soft(tiers[0].ceilingTokens).toBe(10_145);

      // tier 2 — plus `software-development`, whose reference gained a
      // comment-scope test and a TODO unfinished-code condition — both add
      // obligation bullets, which is why this tier's ceiling grew.
      expect.soft(tiers[1].floorObligations).toBe(15);
      expect.soft(tiers[1].floorTokens).toBe(3_367);
      expect.soft(tiers[1].ceilingObligations).toBe(246);
      expect.soft(tiers[1].ceilingTokens).toBe(19_670);

      // tier 3 — plus `loop-engineering`, the whole mandated set.
      //
      // these four figures are pinned twice: tier 3 equals the mandated-set
      // assertions above (the closing checks below prove it directly). a
      // branch that moves one copy and not the other merges without a
      // textual conflict and reddens `main` on arrival — move both, or
      // neither.
      //
      // the floor grew by 2 here because loop-engineering's Phase 1 gained
      // two `**Guidelines:**` bullets — establishing the harness-permission
      // determination before the first Phase 1 investigation read, and the
      // MUST-read for context-ownership.md. the ceiling grew by the same 2
      // and by nothing further: subagent-delegation.md's standing-mandate
      // recording requirement widened a bullet that was already counted, so
      // it moved the ceiling's tokens without moving its obligation count.
      expect.soft(tiers[2].floorObligations).toBe(51);
      expect.soft(tiers[2].floorTokens).toBe(10_776);
      expect.soft(tiers[2].ceilingObligations).toBe(484);
      expect.soft(tiers[2].ceilingTokens).toBe(51_629);

      // the last tier is the total, by construction. asserting it rather than
      // trusting it is what would catch a tiering that silently dropped a skill
      // — and it is the one assertion here that survives any corpus drift.
      const totals = totalsOf(report("--mandated").stdout);
      expect(tiers[2].ceilingObligations).toBe(totals.ceilingObligations);
      expect(tiers[2].floorObligations).toBe(totals.floorObligations);
      expect(tiers[2].ceilingTokens).toBe(totals.ceilingTokens);
      expect(tiers[2].floorTokens).toBe(totals.floorTokens);
    });

    it("keeps the tiers to the mandated set when further skills are selected", async () => {
      const stdout = report("--mandated", "code-review").stdout;

      // `--mandated code-review` answers "what does a review round carry" in
      // its total, and "what does the mandated set cost a session of each kind"
      // in its tiers. folding the extra selector into the tiers would destroy
      // the second answer, which is the one the tiers exist for.
      //
      // the lower bound below MUST track the tier figure directly above it,
      // not a copy of it: the two assertions only discriminate as a pair,
      // proving `code-review` added something on top of the mandated set
      // alone. a bound left behind after the tier figure moves stops proving
      // that — it would keep passing even if `code-review` contributed
      // nothing at all, which is exactly the regression this pair exists to
      // catch.
      expect(tiersOf(stdout)[2].ceilingObligations).toBe(484);
      expect(totalsOf(stdout).ceilingObligations).toBeGreaterThan(484);
    });

    it("prints no tier block without --mandated", async () => {
      // the tiers describe the mandated set's own scoping, so they would be
      // meaningless over an arbitrary selection — a non-mandated invocation
      // prints no tier block at all.
      expect(report("code-review").stdout).not.toContain("Cumulative by session kind");
      expect(report().stdout).not.toContain("Cumulative by session kind");
    });
  });

  describe("exit-code contract", () => {
    it("exits 0 on the whole repository, where the numbers are largest", async () => {
      const result = report();

      // a four-figure obligation count is an alarming number and still not a
      // failure: this tool has no threshold to cross. stated as a magnitude
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
      expect(result.stdout).toMatch(/Usage: report-obligation-burden\.mjs/);
    });

    it.each([
      { label: "an unknown flag", args: ["--bogus"] },
      { label: "an unknown skill name", args: ["no-such-skill-anywhere"] },
      { label: "a path holding no skill", args: ["tests"] },
    ])("exits 2 on $label", async ({ args }) => {
      expect(report(...args)).toExitWith(2);
    });

    it("never exits 1", async () => {
      // the documented contract is 0 or 2 only. a 1 would mean a threshold crept
      // in, which is the one thing this tool must not grow.
      for (const args of [[], ["--mandated"], ["skills"], ["code-review"]]) {
        expect.soft(report(...args).code).not.toBe(1);
      }
    });
  });

  describe("agreement with check-skill-body.mjs", () => {
    it("partitions the same bullets the structure validator does", async () => {
      // three readings of one definition, over a fixture built so each lands:
      //   2 in-block bullets with a keyword     → obligations
      //   1 in-block bullet without one         → a `guidelines:` failure
      //   1 out-of-block bullet with a keyword  → a `placement:` warning
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
      // the partition: every in-block bullet is either an obligation or a
      // `guidelines:` failure, and nothing is both.
      expect(reported.floorObligations + guidelineFailures).toBe(3);
    });

    it("agrees with the structure validator across a fence", async () => {
      // the edge the shared boundary exists for: a fenced block is continuation,
      // so a rule after it is still in the block — and an example inside it is
      // not a rule at all. both readers must see that identically.
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
      // still inside the block after the fence, so no bullet is misread as a
      // stray keyword bullet outside one.
      expect(checkSkill(dir).output).not.toMatch(/placement:/);
    });
  });
});
