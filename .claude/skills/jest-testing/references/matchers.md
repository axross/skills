# Matchers

Apply this reference when choosing an assertion, when a matcher is passing or failing for a reason that is not obvious, or when a compound assertion is repeated enough to deserve its own matcher.

Verified against `jest` 30.4.2 — [Jest — Expect](https://jestjs.io/docs/expect).

This reference covers **which matcher expresses an assertion**. Whether the assertion pins behavior or implementation belongs to a unit-testing capability, which owns it runner-agnostically.

## The Equality Family

Four matchers compare values, and their names do not reveal how they differ. The differences decide real cases.

| Matcher         | Compares                 | `{a: undefined}` vs `{}` | Class identity | Extra properties |
| --------------- | ------------------------ | ------------------------ | -------------- | ---------------- |
| `toBe`          | `Object.is` — identity   | not equal                | n/a            | n/a              |
| `toEqual`       | recursive value equality | **equal**                | ignored        | not allowed      |
| `toStrictEqual` | recursive, strict        | not equal                | **checked**    | not allowed      |
| `toMatchObject` | recursive subset         | equal                    | ignored        | **allowed**      |

`toEqual` ignoring `undefined` properties is the one that bites: a function that should have omitted a key passes against an expectation that omits it. `toStrictEqual` catches that, and also catches a plain object masquerading as a class instance.

In Jest 30, all of these ignore **non-enumerable** properties — a change from 29 that can make a previously failing assertion pass.

**Guidelines:**

- MUST use `toBe` for primitives and for deliberate identity checks, and never for structural comparison of objects.
- MUST use `toStrictEqual` when the absence of a key, or the class of a value, is part of the contract under test.
- MUST use `toMatchObject` only when the unasserted properties are genuinely not the caller's concern, not as a way to avoid updating an expectation.
- SHOULD prefer `toEqual` over `toMatchObject` for a value the code under test fully constructs, so an unexpected extra property fails.

## Collections, Numbers, and Errors

- `toContain` uses `===`; `toContainEqual` compares structurally. Reaching for the first with an array of objects is a common silent failure.
- `toHaveLength` reports the actual length on failure, which `expect(xs.length).toBe(n)` does not.
- `toHaveProperty(path, value?)` takes a dotted key path and is the right tool for one field deep inside a large object.
- `toBeCloseTo(value, digits = 2)` is required for floating-point comparison and is equally the right matcher for a probabilistic result — a simulation's convergence, a sampled rate.
- `toThrow(argument?)` with no argument asserts almost nothing: any throw satisfies it, including one from a typo in the test's own setup.

**Guidelines:**

- MUST pass an argument to `toThrow` — a message substring, a pattern, or an error class — so the assertion distinguishes the intended failure from an accidental one.
- MUST use `toContainEqual` rather than `toContain` when matching an object inside an array.
- MUST wrap the call in a function for `toThrow`; passing the result of calling it throws before `expect` runs.
- SHOULD use `toBeCloseTo` with an explicit precision for any float or sampled value, rather than `toBe`.
- SHOULD choose the matcher whose failure message names the problem — `toHaveLength`, `toContain`, `toHaveProperty` — over a boolean expression that reports only `false`.

## Asserting on Mocks

The call family (`toHaveBeenCalled`, `toHaveBeenCalledTimes`, `toHaveBeenCalledWith`, `toHaveBeenLastCalledWith`, `toHaveBeenNthCalledWith`) reads a mock's recorded calls. The return family (`toHaveReturned`, `toHaveReturnedTimes`, `toHaveReturnedWith`, `toHaveLastReturnedWith`, `toHaveNthReturnedWith`) reads its results.

The trap is precision that pins the wrong thing. `toHaveBeenCalledTimes` on a callback the framework controls asserts the framework's call pattern, not the code's behavior — so a harmless framework upgrade turns the suite red. A chain of `toHaveBeenNthCalledWith` assertions covering every call is the same mistake at scale.

**Guidelines:**

- MUST NOT assert an exact call count for a callback whose invocation frequency is decided by a framework rather than by the code under test.
- MUST prefer `toHaveBeenCalledWith` over inspecting `mock.calls` by index, so the failure message shows the diff.
- SHOULD assert the call that carries the behavior — usually the last, or the one matching a predicate — rather than every call in sequence.
- SHOULD prefer an observable result to a call assertion where one exists, which the unit-testing capability named above owns and this family makes easy to ignore.

## Matching Part of a Value

Asymmetric matchers stand in for a value inside a larger expectation: `expect.any`, `expect.anything`, `expect.objectContaining`, `expect.arrayContaining`, `expect.stringContaining`, `expect.stringMatching`, `expect.closeTo`, and `expect.arrayOf`. Each has an `expect.not.*` counterpart.

They compose, which is what makes them worth reaching for: an expectation can pin the fields that matter and admit anything for a generated identifier or timestamp, in one readable literal rather than several separate assertions.

**Example:**

```ts
expect(created).toEqual({
  id: expect.any(String),
  createdAt: expect.any(Date),
  title: "Hello",
  tags: expect.arrayContaining(["draft"]),
});
```

**Guidelines:**

- MUST use an asymmetric matcher for a genuinely non-deterministic field rather than deleting the field before comparing, which also hides its absence.
- MUST keep `expect.any` narrow: it accepts any instance of the constructor, so `expect.any(Object)` asserts nearly nothing.
- SHOULD prefer one composed expectation over several partial assertions, so an unexpected shape change fails in one place.

## Custom Matchers

`expect.extend` registers a matcher returning `{pass, message}`. It earns its place when a compound assertion recurs and its failure message would otherwise be uninformative. `expect.addEqualityTesters` changes how a domain type compares everywhere, and `expect.addSnapshotSerializer` changes how one prints.

**Guidelines:**

- MUST register custom matchers in a `setupFilesAfterEnv` module rather than per spec, so every file gets the same set.
- MUST write a `message` that states the expected and actual values, since that string is the entire value of a custom matcher over an inline expression.
- SHOULD add a custom matcher only after the same compound assertion appears in several files; one occurrence is better inline.
- SHOULD prefer an equality tester over a custom matcher when the goal is that a domain type compares correctly under every existing matcher.

## Assertion Guards

`expect.assertions(n)` fails a case that did not run exactly `n` assertions; `expect.hasAssertions()` fails one that ran none. They matter where control flow can skip an assertion — a rejection path, a callback, a conditional branch.

**Guidelines:**

- MUST add an assertion guard to any case whose assertions live inside a `catch`, a callback, or a conditional.
- SHOULD NOT add a guard to a straight-line case, where it adds a number to maintain and prevents nothing.
