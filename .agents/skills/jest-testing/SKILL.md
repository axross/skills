---
name: jest-testing
description: A change touching Jest itself — a Jest config, `testMatch`, `@jest/globals`, `jest.fn`, `jest.spyOn`, `jest.mock`, `unstable_mockModule`, `useFakeTimers`, `toMatchSnapshot`, `moduleNameMapper`, `transformIgnorePatterns`, `setupFilesAfterEnv`, `next/jest`, `jest-expo`, a `--runInBand` or `--detectOpenHandles` run, or `Cannot use import statement outside a module`. For what is worth testing and the unit-versus-e2e call, use a unit-testing capability; for browser or device suites, an end-to-end-testing one. Baseline Jest 30.4.2.
user-invocable: false
---

# Jest Testing

Use this capability whenever a change touches Jest — its configuration, its API, its command line, or the way a suite is transformed and isolated. It owns the **runner layer**: which Jest API, which option, which file, which flag, and what each one costs.

It does **not** own what to test. Whether a behavior deserves a test at all, how a `describe` block and a case are named, whether an assertion pins behavior or implementation, and whether something belongs in a unit test rather than an integration or end-to-end one all belong to a unit-testing capability, which is runner-agnostic and applies whether a project runs Jest, Vitest, or Node's built-in runner. This skill assumes those decisions are made and says how Jest carries them out. Where a rule here has a counterpart there, this skill states the Jest mechanism and names the other as owner.

It also does not own the **framework** an integration sits inside. That Next.js has a build config to wrap, or that an Expo app has a Metro config, is a framework fact owned by that framework's own capability; what the Jest side of that wiring looks like is owned here.

**Version discipline.** Jest's option surface moves between majors, and Jest 30 removed a decade of aliases in one release: `toBeCalledWith`, `toThrowError`, `jest.genMockFromModule`, `jest.SpyInstance`, and `jest --init` are all gone rather than deprecated. Options also behave differently than their names suggest — `waitForUnhandledRejections` defaults to `false`, not on. Every version-sensitive statement here names what it was verified against and links the upstream page it was checked against, and where a surface is known to move the rule is a **lookup** — consult [Jest — Configuring Jest](https://jestjs.io/docs/configuration) for the installed version — rather than a frozen option name. Treat an unversioned claim about a Jest option, in this skill or anywhere else, as suspect.

**Verified against** `jest` 30.4.2 — [Jest — Getting Started](https://jestjs.io/docs/getting-started) — published to npm on 2026-05-09 and still latest as of 2026-08-01, whose `engines.node` is `^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0`.

**Out of scope.** Vitest, Node's built-in test runner, and Bun's are named only where the honest answer to "should this project run Jest at all" is no. React Testing Library's own query and assertion conventions belong to a component-testing capability; only its Jest-side wiring is covered here.

**Guidelines:**

- MUST resolve a version-sensitive question against the installed Jest's own documentation rather than from memory, and state the version the answer came from.
- MUST ask Jest itself — `--listTests`, `--showConfig` — what a configuration actually selects, rather than reasoning about the pattern; its glob and regex matching does not read off the page.
- SHOULD type every mock against the interface it replaces; a bare `jest.fn()` accepts and returns anything, so it survives a signature change that should have broken the test.

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119.html).

## Boundary and Versions

See [boundary-and-versions.md](./references/boundary-and-versions.md) for:

- the mechanism-versus-judgment split deciding whether a question belongs here or to a unit-testing capability
- why a Vite project, a browser-driven test, and an async Server Component each need a different runner
- the Jest 30 removals — `toBeCalledWith`, `toThrowError`, `genMockFromModule`, `SpyInstance`, `--testPathPattern` — and `no-alias-methods` to auto-fix them
- the silent Jest 30 changes: case-sensitive `jest.mock` paths, `toEqual` ignoring non-enumerable properties, `.mts`/`.cts` in the defaults, `glob@10`
- checking the installed version against a rule's `Verified against` marker and its linked upstream page

## Configuration

See [configuration.md](./references/configuration.md) for:

