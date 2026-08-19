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
      // the label said "the always-on set" until #211. it was wrong about two
      // of the three skills, so the assertion that pinned it moved with it.
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

      // drifted from 20 in #201, which added the optional delegated
      // implementation path. three obligation bullets reached loop-engineering's
      // own body: keeping judgment and delivery with the main actor whether or
      // not implementation is delegated, the Phase 4 permission to delegate a
      // mechanical fix, and the retry cap in the Termination Guard. the
      // contracts themselves went to references, which is why the floor moved
      // by three while the ceiling moved by seventy.
      // drifted again from 23 in #209, which gave software-development a
      // Product Specification section routing to the capability that owns a
      // project's own description of its product. both rules sit in the
      // SKILL.md body, so this and the ceiling below move by the same two.
      // and one more in #208, which added the optional pre-flight review
      // stage. exactly one obligation bullet reached the body: the
      // Termination Guard's cap on the pre-pull-request implement↔review loop,
      // stated there so it is not mistaken for the address↔review cap beside
      // it. the Phase 2 bullet that introduces the stage sits outside a
      // Guidelines block, so it is prose and not a rule — which is why the
      // floor moved by one while the ceiling moved by thirty.
      // #244 left this figure unmoved on purpose: it promoted the
      // harness-policy branch and its permission question into SKILL.md's
      // Delegated Implementation list and Phase 2 step as routing prose,
      // under an explicit budget that the promotion cost bytes rather than
      // rules — no MUST/SHOULD/MAY landed in SKILL.md itself.
      // and one more in #271, which reverses that trade: two consecutive
      // change-delivering runs read #244's routing prose without being bound
      // by it — one skipped the determination outright, the other ran it and
      // misread a request-conditioned policy as barred — so the
      // determination now lands in Phase 2's first `**Guidelines:**` block
      // instead of staying prose. exactly one MUST bullet reached the body,
      // which is why the floor moves by one.
      // and 4 more in #435, which gave professional-behavior a Response
      // Language section: two MUST bullets naming what the human-facing
      // surface follows and what it excludes, and two more for the
      // term-handling clause and its borrowing convention — all four landing
      // directly in SKILL.md's own Guidelines block, per this repository's
      // load-bearing-rule placement.
      // and 6 more in #451 revision 2, which reverses the load-bearing-hoist
      // direction #435 (and #418, #436's own precedent) had been applying:
      // a load-bearing rule's own statement now returns to its reference
      // behind a conditional MUST-read obligation, and professional-behavior
      // gains that obligation for the six references it had previously
      // routed to with no Guidelines block at all — Uncertainty Triage,
      // Clarifying Interview, Asking the Human, External Research, Accuracy
      // Discipline, and Reporting. Response Language's own four bullets are
      // untouched: they were added directly to SKILL.md, never hoisted from
      // a reference, and the reversal's own carve-out keeps an unconditional-
      // scope rule like this one stated in SKILL.md rather than moving it.
      expect.soft(totals.floorObligations).toBe(37);
      // drifted from 6,958 in #195, which folded each skill's `when_to_use`
      // into its `description`, and then co-notated the harness references so
      // each names both its Claude Code and its Codex form. the fold lowered
      // this figure and the co-notation raised part of it back. both are prose
      // edits, which is why the obligation counts beside these token figures
      // never moved at all.
      // drifted again from 6,776 in #201, by the routing and state-machine
      // prose the delegated path added to the body. the last 3 of it are not
      // that branch's: #201 merged main and carried professional-behavior's
      // `description` edit into the source it had been applied around, which
      // lengthened the opening clause by eight bytes.
      // and 42 more from the review's second nit: Phase 2's reviewer-mode
      // self-check bullet had not been given the delegated carve-out its
      // neighbour got, so a reader could take it to mean the main actor redoes
      // the worker's full diff review after reclaiming the lease.
      // the last 1 is plan revision 2's: SKILL.md's routing bullet named the
      // old exclusion ("why a general-purpose or default agent does not
      // qualify") and had to name the new criterion instead ("why capability
      // rather than a declared responsibility decides").
      // drifted from 7,704 in #203, which dropped the fixed section count from
      // loop-engineering's parent routing line so the canonical plan structure
      // can gain or lose a section without that summary going stale.
      // and 253 more from #209's section, prose in the same body.
      // and 225 more in #208, from the two paragraphs the pre-flight stage adds
      // to the body: the Phase 2 bullet routing to it and stating the skip when
      // no compatible review worker resolves, and the Termination Guard cap
      // above.
      // and up again in #216, from the routing bullet SKILL.md gained for
      // implementation-worker.md's new section on defining a worker.
      // and ten more in #222, from the clause the same Phase 2 bullet gained
      // for pre-flight-review.md's new section on defining a reader.
      // #203, #209, #208, #216, and #222 each moved this figure independently
      // and landed in that order; the value here is the measured total after
      // merging main, not any one branch's figure.
      // and again in #212, which moved no obligation at all: Phase 4's gate
      // rule and its intro prose were reworded to defer to the
      // independent-review reference rather than enumerate the flip's
      // conditions, so only bytes moved.
      // and two more in #231, from the twelve bytes the description's
      // `exposes and permits one` clause adds. a frontmatter-only edit, so no
      // obligation moved — only the byte total this figure divides.
      // and 57 more in #244, from SKILL.md's own two prose additions: the
      // Delegated Implementation routing bullet naming the harness-policy
      // branch and its permission question, and the Phase 2 step's clause
      // naming the permission determination as preceding the executor
      // choice. neither adds an obligation, which is why the floor above
      // does not move — only its byte total does.
      // and 38 more in #246, again entirely from SKILL.md's own body: the
      // Delegated Implementation routing line for implementation-worker.md
      // grew to describe the preflight's reachability check for every
      // required manifest entry rather than only the `visual` one, and the
      // routing line for the worker-definition section grew to name the one
      // channel a definition may never withdraw. both are routing-bullet
      // prose outside a Guidelines block, so no obligation moved with them —
      // only the bytes this figure divides. the reference-file edits behind
      // those two lines (below) moved the ceiling instead.
      // and 86 more in #251, which rewrote the Execution Model's machine-event
      // resume trigger around event delivery, split the routing bullet that
      // named the tail's cadence in two, and re-derived the Termination Guard's
      // dormancy cap from the awaited work's own declared timeout. SKILL.md
      // body prose only — no obligation was added or removed there, which is
      // why the floor count stands still while its byte total moves. measured
      // after merging main, which had moved this figure twice more in the
      // meantime; the value is the post-merge total, not this branch's delta.
      // and 47 more in #256, from SKILL.md's own two prose changes: the Phase 2
      // pre-flight bullet's enumeration gained the boundary that keeps run
      // state out of what a reader judges, and the Run State and Reporting
      // section's opening stopped calling the status block blanket
      // "human-invisible" and said instead what an agent reading the raw body
      // sees. neither adds an obligation, which is why the floor count above
      // does not move — only the bytes it divides.
      // then 19 more in the same change, from its own pre-flight round 2. the
      // Phase 2 bullet had kept saying the stage buys a reviewer "free of the
      // implementer's reasoning state, and nothing else" — the unqualified
      // claim the change had just stopped the property table from making, left
      // standing in the routing prose beside it. still prose, so the floor
      // obligation count holds.
      // and 121 more in #271, entirely from SKILL.md's own body: the
      // Delegated Implementation opening reordered so the permission
      // determination is read before the sentence normalizing single-agent
      // fallback, the routing bullet that flattened a policy's bars-or-
      // conditions branches into one line split into two, and the new
      // Guidelines bullet noted at the floor above. partly offset by three
      // stray "optional" mentions of the pre-flight stage trimmed once it
      // stopped being discretionary — the Phase 2 bullet's own label, "MAY
      // judge" becoming "judges", and the Termination Guard cap's lead-in —
      // but the growth outweighs the trim.
      // and 27 more in the same change's own pre-flight review round 1. the
      // normalizing sentence's "whenever either does not hold" read the
      // permission determination as a binary that either holds or does not —
      // which reads undetermined-and-not-yet-asked as already licensing
      // fallback, the exact failure this change exists to remove, surviving
      // inside the sentence meant to remove it. it now tracks the
      // determination's actual outcomes instead: no qualifying worker, a
      // barred policy, or an undetermined policy the human declined or that
      // could not be asked. framing prose only, consistent with the five
      // terminal outcomes implementation-worker.md already names — no
      // obligation moved, which is why the floor count above still holds.
      // and 19 more in #283, which gave software-development's SKILL.md a
      // routing bullet for the comment voice code-quality.md now states
      // outright. a routing bullet is not an obligation, so the floor count
      // above is unmoved and only the bytes this figure divides grew.
      // and 32 more in #304, which rewrote the two Delegated Implementation
      // routing bullets so the first names the barred/undetermined criterion
      // and the second its consequence, rather than both announcing that a
      // branch exists. still routing prose outside a Guidelines block, so no
      // obligation moved and only the bytes this figure divides grew.
      // and 17 fewer in the same change's pre-flight fix round: the first
      // bullet had reproduced implementation-worker.md's exact qualifying
      // phrases instead of naming the criterion as a handle — the detail
      // leakage progressive-disclosure.md exists to prevent. pointing at the
      // reference instead of restating it shrank the bullet net of the
      // growth above, still with no obligation moved.
      // and 1 fewer in #341, which renamed software-development's Product
      // Specification section to Living Documentation and rephrased its
      // prose and first routing bullet away from the retired
      // product-specification kind, following the rename of the skill that
      // owns it. wording only — the bullet stays one obligation saying the
      // same thing — so the floor count above is unmoved and only the bytes
      // this figure divides shrank.
      // and 17 more in that change's pre-flight fix round, which qualified the
      // section's scope sentence so it stops claiming the capability covers
      // nothing but the product. still wording only, still one obligation.
      // and 630 more in #435, the same Response Language section's SKILL.md
      // prose and its four Guidelines bullets.
      // and 256 more in #451 revision 2, the bytes of the same six new
      // `**Guidelines:**` blocks noted at the floor above; the routing
      // lists above them were already there and this change left them
      // untouched.
      // its pre-flight review round moved the token figures once more, and
      // only them: three read-obligation conditions were rewritten narrower
      // after the reviewer found professional-behavior's Reporting one fired
      // on every turn, which the change's own new rule calls a defect. prose
      // only, so no obligation count moves.
      expect.soft(totals.floorTokens).toBe(9_586);
      // drifted from 299 in #174. all ten come from loop-engineering's
      // github-conventions.md, which gave the GitHub-operation mechanics back
      // to their owner: twelve restated bullets out, two loop-specific ones
      // kept — the loop's own write routing, and the fixing-commit hash each
      // resolved review thread is tied to. the other two mandated skills are
      // unchanged in count.
      // drifted from 289 in #195. the only obligation change in that branch:
      // professional-behavior's question-tool rule split in two, separating
      // "use the tool whenever the session exposes one" from "fall back to the
      // turn output only where none exists". one rule carrying both read as
      // permission to skip the tool whenever you expected it to be missing.
      // drifted from 290 in #201 — the largest single move this figure has
      // taken. four new loop-engineering references carry the delegated path's
      // contracts (worker resolution and preflight, the implementation package
      // and its artifact-fidelity rules, execution while a worker holds the
      // writer lease, and writer ownership with retry and recovery), and four
      // existing ones gained plan-revision identity, delegated run state,
      // reconstructing a lost worker, and reading a body through a channel
      // adequate to what it carries. the delegated path is optional at runtime
      // but its rules are not conditional in the corpus: an agent holding this
      // skill holds all of them, which is what this figure is for.
      // three later moves in #201, netting +1. review round 1 added one: the
      // agent catalog being unenumerable was governed only through general
      // preflight language, so it gained a rule naming the scenario. round 2
      // removed one: the byte-faithful-channel rule was stated in both
      // github-conventions.md and run-state-and-reporting.md, and the latter
      // now points at the former. plan revision 2 added one: executor
      // resolution was screening for responsibilities the implementation
      // package already supplies, which excluded the generic implementation
      // workers a harness ships built in, so the exclusion rule split into an
      // exclusion and a tie-break.
      // drifted from 361 in #203, net +4 in loop-engineering's fallback plan
      // document. three are the Todo section's own rules — where it sits and
      // how its items are written, what detail stays out, and that it is fixed
      // at approval rather than kept as a progress tracker — and the fourth is
      // the conditional two-column Goals and Non-goals table. the single
      // goal-framing rule the merged section replaced left the count level.
      // one more from #203's review: the merged Goals and Non-goals rule was
      // carrying three obligations in one bullet — section shape, the flat
      // list's opening verbs, and the concrete-outcome requirement the old
      // goal-framing rule had owned and this branch had dropped. splitting it
      // restores that requirement for a project holding this fallback alone.
      // drifted again from 366 in #209, by the same two body rules as the
      // floor; that branch added no reference file to a mandated skill.
      // drifted from 368 in #215, net +5. four are the Settled Decisions
      // section pull-request-descriptions.md gained: record a decision already
      // settled with a stakeholder as settled, never offer it back to the
      // reviewer as an open question, flag it rather than pass over it in
      // silence, and state what revisiting it would take. the fifth is
      // github-conventions.md's deferring bullet, which carries the
      // plan-approval gate's own stake in that rule for a project holding this
      // loop alone. qualifying the neighbouring open-questions bullet moved no
      // count — it narrowed a rule that was already there.
      // and thirty more in #208, which added the optional pre-flight review
      // stage between the completion-evidence check and the pull request.
      // twenty-four of the thirty are the new pre-flight-review.md: the advisory
      // framing with its skip-and-fall-back rule and read-only worker
      // resolution, the input contract that excludes the implementer's receipt,
      // the merge-base policy read, the reader's position in the writer lease,
      // the fresh-reviewer-per-round rule that deliberately inverts the
      // resume-preferred default around it, the finding ledger with its
      // terminal states and its durability across a reclaimed session, the
      // dismissal split by severity with the no-re-grading rule that is the
      // only thing keeping the split from being evaded, and the round cap with
      // its declined-round outcome, and — found by the plan's own desk-check
      // rather than written first — an explicit prohibition on spawning the
      // reviewer while an implementation worker still runs, which until then
      // resolved only through a conditional MAY and the reference's opening
      // sentence. five of the remaining six land in existing
      // references — two in delegated-execution.md (a reader is not the second
      // implementation worker the Waiting rules forbid, and scope-changing
      // input mid-review takes the plan-revision path rather than the interrupt
      // sequence written for an editing worker), one each in
      // writer-ownership-and-recovery.md, run-state-and-reporting.md, and
      // resuming-and-handoff.md — and the sixth is the Termination Guard bullet
      // noted at the floor. as with the delegated path itself, the stage is
      // optional at runtime and its rules are not conditional in the corpus.
      // and five more in #216, which gave this repository an implementation
      // worker and documented what such a definition may carry — all about what
      // a definition must leave to the package rather than restate: keep it to
      // properties of the agent, do not preload the skill, do not give the
      // worker its own checkout, and withdraw the GitHub channel where the host
      // allows it. the fifth came from that branch's own review round: the
      // worked example had been written around this loop's package, which made
      // it unusable to any other caller and so worthless as the reference it was
      // meant to be. the framing rule now says to write it without assuming the
      // loop.
      // and four more in #222, which gave the pre-flight review stage the
      // reader counterpart of that section: deny a reader mutation and
      // spawning rather than enumerating what it may use, leave it able to
      // reach the specification and the sources a factual claim rests on, do
      // not withdraw a channel that carries what it must read, and do not call
      // it read-only while it still holds a shell.
      // plan revision 1 of that branch had five here, not four. it withheld the
      // GitHub channel and the project's skills from a reader, which a human
      // caught: a reviewer needs the issue to confirm what was asked, and the
      // skills exclusion was empty anyway because Read reaches them. the rule
      // that replaced both is one, not two.
      // six branches moved this figure from 361 independently — #203's +5,
      // #209's +2, #215/#221's +5, #208's +30, #216's +5, and #222's +4 — and
      // they are additive: 361 + 51 = 412, measured rather than carried from
      // any one of them. only the last is this change's.
      // and seven more in #229, which gave a spawn the harness's policy blocks
      // its own branch of executor resolution: six in implementation-worker.md
      // (the branch itself, the reporting rule that forbids restating it as one
      // of its two neighbours, and the four governing a policy conditional on
      // the human's request), plus one in pre-flight-review.md pointing the
      // reader's spawn at the same branch. all seven land in reference files,
      // which is why the floor above does not move with them.
      // and five more in #244, which inverted the policy branch's trigger
      // from noticing a conditional policy to establishing permission on
      // every run, and gave executor resolution its named terminal
      // outcomes. two of the five replace the branch's old single ask-trigger
      // bullet in implementation-worker.md: establishing permission before
      // the first edit, and not asking once permission is already
      // established. two more are Executor Resolution's own new
      // bullets: terminating in one of five named outcomes and
      // recording which, and proceeding without stalling when a fallback
      // cannot be classified. the fifth came out of that change's own
      // pre-flight review, which caught the outcome vocabulary mislabelling
      // an unasked run as a decline: it forbids recording a declined
      // conditional policy where no question was put. all five land in that
      // one reference file, which is why the floor above does not move with
      // them.
      // and one more in #246, net across three reference files. the channel
      // rule that told a worker definition to withdraw the harness's GitHub
      // channel had been stated twice — once for the worker in
      // implementation-worker.md, once for the reader in
      // pre-flight-review.md — and this change reverses and moves it: a
      // single MUST NOT replaces the worker's old SHOULD in
      // implementation-worker.md (net zero there), pre-flight-review.md's copy
      // is deleted outright (-1), and implementation-package.md gains two new
      // obligations of its own — the tracking issue's thread as a required
      // manifest entry beside the plan, and the main actor's in-package
      // carriage route for a required entry no worker channel reaches (+2).
      // -1 + 2 nets +1.
      // and two more in #251, both in independent-review.md's waiting tail:
      // keep the fallback self-wake scheduled even while a subscription is
      // active, because delivery is not documented to carry the success
      // transitions the ready flip turns on; and do not tune a wake to the
      // harness's prompt-cache TTL, which is a property of the session rather
      // than of the awaited work. the two rules they joined were reworded
      // rather than added to — the self-wake rule became a mechanism-resolution
      // rule, and the fixed 4-then-10-minute cadence became a derivation from
      // the pending checks' own completion profiles. both land in a reference
      // file, which is why the floor count above does not move with them.
      // and eight more in #256, which closed the pre-flight ledger's
      // anchoring channel, all in reference files. three are Ledger
      // Durability's: the old single write-everything rule split into an
      // unconditional round-number-and-waiting-state rule and a conditional
      // write rule, paired with a new clear-on-resume rule, so the
      // unconditional part, the write, and the clear each read as a separate
      // obligation instead of one bundled rule. one is Review Package's,
      // forbidding the package from asserting that an earlier round's
      // findings are beyond the reviewer's reach — the exact claim a prior
      // round's package had made while pointing the reader at a document that
      // carried them. three are pre-flight-review.md's new Run State Is Not
      // Input section, the reader boundary for run state encountered outside
      // the package. and one is run-state-and-reporting.md's, requiring the
      // run to report a reviewer's disclosure that it read run state.
      // and six more in #271. three are implementation-worker.md's: an
      // unreadable policy now defaults to undetermined rather than barred,
      // with a policy naming the human's request as its condition the
      // canonical undetermined case rather than barred; a SHOULD weighing
      // configuration that governs how delegation behaves as evidence
      // against a barred classification; and a requirement that every
      // determination record the policy text it rests on, quoted, or the
      // observation that none was found. one is run-state-and-reporting.md's:
      // a status-block entry naming no determination is not a valid entry.
      // one is pre-flight-review.md's: the stage now runs, rather than may
      // run, whenever implementation was delegated and a compatible reader
      // resolves. the sixth is the floor's own new Guidelines bullet, counted
      // again here because the ceiling is SKILL.md plus every reference, not
      // references alone.
      // and three more in #283, all in software-development's code-quality.md.
      // a new Comment Voice section states the voice the old text deferred to
      // existing source files for, carrying five rules: prose is lowercase,
      // all-caps is not emphasis, identity-bearing casing survives, a linter
      // suppression directive keeps the tool's casing, and a project's own
      // documented convention overrides the default. two of the five moved up
      // from Line Comments rather than being new, which is why the net is
      // three and not five.
      // and 7 more in #435: the same four in SKILL.md's Response Language
      // Guidelines block counted at the floor above, plus three more in
      // reporting.md's own new Response Language section, which the ceiling
      // counts and the floor does not.
      // and 6 more in #451 revision 2: the same six new SKILL.md
      // read-obligation bullets counted at the floor above. no reference
      // file's own obligation count moved — each of the six pointed-at
      // references was already fully descriptive, carrying no rule this
      // change needed to relocate — so the ceiling moves by exactly the
      // floor's own delta.
      expect.soft(totals.ceilingObligations).toBe(471);
      // drifted from 25,265 in #195, by the same fold-then-co-notate pair as
      // the floor above; the reference files the ceiling adds carry no
      // frontmatter of their own, so only their co-notation moves this one
      // independently.
      // drifted again from 25,250 in #201, by the eight reference files above,
      // plus the same three-token professional-behavior edit noted at the floor,
      // plus the two review nits that named their scenarios directly.
      // the last 167 are plan revision 2's, and land almost entirely in
      // implementation-worker.md: the resolution criterion inverted from what
      // an agent's definition declares to what it can do, which took a new
      // paragraph stating that resolution screens only for what the package
      // cannot supply, plus an exclusion rule and a tie-break in place of the
      // single ambiguity rule they replaced.
      // drifted from 32,566 in #203, by the same fallback-plan additions that
      // raised the ceiling obligation count above, plus the prose around them:
      // the reordered nine-section list, the Todo section's framing paragraph,
      // and the merged Goals and Non-goals rules.
      // the last 63 are #203's review: the split above, plus the clause naming
      // what a table's column headers do in place of the opening verbs, so the
      // two forms no longer leave a reader to infer which rules survive.
      // and 254 more from #209's section — the floor's own 253 plus one, since
      // each figure rounds its own byte total independently.
      // drifted from 33,103 in #215, by the five obligations above and the
      // prose they sit in: the polarity contrast the Settled Decisions section
      // demonstrates before its bullets, and the sentence stating that
      // recording a decision as settled does not place it beyond review.
      // drifted again from 32,566 in #208. most of it is pre-flight-review.md
      // at 13,798 bytes, which makes it the largest reference this skill
      // carries — the stage has one contract per property it recovers, and each
      // has to say which property and why, or a later reader reads the whole
      // set as belt-and-braces and drops one. the rest is the amendments to the
      // five existing files above.
      // and up again in #216, from that branch's new section on defining a
      // worker of your own.
      // and 557 more in #222, from the reader counterpart of that section: the
      // four obligations above plus the paragraphs explaining why a reviewer's
      // reach is wider than its job sounds and why enumerating that reach fails
      // silently — the part a copier needs and the part analogy does not carry.
      // fewer obligations than plan revision 1 and more prose, which is the
      // shape of the correction: one rule replaced two, and the reasoning that
      // makes the rule follow-able had to be written out.
      // measured after the same merge, for the same reason as the figure
      // above.
      // #212 moved it once more, again with the obligation count above
      // standing still: independent-review.md gained the paragraph stating the
      // flip gate's three conditions, and four bullets across three files were
      // reworded to point at it instead of restating the pair.
      // and 744 more in #229, for the seven obligations noted above plus the
      // prose that makes them follow-able: the paragraph separating capability
      // from permission, the one naming why neither neighbouring rule describes
      // a policy block, and the one on a conditional policy hiding the lever
      // that lifts it.
      // and two more in #231, the same twelve description bytes reaching this
      // figure through the same SKILL.md the floor above counts.
      // and 977 more in #244, split across three files: implementation-worker.md
      // for the rewritten policy branch and the five-outcome recording
      // requirement, run-state-and-reporting.md for the delegation-permission
      // determination the completion summary and status block now carry,
      // and the same 269 SKILL.md bytes the floor above already counts.
      // roughly half of the 960 are that change's own two pre-flight review
      // rounds, and both caught a rule that over-asked. the first added the
      // route by which silence counts as permission — a harness that says
      // nothing about delegation has not withheld it — and the outcome that
      // covers an unasked run without calling it a decline. the second turned
      // the determination into three results rather than two, because an
      // outright bar had fallen into the same bucket as an unclassifiable
      // policy: the run would have asked a question no answer could lift, and
      // the absolute-policy outcome had become unreachable. neither reached the
      // pull request.
      // and 350 more in #246 — the floor's own 38 plus roughly 312 from the
      // net reference-file bytes behind the obligation move above:
      // implementation-worker.md's two swapped bullets grew on net (the
      // compatibility-preflight rule generalizing past `visual`, and the
      // worker-definition rule replacing a withdrawal with a prohibition and
      // the reasoning it takes to state one instead of the other),
      // implementation-package.md grew by two new obligations and the prose
      // introducing them, and pre-flight-review.md shrank by the one bullet
      // it no longer states. two smaller edits are part of that figure too,
      // and naming them is what makes it add up: implementation-worker.md's
      // plain "It can withdraw tools" framing bullet grew to qualify itself
      // against the new prohibition, and implementation-package.md's existing
      // substitution-prohibition bullet grew to carve the new carriage route
      // out of what still counts as a weaker channel. each figure rounds its
      // own byte total independently, which is the whole of the remaining
      // difference between the parts and the sum.
      // and 654 more in #251: the two obligations above plus the prose that
      // makes them follow-able — the two paragraphs separating event delivery
      // from a scheduled self-wake and stating why delivery alone can leave a
      // finished change waiting, and the paragraph deriving each wake from the
      // pending checks' completion profiles with the reference project's own
      // runs as the worked example. the premise sentence those replaced had
      // asserted that nothing wakes the session at all.
      // and 1,181 more in #256: the eight obligations above, plus the prose
      // that makes them follow-able and the corrections that ride with them —
      // Ledger Durability's rewritten write/clear rationale, the new Run State
      // Is Not Input section's demonstration paragraph, the property table's
      // Context independence row qualified from an unqualified "yes" with its
      // trailing note naming the residual alongside absence visibility, the
      // Finding Ledger and Dismissal Authority sentences settling "the ledger"
      // as session state rather than the status block, and the "human-invisible"
      // correction in run-state-and-reporting.md's opening.
      // then 5 back off in the same change, from its own pre-flight review's
      // two Minor findings. both were wording, not rules, which is why the
      // obligation count above holds: resuming-and-handoff.md stopped calling
      // the status block's durable subset "the finding ledger" — the name the
      // same change had just reserved for the session-state object — and
      // Dismissal Authority stopped claiming a dismissal reason is folded into
      // what the run reports, which no reporting rule requires.
      // and 96 more from that same round 2: the floor's own 19, plus
      // pre-flight-review.md's opening sentence gaining the same qualification
      // as the bullet above, and Ledger Durability's park paragraph handing the
      // question-routing back to asking-the-human.md — it had described the
      // status block as a fallback channel the human is asked through, which
      // that file explicitly says it is not.
      // and 17 last from round 3, finishing the same job: three places still
      // said "the ledger" where they meant the status block's durable entries,
      // inside the very section named Ledger Durability. two now say entries,
      // and the definition itself grew to cover a finding's disposition and the
      // reason behind it, which Dismissal Authority had been recording there
      // all along without the definition admitting it.
      // and 165 more from the independent review's two Important findings. the
      // park count said "exactly two" while a finding that changes the approved
      // plan sends the run back to the plan-approval gate — a third wait the
      // conditional write rule did not name. it is not one: that route abandons
      // the round, which the neighbouring route in delegated-execution.md
      // already did, and saying so is the paragraph the ledger's definition
      // gained. the same sentence also restated two of asking-the-human.md's
      // conclusions beside a citation of it, so the restatement is gone and the
      // pointer stands alone. no obligation moved either way — one existing
      // bullet grew a clause, and the rest is prose.
      // and 469 more in #271: the six obligations above plus the prose that
      // makes them follow-able, split across five files — 1,045 bytes in
      // implementation-worker.md (the new obligations plus the paragraph
      // splitting the section, once they pushed it past the ten-bullet
      // ceiling agent-skill-authoring sets, into the section itself and a new
      // "Putting the Decision to the Human" subsection), 347 in
      // run-state-and-reporting.md, 271 in pre-flight-review.md, the 578
      // SKILL.md bytes the floor above already counts, and a net 7 bytes
      // trimmed from delegated-execution.md and writer-ownership-and-
      // recovery.md's own stray "optional" mentions of the pre-flight stage.
      // each figure rounds its own byte total independently.
      // and 27 more from that change's own pre-flight review round 1, the
      // same SKILL.md tightening noted at the floor above — still framing
      // prose, so only the byte total this figure divides moves.
      // and 287 more from #283's Comment Voice section — the five rules the
      // ceiling above counts, plus the two paragraphs that argue why the
      // voice is stated here rather than inferred from the surrounding files.
      // and 32 more in #304, the same SKILL.md routing-bullet rewrite noted at
      // the floor above — no reference file changed, so the ceiling moves by
      // exactly the floor's own delta.
      // and 17 fewer in the same change's pre-flight fix round, again exactly
      // the floor's own delta: no reference file changed there either.
      // and 1 fewer in #341, once more exactly the floor's own delta — the
      // section rename noted there touched SKILL.md alone.
      // and 17 more in that change's pre-flight fix round, again the floor's
      // own delta and again SKILL.md alone.
      // and 1,199 more in #435, the combined bytes of SKILL.md's new section
      // and reporting.md's new section.
      // and 257 more in #451 revision 2, the same six new SKILL.md bytes the
      // floor above already counts; each figure rounds its own byte total
      // independently, which is the one-token gap between the two deltas.
      // its pre-flight review round moved the token figures once more, and
      // only them: three read-obligation conditions were rewritten narrower
      // after the reviewer found professional-behavior's Reporting one fired
      // on every turn, which the change's own new rule calls a defect. prose
      // only, so no obligation count moves.
      expect.soft(totals.ceilingTokens).toBe(46_317);
    });

    it("reports the three tiers CLAUDE.md scopes the set to, cumulatively", async () => {
      const tiers = tiersOf(report("--mandated").stdout);

      // the point of the block, and the reason #211 exists: the figure this
      // report printed as one total was the last of these, labelled "every
      // session". an ordinary question-answering session carries the first.
      expect(tiers.map((tier) => tier.condition)).toEqual([
        "every session",
        "+ task touches the project",
        "+ task changes something",
      ]);

      // cumulative, not disjoint — each row contains the ones above it. all four
      // figures are pinned per tier, matching what the totals above already do,
      // because the whole point of the block is to say which tier moved: pinning
      // only the ceiling obligations would report that a tier drifted without
      // saying by how much or in which dimension.
      //
      // tier 1 — `professional-behavior`, the only genuinely unconditional
      // member. it stated no obligation bullets in its own body from #195,
      // which folded `when_to_use` into `description`, until #435 gave it a
      // Response Language section: four MUST/MUST NOT bullets landed directly
      // in SKILL.md's own Guidelines block, per this repository's
      // load-bearing-rule placement, so the floor is no longer zero.
      // #451 revision 2 reverses that placement rule everywhere except this
      // one section, which the reversal's own carve-out keeps in SKILL.md
      // because Response Language's condition is unconditional within its
      // skill's scope — so those four bullets are untouched, and the +6 here
      // is entirely the six new conditional MUST-read bullets the skill's
      // other six references gained, each replacing what used to be a
      // routing list with no obligation at all.
      expect.soft(tiers[0].floorObligations).toBe(10);
      // its pre-flight review round moved the token figures once more, and
      // only them: three read-obligation conditions were rewritten narrower
      // after the reviewer found professional-behavior's Reporting one fired
      // on every turn, which the change's own new rule calls a defect. prose
      // only, so no obligation count moves.
      expect.soft(tiers[0].floorTokens).toBe(2_014);
      expect.soft(tiers[0].ceilingObligations).toBe(133);
      expect.soft(tiers[0].ceilingTokens).toBe(10_145);

      // tier 2 — plus `software-development`. drifted from 204 in #209, which
      // gave it a Product Specification section, and again in #215/#221, which
      // added Settled Decisions to pull-request-descriptions.md.
      // #283 moves all but the first: the routing bullet grows the SKILL.md
      // bytes, and the Comment Voice section grows both reference figures.
      // #341 renames that Product Specification section to Living
      // Documentation and rewords its prose off the retired kind, moving the
      // floor tokens alone: no obligation moved, and the ceiling held only
      // because that four-byte shrink did not cross a rounding boundary at
      // this tier's base, though it did at tier 3's below. a SKILL.md-only
      // edit can move a ceiling — the ceiling counts those bytes too — which
      // that change's own pre-flight fix round then demonstrated: qualifying
      // the section's scope sentence grew it enough to move both figures here.
      // and #435 moves all four again, entirely from tier 1's own delta
      // above: `software-development` is unchanged, so this tier rises by
      // exactly what professional-behavior's Response Language section added.
      // #451 revision 2 moves all four again the same way — software-
      // development untouched, the whole delta inherited from tier 1's own
      // six new read-obligation bullets.
      expect.soft(tiers[1].floorObligations).toBe(15);
      // its pre-flight review round moved the token figures once more, and
      // only them: three read-obligation conditions were rewritten narrower
      // after the reviewer found professional-behavior's Reporting one fired
      // on every turn, which the change's own new rule calls a defect. prose
      // only, so no obligation count moves.
      expect.soft(tiers[1].floorTokens).toBe(3_210);
      expect.soft(tiers[1].ceilingObligations).toBe(240);
      expect.soft(tiers[1].ceilingTokens).toBe(18_604);

      // tier 3 — plus `loop-engineering`, and the figure this report printed
      // alone before #211. drifted from 361 by #204's plan-structure rewrite,
      // #206/#208's pre-flight review stage, and #215/#221's deferring bullet.
      // #211's own acceptance criterion quotes 361 as a snapshot at filing; the
      // criterion is measured against the base at merge time, as its own text
      // now says, because `main` moves these independently of this branch.
      //
      // these four figures are pinned twice. the mandated-set assertions above
      // state the same numbers, because tier 3 is the whole mandated set — the
      // closing assertions of this case say so. a branch that moves one copy
      // and not the other merges without a textual conflict and reddens `main`
      // on arrival: #223 added this copy while #224 was moving the other, and
      // neither branch's CI could see the collision. move both, or neither.
      // #229 moved both, on the merge that brought #227's correction of this
      // block into it — which is the warning above working as intended: the
      // branch had moved only the copy above, and taking this block from the
      // base is what surfaced the other half still to move.
      // #231 moved both copies too, and moved neither obligation count: its
      // twelve bytes are frontmatter, which the report weighs but no rule lives in.
      // #244 moved both copies too, for the same reasons as the mandated-set
      // totals above: the floor obligation count held steady on purpose, and
      // the other three moved by the same figures given there.
      // #246 moved both copies again, and again held the floor obligation
      // count steady: the floor tokens by SKILL.md's own routing prose, the
      // ceiling obligation count by the channel rule moving from a duplicated
      // SHOULD to a single MUST NOT plus implementation-package.md's two new
      // obligations, and the ceiling tokens by the net bytes behind both.
      // #251 moved both copies as well — three of the four figures, leaving
      // only the floor obligation count, since both rules it adds live in a
      // reference file rather than in SKILL.md's body. it also arrived after
      // main had moved these twice, and the merge is where the two sets of
      // figures were reconciled: the values here are measured post-merge.
      // #256 moved both copies too, for the same reasons as the mandated-set
      // totals above: the floor obligation count held steady on purpose, since
      // its SKILL.md edits stay prose, while floor tokens, ceiling obligations,
      // and ceiling tokens all moved by the figures given there.
      // #271 moved both copies too, for the same reasons as the mandated-set
      // totals above: the floor obligation count by the new Phase 2
      // Guidelines bullet, the floor tokens by SKILL.md's own prose changes,
      // the ceiling obligation count by the six obligations detailed there,
      // and the ceiling tokens by the bytes behind all of them. its own
      // pre-flight review round 1 moved both token figures again, by the
      // same 27-byte SKILL.md tightening noted there, with neither
      // obligation count moving.
      // #304 moved only the token figures, by the same routing-bullet rewrite
      // noted at the mandated-set totals above: SKILL.md prose only, so
      // neither obligation count moves. its own pre-flight fix round moved
      // both token figures again, by the same 17-token shrink noted there.
      // #341 moved only the token figures too, by the same section rename
      // noted at the mandated-set totals above: SKILL.md prose only, so
      // neither obligation count moves. its pre-flight fix round moved both
      // again, by the same scope-sentence qualification noted there.
      // #435 moved both copies too, for the same reasons as the mandated-set
      // totals above: all four figures move, by the same deltas given there.
      // #451 revision 2 moved both copies once more, for the same reasons as
      // the mandated-set totals above: all four figures move, by the same
      // deltas given there — loop-engineering and software-development are
      // both untouched by this change.
      expect.soft(tiers[2].floorObligations).toBe(37);
      // its pre-flight review round moved the token figures once more, and
      // only them: three read-obligation conditions were rewritten narrower
      // after the reviewer found professional-behavior's Reporting one fired
      // on every turn, which the change's own new rule calls a defect. prose
      // only, so no obligation count moves.
      expect.soft(tiers[2].floorTokens).toBe(9_586);
      expect.soft(tiers[2].ceilingObligations).toBe(471);
      expect.soft(tiers[2].ceilingTokens).toBe(46_317);

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
      // alone. a bound left behind after the tier figure moves — as #271
      // left it at 435 when the tier above went to 441 — stops proving that:
      // it would keep passing even if `code-review` contributed nothing at
      // all, which is exactly the regression this pair exists to catch.
      // #271 moved this to 441 to close that gap, #283 to 444 with it, #435
      // to 451 with it, and #451 revision 2 to 457 with it. tightening the
      // comment rules to an admissibility test moved it to 471, all 14 from
      // software-development's own new comment obligations.
      expect(tiersOf(stdout)[2].ceilingObligations).toBe(471);
      expect(totalsOf(stdout).ceilingObligations).toBeGreaterThan(471);
    });

    it("prints no tier block without --mandated", async () => {
      // the tiers describe the mandated set's own scoping, so they would be
      // meaningless over an arbitrary selection — and their absence is what
      // keeps every non-mandated invocation byte-identical to before #211.
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
