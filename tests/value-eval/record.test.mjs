// Offline tests for scripts/value-eval/record.mjs: the raw per-run record and
// its NDJSON serialisation. The central claim under test is the one issue
// #235 is explicit about — no verdict field, ever — proven by an exhaustive
// key-set assertion rather than a spot check for one banned name.

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { tempDir } from "../helpers/fixtures.mjs";

import {
  appendRunRecord,
  buildRunRecord,
  readRunRecords,
  serializeRunRecord,
} from "../../scripts/value-eval/record.mjs";

const SAMPLE_TRANSCRIPT = Object.freeze({
  filesRead: ["shared/resolve-translation.ts"],
  commandsRun: ["npm test"],
  ranTests: true,
  ranLint: false,
  ranFormat: false,
  turns: 12,
  cost: 0.37,
  truncated: false,
  loadedSkills: ["unit-testing"],
  model: "claude-opus-5",
});

const SAMPLE_ARTIFACT = Object.freeze({
  testFilePath: "shared/resolve-translation.spec.ts",
  importSpecifiers: ["./resolve-translation"],
  importsHelper: { normalizeLocale: false, findExactMatch: true, findLanguageMatch: false },
  testCaseNames: ["returns the exact match"],
  assertionCount: 1,
  usesMocks: false,
});

function sampleInput(overrides = {}) {
  return {
    arm: "treatment",
    runIndex: 0,
    mock: "content-site",
    skills: ["unit-testing"],
    prompt: "shared/resolve-translation.ts has no tests. Add unit tests for it.",
    targetModule: "shared/resolve-translation.ts",
    cliExitCode: 0,
    transcript: SAMPLE_TRANSCRIPT,
    artifact: SAMPLE_ARTIFACT,
    diff: "diff --git a/shared/resolve-translation.spec.ts …",
    recordedAt: "2026-08-06T00:00:00Z",
    ...overrides,
  };
}

describe("buildRunRecord", () => {
  it("carries arm, run index, the extractor outputs, cost, turns, truncated, and loaded skills", () => {
    const record = buildRunRecord(sampleInput());

    expect(record.arm).toBe("treatment");
    expect(record.runIndex).toBe(0);
    expect(record.turns).toBe(12);
    expect(record.costUsd).toBe(0.37);
    expect(record.truncated).toBe(false);
    expect(record.loadedSkills).toEqual(["unit-testing"]);
    expect(record.transcript).toEqual(SAMPLE_TRANSCRIPT);
    expect(record.artifact).toEqual(SAMPLE_ARTIFACT);
  });

  it("carries no verdict field — the key set is exactly what the record documents", () => {
    const record = buildRunRecord(sampleInput());

    expect(Object.keys(record).sort()).toEqual(
      [
        "arm",
        "artifact",
        "cliExitCode",
        "costUsd",
        "diff",
        "loadedSkills",
        "mock",
        "prompt",
        "recordedAt",
        "runIndex",
        "skills",
        "targetModule",
        "transcript",
        "truncated",
        "turns",
      ].sort(),
    );

    for (const banned of ["verdict", "score", "pass", "passed", "worth", "outcome", "grade"]) {
      expect(Object.keys(record)).not.toContain(banned);
    }
  });

  it("is frozen, so a caller cannot mutate a field after the fact", () => {
    const record = buildRunRecord(sampleInput());
    expect(() => {
      record.arm = "control";
    }).toThrow();
  });

  it("copies the skills array rather than aliasing the caller's", () => {
    const skills = ["unit-testing"];
    const record = buildRunRecord(sampleInput({ skills }));
    skills.push("code-review");
    expect(record.skills).toEqual(["unit-testing"]);
  });

  it("defaults recordedAt to a whole-second ISO timestamp when omitted", () => {
    const record = buildRunRecord(sampleInput({ recordedAt: undefined }));
    expect(record.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });
});

describe("serializeRunRecord / appendRunRecord / readRunRecords", () => {
  it("serializes one record as one newline-terminated JSON line", () => {
    const record = buildRunRecord(sampleInput());
    const line = serializeRunRecord(record);

    expect(line.endsWith("\n")).toBe(true);
    expect(line.trim().split("\n")).toHaveLength(1);
    expect(JSON.parse(line)).toEqual(record);
  });

  it("appends records one at a time and reads them back in order", async () => {
    const dir = await tempDir();
    const path = join(dir, "records.ndjson");

    const first = buildRunRecord(sampleInput({ arm: "control", runIndex: 0 }));
    const second = buildRunRecord(sampleInput({ arm: "treatment", runIndex: 0 }));

    await appendRunRecord(path, first);
    await appendRunRecord(path, second);

    const records = await readRunRecords(path);
    expect(records).toEqual([first, second]);

    // Genuinely one line per record on disk — not a JSON array.
    const raw = await readFile(path, "utf8");
    expect(raw.trim().split("\n")).toHaveLength(2);
  });

  it("reads an empty array from a records file that does not exist yet", async () => {
    const dir = await tempDir();
    expect(await readRunRecords(join(dir, "missing.ndjson"))).toEqual([]);
  });
});