- where the config may live, and why `"type": "module"` forces a `jest.config.cjs`
- adopting a preset without discarding the `transform` it already set
- `projects` and `displayName` for suites needing different environments or timeouts
- `rootDir`, `<rootDir>`, `roots`, and deriving `moduleNameMapper` from `tsconfig.json` paths
- `/** @type {import("jest").Config} */` so a misspelled option is caught in the editor

## Test Discovery

See [test-discovery.md](./references/test-discovery.md) for:

- `testMatch` versus `testRegex`, and why setting both is a configuration error
- colocated specs versus a `__tests__/` directory
- separating a Jest suite from a Playwright suite by extension, so neither collects the other's files
- `testPathIgnorePatterns` versus `modulePathIgnorePatterns` for a stale `dist/`
- `--listTests`, and why `--passWithNoTests` turns the worst misconfiguration into a pass

## The Test API

See [test-api.md](./references/test-api.md) for:

- `@jest/globals`, and the half-imported file that still passes because the rest resolve as globals
- `injectGlobals: false` to make that half-imported file fail loudly
- `it` versus `test`, and `consistent-test-it` to enforce one per project
- `describe`, `.only`, `.skip`, `test.todo`, `test.failing` — and why `describe.skip` still runs its body
- hook scoping, and why every `describe` body runs before any `beforeAll`
- why a case registered after an `await` never runs, so a `.each` table cannot be built in `beforeEach`
- `.each` in its array and tagged-template forms, and the `%p`/`$name` placeholders that title a row

## Matchers

See [matchers.md](./references/matchers.md) for:

- `toBe`, `toEqual`, `toStrictEqual`, `toMatchObject` — and which of them treat `{a: undefined}` as `{}`
- `toContain` versus `toContainEqual`, `toHaveLength`, `toHaveProperty`, `toBeCloseTo`, and why a bare `toThrow()` asserts almost nothing
- the `toHaveBeenCalled*` family, and why an exact call count on a framework-driven callback is brittle
- `expect.any`, `objectContaining`, `arrayContaining`, `stringMatching`, `closeTo` for a non-deterministic field
- `expect.extend` and `addEqualityTesters`, registered once in `setupFilesAfterEnv`
- `expect.assertions(n)` and `hasAssertions()` for a case whose assertions sit inside a `catch` or a callback

## Asynchronous Tests

See [asynchronous.md](./references/asynchronous.md) for:

- the four await forms, and why `done` needs a `try`/`catch` or a failed assertion surfaces as a timeout
- the missing `await` that makes a test pass asserting nothing, and `valid-expect` which catches it
- `.rejects` and `expect.assertions(n)`, so a resolution cannot satisfy a rejection test
- the 5000 ms default, and setting `testTimeout` at the narrowest scope that needs it
- `waitForUnhandledRejections`, which defaults to `false` despite what its name suggests

## Mock Functions and Spies

See [mock-functions.md](./references/mock-functions.md) for:

- `jest.fn()` and the `.mock` surface — `calls`, `lastCall`, `results`, `instances`, `contexts`
- `mockReturnValue`, `mockResolvedValue`, `mockRejectedValue`, their `Once` variants, and `withImplementation`
- `jest.spyOn` including its `"get"`/`"set"` form, and why an assigned `jest.fn()` cannot be restored
- `jest.replaceProperty` for a non-function property such as one on `process.env`
- `mockClear` versus `mockReset` versus `mockRestore`, and why `mockRestore` does nothing to a bare `jest.fn()`
- `jest.mocked()`, `jest.Mocked<T>`, and `jest.Spied<T>` replacing the removed `jest.SpyInstance`
- the type safety a bare `jest.fn()` gives up that an injected fake keeps

## Module Mocking

See [module-mocking.md](./references/module-mocking.md) for:

- `jest.mock` hoisting above the imports, and `jest.doMock` when that hoisting is wrong
- the `mock` name prefix a factory's out-of-scope check requires
- `__mocks__` beside the module versus beside `node_modules`, and which of the three cases needs an explicit `jest.mock()`
- `jest.requireActual` spread into a partial mock, and `__esModule: true` for a default export
- `jest.requireActual` again, to reach a real export out of a module you mocked
- class mocking, and why an automatic mock misses an arrow-function class property

