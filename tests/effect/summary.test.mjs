// the derived layer, and the checks that decide whether a case measurement
// measures anything.
//
// each case asserts that a disagreement both fails and is named. a check that
// fails without saying what disagreed leaves a reader to diff two JSON files by
// eye.

import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { canonicalJson } from "../../tools/evaluation/effect/src/layout.mjs";
import { buildConfiguration } from "../../tools/evaluation/effect/src/spawn.mjs";
import {
  changedPaths,
  comparabilityOf,
  deriveCaseSummary,
  deriveProbeSummary,
  finalMessageHeadings,
  readProbe,
  solicitsDecision,
} from "../../tools/evaluation/effect/src/summary.mjs";

let caseDir;

beforeEach(async () => {
  caseDir = await mkdtemp(join(tmpdir(), "case-measurement-"));
});
afterEach(async () => {
  await rm(caseDir, { recursive: true, force: true });
});

const TRANSCRIPT = [
  JSON.stringify({ type: "system", subtype: "init", model: "claude-sonnet-5", skills: [] }),
  JSON.stringify({
    type: "assistant",
    message: {
      usage: { input_tokens: 10, output_tokens: 4 },
      content: [{ type: "tool_use", name: "Bash", input: { command: "npm test" } }],
    },
  }),
  JSON.stringify({ type: "result", subtype: "success", num_turns: 3, total_cost_usd: 1.5 }),
].join("\n");

/** a one-turn transcript whose init event reports the given loaded skills. */
function loadedTranscript(skills) {
  return [
    JSON.stringify({ type: "system", subtype: "init", model: "claude-sonnet-5", skills }),
    JSON.stringify({ type: "result", subtype: "success", num_turns: 1, total_cost_usd: 1 }),
  ].join("\n");
}

/** a transcript whose only assistant turn ends on the given text. */
function transcriptEndingWith(text) {
  return [
    JSON.stringify({ type: "system", subtype: "init", model: "claude-sonnet-5", skills: [] }),
    JSON.stringify({
      type: "assistant",
      message: { usage: {}, content: [{ type: "text", text }] },
    }),
    JSON.stringify({ type: "result", subtype: "success", num_turns: 1, total_cost_usd: 0.1 }),
  ].join("\n");
}

/** a transcript whose only assistant turn is a tool call, with no text block. */
const TRANSCRIPT_NO_ASSISTANT_TEXT = [
  JSON.stringify({ type: "system", subtype: "init", model: "claude-sonnet-5", skills: [] }),
  JSON.stringify({
    type: "assistant",
    message: { usage: {}, content: [{ type: "tool_use", name: "Bash", input: { command: "echo hi" } }] },
  }),
  JSON.stringify({ type: "result", subtype: "error_max_turns", num_turns: 1 }),
].join("\n");

/** everything overridable per case. */
async function writeProbe(name, { configuration = {}, transcript = TRANSCRIPT, patch = "" } = {}) {
  const directory = join(caseDir, name);
  await mkdir(directory, { recursive: true });
  const full = buildConfiguration({
    projectName: "tsuzuri",
    projectTree: "sha256:tree",
    prompt: "add tests",
    skills: name.startsWith("skill-present") ? { "unit-testing": "sha256:skill" } : {},
    ...configuration,
  });
  await writeFile(
    join(directory, "metadata.json"),
    canonicalJson({ timestamp: "2026-08-07T00:00:00Z", configuration: full }),
    "utf8",
  );
  await writeFile(join(directory, "transcript.jsonl"), `${transcript}\n`, "utf8");
  await writeFile(join(directory, "changes.patch"), patch, "utf8");
}

const aPair = async () => {
  await writeProbe("skill-absent-aaaaaaaa");
  await writeProbe("skill-present-bbbbbbbb");
};

describe("changedPaths", () => {
  it("reads the paths a unified diff touches, in first-appearance order", () => {
    const patch = [
      "diff --git a/shared/b.ts b/shared/b.ts",
      "diff --git a/shared/a.ts b/shared/a.ts",
      "diff --git a/shared/b.ts b/shared/b.ts",
    ].join("\n");
    expect(changedPaths(patch)).toEqual(["shared/b.ts", "shared/a.ts"]);
  });

  it("reads an empty patch as no changes", () => {
    expect(changedPaths("")).toEqual([]);
  });
});

