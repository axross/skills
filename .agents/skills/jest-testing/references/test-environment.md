# Test Environment

Apply this reference when choosing the runtime a suite executes in, when a browser API is missing or needs stubbing, or when deciding which of Jest's four setup slots a piece of setup belongs in.

Verified against `jest` 30.4.2 — [Jest — Configuring Jest](https://jestjs.io/docs/configuration).

## Choosing an Environment

`testEnvironment` defaults to `node`. The alternative, `jsdom`, emulates browser APIs and has shipped as a **separate package** since Jest 28 — `jest-environment-jsdom` must be installed explicitly, and Jest 30 moved it to jsdom v26, which can change DOM behavior on upgrade.

jsdom is not free: it constructs a document, a window, and a large API surface for every test file that uses it. A suite testing pure logic pays that cost for nothing. The default of `node` is the right choice for parsers, validators, formatters, repositories, and route handlers — which is most of what a unit suite contains.

**Guidelines:**

- MUST keep `testEnvironment: "node"` for suites that do not touch the DOM, rather than setting jsdom project-wide because some files need it.
- MUST install `jest-environment-jsdom` explicitly when using it; it is not bundled.
- MUST re-run DOM-dependent suites after a Jest major upgrade, since the bundled jsdom version moves with it.
- SHOULD split DOM-dependent specs into their own project when both kinds exist in quantity, so neither pays the other's cost.

## Per-File Override

A docblock overrides the project default for one file. Jest reads it from the **first** docblock in the file, so it has to precede every import — placed lower it is silently ignored, and the file runs under the project default while appearing to ask for something else.

```ts
/**
 * @jest-environment jsdom
 */
```

**Guidelines:**

- MUST confirm the environment a file actually ran under, rather than assuming the docblock took, when a DOM-dependent spec fails on a missing global.
- SHOULD use the docblock for a small number of exceptions and a separate project for a large number.

## Environment Options

`testEnvironmentOptions` passes configuration into the environment — `url` (which sets `location` and matters for anything reading the origin), `userAgent`, and `customExportConditions`, which decides which `exports` entry of a dual-published package is resolved.

**Guidelines:**

- MUST set `testEnvironmentOptions.url` when code under test reads the document's location, rather than asserting against jsdom's default.
- SHOULD set `customExportConditions` deliberately when a dependency publishes several builds, since the default may resolve a build the project never ships.

## What jsdom Does Not Implement

jsdom implements the DOM, not a browser. Layout is absent, so anything measuring geometry returns zeros. `matchMedia`, `IntersectionObserver`, `ResizeObserver`, and `scrollTo` are commonly missing, and code calling one throws rather than degrading.

Stubbing has an ordering constraint: if the missing API is read at module scope, a stub installed inside the spec runs too late. It has to be installed in a `setupFilesAfterEnv` module, which runs before the spec's imports are evaluated.

**Guidelines:**

- MUST install a stub for a missing browser API in a `setupFilesAfterEnv` module when the API is read at module scope, not inside the spec.
- MUST NOT assert on layout, geometry, or visibility under jsdom; those values are not computed and the assertion is meaningless.
- SHOULD route a behavior that genuinely needs a browser to an end-to-end suite rather than stubbing enough of jsdom to fake it.

## The Four Setup Slots

They run at different times and are not interchangeable:

| Slot                 | Runs                                            | For                                              |
| -------------------- | ----------------------------------------------- | ------------------------------------------------ |
| `globalSetup`        | once per run, **in its own context**            | starting a server, seeding a database            |
| `setupFiles`         | per test file, before the test framework        | polyfills, environment variables                 |
| `setupFilesAfterEnv` | per test file, after the framework is installed | `expect.extend`, global hooks, matcher libraries |
| `globalTeardown`     | once per run, in its own context                | stopping what `globalSetup` started              |

The distinction that catches people: `globalSetup` runs in a **separate context** from the tests. A value assigned to a variable there is not visible to any spec. State crosses that boundary only through the environment, the file system, or a port — not through module scope.

The other: `expect` does not exist yet during `setupFiles`, so `expect.extend` and any matcher library belong in `setupFilesAfterEnv`.

**Guidelines:**

- MUST put `expect.extend`, custom matchers, and global lifecycle hooks in `setupFilesAfterEnv`; `expect` is not defined during `setupFiles`.
- MUST NOT expect a value assigned in `globalSetup` to be readable from a spec; pass it through the environment or the file system.
- MUST stop in `globalTeardown` whatever `globalSetup` started, or the run will not exit cleanly.
- SHOULD keep a per-file setup module small, since every test file pays its cost.
- SHOULD prefer per-project setup entries over one shared module carrying conditionals for each suite.
