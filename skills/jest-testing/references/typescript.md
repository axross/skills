# TypeScript

Apply this reference when setting up or changing how a TypeScript project's tests are compiled, when the suite is slow and the transformer is suspected, or when typing a mock.

Verified against `jest` 30.4.2, whose minimum supported TypeScript is 5.4 — [Jest — Getting Started](https://jestjs.io/docs/getting-started).

## The Three Transformer Routes

| Route                                     | Type-checks | Relative speed | Notes                                         |
| ----------------------------------------- | ----------- | -------------- | --------------------------------------------- |
| `ts-jest`                                 | **yes**     | slowest        | uses the real compiler; closest to production |
| `@swc/jest`                               | no          | fastest        | strips types                                  |
| `babel-jest` + `@babel/preset-typescript` | no          | fast           | strips types; ships with Jest                 |

Jest's own documentation is explicit that the Babel route is "purely transpilation" and "Jest will not type-check your tests as they are run".

Type-checking inside the transformer is the expensive part, and it is also redundant with a build that already runs the compiler. The common arrangement is therefore a fast transformer plus a separate `tsc --noEmit`, which type-checks the whole project once instead of file by file, and catches errors in files no test imports.

**Guidelines:**

- MUST pair a non-type-checking transformer with a separate `tsc --noEmit` check, and run both, rather than assuming the test run catches type errors.
- MUST NOT conclude a change is type-safe because the Jest suite passed under a stripping transformer.
- SHOULD prefer a fast transformer plus `tsc --noEmit` over `ts-jest`'s in-transformer checking when suite time matters.
- SHOULD keep the transformer choice consistent with the production build's, so a difference in emitted semantics cannot hide a bug.

## isolatedModules

`ts-jest`'s `isolatedModules` compiles each file independently, skipping cross-file type analysis. It is substantially faster and gives up the errors that only whole-program analysis finds — which is acceptable exactly when a separate `tsc --noEmit` is doing that analysis anyway.

**Guidelines:**

- MUST run a whole-program `tsc --noEmit` somewhere in the pipeline when `isolatedModules` is enabled.
- SHOULD use `import type` for type-only imports under isolated compilation, so an erased import cannot become a runtime dependency.

## Typing Mocks

| Need                                   | Use                  |
| -------------------------------------- | -------------------- |
| Type an already-mocked module or value | `jest.mocked(value)` |
| Type a mocked module's shape           | `jest.Mocked<T>`     |
| Type a `jest.spyOn` handle             | `jest.Spied<T>`      |
| Type a `jest.replaceProperty` handle   | `jest.Replaced<T>`   |

`jest.SpyInstance` was **removed** in Jest 30; `jest.Spied<T>` replaces it. A cast such as `fn as jest.Mock` discards the signature entirely, which is what `jest.mocked` exists to avoid.

**Guidelines:**

- MUST use `jest.mocked()` rather than an `as jest.Mock` cast, so the mock keeps its signature.
- MUST replace `jest.SpyInstance` with `jest.Spied<T>` when upgrading to Jest 30.
- MUST type a `jest.mock` factory's return, or the factory can return a shape the module never had; `no-untyped-mock-factory` enforces this.
- SHOULD import types from `@jest/globals` rather than installing `@types/jest` alongside it.

## Tightened Inference in Jest 30

Jest 30 made the `toHaveBeenCalledWith` family infer argument types from the mock's own signature. An assertion passing an argument of the wrong type is now a compile error where it previously type-checked and passed at run time.

This surfaces genuine drift — a test asserting against a signature the implementation no longer has — so the fix is to correct the assertion, not to widen the mock.

**Guidelines:**

- MUST correct the assertion or the mock's type when the tightened inference reports an error, rather than casting to `any` to restore the previous behavior.
- SHOULD expect a batch of these errors on upgrade in a codebase that used loosely typed mocks, and treat each as a real finding.
