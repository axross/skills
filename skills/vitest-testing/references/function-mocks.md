# Function Mocks and Spies

Apply this reference when creating a mock function, observing an existing method, or reasoning about what a reset actually clears.

Verified against Vitest 4.1.10; `mockThrow` and `vi.defineHelper` require 4.1.0+.

## Create a Boundary or Observe One

`vi.fn()` creates a new mock function — a boundary the test supplies. `vi.spyOn(object, "method")` wraps an existing method, recording calls while leaving behavior intact until an implementation is set.

The constraint that catches people: **a spy only sees calls made after it is installed.** Work done at import time, or during a module's top-level evaluation, happened before any `beforeEach` ran and is invisible to a spy set up there.

**Guidelines:**

- MUST install a spy before the code path under test runs; a spy cannot observe import-time work.
- SHOULD use `vi.spyOn` over replacing a method by assignment, so restoration is available.

## Setting Behavior

| Call                                            | Effect                                 |
| ----------------------------------------------- | -------------------------------------- |
| `mockReturnValue` / `mockReturnValueOnce`       | a fixed return                         |
| `mockResolvedValue` / `mockResolvedValueOnce`   | a resolved promise                     |
| `mockRejectedValue` / `mockRejectedValueOnce`   | a rejected promise                     |
| `mockImplementation` / `mockImplementationOnce` | a full body                            |
| `mockThrow` / `mockThrowOnce`                   | throws, without wrapping in a function |
| `withImplementation`                            | a temporary body for one callback      |
| `mockReturnThis`                                | returns the `this` context             |

**Guidelines:**

- SHOULD prefer the specific setter over `mockImplementation` where one exists; it states intent in the call name.
- MUST use the `Once` variants for a sequence rather than reassigning between calls, so the sequence is visible in one place.

## The Three Resets, Precisely

| Call          | Clears history | Resets implementation                     | Restores the original                        |
| ------------- | -------------- | ----------------------------------------- | -------------------------------------------- |
| `mockClear`   | yes            | no                                        | no                                           |
| `mockReset`   | yes            | yes — back to the original implementation | no                                           |
| `mockRestore` | yes            | yes                                       | yes — restores the spied object's descriptor |

Picking the wrong one is a silent leak: `mockClear` on a spy whose implementation was replaced leaves the replacement in place for every later test.

The `vi.clearAllMocks` / `resetAllMocks` / `restoreAllMocks` forms apply these across the file, **but reach only manually created spies** — automocked modules are untouched by all three. A suite relying on `restoreAllMocks` to undo an automock is relying on something that does not happen.

**Guidelines:**

- MUST use `mockRestore` (or `restoreMocks: true`) for a spy whose implementation was replaced; `mockClear` leaves it installed.
- MUST NOT rely on the `*AllMocks` calls to undo module-level automocking; they do not reach it.
- SHOULD configure `restoreMocks` rather than calling the reset in every file.

## Inspecting Calls

`mock.calls`, `mock.lastCall`, `mock.results`, `mock.settledResults`, `mock.instances`, `mock.contexts`, and `mock.invocationCallOrder`.

Two v4 changes matter: `invocationCallOrder` now starts at `1`, and `getMockName()` returns `"vi.fn()"` rather than `"spy"` — the latter rewrites every snapshot containing a mock.

Prefer a matcher over reading these directly. `toHaveBeenCalledWith` and `toHaveBeenCalledExactlyOnceWith` produce a readable diff; an equality assertion against `mock.calls[0]` produces an array comparison.

**Guidelines:**

- SHOULD assert with the mock matchers rather than reading `mock.calls` and comparing manually.
- MUST NOT assert on `invocationCallOrder` values as absolute numbers; use `toHaveBeenCalledBefore` / `toHaveBeenCalledAfter` for ordering.

## Utilities

`vi.mocked()` casts a value to its mocked type for TypeScript; `vi.isMockFunction()` tests one; `vi.mockObject()` deeply mocks an object's methods; `vi.defineHelper()` wraps a shared assertion helper so a failure points at the call site rather than inside the helper.

**Guidelines:**

- SHOULD wrap a shared assertion helper in `vi.defineHelper` so its failures locate the caller.
- MUST NOT use `vi.mocked()` to assert a value is a mock; it is a type-level cast and checks nothing at runtime.
