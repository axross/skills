# Isolation

Apply this reference when a test passes alone and fails in the suite, when mock state appears to survive between cases, or when a suite touches a resource that every worker would share.

Verified against `jest` 30.4.2 — [Jest — The Jest Object](https://jestjs.io/docs/jest-object).

## Resetting Mocks in Configuration

Three options apply a reset to every mock before each test, mirroring the three levels in [mock-functions.md](./mock-functions.md):

| Option         | Applies       | Clears calls | Clears implementation | Restores original |
| -------------- | ------------- | ------------ | --------------------- | ----------------- |
| `clearMocks`   | `mockClear`   | yes          | no                    | no                |
| `resetMocks`   | `mockReset`   | yes          | yes                   | no                |
| `restoreMocks` | `mockRestore` | yes          | yes                   | yes (spies only)  |

Setting one in configuration is strictly better than expecting every spec to remember: a forgotten reset produces a failure in a _different_ file, and the file that caused it looks innocent.

`clearMocks` is the right default. `resetMocks` also discards implementations set at module scope, which surprises a spec that configures a mock once for the whole file. `restoreMocks` additionally undoes spies, and also restores properties replaced with `jest.replaceProperty`.

**Guidelines:**

- MUST set one of the three reset options in configuration rather than relying on per-spec resets.
- MUST NOT enable `resetMocks` in a project whose specs set implementations at module scope, or those implementations vanish before the first case.
- SHOULD default to `clearMocks`, and add `restoreMocks` in a project that uses `jest.spyOn` or `jest.replaceProperty` widely.

## Module State

Each test **file** gets a fresh module registry, so module-level state does not cross files. It does persist across cases _within_ a file: a module that memoises on first import keeps that value for every subsequent case.

`resetModules` clears the registry between tests; `jest.resetModules()` does it on demand; `jest.isolateModules(fn)` and `jest.isolateModulesAsync(fn)` give one block its own registry without disturbing the rest.

Re-importing after a reset is required — a binding captured before the reset still points at the old instance.

**Guidelines:**

- MUST re-import a module after resetting the registry; an existing binding still references the previous instance.
- MUST use `jest.isolateModules` for a case that needs a fresh copy of one module, rather than enabling `resetModules` for the whole project.
- SHOULD prefer exposing a reset function from the module over resetting the registry, when the module is one the project owns.

## Module-Scope Side Effects in a Spec

A statement at a spec's module scope runs once, at collection, and affects every case in the file. Silencing a logger this way is legitimate and cheap:

```ts
// Runs once, before any case, and applies to the whole file.
logger.level = "silent";
```

The cost is that it is invisible from inside a case, and it does not unwind. Anything with reach beyond the file — a global, a shared singleton, an environment variable other suites read — belongs in a hook that restores it.

**Guidelines:**

- MUST restore anything mutated at module scope whose reach extends beyond the file, using a hook rather than a bare statement.
- MUST NOT mutate shared global state at a spec's module scope; the effect is invisible to a reader of the failing case.
- SHOULD keep a module-scope side effect to configuration that is obviously file-local, such as quieting a logger.

## What Workers Share

Jest runs test files in parallel workers. Each has its own module registry and its own globals — but every worker shares the machine: the same file system, the same ports, the same database, the same external service.

Two files that both write to a fixed temporary path, or both bind a fixed port, fail intermittently in a way that looks like a code bug. `JEST_WORKER_ID` — a unique index starting at 1, and always `1` under `--runInBand` — is what partitions such a resource.

```ts
const schema = `test_${process.env.JEST_WORKER_ID}`;
```

**Guidelines:**

- MUST derive any fixed external resource — a port, a directory, a database name — from `JEST_WORKER_ID` when more than one test file uses it.
- MUST NOT rely on `--runInBand` to make a suite pass; it hides a shared-resource defect that returns the moment the suite is parallelised again.
- SHOULD prefer a per-test unique resource to a per-worker one where creation is cheap.

## Diagnosing a Suite-Only Failure

A test that passes alone and fails in the suite is reporting shared state. The sequence that localises it:

1. `--runInBand` — if it now passes, the interference is between files, not within one.
2. `--randomize` with `--showSeed` — if it fails in a different order, the dependency is on ordering rather than on one specific file.
3. `-t` or `test.only` — narrow to the pair of cases involved.
4. Check the reset options above, then module state, then external resources, in that order.

**Guidelines:**

- MUST treat a pass-alone-fail-in-suite result as shared state rather than as flakiness to retry away.
- MUST record the seed from a failing `--randomize` run, so the order can be reproduced exactly.
- SHOULD run a new suite once under `--randomize` before trusting it, since order dependence otherwise surfaces only when an unrelated file is added.
