# Review and Enforcement

Apply this reference when setting up lint enforcement for a Jest suite, when reviewing a change that touches tests, or when reporting what a Jest change was verified against.

Verified against `jest` 30.4.2 and `eslint-plugin-jest` 29.16.0 — [eslint-plugin-jest](https://github.com/jest-community/eslint-plugin-jest#readme), whose `docs/rules/` directory holds a page per rule named below.

## What Lint Enforces

Much of this skill is mechanically checkable, and a lint rule beats a review comment because it fires before the review. `eslint-plugin-jest`'s recommended config covers the highest-value cases:

| Rule                      | Prevents                                                   |
| ------------------------- | ---------------------------------------------------------- |
| `valid-expect`            | an `expect` that is never awaited or never completes       |
| `valid-expect-in-promise` | an assertion inside a promise chain nothing awaits         |
| `no-focused-tests`        | a committed `.only` silently reducing a file to one case   |
| `no-disabled-tests`       | a skipped test nobody revisits                             |
| `no-conditional-expect`   | an assertion behind a branch that may never run            |
| `no-standalone-expect`    | an assertion outside any case                              |
| `no-identical-title`      | two cases whose reports cannot be told apart               |
| `no-done-callback`        | the callback form and its swallowed-assertion failure mode |
| `no-alias-methods`        | matcher aliases removed in Jest 30 — auto-fixable          |
| `expect-expect`           | a case that asserts nothing                                |

**Guidelines:**

- MUST enable `eslint-plugin-jest`'s recommended configuration in a project running Jest; several of its rules catch silent-pass defects no review reliably finds.
- MUST fix `valid-expect` and `valid-expect-in-promise` findings rather than suppressing them; each marks a test that is not asserting what it appears to.
- SHOULD use `no-alias-methods`' auto-fix to complete a Jest 30 migration, rather than searching by hand.

## Worth Turning On Deliberately

These are not in the recommended set and each encodes a decision:

| Rule                            | Decision it enforces                                                          |
| ------------------------------- | ----------------------------------------------------------------------------- |
| `prefer-importing-jest-globals` | the API is imported, not inherited from globals                               |
| `consistent-test-it`            | one case function per project                                                 |
| `prefer-jest-mocked`            | `jest.mocked()` over a signature-discarding cast                              |
| `prefer-spy-on`                 | `jest.spyOn` over assigning a `jest.fn()`                                     |
| `prefer-strict-equal`           | `toStrictEqual` over `toEqual`                                                |
| `no-large-snapshots`            | a snapshot stays small enough to review                                       |
| `no-interpolation-in-snapshots` | a snapshot cannot interpolate itself into passing                             |
| `require-to-throw-message`      | `toThrow` distinguishes the intended failure                                  |
| `prefer-each`                   | a table over a hand-rolled loop                                               |
| `valid-mock-module-path`        | a mocked path that resolves — sharper since Jest 30 made paths case-sensitive |
| `max-nested-describe`           | a ceiling on nesting depth                                                    |

**Guidelines:**

- MUST enable `prefer-importing-jest-globals` in a project that has adopted explicit imports, so the convention is enforced rather than merely stated.
- SHOULD enable `no-large-snapshots` with an explicit ceiling in any project using snapshots.
- SHOULD adopt these incrementally, at whatever severity lets an existing suite stay green, rather than turning all of them on at once.

## Reviewing a Jest Change

Lint cannot see any of these, so they are the review's job:

- Does a mock stand at a real boundary, or is it hiding the behavior the test claims to verify?
- Would this test fail for the regression it exists to catch, or only for a rewrite?
- Does an assertion pin a framework's call pattern rather than the code's behavior?
- Is a snapshot doing the work an explicit assertion should do — and did anyone read it?
- Is the clock real where it should be fake, or advanced synchronously where the code awaits?
- Does the suite still pass under `--randomize`, and with the changed file run alone?
- Does a new `testMatch` still select what it did, and nothing belonging to another runner?

**Guidelines:**

- MUST check that a changed test would fail against the pre-change implementation, rather than only that it passes against the new one.
- MUST flag an assertion that pins a framework's scheduling, a snapshot that nobody reviewed, and a real-clock wait, as defects rather than style.
- MUST verify a discovery-pattern change with `--listTests` output in the change's evidence, since the failure mode is a silent pass.
- SHOULD flag a spec whose bulk is mock setup as a signal about the code's dependency structure.

## Verification Evidence

That a test change runs the project's own commands, and reports what was skipped, is owned by a unit-testing capability and by whatever quality-assurance practice a project keeps. The additions below are the Jest-specific evidence those do not name.

A Jest change is not verified by having been written.

**Guidelines:**

- MUST run the project's unit-test command and report the result, naming the command rather than describing it.
- MUST run the project's format, lint, and type-check commands after changing specs, and report any that could not run with the reason and the residual risk.
- MUST report the file count from `--listTests` when a discovery option changed.
- SHOULD run the changed spec in isolation as well as in the suite, and say that both were done.

## The Bundled Validator

`scripts/check-jest-usage.mjs` checks four defects that are decidable from source and fail silently: a partially imported test API, `it` and `test` mixed in one file, a Jest 30-removed API still in use, and a `testMatch` that also selects another runner's directory.

It deliberately checks nothing requiring judgment, so a report is always a real defect rather than an argument.

**Guidelines:**

- MUST run the validator over a project whose Jest specs or configuration a change touches, and report the result.
- MUST NOT treat a passing run as evidence that a suite is well tested; it is a floor, and every rule in this skill that needs judgment is outside it.
- SHOULD run it after a Jest major upgrade, where the removed-API check does the most work.
