// the repository's own gates, run over the real tree.
//
// these three checks were `npm run links`, `npm run skill-structure`, and
// `npm run installed-copies`. they are gates, not contract tests: each asserts
// that this repository is currently clean, where the suites under
// tests/validators assert what the validators do to fixture input.
//
// a gate that runs but cannot fail is worse than no gate, because it reads as
// coverage. each case below therefore has a companion in
// tests/repository/gate-teeth.test.mjs that plants a violation in a temporary
// copy and requires the same invocation to catch it.

import { describe, expect, it } from "vitest";

import { runScript } from "../helpers/run.mjs";
import { GATES } from "./gates.mjs";

describe("repository gates", () => {
  it.each(GATES)("$name passes over this repository", ({ script, args, passes }) => {
    const result = runScript(script, args);

    expect(result).toPassCleanly();
    expect(result.stdout).toMatch(passes);
  });
});
