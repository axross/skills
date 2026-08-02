# Module Mocking

Apply this reference when replacing a whole module, writing a manual mock directory, mocking part of a module, or mocking a class — in a CommonJS or transpiled-to-CommonJS suite.

Verified against `jest` 30.4.2 — [Jest — Manual Mocks](https://jestjs.io/docs/manual-mocks). For an ES module suite, the mechanism is different: see [esm-mocking.md](./esm-mocking.md).

Module mocking is the heaviest tool in this skill. Read the opening of [mock-functions.md](./mock-functions.md) first — a dependency reachable as an argument does not need any of this.

## Hoisting

`jest.mock(path, factory?)` is hoisted by Jest's Babel plugin above the `import` statements in the file, regardless of where it appears. That is what makes it work at all: the mock has to be registered before the module under test is evaluated.

The consequence is that the factory runs before any module-scope variable in the file is initialised. Jest enforces this with an error — a factory referencing an out-of-scope variable is rejected — and exempts names beginning with `mock`, which is why the convention exists.

```ts
// `mockPlay` is exempt from the out-of-scope check by its name.
const mockPlay = jest.fn();

jest.mock("./player", () => ({
  Player: jest.fn(() => ({ play: mockPlay })),
}));
```

`jest.doMock` is the un-hoisted variant, for when a mock must be registered conditionally or after something else has run; it requires the module to be loaded afterwards with `require` or a dynamic `import`.

**Guidelines:**

- MUST prefix a variable a `jest.mock` factory references with `mock`, or the factory is rejected as referencing an out-of-scope variable.
- MUST use `jest.doMock` plus a deferred load when a mock cannot be registered at module scope, rather than fighting the hoisting.
- MUST match the module path's case exactly; Jest 30 made `jest.mock` paths case-sensitive.
- SHOULD keep a factory free of logic beyond returning the shape, since it runs before the file's own initialisation.

## Manual Mock Directories

A `__mocks__` directory holds a stand-in module. Three different rules govern when it applies, and conflating them is the usual cause of a mock that appears to be ignored:

| Mocking                        | `__mocks__` goes                    | `jest.mock()` needed?      |
| ------------------------------ | ----------------------------------- | -------------------------- |
| Your own module                | beside the module                   | **yes**                    |
| A package from `node_modules`  | beside `node_modules` (at the root) | no — applied automatically |
| A Node built-in (`fs`, `path`) | beside `node_modules` (at the root) | **yes**                    |

A scoped package maps to a nested path — `__mocks__/@scope/name.js`. The directory name is case-sensitive. And the root that "beside `node_modules`" refers to moves with `roots`, so changing that option relocates where every package mock has to live.

**Guidelines:**

- MUST call `jest.mock()` explicitly for a user module or a Node built-in; only a `node_modules` package mock applies on its own.
- MUST re-check manual mock locations after changing `roots`, which moves the directory that resolves them.
- MUST NOT import from `__mocks__` directly in a spec; let the module system substitute it, which `no-mocks-import` enforces.
- SHOULD build a package mock from `jest.createMockFromModule` and override only what the test needs, so the rest of the surface stays shaped like the real module.

## Mocking Part of a Module

Replacing a whole module when a test needs one export removes real behavior the test depends on. `jest.requireActual` brings the rest back.

```ts
jest.mock("./config", () => ({
  ...jest.requireActual("./config"),
  loadRemoteConfig: jest.fn(async () => ({ flag: true })),
}));
```

For a module with a default export, the object needs `__esModule: true` so the interop treats `default` as the default export rather than a named one.

The mirror-image case is a module you mocked whose _real_ implementation the test itself needs — the classic being mocking a fetch library while still needing its real `Response` class to build a fixture. `jest.requireActual` reaches past your own mock.

**Guidelines:**

- MUST spread `jest.requireActual` into a partial mock rather than re-declaring the exports the test does not care about.
- MUST set `__esModule: true` on a factory that supplies a `default` export.
- MUST use `jest.requireActual` to obtain a real export the test needs from a module it has mocked, rather than importing it and receiving the mock.
- SHOULD prefer mocking the narrowest module at the boundary over mocking a broad module several layers in.

## Mocking a Class

Four mechanisms exist, in increasing order of control: an automatic mock (`jest.mock(path)` with no factory), a manual mock in `__mocks__`, a factory returning a constructor, and `mockImplementation` applied to an automatically mocked constructor.

The blind spot worth knowing: an automatic mock replaces **prototype methods**. A method defined as a class property holding an arrow function is an instance property, not a prototype method, and is not replaced.

`jest.spyOn(Class.prototype, "method")` is often enough and is much lighter than mocking the module.

**Guidelines:**

- MUST NOT rely on an automatic mock to replace a method defined as an arrow-function class property; it replaces prototype methods only.
- MUST return a constructor — not an arrow function — from a factory standing in for a class, since an arrow function cannot be called with `new`.
- SHOULD prefer `jest.spyOn(Class.prototype, method)` to mocking the whole module when a test needs one method's behavior changed.

## Automocking

`automock: true` replaces every imported module with an automatic mock. It is rarely the right default: it is slow, it makes each spec's real dependencies invisible, and it turns adding an import into a silent behavior change.

**Guidelines:**

- MUST NOT enable `automock` in a new project; mock explicitly at the boundaries instead.
- SHOULD treat an existing `automock: true` as a migration target, using `unmockedModulePathPatterns` to shrink its reach incrementally.