describe("deriveProbeSummary", () => {
  it("derives the loaded skill set from the transcript, not from metadata", async () => {
    await writeProbe("skill-present-bbbbbbbb");
    const summary = deriveProbeSummary(
      await readProbe(join(caseDir, "skill-present-bbbbbbbb"), "skill-present-bbbbbbbb"),
    );
    // an outcome of the run, not a setting of it.
    expect(summary.loadedSkills).toEqual([]);
    expect(summary.turns).toBe(3);
    expect(summary.costUsd).toBe(1.5);
    expect(summary.ranTests).toBe(true);
    expect(summary.usage).toMatchObject({ input: 10, output: 4, messages: 1 });
  });

  it("fails when the transcript contradicts the declared model", async () => {
    await writeProbe("skill-absent-aaaaaaaa", {
      transcript: JSON.stringify({ type: "system", model: "some-other-model", skills: [] }),
    });
    const probe = await readProbe(join(caseDir, "skill-absent-aaaaaaaa"), "skill-absent-aaaaaaaa");
    expect(() => deriveProbeSummary(probe)).toThrow(/declared model .* but the transcript reports/);
  });

  describe("declaredSkillsLoaded", () => {
    it("is the sorted intersection of a probe's own declared skills and its own loaded set", async () => {
      await writeProbe("skill-present-bbbbbbbb", {
        configuration: { skills: { "unit-testing": "sha256:skill", "vitest-testing": "sha256:other" } },
        transcript: [
          JSON.stringify({
            type: "system",
            subtype: "init",
            model: "claude-sonnet-5",
            skills: ["vitest-testing", "some-injected-skill"],
          }),
          JSON.stringify({ type: "result", subtype: "success", num_turns: 1, total_cost_usd: 1 }),
        ].join("\n"),
      });
      const probe = await readProbe(join(caseDir, "skill-present-bbbbbbbb"), "skill-present-bbbbbbbb");
      // "unit-testing" is declared but never shows up loaded; the injected
      // skill shows up loaded but was never declared. only the overlap
      // survives, and it is a fact about this probe alone — nothing here
      // looks at a sibling probe.
      expect(deriveProbeSummary(probe).declaredSkillsLoaded).toEqual(["vitest-testing"]);
    });

    it("is empty when the probe declares no skills", async () => {
      await writeProbe("skill-absent-aaaaaaaa");
      const probe = await readProbe(join(caseDir, "skill-absent-aaaaaaaa"), "skill-absent-aaaaaaaa");
      expect(deriveProbeSummary(probe).declaredSkillsLoaded).toEqual([]);
    });

    it("is null, not empty, when the transcript never said what loaded", async () => {
      // `null` means the stream did not say, distinct from "said none".
      await writeProbe("skill-present-bbbbbbbb", {
        transcript: JSON.stringify({ type: "result", subtype: "success", num_turns: 1 }),
      });
      const probe = await readProbe(join(caseDir, "skill-present-bbbbbbbb"), "skill-present-bbbbbbbb");
      expect(deriveProbeSummary(probe).declaredSkillsLoaded).toBeNull();
    });
  });

  it("does not fail when the transcript is merely silent about the model", async () => {
    // `null` means "did not say", not "disagrees".
    await writeProbe("skill-absent-aaaaaaaa", {
      transcript: JSON.stringify({ type: "result", subtype: "success", num_turns: 1 }),
    });
    const probe = await readProbe(join(caseDir, "skill-absent-aaaaaaaa"), "skill-absent-aaaaaaaa");
    expect(() => deriveProbeSummary(probe)).not.toThrow();
  });

  describe("endedAwaitingDecision", () => {
    it("is true for an empty diff whose final message solicits a decision", async () => {
      await writeProbe("skill-absent-aaaaaaaa", {
        transcript: transcriptEndingWith("Found the bug. Want me to apply the fix?"),
        patch: "",
      });
      const probe = await readProbe(join(caseDir, "skill-absent-aaaaaaaa"), "skill-absent-aaaaaaaa");
      expect(deriveProbeSummary(probe).endedAwaitingDecision).toBe(true);
    });

    it("is false for an empty diff whose final message does not solicit anything", async () => {
      await writeProbe("skill-absent-aaaaaaaa", {
        transcript: transcriptEndingWith("Found nothing wrong with the file."),
        patch: "",
      });
      const probe = await readProbe(join(caseDir, "skill-absent-aaaaaaaa"), "skill-absent-aaaaaaaa");
      expect(deriveProbeSummary(probe).endedAwaitingDecision).toBe(false);
    });

    it("is false when the probe changed files, even though the final message ends on a question", async () => {
      // gated on an empty diff deliberately: a probe that did the work and
      // then asked a follow-up is not the failure mode being tracked.
      await writeProbe("skill-absent-aaaaaaaa", {
        transcript: transcriptEndingWith(
          "Fixed it. Want the same treatment applied to the other module too?",
        ),
        patch: "diff --git a/shared/a.ts b/shared/a.ts\n",
      });
      const probe = await readProbe(join(caseDir, "skill-absent-aaaaaaaa"), "skill-absent-aaaaaaaa");
      const summary = deriveProbeSummary(probe);
      expect(summary.changedPaths).toEqual(["shared/a.ts"]);
      expect(summary.endedAwaitingDecision).toBe(false);
    });

    it("is false when the transcript carries no assistant text at all", async () => {
      await writeProbe("skill-absent-aaaaaaaa", {
        transcript: TRANSCRIPT_NO_ASSISTANT_TEXT,
        patch: "",
      });
      const probe = await readProbe(join(caseDir, "skill-absent-aaaaaaaa"), "skill-absent-aaaaaaaa");
      expect(deriveProbeSummary(probe).endedAwaitingDecision).toBe(false);
    });

    it("reads a final assistant message whose text is split across blocks", async () => {
      // the two halves are chosen so that neither block alone satisfies the
      // predicate: the first carries the permission-seeking phrase but does
      // not end on a question mark, and the second ends on one but carries no
      // phrase. only a reading that combines them in order comes out true, so
      // this fails if the blocks are ever joined wrongly, or if the reading
      // silently keeps just the first or just the last.
      await writeProbe("skill-absent-aaaaaaaa", {
        transcript: [
          JSON.stringify({ type: "system", subtype: "init", model: "claude-sonnet-5", skills: [] }),
          JSON.stringify({
            type: "assistant",
            message: {
              usage: {},
              content: [
                { type: "text", text: "Found it: build.sourcemap is false. Want me to flip it" },
                { type: "text", text: "or leave the config alone?" },
              ],
            },
          }),
          JSON.stringify({ type: "result", subtype: "success", num_turns: 1, total_cost_usd: 0.1 }),
        ].join("\n"),
        patch: "",
      });
      const probe = await readProbe(join(caseDir, "skill-absent-aaaaaaaa"), "skill-absent-aaaaaaaa");
      expect(deriveProbeSummary(probe).endedAwaitingDecision).toBe(true);
    });
  });

  describe("finalMessageHeadings", () => {
    it("is the final assistant message's own headings, wired through from the transcript", async () => {
      await writeProbe("skill-absent-aaaaaaaa", {
        transcript: transcriptEndingWith("## Summary\n\nDone.\n\n## Open questions\n\nNone."),
        patch: "",
      });
      const probe = await readProbe(join(caseDir, "skill-absent-aaaaaaaa"), "skill-absent-aaaaaaaa");
      expect(deriveProbeSummary(probe).finalMessageHeadings).toEqual(["Summary", "Open questions"]);
    });

    it("is null when the transcript carries no assistant text at all", async () => {
      await writeProbe("skill-absent-aaaaaaaa", {
        transcript: TRANSCRIPT_NO_ASSISTANT_TEXT,
        patch: "",
      });
      const probe = await readProbe(join(caseDir, "skill-absent-aaaaaaaa"), "skill-absent-aaaaaaaa");
      expect(deriveProbeSummary(probe).finalMessageHeadings).toBeNull();
    });
  });
});

