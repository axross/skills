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

import { canonicalJson } from "../../tools/effect-eval/src/layout.mjs";
import { buildConfiguration } from "../../tools/effect-eval/src/spawn.mjs";
import {
  changedPaths,
  comparabilityOf,
  deriveCaseSummary,
  deriveProbeSummary,
  readProbe,
} from "../../tools/effect-eval/src/summary.mjs";

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

/** everything overridable per case. */
async function writeProbe(name, { configuration = {}, transcript = TRANSCRIPT, patch = "" } = {}) {
  const directory = join(caseDir, name);
  await mkdir(directory, { recursive: true });
  const full = buildConfiguration({
    projectName: "content-site",
    projectTree: "sha256:tree",
    prompt: "add tests",
    targetModule: "shared/x.ts",
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

  it("does not fail when the transcript is merely silent about the model", async () => {
    // `null` means "did not say", not "disagrees".
    await writeProbe("skill-absent-aaaaaaaa", {
      transcript: JSON.stringify({ type: "result", subtype: "success", num_turns: 1 }),
    });
    const probe = await readProbe(join(caseDir, "skill-absent-aaaaaaaa"), "skill-absent-aaaaaaaa");
    expect(() => deriveProbeSummary(probe)).not.toThrow();
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
