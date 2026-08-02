# Diagnosing Failures

Apply this reference when a test is flaky, when a run will not exit, when a failure message is not enough to locate the cause, or when an edit appears to have no effect.

Verified against `jest` 30.4.2 — [Jest — Troubleshooting](https://jestjs.io/docs/troubleshooting).

## Order Dependence

`--randomize` shuffles case order within each file; `--seed` fixes the shuffle; `--showSeed` prints the seed used. Together they turn order dependence from an intermittent mystery into a reproducible failure.

The value is in running this _before_ a problem appears. A suite that has never been randomised has order dependence nobody has met yet, and it surfaces later as an unrelated pull request "breaking" a test it never touched.

**Guidelines:**

- MUST record the seed from a failing randomised run, and reproduce with `--seed` before changing anything.
- MUST treat an order-dependent failure as shared state, following the sequence in [isolation.md](./isolation.md), rather than reordering the cases to hide it.
- SHOULD run a new or substantially changed suite once under `--randomize`, so order dependence is found by the author rather than by a stranger.

## Retries

`jest.retryTimes(n, options)` re-runs a failing case, with `logErrorsBeforeRetry`, `waitBeforeRetry`, and `retryImmediately`. It requires the default runner.

A retry converts a visible failure into an invisible one. The test still fails intermittently; the suite simply stops saying so, and the underlying defect — a shared resource, a real timer, a race — stays in the code and eventually reaches production.

**Guidelines:**

- MUST NOT add retries to a suite as a standing configuration; a passing retry is not a passing test.
- MUST enable `logErrorsBeforeRetry` when retries are used at all, so the failures remain visible in the log.
- SHOULD use a retry as a short-lived diagnostic — to learn how often something fails — and record what it is masking and when it will be removed.

## A Run That Will Not Exit

"Jest did not exit one second after the test run has completed" means something is still holding the event loop: an open socket, a timer, a database pool, a watcher.

`--detectOpenHandles` reports what, and implies `--runInBand`, so it is slow but precise. `openHandlesTimeout` (default 1000 ms) tunes the warning.

`--forceExit` makes the message go away without fixing anything, and takes with it any pending write — a coverage report, a result file. It is an admission, not a solution.

**Guidelines:**

- MUST run `--detectOpenHandles` to identify the holder before considering `--forceExit`.
- MUST close in a teardown hook whatever a test opened — connections, servers, watchers, intervals.
- MUST NOT leave `--forceExit` in a project's test script; it can truncate coverage and result output.
- SHOULD check `globalTeardown` first when the run-level setup started a server or a database.

## Attaching a Debugger

```bash
node --inspect-brk node_modules/.bin/jest --runInBand -t "the failing case"
```

Then attach from the browser's inspector or the editor. `--runInBand` is required: a worker process is not the one the debugger attached to.

**Guidelines:**

- MUST pass `--runInBand` when debugging, or breakpoints are set in a process the tests do not run in.
- SHOULD narrow with `-t` or `--runTestsByPath` before attaching, so execution stops in the case of interest.

## Narrowing a Failure

The ladder, cheapest first: `-t` to one case; `test.only` inside the file; `--runTestsByPath` to one file; `-e`/`--expand` to see a full diff instead of an elided patch; `--no-coverage` to remove instrumentation from the picture.

A `toEqual` failure elides unchanged parts of large values by default, and the omitted region is sometimes where the difference is.

**Guidelines:**

- MUST use `-e`/`--expand` when a diff's elision hides the differing region.
- MUST remove a `test.only` used for narrowing before committing; `no-focused-tests` catches it.
- SHOULD read the whole failure message, including the received value's type, before assuming which side is wrong.

## Stale Output

An edit that appears to have no effect is usually a cache. Jest caches transform output, and a custom transformer without `getCacheKey` returns yesterday's result indefinitely.

**Guidelines:**

- MUST run `--clearCache` when an edit to a transformer or a Babel configuration has no visible effect.
- MUST implement `getCacheKey` in a custom transformer, per [transforms-and-resolution.md](./transforms-and-resolution.md).
- SHOULD try `--no-watchman` when file changes are not detected, before suspecting the configuration.