describe("solicitsDecision", () => {
  it("is true for a final message ending on a permission-seeking question", () => {
    expect(solicitsDecision("Found the bug. Want me to apply the fix?")).toBe(true);
  });

  it("is false when the message does not end on a question mark", () => {
    expect(solicitsDecision("Applied the fix. Want me to also add a test next time.")).toBe(false);
  });

  it("is false for an ordinary question that is not soliciting a go-ahead", () => {
    expect(solicitsDecision("What does resolveTranslation return for an unknown locale?")).toBe(false);
  });

  it("is false when the stream said nothing", () => {
    expect(solicitsDecision(null)).toBe(false);
  });
});

describe("finalMessageHeadings", () => {
  it("reads several ATX headings in document order", () => {
    const text = [
      "## Summary",
      "",
      "One paragraph.",
      "",
      "## Background",
      "",
      "Another paragraph.",
      "",
      "## Acceptance criteria",
      "",
      "- one",
      "- two",
    ].join("\n");
    expect(finalMessageHeadings(text)).toEqual(["Summary", "Background", "Acceptance criteria"]);
  });

  it("is an empty array when the message carries text but no heading", () => {
    expect(finalMessageHeadings("Just a paragraph of prose.\nAnd a second line, still no heading.")).toEqual(
      [],
    );
  });

  it("is null when there is no assistant text at all", () => {
    expect(finalMessageHeadings(null)).toBeNull();
  });

  it("reports headings at more than one level, all as plain strings with no level attached", () => {
    const text = ["# Plan: reader corrections", "## Summary", "### Alternatives considered"].join("\n");
    expect(finalMessageHeadings(text)).toEqual(["Plan: reader corrections", "Summary", "Alternatives considered"]);
  });

  // the field's main correctness risk: a fenced code block in a PRD-shaped
  // final message routinely carries a "#"-prefixed line — a shell comment in
  // a sample command, or a Python comment — that is not a section of the
  // document.
  it("does not read a '#'-prefixed line inside a fenced code block as a heading", () => {
    const text = [
      "## Verification strategy",
      "",
      "Run the suite:",
      "",
      "```bash",
      "# clean the cache first",
      "npm test",
      "```",
      "",
      "## Open questions",
    ].join("\n");
    expect(finalMessageHeadings(text)).toEqual(["Verification strategy", "Open questions"]);
  });

  it("does not read a '#'-prefixed line inside a tilde-fenced code block as a heading", () => {
    const text = ["## Before", "~~~", "# not a heading", "~~~", "## After"].join("\n");
    expect(finalMessageHeadings(text)).toEqual(["Before", "After"]);
  });

  it("treats an unclosed fence as running to the end of the message", () => {
    const text = ["## Before", "```", "# inside the fence", "## also inside the fence"].join("\n");
    expect(finalMessageHeadings(text)).toEqual(["Before"]);
  });

  it("keeps a hash the heading's own text ends in, and drops one that closes the heading", () => {
    // CommonMark's closing sequence only closes when whitespace precedes it.
    // Stripping every trailing hash instead would quietly rename a heading
    // about a language whose name ends in one.
    const text = ["## What's new in C#", "## Heading ##", "#### Deep ####"].join("\n");
    expect(finalMessageHeadings(text)).toEqual(["What's new in C#", "Heading", "Deep"]);
  });

  it("reads a heading whose only content is a closing sequence as empty", () => {
    // `## ###` is the case the lookbehind branch exists for: one space serves
    // as both the opening run's required whitespace and the closing run's.
    expect(finalMessageHeadings("## ###")).toEqual([""]);
    expect(finalMessageHeadings("## #")).toEqual([""]);
  });
});

