# Coverage

Apply this reference when enabling coverage, setting or changing a threshold, excluding code from measurement, or explaining a coverage number that looks wrong.

Verified against `jest` 30.4.2 — [Jest — Configuring Jest](https://jestjs.io/docs/configuration).

## Collecting

`--coverage` (or `collectCoverage`) turns it on. By default Jest reports only on files the tests actually loaded, which flatters the number: a module no test imports is not counted as uncovered, it is simply absent.

`collectCoverageFrom` fixes that by naming the files that _should_ be covered whether or not anything imported them, which is the only way the percentage means what a reader assumes.

```js
collectCoverageFrom: [
  "src/**/*.{ts,tsx}",
  "!src/**/*.d.ts",
  "!src/**/*.stories.tsx",
];
```

**Guidelines:**

- MUST set `collectCoverageFrom` whenever a coverage threshold is enforced; without it an untested file raises the percentage by disappearing.
- MUST exclude generated files, type declarations, and story or fixture files from collection rather than from the threshold.
- SHOULD keep coverage off by default and enable it explicitly, since instrumentation slows every run.

## Providers

`coverageProvider` is `babel` by default; `v8` uses the engine's own instrumentation. They disagree — v8 measures at a different granularity and attributes branches differently, so switching changes the number without any change to the tests. v8 is faster and needs no Babel instrumentation, which matters for a suite using a non-Babel transformer.

**Guidelines:**

- MUST re-baseline any threshold when changing provider; the numbers are not comparable.
- SHOULD prefer `v8` in a project whose transformer is not Babel, so coverage does not force a second instrumentation pass.

## Thresholds

`coverageThreshold` fails a run below the stated figures. It accepts a `global` entry and per-path entries, and a **negative** number means something different: it caps the number of uncovered units rather than setting a percentage floor.

```js
coverageThreshold: {
  global: { branches: 80, functions: 80, lines: 80, statements: -10 },
};
```

That a threshold is a deliberate project decision rather than a number to loosen when a run goes red is owned by a unit-testing capability, which owns it runner-agnostically. What Jest adds is the shape of the option.

**Guidelines:**

- MUST set a per-path threshold for a critical module rather than relying on a global figure that a large well-covered module can carry.
- MUST re-read the negative form as a count, not a percentage, before changing it; `-10` and `10` are different kinds of limit.

## Exclusions

`coveragePathIgnorePatterns` removes paths from measurement. An inline pragma removes a specific branch. Either way the exclusion is a claim that the code is verified elsewhere — or that it should not exist.

```ts
/* istanbul ignore next -- unreachable without a real device; covered by the e2e suite */
```

When an exclusion is justified, and that dead code should be deleted rather than excluded, are owned by the same unit-testing capability. The Jest-side rule is only which mechanism to reach for.

**Guidelines:**

- SHOULD use `coveragePathIgnorePatterns` for a whole path and the inline pragma for a single branch, rather than widening a pattern to cover one line.

## The Silent Exclusion Failure

If `babel-plugin-istanbul` is in the project's Babel configuration, it instruments everything Babel processes, before Jest's own exclusions apply. `coveragePathIgnorePatterns` then appears to do nothing, and the cause is in a file most people never connect to coverage.

**Guidelines:**

- MUST remove `babel-plugin-istanbul` from the Babel configuration when using Jest's coverage; Jest wraps Istanbul itself.
- SHOULD check the Babel configuration first when a coverage exclusion has no effect, before adjusting the pattern.
