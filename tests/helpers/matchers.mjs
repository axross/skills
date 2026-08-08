// custom matchers for validator spawn results.
//
// every bundled validator's contract is an exit code plus what it writes to
// stdout/stderr, so nearly every assertion in this suite is "did it exit N, and
// does its report mention X". written with bare `expect(result.code).toBe(1)`
// that reads fine until it fails, at which point the diff says `1 !== 0` and
// nothing about why the validator disagreed — the report it printed is the one
// thing a reader needs and the one thing the message omits.
//
// these matchers put the validator's own output in the failure message, so a
// red test explains itself without a rerun.

import { expect } from "vitest";

/** the validator's own report, indented so it reads as quoted output. */
function quoteOutput(result) {
  const text = result.output.trimEnd();
  if (text === "") return "    (the script printed nothing)";
  return text
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");
}

expect.extend({
  /**
   * the script exited with `expected`.
   *
   * @param {{ code: number, output: string }} result
   * @param {number} expected
   */
  toExitWith(result, expected) {
    const pass = result.code === expected;
    return {
      pass,
      actual: result.code,
      expected,
      message: () =>
        pass
          ? `Expected the script NOT to exit ${expected}, but it did. Its output was:\n${quoteOutput(result)}`
          : `Expected the script to exit ${expected}, but it exited ${result.code}. Its output was:\n${quoteOutput(result)}`,
    };
  },

  /**
   * the script failed (exit 1) and also said why, matching `pattern` against stdout
   * and stderr combined. both halves matter: a validator that exits 1 for an
   * unrelated reason is not evidence that the rule under test fired.
   *
   * @param {{ code: number, output: string }} result
   * @param {RegExp | string} pattern
   */
  toReportFailure(result, pattern) {
    const matcher = typeof pattern === "string" ? new RegExp(pattern) : pattern;
    const exited = result.code === 1;
    const mentioned = matcher.test(result.output);
    const pass = exited && mentioned;

    return {
      pass,
      message: () => {
        if (pass) {
          return `Expected the script NOT to report a failure matching ${matcher}, but it did. Its output was:\n${quoteOutput(result)}`;
        }
        const reason = !exited
          ? `it exited ${result.code} rather than 1`
          : `its report never matched ${matcher}`;
        return `Expected the script to report a failure matching ${matcher}, but ${reason}. Its output was:\n${quoteOutput(result)}`;
      },
    };
  },

  /**
   * the script passed (exit 0). a named matcher rather than `toExitWith(0)`
   * because "this input is clean" is the single most repeated assertion here,
   * and it reads as the claim it makes.
   *
   * @param {{ code: number, output: string }} result
   */
  toPassCleanly(result) {
    const pass = result.code === 0;
    return {
      pass,
      message: () =>
        pass
          ? `Expected the script NOT to pass, but it exited 0. Its output was:\n${quoteOutput(result)}`
          : `Expected the script to pass, but it exited ${result.code}. Its output was:\n${quoteOutput(result)}`,
    };
  },
});