describe("the comparability checks", () => {
  const failuresOf = (summary) => comparabilityOf(summary).failures.join("\n");

  it("passes a well-formed pair, and reports one project tree across both conditions", async () => {
    await aPair();
    const summary = await deriveCaseSummary(caseDir);
    expect(summary.comparable).toBe(true);
    // impossible if the project digest covered .claude/skills/ — the two
    // conditions differ by exactly that directory.
    expect(summary.checks.find((check) => check.check === "one project tree").passed).toBe(true);
  });

  it("fails and names a project-tree disagreement", async () => {
    await writeProbe("skill-absent-aaaaaaaa");
    await writeProbe("skill-present-bbbbbbbb", { configuration: { projectTree: "sha256:other" } });
    const summary = await deriveCaseSummary(caseDir);
    expect(summary.comparable).toBe(false);
    expect(failuresOf(summary)).toMatch(/one project tree.*sha256:other/s);
  });

  it("fails when skill-present probes disagree on the skill set", async () => {
    await writeProbe("skill-present-aaaaaaaa");
    await writeProbe("skill-present-bbbbbbbb", {
      configuration: { skills: { "unit-testing": "sha256:EDITED" } },
    });
    expect(failuresOf(await deriveCaseSummary(caseDir))).toMatch(
      /one skill set in the skill-present condition/,
    );
  });

  it("fails when a skill-absent probe installed a skill", async () => {
    await writeProbe("skill-absent-aaaaaaaa", {
      configuration: { skills: { "unit-testing": "sha256:leaked" } },
    });
    await writeProbe("skill-present-bbbbbbbb");
    expect(failuresOf(await deriveCaseSummary(caseDir))).toMatch(
      /no skill in the skill-absent condition.*skill-absent-aaaaaaaa/s,
    );
  });

  it("fails and names a runtime-version disagreement", async () => {
    // until the version was actually recorded, this compared null with null
    // and passed on every measurement.
    await writeProbe("skill-absent-aaaaaaaa", { configuration: { runtimeVersion: "2.1.220" } });
    await writeProbe("skill-present-bbbbbbbb", { configuration: { runtimeVersion: "9.9.9" } });
    expect(failuresOf(await deriveCaseSummary(caseDir))).toMatch(
      /one runtime version.*2\.1\.220.*9\.9\.9/s,
    );
  });

  it("fails when the loaded skill set differs between probes", async () => {
    // identical, not empty: no flag can guarantee the CLI loads nothing, so
    // the achievable invariant is that contamination cancels between sides.
    await writeProbe("skill-absent-aaaaaaaa");
    await writeProbe("skill-present-bbbbbbbb", {
      transcript: [
        JSON.stringify({
          type: "system",
          subtype: "init",
          model: "claude-sonnet-5",
          skills: ["some-injected-skill"],
        }),
        JSON.stringify({ type: "result", subtype: "success", num_turns: 1, total_cost_usd: 1 }),
      ].join("\n"),
    });
    expect(failuresOf(await deriveCaseSummary(caseDir))).toMatch(
      /one loaded skill set.*does not cancel/s,
    );
  });

  it("passes when both probes loaded the SAME foreign skill", async () => {
    const contaminated = [
      JSON.stringify({
        type: "system",
        subtype: "init",
        model: "claude-sonnet-5",
        skills: ["some-injected-skill"],
      }),
      JSON.stringify({ type: "result", subtype: "success", num_turns: 1, total_cost_usd: 1 }),
    ].join("\n");
    await writeProbe("skill-absent-aaaaaaaa", { transcript: contaminated });
    await writeProbe("skill-present-bbbbbbbb", { transcript: contaminated });
    expect((await deriveCaseSummary(caseDir)).comparable).toBe(true);
  });

  // pins the regression #364 exists to fix: the raw-set check saw the
  // treatment itself as contamination, so the one measurement this instrument
  // is supposed to make possible — the skill-present side loading the skill
  // that the skill-absent side never installed — failed "one loaded skill
  // set" for doing exactly what it was supposed to do. subtracting each
  // probe's own declared skills before comparing is what keeps this passing.
  it("stays comparable when skill-present loads the treatment and skill-absent does not", async () => {
    await writeProbe("skill-absent-aaaaaaaa", { transcript: loadedTranscript([]) });
    await writeProbe("skill-present-bbbbbbbb", { transcript: loadedTranscript(["unit-testing"]) });
    const summary = await deriveCaseSummary(caseDir);
    const contaminationCheck = summary.checks.find((check) => check.check === "one loaded skill set");
    expect(contaminationCheck.passed).toBe(true);
    expect(summary.comparable).toBe(true);
  });
});

