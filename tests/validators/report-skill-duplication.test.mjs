// exit-code and report contract for report-skill-duplication.mjs.
//
// the documented contract is: 0 whenever a report was produced — always, however
// many pairs it found — and 2 on a bad invocation. that "always 0" is the claim
// tests/repository/reporting-tools.test.mjs depends on when it keeps this script
// out of every gate, so it is asserted here against real fixtures rather than
// taken on trust.
//
// the behavioural cases below pin the three decisions that make the ranking
// mean anything: comparison is cross-skill only, a restated rule is reported as
// a candidate rather than a finding, and the RFC-2119 keyword itself does not
// contribute to a score.

import { describe, expect, it } from "vitest";

import { tempDir, writeSkill } from "../helpers/fixtures.mjs";
import { SCRIPTS, validator } from "../helpers/run.mjs";

const report = validator(SCRIPTS.reportSkillDuplication);

/** a skill body stating one rule, so a fixture's rule set is exactly known. */
function withRules(...rules) {
  return `# Fixture Skill\n\nBody prose for the fixture.\n\n**Guidelines:**\n\n${rules
    .map((rule) => `- ${rule}`)
    .join("\n")}\n`;
}

const SHARED_RULE =
  "MUST redact an authentication token before writing it to a structured log line.";

describe("report-skill-duplication.mjs", () => {
  describe("exit 0 — a report was produced", () => {
    it("reports a rule two skills state as a candidate pair", async () => {
      const root = await tempDir();
      await writeSkill(root, "first-skill", { body: withRules(SHARED_RULE) });
      await writeSkill(root, "second-skill", { body: withRules(SHARED_RULE) });

      const result = report(root);

      expect(result.code).toBe(0);
      expect(result.stdout).toMatch(/1 candidate pair\(s\) at or above it/);
      expect(result.stdout).toMatch(/1\.00 {2}first-skill ↔ second-skill/);
      expect.soft(result.stdout).toMatch(/first-skill\/SKILL\.md:\d+/);
      expect.soft(result.stdout).toMatch(/second-skill\/SKILL\.md:\d+/);
    });

    it("names the Portable Source Exception so a pair is never read as a verdict", async () => {
      const root = await tempDir();
      await writeSkill(root, "first-skill", { body: withRules(SHARED_RULE) });
      await writeSkill(root, "second-skill", { body: withRules(SHARED_RULE) });

      const result = report(root);

      // the caveat is the report's load-bearing sentence: without it a reader
      // treats a ranked list of legitimate restatements as a defect list.
      expect(result.stdout).toMatch(/CANDIDATES, not findings/);
      expect(result.stdout).toMatch(/Portable Source/);
      expect(result.stdout).toMatch(/never passes or fails/);
    });

    it("stays silent about a skill restating its own rule", async () => {
      const root = await tempDir();
      // same rule twice in a single skill: a different defect with a different
      // remedy, and reporting it here would bury the cross-skill pairs.
      await writeSkill(root, "only-skill", {
        body: withRules(SHARED_RULE, SHARED_RULE),
      });

      const result = report(root);

      expect(result.code).toBe(0);
      expect(result.stdout).toMatch(/No pair scored at or above the floor\./);
    });

    it("does not score two unrelated rules on their shared RFC-2119 keyword", async () => {
      const root = await tempDir();
      await writeSkill(root, "first-skill", {
        body: withRules("MUST NOT commit a generated lockfile to the branch."),
      });
      await writeSkill(root, "second-skill", {
        body: withRules("MUST NOT await a promise inside a render function."),
      });

      const result = report(root);

      expect(result.code).toBe(0);
      expect(result.stdout).toMatch(/No pair scored at or above the floor\./);
    });

    it("reports a near-duplicate once the floor is lowered to reach it", async () => {
      const root = await tempDir();
      await writeSkill(root, "first-skill", {
        body: withRules(
          "MUST redact an authentication token before writing it to a log line.",
        ),
      });
      await writeSkill(root, "second-skill", {
        body: withRules(
          "MUST redact an authentication token before writing a structured log line, always.",
        ),
      });

      const strict = report(root, "--min", "0.95");
      const loose = report(root, "--min", "0.5");

      expect(strict.code).toBe(0);
      expect(strict.stdout).toMatch(/No pair scored at or above the floor\./);
      expect(loose.code).toBe(0);
      expect(loose.stdout).toMatch(/1 candidate pair\(s\) at or above it/);
    });

    it("caps the listing at --top and says how many it withheld", async () => {
      const root = await tempDir();
      await writeSkill(root, "first-skill", {
        body: withRules(SHARED_RULE, `${SHARED_RULE.slice(0, -1)} every time.`),
      });
      await writeSkill(root, "second-skill", {
        body: withRules(SHARED_RULE, `${SHARED_RULE.slice(0, -1)} every time.`),
      });

      const result = report(root, "--top", "1");

      expect(result.code).toBe(0);
      expect(result.stdout).toMatch(/further pair\(s\) not shown — raise --top/);
    });

    it("prints usage for --help", async () => {
      const result = report("--help");

      expect(result.code).toBe(0);
      expect(result.stdout).toMatch(/Usage: report-skill-duplication\.mjs/);
      expect.soft(result.stdout).toMatch(/--min/);
      expect.soft(result.stdout).toMatch(/--top/);
    });
  });

  describe("exit 2 — bad invocation", () => {
    it("rejects an unknown option", async () => {
      const result = report("--not-an-option");

      expect(result.code).toBe(2);
      expect(result.stderr).toMatch(/Unknown option "--not-an-option"/);
    });

    it("rejects a similarity floor outside 0 to 1", async () => {
      const result = report("--min", "5");

      expect(result.code).toBe(2);
      expect(result.stderr).toMatch(/--min takes a number between 0 and 1/);
    });

    it("rejects a non-integer --top", async () => {
      const result = report("--top", "2.5");

      expect(result.code).toBe(2);
      expect(result.stderr).toMatch(/--top takes a whole number/);
    });

    it("rejects a selector that resolves to no skill", async () => {
      const result = report("no-such-skill-anywhere");

      expect(result.code).toBe(2);
      expect(result.stderr).toMatch(/No skill found for "no-such-skill-anywhere"/);
    });
  });
});
