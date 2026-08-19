// fingerprintsMatch / findComparablePredecessor: which of a scenario's
// earlier measurements, if any, a later one is read as a change against —
// by content (project tree, model, skill digests, reasoning judge + prompt
// per factor), never by name.

import { describe, expect, it } from "vitest";

import {
  fingerprintsMatch,
  findComparablePredecessor,
} from "../../tools/evaluation/src/comparability.mjs";

function fingerprint(overrides = {}) {
  return {
    projectTree: "sha256:tree",
    runtimeModel: "anthropic/claude-sonnet-5-1",
    skillDigests: { "a-skill": "sha256:a" },
    reasoningJudges: [{ factor: "f1", judgeModel: "anthropic/judge-1", prompt: "read this" }],
    ...overrides,
  };
}

describe("fingerprintsMatch", () => {
  it("matches two identical fingerprints", () => {
    expect(fingerprintsMatch(fingerprint(), fingerprint())).toBe(true);
  });

  it("is insensitive to skill-digest key order", () => {
    const a = fingerprint({ skillDigests: { x: "1", y: "2" } });
    const b = fingerprint({ skillDigests: { y: "2", x: "1" } });
    expect(fingerprintsMatch(a, b)).toBe(true);
  });

  it("mismatches on a different project tree", () => {
    expect(fingerprintsMatch(fingerprint(), fingerprint({ projectTree: "sha256:other" }))).toBe(false);
  });

  it("mismatches on a different runtime model", () => {
    expect(fingerprintsMatch(fingerprint(), fingerprint({ runtimeModel: "anthropic/claude-sonnet-5-2" }))).toBe(
      false,
    );
  });

  it("mismatches on a changed skill digest", () => {
    const a = fingerprint({ skillDigests: { "a-skill": "sha256:a" } });
    const b = fingerprint({ skillDigests: { "a-skill": "sha256:changed" } });
    expect(fingerprintsMatch(a, b)).toBe(false);
  });

  it("mismatches on a different number of installed skills", () => {
    const a = fingerprint({ skillDigests: { x: "1" } });
    const b = fingerprint({ skillDigests: { x: "1", y: "2" } });
    expect(fingerprintsMatch(a, b)).toBe(false);
  });

  // docs/specs/skill-evaluation.md: "Re-judging a stored measurement with a
  // different reasoning judge is therefore a new measurement, never a
  // silent update to the old one."
  it("mismatches when a reasoning factor's judge model changed", () => {
    const a = fingerprint({ reasoningJudges: [{ factor: "f1", judgeModel: "anthropic/judge-1", prompt: "p" }] });
    const b = fingerprint({ reasoningJudges: [{ factor: "f1", judgeModel: "anthropic/judge-2", prompt: "p" }] });
    expect(fingerprintsMatch(a, b)).toBe(false);
  });

  it("mismatches when a reasoning factor's prompt changed", () => {
    const a = fingerprint({ reasoningJudges: [{ factor: "f1", judgeModel: "anthropic/judge-1", prompt: "p1" }] });
    const b = fingerprint({ reasoningJudges: [{ factor: "f1", judgeModel: "anthropic/judge-1", prompt: "p2" }] });
    expect(fingerprintsMatch(a, b)).toBe(false);
  });

  // docs/specs/skill-evaluation.md: "the route that asked it" is part of
  // what makes two measurements comparable, alongside the model and the
  // prompt — re-judging through a different route is a new measurement.
  it("mismatches when a reasoning factor's route changed", () => {
    const a = fingerprint({
      reasoningJudges: [{ factor: "f1", judgeModel: "m", route: "claude-code-cli", prompt: "p" }],
    });
    const b = fingerprint({
      reasoningJudges: [{ factor: "f1", judgeModel: "m", route: "direct-http", prompt: "p" }],
    });
    expect(fingerprintsMatch(a, b)).toBe(false);
  });

  it("mismatches when one fingerprint records a reasoning judge's route and the other records none", () => {
    const a = fingerprint({
      reasoningJudges: [{ factor: "f1", judgeModel: "m", route: "claude-code-cli", prompt: "p" }],
    });
    const b = fingerprint({ reasoningJudges: [{ factor: "f1", judgeModel: "m", prompt: "p" }] });
    expect(fingerprintsMatch(a, b)).toBe(false);
  });

  it("is insensitive to reasoning-judge entry order", () => {
    const a = fingerprint({
      reasoningJudges: [
        { factor: "f1", judgeModel: "m", prompt: "p1" },
        { factor: "f2", judgeModel: "m", prompt: "p2" },
      ],
    });
    const b = fingerprint({
      reasoningJudges: [
        { factor: "f2", judgeModel: "m", prompt: "p2" },
        { factor: "f1", judgeModel: "m", prompt: "p1" },
      ],
    });
    expect(fingerprintsMatch(a, b)).toBe(true);
  });
});

describe("findComparablePredecessor", () => {
  it("returns null for an empty candidate list — a scenario's first measurement", () => {
    expect(findComparablePredecessor([], fingerprint())).toBeNull();
  });

  it("returns null when no candidate matches", () => {
    const candidates = [{ id: "m1", timestamp: "2026-01-01T00:00:00Z", fingerprint: fingerprint({ projectTree: "sha256:other" }) }];
    expect(findComparablePredecessor(candidates, fingerprint())).toBeNull();
  });

  it("returns the most recent of several matching candidates", () => {
    const candidates = [
      { id: "older", timestamp: "2026-01-01T00:00:00Z", fingerprint: fingerprint() },
      { id: "newer", timestamp: "2026-06-01T00:00:00Z", fingerprint: fingerprint() },
      { id: "non-matching", timestamp: "2026-08-01T00:00:00Z", fingerprint: fingerprint({ projectTree: "sha256:other" }) },
    ];
    expect(findComparablePredecessor(candidates, fingerprint())).toEqual({
      id: "newer",
      timestamp: "2026-06-01T00:00:00Z",
    });
  });
});
