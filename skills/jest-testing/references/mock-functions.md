# Mock Functions and Spies

Apply this reference when creating a test double, recording what a dependency received, replacing a method or a property for the duration of a test, or resetting one between tests.

Verified against `jest` 30.4.2 — [Jest — Mock Functions API](https://jestjs.io/docs/mock-function-api).

This reference covers the **Jest mechanism**. Whether a boundary deserves a double at all, and whether a double is hiding the behavior under test, belong to a unit-testing capability.

## What a Mock Costs That a Fake Does Not

Whether a boundary deserves a double, and whether a manual fake serves better than a mock, belong to the unit-testing capability named above. The Jest-specific part is what you give up by choosing this API: **type safety**.

An injected fake is checked against the parameter it satisfies, so a change to the real interface breaks compilation. A bare `jest.fn()` is not — it is typed as accepting anything and returning `undefined`, so nothing stops it returning a shape the real dependency never had, and the test keeps passing after the signature changes underneath it. That gap is closable, but only deliberately, with the helpers under **Typing a Mock** below.

**Guidelines:**

- MUST type a mock against the interface it replaces — via `jest.mocked`, a typed factory, or a `satisfies` literal — so a signature change fails the build rather than surviving in a green test.
- MUST NOT leave a bare `jest.fn()` standing in for a typed dependency; it silently accepts and returns anything.

## Creating and Reading a Mock

`jest.fn(implementation?)` creates one. Its `.mock` property records what happened:

| Property    | Holds                                                                     |
| ----------- | ------------------------------------------------------------------------- |
| `calls`     | an array of argument arrays, one per call                                 |
| `lastCall`  | the most recent argument array, or `undefined`                            |
| `results`   | `{type, value}` per call, `type` being `return`, `throw`, or `incomplete` |
| `instances` | objects created when the mock was called with `new`                       |
| `contexts`  | the `this` of each call                                                   |

Prefer the matchers in [matchers.md](./matchers.md) over reading `.mock` directly — they produce a diff on failure where an index lookup produces only a value.

**Guidelines:**

- MUST name a mock with `mockName` when a file has several, so a failure report identifies which one.
- SHOULD read `.mock` directly only for an assertion no matcher expresses, such as inspecting `results[n].type`.

## Setting Behavior

| Call                                                | Effect                                   |
| --------------------------------------------------- | ---------------------------------------- |
| `mockImplementation(fn)`                            | all future calls                         |
| `mockImplementationOnce(fn)`                        | the next call only; chainable            |
| `mockReturnValue(v)` / `mockReturnValueOnce(v)`     | return `v`                               |
| `mockResolvedValue(v)` / `mockResolvedValueOnce(v)` | resolve with `v`                         |
| `mockRejectedValue(e)` / `mockRejectedValueOnce(e)` | reject with `e`                          |
| `mockReturnThis()`                                  | return the call's `this`                 |
| `withImplementation(fn, callback)`                  | a different implementation for one block |

Once the `Once` queue is exhausted, calls fall back to the base implementation — or to `undefined` if none was set, which is a common source of a confusing second-call failure.

**Guidelines:**

- MUST use the promise shorthands rather than `mockImplementation(() => Promise.resolve(v))`; `prefer-mock-promise-shorthand` enforces this.
- MUST set a base implementation alongside any `Once` queue that a case may exhaust, or later calls silently return `undefined`.
- SHOULD prefer `withImplementation` to a manual set-and-restore around a block.

## Spying and Replacing

`jest.spyOn(object, method)` wraps an existing method, **keeps calling the original**, and records the calls. `jest.spyOn(object, prop, "get" | "set")` does the same for an accessor. Assigning `object.method = jest.fn()` looks equivalent and is not: it discards the original, and it cannot be restored by `mockRestore` or by `restoreMocks`.

`jest.replaceProperty(object, key, value)` handles a property that is not a function, returning a handle with `replaceValue` and `restore` — the right tool for `process.env`.

**Guidelines:**

- MUST use `jest.spyOn` rather than assigning a `jest.fn()` to an existing method, so the original can be restored.
- MUST use `jest.replaceProperty` rather than assigning to a non-function property, for the same reason.
- MUST call `mockImplementation` on a spy when the original should not run; `spyOn` alone still calls through.
- SHOULD enable `prefer-spy-on`, which flags the assignment form.

## The Three Reset Levels

The names do not order themselves, and choosing wrongly produces a test that passes in isolation and fails in the suite.

| Call            | Clears calls | Clears implementation | Restores original |
| --------------- | ------------ | --------------------- | ----------------- |
| `mockClear()`   | yes          | no                    | no                |
| `mockReset()`   | yes          | yes                   | no                |
| `mockRestore()` | yes          | yes                   | **yes**           |

`mockRestore` only does anything for a mock created by `jest.spyOn` or `jest.replaceProperty`; on a bare `jest.fn()` it behaves as `mockReset`. The configuration options `clearMocks`, `resetMocks`, and `restoreMocks` apply the corresponding call to every mock before each test, which is almost always better than remembering per file — see [isolation.md](./isolation.md).

**Guidelines:**

- MUST set the appropriate reset option in configuration rather than relying on every spec to reset its own mocks.
- MUST use `mockRestore`, not `mockReset`, when the original implementation has to come back.
- MUST NOT expect `mockRestore` to restore anything on a mock that was assigned rather than spied.
- SHOULD prefer `clearMocks` as the project default, and reach for `resetMocks` only when implementations genuinely leak between cases.

## Typing a Mock

`jest.mocked(source)` types an already-mocked value; `jest.Mocked<T>`, `jest.Spied<T>`, and `jest.Replaced<T>` type the corresponding handles. `jest.SpyInstance` was removed in Jest 30 in favour of `jest.Spied<T>`.

Jest 30 also tightened `toHaveBeenCalledWith` inference, so an argument of the wrong type is now a compile error rather than a passing assertion.

**Guidelines:**

- MUST use `jest.mocked()` rather than an `as jest.Mock` cast, which discards the signature; `prefer-jest-mocked` enforces this.
- MUST replace `jest.SpyInstance` with `jest.Spied<T>` when upgrading to Jest 30.
- SHOULD let the tightened `toHaveBeenCalledWith` inference surface argument drift, rather than widening a mock's type to silence it.
