# Running and Performance

Apply this reference when invoking Jest directly, when configuring the command a pipeline runs, or when a suite is slower than it should be.

Verified against `jest` 30.4.2 — [Jest — CLI Options](https://jestjs.io/docs/cli).

## Selecting What Runs

| Flag                              | Selects                                                           |
| --------------------------------- | ----------------------------------------------------------------- |
| `jest <pattern>`                  | test files whose path matches the positional pattern              |
| `-t`, `--testNamePattern <regex>` | cases whose full name matches                                     |
| `--testPathPatterns <regex>...`   | paths matching any pattern (renamed and made variadic in Jest 30) |
| `--runTestsByPath <path>...`      | exact paths, with no pattern interpretation                       |
| `-o`, `--onlyChanged`             | files related to uncommitted changes                              |
| `--changedSince <ref>`            | files related to changes since a branch or commit                 |
| `--findRelatedTests <file>...`    | tests covering the named source files                             |

`--findRelatedTests` is the one worth knowing for a pre-commit hook: it maps changed source files to the tests that import them.

**Guidelines:**

- MUST invoke the project's own test script rather than raw `jest`, reaching for flags only to chase a specific failure.
- MUST use `--testPathPatterns` on Jest 30; `--testPathPattern` was removed.
- SHOULD quote a `-t` pattern, since an unquoted one is expanded by the shell.

## Watch and Continuous Integration

`--watch` re-runs tests related to changed files and needs a version-control repository; `--watchAll` re-runs everything and does not. Watch mode also offers interactive snapshot review, which is the pleasant way to update snapshots one at a time.

`--ci` changes one thing that matters a great deal: a **new** snapshot fails instead of being written. Without it, a pull request adding a snapshot test writes the snapshot during the pipeline and reports green regardless of whether the recorded value is right.

**Guidelines:**

- MUST pass `--ci` in every pipeline invocation, so an unreviewed snapshot cannot pass.
- MUST NOT use `--watch` in a pipeline; it never exits.
- SHOULD use `--watchAll` when a repository has no version-control metadata, such as in a container that copied only the source.

## Worker Sizing

`maxWorkers` defaults to one fewer than the machine's cores. On a two-core continuous-integration container that means one worker plus the coordinator, and the default frequently over-subscribes a small runner, making the suite slower than running it serially.

`--runInBand` (`-i`) runs everything in the current process: the right choice for a small container, and required by `--detectOpenHandles`.

`--shard=<index>/<count>` splits a suite across machines, which is the answer when a single machine's parallelism is exhausted.

**Guidelines:**

- MUST set `maxWorkers` explicitly in continuous integration to match the runner's actual cores, rather than accepting a default sized for a developer machine.
- MUST NOT use `--runInBand` to make a failing suite pass; that hides a shared-state defect, per [isolation.md](./isolation.md).
- SHOULD measure before and after changing worker count; the effect is machine-specific and often the opposite of what is expected.
- SHOULD shard across machines only after single-machine parallelism is genuinely saturated.

## Finding the Cost

`slowTestThreshold` (default 5 seconds) marks slow files in the report. `--logHeapUsage` with `--runInBand` shows memory growth across files. `workerIdleMemoryLimit` recycles a worker that exceeds a limit, which is a workaround for a leak rather than a fix.

Transformation is usually the dominant cost in a TypeScript suite, and the cache hides it — a second run is fast while a clean continuous-integration run is not. Compare against a `--no-cache` run before concluding the tests themselves are slow.

**Guidelines:**

- MUST compare a cached run against `--no-cache` before attributing slowness to the tests rather than to transformation.
- MUST NOT leave `--no-cache` in a project's test script; it is a diagnostic.
- SHOULD reach for the transformer choice in [typescript.md](./typescript.md) when transformation dominates, before optimising individual tests.
- SHOULD treat `workerIdleMemoryLimit` as a temporary mitigation and record the leak it is masking.

## Benchmarks Checked In as Tests

A case running a large simulation or a long loop is a benchmark. It is slow on every run, its assertion is usually statistical, and it fails intermittently when the machine is loaded — while telling nobody anything they did not already know.

```ts
// A benchmark, not a unit test: 100 000 iterations, asserted to two digits.
for (const matchup of evaluator.take(100_000)) {
  /* ... */
}
expect(wins / evaluated).toBeCloseTo(9 / 44, 2);
```

That unit tests stay fast is a unit-testing rule; what Jest adds is that `slowTestThreshold` and `projects` make the offender visible and give it somewhere else to live.

**Guidelines:**

- MUST reduce the iteration count to what the assertion's precision actually requires, rather than leaving a figure chosen for confidence.
- SHOULD move a genuine benchmark into its own project or script, excluded from the default run, and state where it runs instead.
- SHOULD assert a statistical result with `toBeCloseTo` and an explicit precision, and record why that precision is sufficient.

## The Standalone Packages

Jest publishes several of its internals for direct use: `jest-diff` for a readable value comparison, `pretty-format` for serialisation, `jest-worker` for parallelising a task, `jest-validate` for checking a user-supplied configuration, `jest-changed-files`, `jest-docblock`, and `jest-get-type`. `expect` is also usable outside a Jest run.

**Guidelines:**

- SHOULD use `jest-diff` or `pretty-format` when a custom matcher or a tool needs a readable value comparison, rather than hand-rolling one.
- SHOULD NOT add one of these as a production dependency merely to reuse a formatting helper; each carries Jest's release cadence.
