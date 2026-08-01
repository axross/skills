---
name: jest-testing
description: The ability to author, configure, run, and debug tests with Jest — the runner layer beneath a runner-agnostic unit-testing capability. Covers the configuration surface and test discovery; explicit `@jest/globals` imports, suite structure, and `.each` tables; the matcher inventory and asymmetric matchers; the async forms and their silent-pass traps; mock functions, spies, and the clear/reset/restore distinction; module mocking in CommonJS and under ESM; fake timers; snapshot discipline; TypeScript transformer choice; transforms, module resolution, and test environments; isolation between tests, coverage, the CLI, suite performance, and diagnosing a flaky or hanging run; the Jest side of Next.js, React Native, and Expo wiring; and a bundled validator for the defects that fail silently. Names Jest 30.4.2 as the baseline every version-sensitive rule was verified against.
when_to_use: Use whenever a change touches Jest itself — a Jest config, `testMatch`, `@jest/globals`, `jest.fn`, `jest.spyOn`, `jest.mock`, `unstable_mockModule`, `useFakeTimers`, `toMatchSnapshot`, `moduleNameMapper`, `transformIgnorePatterns`, `setupFilesAfterEnv`, `next/jest`, `jest-expo`, a `--runInBand` or `--detectOpenHandles` run, or `Cannot use import statement outside a module`. For what is worth testing, case naming, and the unit-versus-e2e scope call, use a unit-testing capability instead; for browser- or device-driven suites, an end-to-end-testing one.
user-invocable: false
---

# Jest Testing

Use this capability whenever a change touches Jest — its configuration, its API, its command line, or the way a suite is transformed and isolated. It owns the **runner layer**: which Jest API, which option, which file, which flag, and what each one costs.

It does **not** own what to test. Whether a behavior deserves a test at all, how a `describe` block and a case are named, whether an assertion pins behavior or implementation, and whether something belongs in a unit test rather than an integration or end-to-end one all belong to a unit-testing capability, which is runner-agnostic and applies whether a project runs Jest, Vitest, or Node's built-in runner. This skill assumes those decisions are made and says how Jest carries them out. Where a rule here has a counterpart there, this skill states the Jest mechanism and names the other as owner.

It also does not own the **framework** an integration sits inside. That Next.js has a build config to wrap, or that an Expo app has a Metro config, is a framework fact owned by that framework's own capability; what the Jest side of that wiring looks like is owned here.

**Version discipline.** Jest's option surface moves between majors, and Jest 30 removed a decade of aliases in one release: `toBeCalledWith`, `toThrowError`, `jest.genMockFromModule`, `jest.SpyInstance`, and `jest --init` are all gone rather than deprecated. Options also behave differently than their names suggest — `waitForUnhandledRejections` defaults to `false`, not on. Every version-sensitive statement here names what it was verified against, and where a surface is known to move the rule is a **lookup** — consult the installed Jest's own documentation — rather than a frozen option name. Treat an unversioned claim about a Jest option, in this skill or anywhere else, as suspect.

**Verified against** `jest` 30.4.2, as published on npm on 2026-08-01, whose `engines.node` is `^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0`.

**Out of scope.** Vitest, Node's built-in test runner, and Bun's are named only where the honest answer to "should this project run Jest at all" is no. React Testing Library's own query and assertion conventions belong to a component-testing capability; only its Jest-side wiring is covered here.

**Guidelines:**

- MUST run the bundled `scripts/check-jest-usage.mjs` over a project whose Jest specs or configuration a change touches; it catches the four defects below that fail silently, and states nothing that needs judgment.
- MUST resolve a version-sensitive question against the installed Jest's own documentation rather than from memory, and state the version the answer came from.
- SHOULD reach for a hand-rolled fake at a real boundary before reaching for `jest.mock`; the module registry is the heaviest tool in this skill and the one most often used first.

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119.html).

## Boundary and Versions

See [boundary-and-versions.md](./references/boundary-and-versions.md) for:

