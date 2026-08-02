# Snapshots

Apply this reference when adding or updating a snapshot, capturing an error message, deciding whether a snapshot is the right assertion at all, or reviewing a snapshot diff.

Verified against `jest` 30.4.2 — [Jest — Snapshot Testing](https://jestjs.io/docs/snapshot-testing).

This reference covers the **Jest mechanism**. Whether a behavior deserves a snapshot rather than an explicit assertion belongs to a unit-testing capability, which owns it runner-agnostically.

## Stored or Inline

`toMatchSnapshot()` writes to a `.snap` file under `__snapshots__/` beside the spec. `toMatchInlineSnapshot()` writes the value into the test file itself on first run.

Inline keeps the expectation next to the assertion, which is what makes a small snapshot readable in review; it needs Prettier to write it back, and it becomes unmanageable past a few lines. Stored suits a larger structure but moves the expectation into a file most reviewers skip.

**Guidelines:**

- MUST prefer an inline snapshot for a value of a few lines, so the expectation is visible where the assertion is.
- MUST commit `.snap` files; a snapshot not in version control asserts nothing on the next run.
- SHOULD give a stored snapshot a hint argument when a file has several, so the entries are distinguishable.

## Error Messages as Contracts

`toThrowErrorMatchingInlineSnapshot()` and `toThrowErrorMatchingSnapshot()` capture a thrown error's message. For a parser or a validator whose messages are part of its public contract, this is a strong fit: the message is short, its wording is the thing under test, and a change is exactly what should surface in review.

```ts
expect(() => Suit.parse("S")).toThrowErrorMatchingInlineSnapshot(
  `""S" is not a valid value for Suit.parse()."`,
);
```

**Guidelines:**

- MUST use the inline form for error-message snapshots; a one-line message stored in a separate file is strictly worse.
- SHOULD snapshot an error message only where its wording is part of the contract, and assert on a code or type otherwise.

## Non-Deterministic Fields

A snapshot containing a generated identifier, a timestamp, or a random value fails on every run. Property matchers replace those fields with an asymmetric matcher, so the shape is still asserted and the varying value is not.

```ts
expect(created).toMatchSnapshot({
  id: expect.any(String),
  createdAt: expect.any(Date),
});
```

The alternative for a value embedded in a string is to normalise it before snapshotting. Fixing the clock, per [fake-timers.md](./fake-timers.md), removes the whole class for time-derived values.

**Guidelines:**

- MUST replace a non-deterministic field with a property matcher rather than deleting it, which would also stop the field's absence from failing.
- MUST fix the clock before snapshotting any value containing a date, duration, or elapsed time.
- SHOULD normalise an embedded varying value in the received string rather than loosening the whole snapshot.

## Updating

`--updateSnapshot` (`-u`) rewrites every failing snapshot. It combines with a name or path filter, which is the safe way to use it: rewriting the whole suite makes an unintended change indistinguishable from an intended one.

`--ci` refuses to write a **new** snapshot, failing instead. This matters because a new snapshot always passes on first run — without `--ci`, a test added in a pull request writes its snapshot during the pipeline and reports green regardless of whether the value is correct.

**Guidelines:**

- MUST run continuous integration with `--ci`, so a snapshot that was never reviewed cannot pass.
- MUST narrow `-u` to the specific tests being updated rather than rewriting the whole suite.
- SHOULD delete obsolete snapshots that Jest reports rather than leaving them, since they hide the removal of the test that owned them.

## Enforcing Reviewability

That a snapshot has to stay small and reviewable, and that reaching for one instead of deciding what to assert is a defect, belongs to the unit-testing capability named above. Jest's contribution is that both are mechanically enforceable rather than left to review.

**Guidelines:**

- SHOULD enable `eslint-plugin-jest`'s `no-large-snapshots` with an explicit line ceiling, which turns the size rule into a check instead of a habit.
- SHOULD enable `no-interpolation-in-snapshots`, which catches a template literal that makes a snapshot assert against itself.
- SHOULD write a snapshot title that states the case, since in a `.snap` file the title is the only context a reviewer gets.

## Serializers and Resolvers

`snapshotSerializers` teaches the printer about a domain type, turning an opaque dump into something reviewable. `expect.addSnapshotSerializer` does the same for one file. `snapshotResolver` relocates `.snap` files, and `snapshotFormat` controls printing options.

**Guidelines:**

- MUST register a project-wide serializer through `snapshotSerializers` in configuration rather than per spec.
- SHOULD add a serializer when a domain type prints as an unreadable structure, rather than snapshotting a hand-built projection of it.
- SHOULD leave `snapshotResolver` alone unless an existing layout requires it; a non-default snapshot location surprises every reader.