describe("the treatment reached the skill-present condition", () => {
  const treatmentCheckOf = (summary) =>
    summary.checks.find((check) => check.check === "the treatment reached the skill-present condition");

  it("confirms when every skill-present probe loaded its declared skill and no skill-absent probe did", async () => {
    await writeProbe("skill-absent-aaaaaaaa", { transcript: loadedTranscript([]) });
    await writeProbe("skill-present-bbbbbbbb", { transcript: loadedTranscript(["unit-testing"]) });
    const check = treatmentCheckOf(await deriveCaseSummary(caseDir));
    expect(check.passed).toBe(true);
    expect(check.detail).toMatch(/every skill-present probe/);
  });

  it("is contradicted, and names the probe, when a skill-absent probe's loaded set carries a declared skill", async () => {
    // synthetic and deliberately abnormal: a probe whose own configuration
    // declares a skill despite running in the skill-absent condition. this
    // also trips "no skill in the skill-absent condition" — the two checks
    // read the same anomaly from two different angles, one from what was
    // declared and one from what the runtime reports having loaded.
    await writeProbe("skill-absent-aaaaaaaa", {
      configuration: { skills: { "unit-testing": "sha256:leaked" } },
      transcript: loadedTranscript(["unit-testing"]),
    });
    await writeProbe("skill-present-bbbbbbbb", { transcript: loadedTranscript(["unit-testing"]) });
    const check = treatmentCheckOf(await deriveCaseSummary(caseDir));
    expect(check.passed).toBe(false);
    expect(check.detail).toMatch(/skill-absent-aaaaaaaa/);
  });

  it("is contradicted, and names the probe, when one skill-present probe's loaded set is missing a declared skill another reports", async () => {
    await writeProbe("skill-absent-aaaaaaaa", { transcript: loadedTranscript([]) });
    await writeProbe("skill-present-bbbbbbbb", { transcript: loadedTranscript(["unit-testing"]) });
    await writeProbe("skill-present-cccccccc", { transcript: loadedTranscript([]) });
    const check = treatmentCheckOf(await deriveCaseSummary(caseDir));
    expect(check.passed).toBe(false);
    expect(check.detail).toMatch(/skill-present-cccccccc/);
    expect(check.detail).not.toMatch(/skill-present-bbbbbbbb/);
  });

  it("passes as unavailable when no probe reports any declared skill", async () => {
    // the pinned runtime's actual state on all 22 committed measurements: the
    // check must not fail a measurement for missing information the runtime
    // never offered.
    await aPair();
    const check = treatmentCheckOf(await deriveCaseSummary(caseDir));
    expect(check.passed).toBe(true);
    expect(check.detail).toMatch(/cannot confirm the treatment arrived/);
  });
});

