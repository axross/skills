# Test Discovery

Apply this reference when deciding where spec files live, when Jest runs too many or too few files, and whenever a repository holds a Jest suite alongside a suite belonging to a different runner.

Verified against `jest` 30.4.2 — [Jest — Configuring Jest](https://jestjs.io/docs/configuration).

## Selecting Test Files

Jest offers two mutually exclusive mechanisms. `testMatch` takes glob patterns and is the default; `testRegex` takes regular expressions. Setting both is a configuration error, not a merge.

The Jest 30 defaults are `**/__tests__/**/*.?([mc])[jt]s?(x)` and `**/?(*.)+(spec|test).?([mc])[jt]s?(x)` — note that `.mts` and `.cts` joined this set in Jest 30, so a non-test file with one of those extensions may now be collected.

**Guidelines:**

- MUST set `testMatch` or `testRegex`, never both.
- MUST prefer `testMatch` unless an existing pattern genuinely needs a regular expression's power; a glob states intent more legibly.
- MUST anchor a custom pattern with `<rootDir>` so it cannot match inside a dependency.
- SHOULD confirm a changed pattern with `--listTests` before committing it, since a pattern matching nothing reports as success under `--passWithNoTests`.

## Where Specs Live

Which convention a project follows is a unit-testing rule; what matters here is that Jest's discovery patterns have to agree with it.

Two conventions are in wide use: a spec colocated beside its subject, and a spec under a `__tests__/` directory. Both work; a project should hold to one.

Colocation makes the spec visible when the subject is edited and keeps the relative import short. A dedicated directory keeps the source tree free of test files, which matters when the source tree is also the published package.

**Guidelines:**

- MUST follow the project's existing convention rather than introducing a second one alongside it.
- MUST keep spec files out of the published artifact, whether by directory placement or by a build-time exclusion.
- SHOULD colocate when the subject is a module with a single clear owner, and use a directory when specs cover a subsystem rather than a file.

## Keeping Two Runners Apart

A repository frequently runs Jest for its logic and a browser or device runner for its user journeys. Jest's default `testMatch` claims both `*.spec.*` and `*.test.*` under every directory — including the one holding the other runner's suite. Left alone, Jest collects those files, fails to resolve the other runner's imports, and reports failures that have nothing to do with the code.

The reliable separation is by extension **and** by directory, with each runner's configuration naming only its own.

**Example:**

```js
// Jest owns *.spec.ts under the source tree; the e2e runner owns *.test.ts
// under e2e/. Neither pattern can reach the other's files.
/** @type {import("jest").Config} */
module.exports = {
  testMatch: ["<rootDir>/src/**/*.spec.ts", "<rootDir>/app/**/*.spec.ts"],
};
```

**Guidelines:**

- MUST narrow `testMatch` explicitly when another runner's tests live in the same repository, rather than relying on the default and excluding afterwards.
- MUST give each runner a distinct file extension convention, so a misplaced file is visible rather than merely unmatched.
- MUST verify the separation from both sides: Jest's `--listTests` should show no e2e file, and the other runner's listing no Jest spec.
- SHOULD give each runner its own npm script naming its own config, so neither is ever invoked with the other's discovery rules.

## Excluding Paths

`testPathIgnorePatterns` (default `["/node_modules/"]`) removes matched files from a run. `modulePathIgnorePatterns` goes further and makes matched paths unresolvable, which is what a stale build directory needs — otherwise Jest may resolve an import to `dist/` and test yesterday's output.

**Guidelines:**

- MUST exclude build output from both discovery and module resolution when a build directory exists inside the project.
- MUST preserve the `node_modules` default when extending `testPathIgnorePatterns`, since assigning a new array replaces it.
- SHOULD prefer narrowing `testMatch` over accumulating exclusions; a positive pattern states what a suite is, while a list of exclusions states only what it is not.

## Proving What Is Selected

Discovery is the one part of a Jest configuration that fails silently in both directions: too many files produce confusing failures, and too few produce a green run that tested nothing.

**Guidelines:**

- MUST run `--listTests` after changing any discovery option, and compare the count against expectation.
- MUST NOT rely on `--passWithNoTests` in a suite that is expected to have tests; it converts the most dangerous misconfiguration into a pass.
- SHOULD use `--showConfig` when the effective configuration is not obviously the one on the page, particularly under a preset.
