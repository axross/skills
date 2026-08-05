// The migration contract for splitting check-skill.mjs into three commands.
//
// Splitting 1,224 lines across three files can drop a rule with nothing to
// notice: the gate set stays consistent, `npm test` still passes, and this
// repository's own skills are clean — so a rule that stopped firing produces
// exactly the same output as a rule that fires and finds nothing. No other
// check in this suite can tell those two apart.
//
// `skill-structure-findings.json` was captured from `check-skill.mjs` against
// `buildSkillFixture`'s root before that command was deleted. Comparing against
// recorded data rather than against the old script is what lets the assertion
// outlive it.
//
// Three properties are asserted, and the third is the one people forget: the
// union must not merely CONTAIN the old findings, it must equal them, and no
// finding may be reported by two commands. A defect behind two gates is read as
// two defects, and the split exists to stop exactly that.

import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { tempDir } from "../helpers/fixtures.mjs";
import { buildFixture } from "../helpers/skill-fixture.mjs";
import { repoPath, runScript, SCRIPTS } from "../helpers/run.mjs";

const COMMANDS = [
  SCRIPTS.checkSkillFrontmatter,
  SCRIPTS.checkSkillBody,
  SCRIPTS.checkSkillReferences,
];

/**
 * A validator's report, reduced to the findings it made.
 *
 * Per-skill PASS/FAIL verdicts are deliberately dropped. After the split a
 * skill that fails a frontmatter rule and passes the body rules is FAIL under
 * one command and PASS under another, so the verdict became a property of the
 * command rather than of the skill. What has to survive is the finding set.
 */
function findingsOf(report) {
  const findings = [];
  let skill = null;

  for (const line of report.split("\n")) {
    const verdict = line.match(/^(?:PASS|FAIL)\s{2}(\S+)/);
    if (verdict) {
      // The directory name alone: the fixture lives in a fresh temp directory
      // each run, so anything above it differs between the recording and the
      // comparison without any rule having changed.
      skill = verdict[1].split("/").pop();
      continue;
    }
    const warn = line.match(/^WARN\s+- (.+)$/);
    if (warn) {
      findings.push({ skill, severity: "warning", message: warn[1] });
      continue;
    }
    const fail = line.match(/^\s+- (.+)$/);
    if (fail) findings.push({ skill, severity: "failure", message: fail[1] });
  }
  return findings;
}

/** A stable key, so the comparison is set-wise rather than order-dependent. */
const key = (finding) =>
  `${finding.skill} ${finding.severity} ${finding.message}`;

describe("the three structure validators, against the recorded set", () => {
  it("reproduce every finding check-skill.mjs made, and add none", async () => {
    const root = await buildFixture(await tempDir());
    const recorded = JSON.parse(
      await readFile(repoPath("tests/validators/skill-structure-findings.json"), "utf8"),
    );

    const union = COMMANDS.flatMap((script) =>
      findingsOf(runScript(script, [root]).output),
    );

    const expected = new Set(recorded.map(key));
    const actual = new Set(union.map(key));

    expect(
      [...expected].filter((k) => !actual.has(k)),
      "a rule the old command reported is no longer reported by any of the three — it was dropped in the split",
    ).toEqual([]);
    expect(
      [...actual].filter((k) => !expected.has(k)),
      "a finding no recorded rule produced — a message drifted, or a rule fires where it did not before",
    ).toEqual([]);
  });

  it("report no finding from more than one command", async () => {
    const root = await buildFixture(await tempDir());

    const union = COMMANDS.flatMap((script) =>
      findingsOf(runScript(script, [root]).output),
    );

    const seen = new Map();
    for (const finding of union) {
      seen.set(key(finding), (seen.get(key(finding)) ?? 0) + 1);
    }

    expect(
      [...seen].filter(([, count]) => count > 1).map(([k]) => k),
      "one defect behind two commands reads as two defects, which is what the split exists to prevent",
    ).toEqual([]);
  });

  it("each carry a shebang, while the module they share does not", async () => {
    for (const script of COMMANDS) {
      const source = await readFile(repoPath(script), "utf8");
      expect(source.startsWith("#!"), `${script} must be executable`).toBe(true);
    }

    const shared = await readFile(
      repoPath("skills/agent-skill-authoring/scripts/skill-documents.mjs"),
      "utf8",
    );
    expect(
      shared.startsWith("#!"),
      "the shared module must not read as a CLI — a tool that counts validators by shebang would count it as a fourth",
    ).toBe(false);
  });
});
