# Configuration

Apply this reference when creating, reading, or changing a project's Jest configuration — choosing where it lives, adopting a preset, splitting a repository into several suites, or resolving a value two tools both need.

Verified against `jest` 30.4.2 — [Jest — Configuring Jest](https://jestjs.io/docs/configuration).

## Where the Configuration Lives

Jest reads its configuration from a `jest` key in `package.json`, from a `jest.config` file in several extensions, or from an explicit `--config` path. One project should use exactly one of these; two sources that disagree produce a configuration nobody can read off the page.

The extension matters more than it looks. A package declaring `"type": "module"` makes every `.js` file an ES module, so a `jest.config.js` using `module.exports` throws. The `.cjs` extension is the usual escape hatch, and is why a modern ESM project's configuration is conventionally `jest.config.cjs` even when nothing else in the repository is CommonJS.

**Example:**

```js
// jest.config.cjs — an ESM package whose Jest configuration stays CommonJS.
/** @type {import("jest").Config} */
module.exports = {
  testEnvironment: "node",
  clearMocks: true,
};
```

**Guidelines:**

- MUST keep one configuration source per project; a `jest` key in `package.json` alongside a config file is a defect even when the two currently agree.
- MUST choose a config file extension that matches the package's module type, rather than discovering the mismatch as a parse error.
- SHOULD annotate a plain-object configuration with `/** @type {import("jest").Config} */` so an unknown or misspelled option is caught by the editor.
- SHOULD keep the configuration free of values derived at run time; a configuration that behaves differently per machine is one nobody can reproduce.

## Presets

A preset is a configuration object a package publishes for Jest to merge underneath yours. `ts-jest`, `jest-expo`, and `next/jest` each set several options at once — a transform, an environment, an exclusion pattern, a module mapping.

The hazard is not using one; it is overriding one without knowing what it already set. A project that sets its own `transform` on top of a preset frequently discards the preset's entire reason for existing.

**Guidelines:**

- MUST read what a preset sets before overriding any option it configures, rather than assuming an addition is additive.
- MUST NOT set `transform` alongside a preset that provides one unless the intent is to replace it entirely.
- SHOULD prefer a framework's own integration helper over a hand-written transform when the framework publishes one.
- SHOULD record why an option overrides a preset, since an unexplained override is impossible to retire safely.

## Projects

`projects` runs several configurations in one invocation. It is the mechanism for a monorepo's packages, and equally for one package that wants a fast suite and a slow one with different timeouts and environments.

Each entry carries its own `displayName`, which labels its output and makes `--selectProjects` and `--ignoreProjects` usable.

**Example:**

```js
/** @type {import("jest").Config} */
module.exports = {
  projects: [
    { displayName: "unit", testMatch: ["<rootDir>/src/**/*.spec.ts"] },
    {
      displayName: "integration",
      testMatch: ["<rootDir>/integration/**/*.spec.ts"],
      testTimeout: 30_000,
      globalSetup: "<rootDir>/integration/setup.ts",
    },
  ],
};
```

**Guidelines:**

- MUST give every project a `displayName`, or its output and any selection flag become ambiguous.
- MUST put a slower suite in its own project rather than raising the whole run's `testTimeout` to accommodate it.
- SHOULD reach for `projects` when two suites genuinely need different environments, timeouts, or setup, not merely different directories — `testMatch` alone handles the latter.
- SHOULD keep options shared by every project in one object the entries spread, so a change lands once.

## Roots and Path Resolution

`rootDir` anchors every relative path in the configuration and defaults to the directory holding the config file. `<rootDir>` interpolates it into a pattern. `roots` narrows where Jest crawls for both test files and manual mocks — which is the part that surprises people, because moving `roots` silently relocates where a `__mocks__` directory has to be.

**Guidelines:**

- MUST write configuration paths through `<rootDir>` rather than as bare relative paths, so the configuration survives being invoked from a subdirectory.
- MUST re-check manual mock locations after changing `roots`; the directory that resolves them moves with it.
- SHOULD leave `rootDir` at its default and place the config file where the default is correct.

## One Source of Truth

Several values must agree between Jest and another tool, and every duplicate is a future divergence. TypeScript path aliases are the common case: `tsconfig.json` declares them for the compiler, and Jest needs the same mapping in `moduleNameMapper` or every aliased import fails to resolve.

Deriving the second from the first costs a few lines and removes the class of bug entirely. Note that mapping order matters — a longer, more specific prefix has to be tried before a shorter one that would also match.

**Example:**

```js
// Derive Jest's module mapping from the compiler's, most specific prefix first.
const { compilerOptions } = require("./tsconfig.json");

const byPrefixLength = ([left], [right]) =>
  right.indexOf("*") - left.indexOf("*");

const moduleNameMapper = Object.fromEntries(
  Object.entries(compilerOptions.paths)
    .sort(byPrefixLength)
    .map(([pattern, [target]]) => [
      `^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace("*", "(.*)")}$`,
      `<rootDir>/${target.replace(/^\.\//, "").replace("*", "$1")}`,
    ]),
);
```

**Guidelines:**

- MUST derive Jest's path mapping from the compiler's configuration rather than maintaining a second hand-written copy.
- MUST order path mappings so a more specific prefix is matched before a shorter one that also matches.
- SHOULD apply the same rule to any other value two tools share — a coverage threshold, a test directory, an environment name.
- SHOULD verify a derived mapping by resolving one aliased import in a real spec, rather than trusting the derivation.
