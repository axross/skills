# The Test API

Apply this reference when writing or reviewing the structure of a spec file — how the test API is imported, how cases are grouped and focused, where setup hooks belong, and how a table-driven case is built.

Verified against `jest` 30.4.2 — [Jest — Globals](https://jestjs.io/docs/api).

This reference covers the **Jest mechanism**. What a `describe` block or a case should be _called_, and whether a case is testing behavior or implementation, belong to a unit-testing capability, which owns them runner-agnostically.

## Importing the Test API

That the API is imported explicitly rather than inherited from globals is a rule a unit-testing capability owns runner-agnostically. What follows is the Jest mechanism for it: which module, which option, and the Jest-specific way the rule fails silently.

Jest injects `describe`, `it`, `test`, `expect`, and `jest` as globals by default. Importing them explicitly from `@jest/globals` is nonetheless the better default: it gives real types without a separate type package, satisfies a linter's `no-undef` without a globals declaration, and keeps working if the project ever sets `injectGlobals: false`.

The failure mode is subtle and passes every check. A file that imports _some_ of the API and takes the rest off the global object works perfectly — the import satisfies the reader, the globals satisfy the runtime, and nothing reports the inconsistency. The convention is then quietly false: the file is not actually importing its test API, and `injectGlobals: false` would break it.

**Example:**

```ts
// Complete — every symbol the file uses comes from the import.
import { describe, expect, it } from "@jest/globals";

// Incomplete, and still passes: `it` and `expect` resolve to globals.
import { describe } from "@jest/globals";
```

**Guidelines:**

- MUST import every Jest symbol a file uses from `@jest/globals` when the project has adopted explicit imports, rather than importing some and inheriting the rest.
- MUST NOT install `@types/jest` alongside `@jest/globals`; they describe the same globals and the community package lags the runner.
- SHOULD set `injectGlobals: false` once a project's specs import consistently, so a regression fails immediately instead of silently.
- SHOULD grep a converted file for each symbol it calls against the ones it imports; a half-imported file passes every check a project runs, so nothing else will report it.

## One Case Function

Holding a project to one case function is also a unit-testing rule; Jest's contribution is that both spellings exist, and that a lint rule can enforce the choice.

`it` and `test` are the same function. A project picks one. Mixing them within a file is the visible symptom of nobody having picked, and it makes the suite harder to scan and to grep.

**Guidelines:**

- MUST use one case function consistently throughout a project, following whichever the existing specs already use.
- MUST NOT import both `it` and `test` into one file.
- SHOULD enable `eslint-plugin-jest`'s `consistent-test-it` rule, which enforces the choice and can fix it automatically.

## Grouping, Focusing, and Skipping

`describe` groups; `.only` and `.skip` narrow. The `f`/`x` prefixes (`fit`, `xit`, `fdescribe`, `xdescribe`) do the same thing less legibly and are worth avoiding.

Two behaviors surprise people. `describe.skip` still **executes its body** — only the cases inside are skipped, so setup written directly in the block still runs. And `.only` is file-scoped: it narrows within its file and does nothing about the other files in the run.

`test.todo(name)` records a planned case without a body. `test.failing` inverts the result — it passes when the body throws — which makes it a way to check in a known bug as a live, self-retiring marker rather than a commented-out test that rots.

**Guidelines:**

- MUST NOT commit a `.only`; it silently reduces a file to one case and reports success.
- MUST use `.skip` and `.only` rather than the `x` and `f` prefixes.
- MUST put setup that should not run for a skipped block inside a hook, since a `describe` body executes regardless.
- SHOULD prefer `test.todo` to a commented-out case, and `test.failing` to a skipped one, so the suite keeps reporting on it.
- SHOULD enable `no-focused-tests` and `no-disabled-tests` so neither reaches a merge unnoticed.

## Hooks and Execution Order

`beforeAll`, `beforeEach`, `afterEach`, and `afterAll` scope to their enclosing `describe`. The ordering rule that matters: Jest runs **every `describe` body first**, collecting the whole tree, and only then runs any case. Code written directly in a `describe` block therefore runs before every `beforeAll` in the file, including ones declared above it.

Teardown unwinds outward — an inner `afterEach` runs before an outer one.

**Guidelines:**

- MUST place setup in a hook rather than directly in a `describe` body, or it runs during collection, before any hook and regardless of skipping.
- MUST use `beforeEach` for state a case mutates, reserving `beforeAll` for genuinely immutable or expensive-and-shared setup.
- MUST return or await a promise from a hook that does asynchronous work, exactly as for a case.
- SHOULD keep hooks at the top of their block and in lifecycle order, which `prefer-hooks-on-top` and `prefer-hooks-in-order` enforce.
- SHOULD prefer inline setup inside a case over a hook assigning to an outer `let`, which forces a reader to trace a variable through several blocks to know its value.

## Defining Cases Synchronously

Jest collects cases by executing the file. A case registered later — inside a `setTimeout`, a `then`, or an `await` — is registered after collection has finished, and simply never runs. Nothing errors.

This is why a `.each` table cannot be built in `beforeEach`: the hook runs after collection, so the table is empty when the cases are registered.

**Guidelines:**

- MUST define every case synchronously at module scope; a case created inside a callback or after an `await` never registers.
- MUST build a `.each` table at module scope, not in a hook.
- SHOULD load fixture data a table depends on synchronously, or generate the table from a literal and resolve the data inside each case.

## Table-Driven Cases

`.each` takes either an array of rows or a tagged template with a header row, and exists on `test`, `it`, and `describe`, plus their `.only`, `.skip`, `.concurrent`, and `.failing` variants.

Titles interpolate: positional placeholders (`%s`, `%d`, `%i`, `%f`, `%j`, `%o`, `%p`, `%#`, `%$`) for the array form, and `$name` — including `$name.nested.path` and `$#` for the index — for the object form. A row that does not name itself produces a failure report that cannot be read without counting rows.

**Example:**

```ts
test.each([
  ["s", Suit.Spade],
  ["h", Suit.Heart],
])("parses %p into %p", (input, expected) => {
  expect(Suit.parse(input)).toBe(expected);
});
```

**Guidelines:**

- MUST interpolate the row's distinguishing values into the title, so a failing row is identifiable from the report alone.
- MUST keep the table a literal rather than a computed value, so a reader can see the cases without executing anything.
- SHOULD prefer the tagged-template form when rows are homogeneous and the header adds meaning, and the array form when rows are short or mixed.
- SHOULD split a table whose rows need materially different assertions, rather than branching inside the case body.
- SHOULD reserve `test.concurrent.each` for genuinely independent rows, and read [isolation.md](./isolation.md) before using it against anything shared.