- deciding whether a question belongs to this capability or to the runner-agnostic one above it
- recognising the projects where Jest is the wrong runner, and what to say instead
- what Jest 30 removed outright, and the migration lever that finds each occurrence
- the changes that alter behavior without changing a name you would grep for
- reading a rule's verified-against marker when the installed Jest disagrees

## Configuration

See [configuration.md](./references/configuration.md) for:

- choosing where the configuration lives, and the form an ESM package needs
- adopting a preset without losing track of what it already set
- splitting one repository's suites into separately configured projects
- resolving paths from a root, and keeping one source of truth for a value two tools need
- getting the configuration type-checked rather than trusted

## Test Discovery

See [test-discovery.md](./references/test-discovery.md) for:

- selecting test files by glob or by pattern, and why setting both is a mistake
- placing specs beside their subject or under a dedicated directory
- keeping a Jest suite and a non-Jest end-to-end suite from selecting each other's files
- excluding build output and vendored code from a run
- proving what the configuration actually selects before trusting it

## The Test API

See [test-api.md](./references/test-api.md) for:

- importing the test API explicitly, and the half-imported file that still passes
- making the implicit form fail loudly rather than silently
- choosing one case function and holding a project to it
- grouping, focusing, skipping, and marking a case as a known failure
- the hook set, its scoping, and the order everything actually runs in
- why a case built asynchronously never registers
- building a table-driven case, and titling its rows so a failure names itself

## Matchers

See [matchers.md](./references/matchers.md) for:

- choosing among the equality matchers, which differ in ways their names do not reveal
- asserting on collections, numbers, and thrown errors
- asserting what a mock received without over-pinning how it was called
- matching part of a value and ignoring the rest
- adding a domain matcher rather than repeating a compound assertion
- preferring a specific matcher over a hand-rolled boolean, for the failure message

## Asynchronous Tests

See [asynchronous.md](./references/asynchronous.md) for:

- the four ways to await work, and the one to avoid
- the omission that makes an async test pass without asserting anything
- guarding a rejection test so a resolution cannot satisfy it
- setting a timeout at the right scope when work legitimately takes longer
- the trade-off behind Jest's handling of an unhandled rejection

## Mock Functions and Spies

See [mock-functions.md](./references/mock-functions.md) for:

- creating a mock and reading what it recorded
- setting a return, a resolution, a rejection, or a one-shot implementation
- wrapping an existing method rather than replacing it, and the accessor form
- replacing a value that is not a function
- the three reset levels, and which one a given mock actually responds to
- typing a mock so a signature change breaks the test rather than the build
- deciding what deserves a mock at all

## Module Mocking

See [module-mocking.md](./references/module-mocking.md) for:

- replacing a module, and the hoisting that makes the call order misleading
- the variable-naming rule a module factory imposes, and why
- the three different rules governing a manual mock directory
- mocking part of a module while keeping the rest real
- reaching past your own mock for the real implementation a test needs
- mocking a class, and the member an automatic mock silently misses

## ESM Mocking

See [esm-mocking.md](./references/esm-mocking.md) for:

- why the ordinary module-mocking call does nothing in an ES module
- the replacement call, its mandatory factory, and the import order it demands
- the runtime flag and configuration an ESM suite needs before anything runs
- reaching the runner's own object without a global
- mocking a CommonJS dependency from an ES module test
- what remains experimental, and how much weight to put on it

## Fake Timers

See [fake-timers.md](./references/fake-timers.md) for:

- taking control of the clock, and giving it back
- choosing how far to advance, and the choice a self-rescheduling timer forces
- advancing a clock whose timers resolve promises
- keeping specific time APIs real while faking the rest
- moving the wall clock rather than the timer queue
- recognising the real-clock wait this replaces, and what it costs a suite

## Snapshots

See [snapshots.md](./references/snapshots.md) for:

- choosing between a stored snapshot and one written into the test
- capturing an error message as a contract
- keeping a generated or time-dependent field from failing every run
- updating snapshots, and the flag that stops an unreviewed one from passing
- keeping a snapshot small enough that a reviewer actually reads it
- teaching the serializer about a domain type

## TypeScript

