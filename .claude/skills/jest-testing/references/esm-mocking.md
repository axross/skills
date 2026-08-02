# ESM Mocking

Apply this reference when a suite runs as native ES modules — a package with `"type": "module"`, `.mjs` files, or `extensionsToTreatAsEsm` — and a test needs to replace a module.

Verified against `jest` 30.4.2 — [Jest — ECMAScript Modules](https://jestjs.io/docs/ecmascript-modules). Jest's own documentation labels this support **experimental**, and the Node APIs underneath it are experimental too; rules here are written accordingly.

## Why the Ordinary Call Does Nothing

`jest.mock()` works in CommonJS because Jest's Babel plugin hoists it above the `require` calls. Under native ESM there is nothing to hoist above: static `import` declarations are resolved and evaluated **before** any statement in the module body runs. By the time `jest.mock()` executes, the real module is already loaded and bound.

Nothing errors. The call succeeds, the mock is registered, and the module under test keeps using the real dependency. This is the single most confusing failure in an ESM Jest suite, because the test reads exactly like a working CommonJS one.

**Guidelines:**

- MUST NOT use `jest.mock()` to replace an ES module; it registers a mock nothing consults and reports no error.
- MUST treat a mock that "does not take effect" in an ESM suite as this problem before investigating the module under test.
- SHOULD confirm whether a suite is running as ESM before choosing a mocking mechanism, since the file extension alone does not settle it.

## The Replacement

`jest.unstable_mockModule(path, factory)` is the ESM equivalent. Three differences from `jest.mock`:

- The **factory is required**. There is no automatic-mock form.
- It is **not hoisted**, so it must appear before the import it affects.
- The module under test must therefore be loaded with a **dynamic `import()`** after the call.

```ts
import { jest } from "@jest/globals";

jest.unstable_mockModule("./clock.js", () => ({
  now: jest.fn(() => 1_700_000_000_000),
}));

// Both imports must come after the call, and must be dynamic.
const { now } = await import("./clock.js");
const { stamp } = await import("./stamp.js");
```

Every static import in the file is still hoisted above all of this — so the module under test cannot be imported statically anywhere in the file, including in a type-only import that a transpiler does not erase.

`jest.unstable_unmockModule` removes the registration, with the caveat that re-mocking the same module afterwards does not reliably take effect.

**Guidelines:**

- MUST place `jest.unstable_mockModule` before the dynamic `import()` of the module under test and of anything importing it transitively.
- MUST load the module under test with `await import()`, never a static `import`, in a file that mocks any of its dependencies.
- MUST supply a factory covering every export the module under test uses, since there is no automatic-mock fallback.
- SHOULD import `jest` from `@jest/globals` in an ESM spec rather than relying on a global.
- SHOULD prefer dependency injection over `unstable_mockModule` in an ESM codebase; the API is experimental and its ergonomics are worse than the CommonJS equivalent.

## Running an ESM Suite

Three things have to be true before any of the above runs:

- Node is started with `--experimental-vm-modules`, typically via `NODE_OPTIONS`.
- Node treats the files as ESM — `"type": "module"`, an `.mjs` extension, or `extensionsToTreatAsEsm` for extensions Node does not recognise on its own.
- Transformation either emits ESM or is switched off with `transform: {}`; a transformer emitting CommonJS defeats the whole arrangement.

```json
{
  "scripts": {
    "test": "NODE_OPTIONS=--experimental-vm-modules jest"
  }
}
```

**Guidelines:**

- MUST pass `--experimental-vm-modules` through `NODE_OPTIONS` in the project's own test script, so the suite cannot be run without it.
- MUST ensure the configured transformer emits ES modules, or disable transformation entirely, when running an ESM suite.
- MUST NOT list an extension in `extensionsToTreatAsEsm` that Node already infers from `"type": "module"`; Jest rejects the redundant entry.

## Reaching the Runner Object

With `injectGlobals` at its default an ESM spec can still use the globals, but the two explicit routes are better:

```ts
import { jest } from "@jest/globals";
// or, with no import at all:
import.meta.jest.useFakeTimers();
```

`import.meta.jest` is the same object as `jest`. `import.meta.url` is also available, which is what `createRequire` needs.

**Guidelines:**

- SHOULD import `jest` from `@jest/globals` for consistency with the rest of the spec's imports, reserving `import.meta.jest` for a file that imports nothing else from Jest.

## Mocking CommonJS from ESM

A CommonJS dependency imported into an ESM test is still mocked with `jest.mock()`, not `unstable_mockModule` — the hoisting problem does not apply to it. Reaching it requires building a `require`:

```ts
import { createRequire } from "node:module";
import { jest } from "@jest/globals";

const require = createRequire(import.meta.url);

jest.mock("some-cjs-package", () => ({ connect: jest.fn() }));

const { connect } = require("some-cjs-package");
```

**Guidelines:**

- MUST use `jest.mock()` for a CommonJS dependency even inside an ESM spec, and `unstable_mockModule` only for genuine ES modules.
- MUST build a `require` with `createRequire(import.meta.url)` to load the mocked CommonJS module.
- SHOULD state in a comment which of the two mechanisms a given mock is using and why, since a file may legitimately need both.

## How Much to Rely on This

The `unstable_` prefix is a statement of intent, not decoration: this API has changed shape across releases and Jest's documentation still labels the whole ESM path experimental. A project can reasonably depend on it — plenty do — but it should do so knowingly, and a design that avoids needing it is worth more here than elsewhere.

**Guidelines:**

- MUST check the installed Jest's ESM documentation before relying on any behavior here; the surface is explicitly experimental and has changed across minors.
- MUST NOT present an ESM mocking arrangement as settled practice in a project that could instead inject the dependency.
- SHOULD record, where a project commits to ESM mocking, what would have to change if the `unstable_` prefix's API moves.
