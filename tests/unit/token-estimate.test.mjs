// The shared byte→token proxy, tested directly.
//
// The divisor is deliberately re-measurable — its own header says "re-measure
// before moving it" — so these cases pin the proxy's CONTRACT rather than its
// current calibration: that it divides UTF-8 bytes, rounds to a whole token,
// and exposes the same figure every caller displays. A case asserting 4.76
// itself would turn a sanctioned re-calibration into a test failure, which is
// how a constant ends up frozen by accident.
//
// The one thing worth pinning by value is the uncertainty STRING, because two
// callers interpolate it into user-facing reports.

import { describe, expect, it } from "vitest";

import {
  BYTES_PER_TOKEN,
  estimateTokens,
  PROXY_UNCERTAINTY,
} from "../../skills/agent-skill-authoring/scripts/token-estimate.mjs";

describe("token-estimate.mjs", () => {
  describe("BYTES_PER_TOKEN", () => {
    it("is a positive number", () => {
      expect(typeof BYTES_PER_TOKEN).toBe("number");
      expect(BYTES_PER_TOKEN).toBeGreaterThan(0);
    });

    it("sits in the range the calibration measured", () => {
      // The header records a per-file spread of 4.55–4.98 over this corpus. A
      // divisor outside it would not be a re-calibration but a mistake.
      expect(BYTES_PER_TOKEN).toBeGreaterThanOrEqual(4.55);
      expect(BYTES_PER_TOKEN).toBeLessThanOrEqual(4.98);
    });
  });

  describe("PROXY_UNCERTAINTY", () => {
    it("is the display string both reports interpolate", () => {
      expect(PROXY_UNCERTAINTY).toBe("±5%");
    });
  });

  describe("estimateTokens()", () => {
    it("divides bytes by the shared divisor", () => {
      expect(estimateTokens(4_760)).toBe(1_000);
    });

    it("rounds to the nearest whole token", () => {
      expect(estimateTokens(1)).toBe(0);
      expect(estimateTokens(3)).toBe(1);
      expect(Number.isInteger(estimateTokens(12_345))).toBe(true);
    });

    it("estimates zero for an empty document", () => {
      expect(estimateTokens(0)).toBe(0);
    });

    it("grows monotonically with size", () => {
      const sizes = [0, 100, 1_000, 10_000, 100_000];
      const estimates = sizes.map(estimateTokens);

      expect(estimates).toEqual([...estimates].sort((a, b) => a - b));
    });

    it("is consistent with dividing by the exported divisor", () => {
      // The claim both reports make to their readers: the bytes shown and the
      // token figure shown are related by the divisor they name.
      for (const bytes of [1, 999, 31_647, 791_627]) {
        expect(estimateTokens(bytes)).toBe(Math.round(bytes / BYTES_PER_TOKEN));
      }
    });
  });
});
