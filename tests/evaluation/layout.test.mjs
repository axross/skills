// layout.mjs: filenames, the on-disk naming scheme, and the one canonical
// serializer everything derived goes through.

import { describe, expect, it } from "vitest";

import {
  canonicalJson,
  DIFF_FILE,
  FACTORS_FILE,
  INVOCATIONS_FILE,
  measurementDirName,
  MEASUREMENTS_ROOT,
  METADATA_FILE,
  newId,
  PROBE_MEASURED_FILES,
  probeDirName,
  SUMMARY_FILE,
  TRANSCRIPT_FILE,
} from "../../tools/evaluation/src/layout.mjs";

describe("filenames", () => {
  it("names the four measured files and matches PROBE_MEASURED_FILES to them", () => {
    expect(PROBE_MEASURED_FILES).toEqual([METADATA_FILE, TRANSCRIPT_FILE, DIFF_FILE, INVOCATIONS_FILE]);
    expect(FACTORS_FILE).toBe("factors.json");
    expect(SUMMARY_FILE).toBe("summary.json");
  });

  it("resolves under tools/evaluation/measurements, not the deleted data/ tree", () => {
    expect(MEASUREMENTS_ROOT).toBe("tools/evaluation/measurements");
    expect(MEASUREMENTS_ROOT).not.toContain("tools/evaluation/data");
  });
});

describe("newId", () => {
  it("produces distinct 8-hex-character ids", () => {
    const a = newId();
    const b = newId();
    expect(a).toMatch(/^[0-9a-f]{8}$/);
    expect(a).not.toBe(b);
  });
});

describe("measurementDirName", () => {
  it("prefixes the scenario id and accepts an explicit id for determinism in a test", () => {
    expect(measurementDirName("my-scenario", "deadbeef")).toBe("my-scenario-deadbeef");
  });

  it("generates a fresh id when none is given", () => {
    expect(measurementDirName("s")).toMatch(/^s-[0-9a-f]{8}$/);
  });
});

describe("probeDirName", () => {
  it("names a probe by its condition and 1-based repetition", () => {
    expect(probeDirName("skill-present", 1)).toBe("skill-present-1");
    expect(probeDirName("skill-absent", 3)).toBe("skill-absent-3");
  });
});

describe("canonicalJson", () => {
  it("pretty-prints with a two-space indent and a trailing newline", () => {
    expect(canonicalJson({ a: 1 })).toBe('{\n  "a": 1\n}\n');
  });

  it("is deterministic for the same input", () => {
    const value = { b: [1, 2, 3], a: "x" };
    expect(canonicalJson(value)).toBe(canonicalJson(value));
  });
});
