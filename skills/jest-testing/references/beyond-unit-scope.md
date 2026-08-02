# Beyond Unit Scope

Apply this reference when a Jest suite needs to exercise more than one module together, drive a real server over HTTP, or use a real database — and when deciding whether Jest is still the right runner for it.

Verified against `jest` 30.4.2 — [Jest — Configuring Jest](https://jestjs.io/docs/configuration).

## What Jest Can Legitimately Do Above a Unit

Jest is a general test runner, not a unit-test runner. It can drive a real HTTP server, a real database, or a real client library, and assert on what comes back. That is a genuine integration or protocol-level end-to-end test and Jest is a reasonable host for it.

What it cannot do is drive a browser or a device. jsdom is an emulation, not a browser: no layout, no real navigation, no real input. A test that needs those belongs to a runner that drives the real thing, and an end-to-end testing capability owns it.

The dividing line is the client. If the test's client is HTTP, a database driver, or a library the application also uses in production, Jest fits. If the client is a user, it does not.

**Guidelines:**

- MUST route any test requiring a real browser or device to a runner that drives one, rather than approximating it with jsdom.
- MUST NOT describe a jsdom-based test as end-to-end; the emulation is not the environment users have.
- SHOULD keep protocol-level suites in Jest when the project already runs it, rather than adding a second runner for HTTP tests alone.

## A Separate Project, Not a Loosened One

An integration suite needs a longer timeout, fewer workers, and run-level setup. Applying those to the whole configuration slows and weakens the fast suite that most changes depend on.

`projects` keeps them apart, per [configuration.md](./configuration.md):

```js
/** @type {import("jest").Config} */
module.exports = {
  projects: [
    { displayName: "unit", testMatch: ["<rootDir>/src/**/*.spec.ts"] },
    {
      displayName: "integration",
      testMatch: ["<rootDir>/integration/**/*.spec.ts"],
      testTimeout: 30_000,
      maxWorkers: 1,
      globalSetup: "<rootDir>/integration/global-setup.ts",
      globalTeardown: "<rootDir>/integration/global-teardown.ts",
    },
  ],
};
```

**Guidelines:**

- MUST give a slower suite its own project rather than raising the fast suite's `testTimeout` to accommodate it.
- MUST make the fast suite runnable alone, via `--selectProjects`, so ordinary development does not wait for the slow one.
- SHOULD constrain an integration project's `maxWorkers` when its tests share an external resource that cannot be partitioned.

## Starting and Stopping a Dependency

`globalSetup` starts what the suite needs; `globalTeardown` stops it. Both run once per run, **in their own context** — a value assigned in `globalSetup` is not visible to any spec, so what crosses the boundary is an environment variable, a file, or a known port.

A dependency left running holds the event loop open and produces the non-exit warning covered in [diagnosing-failures.md](./diagnosing-failures.md).

**Guidelines:**

- MUST stop in `globalTeardown` everything `globalSetup` started, including on the path where setup partly failed.
- MUST pass state from `globalSetup` to the specs through the environment or the file system, never through module scope.
- SHOULD partition an external resource per worker with `JEST_WORKER_ID`, per [isolation.md](./isolation.md), when the suite runs in parallel.

## Waiting for Readiness

Polling a readiness signal with a bounded deadline instead of sleeping a guessed duration is a rule an end-to-end-testing capability already owns, and it holds here for the same reason: a fixed sleep is too long on a fast machine and too short on a loaded one. What follows is only what that looks like inside a Jest `globalSetup`, which has no runner-provided server manager to fall back on.

```ts
async function waitUntilReady(url: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Not accepting connections yet.
    }
    if (Date.now() > deadline)
      throw new Error(`${url} not ready in ${timeoutMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
```

**Guidelines:**

- MUST fail with a message naming what was being waited for when the deadline passes, rather than letting the specs run against a dependency that never came up.
- SHOULD put the wait in `globalSetup` rather than a `beforeAll`, so the cost is paid once per run instead of once per file.

## Where Jest Stops

The pressure at this boundary is always toward keeping one runner. Adding a browser runner costs setup, a second vocabulary, and a slower pipeline, so the tempting move is another jsdom approximation instead. Each one is individually defensible and the accumulation is a suite that reports confidence it does not have.

**Guidelines:**

- MUST hand a test over to an end-to-end capability once it needs a real browser, a real device, or a real user interaction.
- MUST NOT accumulate browser approximations in a Jest suite to avoid adopting the runner that would do it properly.
- SHOULD state, when a behavior is covered only at unit level, what remains unverified and where it would be verified instead.