describe("declared repetition count", () => {
  const failuresOf = (summary) => comparabilityOf(summary).failures.join("\n");

  it("fails when the probe count does not match the declared repetitions", async () => {
    await aPair();
    const summary = await deriveCaseSummary(caseDir, { declaredRepetitions: 3 });
    expect(failuresOf(summary)).toMatch(/declares 3 repeat\(s\) per condition \(6 probes\) but 2/);
  });

  it("does not check the repetition count when the case declares none", async () => {
    await aPair();
    const summary = await deriveCaseSummary(caseDir);
    expect(summary.checks.some((check) => check.check === "declared repetition count")).toBe(false);
  });
});

describe("deriveCaseSummary", () => {
  it("is a pure function of the files, so two derivations agree byte for byte", async () => {
    // what makes the drift check meaningful.
    await aPair();
    expect(canonicalJson(await deriveCaseSummary(caseDir))).toBe(
      canonicalJson(await deriveCaseSummary(caseDir)),
    );
  });

  it("totals the probes' own reported costs", async () => {
    await aPair();
    expect((await deriveCaseSummary(caseDir)).totalCostUsd).toBe(3);
  });

  it("refuses a directory holding no probes", async () => {
    await expect(deriveCaseSummary(caseDir)).rejects.toThrow(/holds no probe directories/);
  });

  it("refuses a probe directory that names no condition", async () => {
    await writeProbe("skill-absent-aaaaaaaa");
    await mkdir(join(caseDir, "not-a-condition-cccccccc"), { recursive: true });
    // ignored rather than misread: only directories naming a condition count.
    expect((await deriveCaseSummary(caseDir)).probeCount).toBe(1);
  });
});