See [typescript.md](./references/typescript.md) for:

- the three transformer routes, and what each one gives up
- getting type errors caught once rather than per test file
- the compilation mode that trades cross-file analysis for speed
- typing a mocked module, a spy, and a replaced property
- the inference change that turns a previously silent mismatch into a build error

## Transforms and Module Resolution

See [transforms-and-resolution.md](./references/transforms-and-resolution.md) for:

- mapping file patterns to transformers, and switching transformation off entirely
- the untransformed dependency behind the most common Jest failure message
- letting specific packages through an exclusion without letting everything through
- mapping path aliases, stylesheets, and static assets, and why mapping order matters
- the transform cache, and what to do when an edit appears to have no effect

## Test Environment

See [test-environment.md](./references/test-environment.md) for:

- choosing between the two built-in environments, and the one that is a separate install
- letting a single file differ from the project default
- passing options into an environment
- the browser APIs the emulated environment does not implement
- the four setup slots, what belongs in each, and the symptom of the wrong choice

## Isolation

See [isolation.md](./references/isolation.md) for:

- resetting mock state between tests once, in configuration, rather than per file
- reloading a module whose top-level state a test has already changed
- the module-scope side effect in a spec and how far it reaches
- what each test file gets its own copy of, and what it shares with every other worker
- partitioning an external resource per worker
- diagnosing a test that passes alone and fails in the suite

## Coverage

See [coverage.md](./references/coverage.md) for:

- collecting coverage, and choosing which files count as uncovered
- the two instrumentation providers, and why they disagree
- setting thresholds, including the form that caps uncovered units instead
- excluding a branch, and recording where it is verified instead
- the Babel plugin that silently disables the exclusion list

## Running and Performance

See [running-and-performance.md](./references/running-and-performance.md) for:

- selecting a subset of tests by name, path, or version-control state
- the two watch modes, and what the continuous-integration flag changes
- sizing the worker pool for the machine actually running the suite
- splitting a suite across machines
- finding the file that costs the run, and the transformation that usually explains it
- recognising a benchmark that has been checked in as a test
- the standalone packages Jest publishes, for when a suite needs one directly

## Diagnosing Failures

See [diagnosing-failures.md](./references/diagnosing-failures.md) for:

- surfacing order dependence deliberately, and reproducing a red run exactly
- treating a retry as a diagnostic rather than a fix
- finding what keeps a run from exiting, and the flag that hides it instead
- attaching a debugger to a single test
- narrowing to one case when the failure is not obvious
- clearing a cache that is answering with stale output

## Next.js

See [nextjs.md](./references/nextjs.md) for:

- what the framework's Jest helper configures on your behalf
- exporting the configuration in the shape the helper's asynchronous loading requires
- the component kind Jest cannot render, and where that confidence has to come from
- testing a server-fenced module's logic without importing the fence
- a working configuration for a Next.js app whose suite runs outside a browser

## React and React Native

See [react-and-native.md](./references/react-and-native.md) for:

- the presets a React Native or Expo project needs, and the exclusion pattern they depend on
- wiring the DOM environment and its custom matchers
- the renderer that is no longer the right default
- assertions that pin the framework's call pattern instead of the component's behavior
- the warning about state updates outside the framework's batching, and what it means
- the behavior a Jest test cannot establish at all

## Beyond Unit Scope

See [beyond-unit-scope.md](./references/beyond-unit-scope.md) for:

- what running an end-to-end test in Jest legitimately means, and what it does not
- giving a slower suite its own configuration rather than loosening the fast one
- starting and stopping a real dependency around a run
- waiting for readiness by polling rather than by sleeping
- the point where Jest stops being the right tool

## Review and Enforcement

See [review-and-enforcement.md](./references/review-and-enforcement.md) for:

- the lint rules that enforce most of this skill mechanically
- the opt-in rules worth turning on deliberately, and what each one prevents
- reviewing a Jest change for the defects a lint rule cannot see
- the verification evidence a Jest change owes a reviewer
- running the bundled validator, and what a passing run does and does not establish