## ESM Mocking

See [esm-mocking.md](./references/esm-mocking.md) for:

- why `jest.mock()` silently does nothing under ESM, since static imports evaluate first
- `jest.unstable_mockModule`, its required factory, and the `await import()` it forces
- `--experimental-vm-modules`, `extensionsToTreatAsEsm`, and a transformer that emits ESM
- `import.meta.jest` as an alternative to importing `jest` from `@jest/globals`
- `jest.mock()` plus `createRequire(import.meta.url)` for a CommonJS dependency
- how much to rely on an API Jest still ships behind an `unstable_` prefix

## Fake Timers

See [fake-timers.md](./references/fake-timers.md) for:

- `jest.useFakeTimers()`, `useRealTimers()`, and `fakeTimers.enableGlobally`
- `advanceTimersByTime` versus `runOnlyPendingTimers` versus `runAllTimers`, and the `timerLimit` a self-rescheduling timer hits
- the `*Async` advance variants, needed whenever a timer callback resolves a promise
- `doNotFake` to keep `performance` or `nextTick` real while faking the rest
- `setSystemTime` and `now`, which move `Date` without running any timer
- the `await new Promise((r) => setTimeout(r, 100))` anti-pattern all of this replaces

## Snapshots

See [snapshots.md](./references/snapshots.md) for:

- `toMatchSnapshot` versus `toMatchInlineSnapshot`
- `toThrowErrorMatchingInlineSnapshot` where an error message is part of the contract
- property matchers for a generated id or timestamp, and fixing the clock before snapshotting a date
- `-u` narrowed to specific tests, and `--ci` refusing to write a new snapshot
- `no-large-snapshots` and `no-interpolation-in-snapshots`
- `snapshotSerializers`, `snapshotResolver`, and `snapshotFormat`

## TypeScript

See [typescript.md](./references/typescript.md) for:

- `ts-jest` versus `@swc/jest` versus `babel-jest`, and that only the first type-checks
- pairing a stripping transformer with a separate `tsc --noEmit`
- `isolatedModules`, which trades cross-file analysis for speed and makes `import type` necessary
- `jest.mocked`, `jest.Mocked<T>`, `jest.Spied<T>`, `jest.Replaced<T>`
- Jest 30's stricter `toHaveBeenCalledWith` inference, which surfaces real argument drift as a build error

## Transforms and Module Resolution

See [transforms-and-resolution.md](./references/transforms-and-resolution.md) for:

- `transform`, its `babel-jest` default, and `transform: {}` to disable transformation entirely
- `transformIgnorePatterns` and the untransformed dependency behind `Cannot use import statement outside a module`
- the negative-lookahead pattern that transforms named packages without transforming all of `node_modules`
- `moduleNameMapper`, `moduleFileExtensions`, `moduleDirectories`, and why first-match-wins ordering matters
- `getCacheKey`, `--no-cache`, and `--clearCache` when an edit appears to have no effect

## Test Environment

See [test-environment.md](./references/test-environment.md) for:

- `node` versus `jsdom`, and that `jest-environment-jsdom` has been a separate install since Jest 28
- the `@jest-environment` docblock, which has to precede every import in the file
- `testEnvironmentOptions` — `url`, `userAgent`, `customExportConditions`
- `matchMedia`, `IntersectionObserver`, `ResizeObserver`, and the layout engine jsdom does not have
- `globalSetup`, `setupFiles`, `setupFilesAfterEnv`, `globalTeardown` — and why `expect.extend` works only in the third

## Isolation

See [isolation.md](./references/isolation.md) for:

- `clearMocks`, `resetMocks`, `restoreMocks` in config, and why `clearMocks` is the right default
- `resetModules`, `jest.resetModules()`, and `jest.isolateModules` for module-level state
- why quieting a logger at a spec's module scope is fine while mutating a shared global is not
- the per-file module registry, against the ports, directories, and databases every worker shares
- `JEST_WORKER_ID` to partition a port or a database schema per worker
- the `--runInBand` → `--randomize` → `-t` sequence for a test that passes alone and fails in the suite

## Coverage

See [coverage.md](./references/coverage.md) for:

- `collectCoverageFrom`, without which an untested file raises the percentage by disappearing
- the `babel` versus `v8` providers, whose numbers are not comparable
- `coverageThreshold`, including the negative form that caps uncovered units instead of setting a floor
- `coveragePathIgnorePatterns` and the `istanbul ignore` pragma
- `babel-plugin-istanbul` in a Babel config silently disabling those exclusions

## Running and Performance

See [running-and-performance.md](./references/running-and-performance.md) for:

- `-t`, `--testPathPatterns`, `--onlyChanged`, `--changedSince`, `--findRelatedTests`
- `--watch` versus `--watchAll`, and `--ci` refusing to write a new snapshot
- `maxWorkers`, whose default over-subscribes a two-core CI container
- `--shard=<index>/<count>` for splitting a suite across machines
- `slowTestThreshold`, `--logHeapUsage`, and comparing against `--no-cache` before blaming the tests
- the checked-in benchmark — a 100 000-iteration loop asserted with `toBeCloseTo`
- `jest-diff`, `pretty-format`, `jest-worker`, and the rest Jest publishes standalone

## Diagnosing Failures

See [diagnosing-failures.md](./references/diagnosing-failures.md) for:

- `--randomize`, `--seed`, and `--showSeed` for order dependence
- `jest.retryTimes` as a diagnostic rather than a fix, and `logErrorsBeforeRetry` so failures stay visible
- `--detectOpenHandles` for a run that will not exit, and why `--forceExit` can truncate coverage output
- `node --inspect-brk node_modules/.bin/jest --runInBand -t` to attach a debugger
- `-t`, `--runTestsByPath`, and `-e`/`--expand` when a diff elides the differing region
- `--clearCache` and `--no-watchman` when an edit appears to have no effect

## Next.js

See [nextjs.md](./references/nextjs.md) for:

- what `next/jest` configures — the compiler transform, asset and font mocks, `.env` loading
- exporting `createJestConfig(config)`'s return value rather than the config object it was given
- why Jest cannot render an async Server Component, so that confidence needs an e2e test
- keeping decision logic out of a `server-only` module rather than mocking the fence
- a working `jest.config.cjs` for a Next.js app on `testEnvironment: "node"`

## React and React Native

See [react-and-native.md](./references/react-and-native.md) for:

- `jest-expo` and the `react-native` preset, and extending rather than replacing their `transformIgnorePatterns`
- `jest-environment-jsdom` plus `@testing-library/jest-dom` registered in `setupFilesAfterEnv`
- why `react-test-renderer` is deprecated in favour of a testing-library renderer
- why `toHaveBeenCalledTimes(9)` on a render prop pins React's scheduling rather than the component's behavior
- what an `act(...)` warning is actually reporting, and awaiting the settled state instead of silencing it
- layout, gestures, animation, and platform navigation, which neither jsdom nor the native environment can verify

## Beyond Unit Scope

See [beyond-unit-scope.md](./references/beyond-unit-scope.md) for:

- where Jest legitimately drives real HTTP or a real database, and where the client has to be a browser
- a separate `projects` entry with its own `testTimeout` and `maxWorkers`, rather than loosening the fast suite
- `globalSetup`/`globalTeardown`, which run in their own context and cannot pass state through module scope
- polling a health endpoint with a bounded deadline instead of sleeping a fixed interval
- the point where accumulating jsdom approximations should become a real browser runner

## Review and Enforcement

See [review-and-enforcement.md](./references/review-and-enforcement.md) for:

- the `eslint-plugin-jest` recommended set — `valid-expect`, `no-focused-tests`, `no-alias-methods`, `expect-expect`
- the opt-in rules — `prefer-importing-jest-globals`, `prefer-jest-mocked`, `no-large-snapshots`, `valid-mock-module-path`
- the review questions lint cannot answer: does the mock hide the behavior, would the test fail for its regression
- the Jest-specific evidence a change owes — a `--listTests` count when discovery changed, a `--randomize` run
- the three silent defects no lint rule catches, and why asking Jest beats reimplementing its matching
