# Asynchronous Tests

Apply this reference when a case awaits work, asserts on a rejection, tests a callback-based API, or times out for a reason that is not the code being slow.

Verified against `jest` 30.4.2 — [Jest — Testing Asynchronous Code](https://jestjs.io/docs/asynchronous).

## The Four Forms

Jest waits for a case when the case tells it to, in one of four ways:

```ts
// Return the promise.
test("resolves", () => expect(fetchData()).resolves.toBe("ok"));

// Await it.
test("resolves", async () => {
  await expect(fetchData()).resolves.toBe("ok");
});

// Await the value directly.
test("resolves", async () => {
  expect(await fetchData()).toBe("ok");
});

// Take the `done` callback — the last resort.
test("resolves", (done) => {
  fetchData((error, data) => {
    if (error) return done(error);
    try {
      expect(data).toBe("ok");
      done();
    } catch (assertion) {
      done(assertion);
    }
  });
});
```

`await expect(p).resolves.toBe(x)` and `expect(await p).toBe(x)` differ in their failure reports: the first names the promise and its state, the second reports only the resolved value, and on rejection produces an unhandled rejection rather than a matcher failure.

The `done` form is the last resort because it requires the `try`/`catch` above — an assertion that throws inside the callback never reaches Jest, so the case times out instead of failing with the real message.

**Guidelines:**

- MUST use `async`/`await` for promise-based work, reserving `done` for a callback API that returns nothing awaitable.
- MUST wrap assertions inside a `done` callback in `try`/`catch` and pass the error to `done`, or a failed assertion surfaces as a timeout.
- MUST NOT combine `done` with a returned promise; Jest rejects the case outright, because the combination leaks.
- SHOULD prefer `await expect(p).resolves` over `expect(await p)` for the failure message it produces.
- SHOULD promisify a callback API once in a helper rather than writing the `done` dance in every case.

## The Silent Pass

Omitting `return` or `await` completes the case before the promise settles. The case passes, having asserted nothing. Nothing in the output distinguishes it from a case that genuinely verified something.

```ts
// Passes whatever fetchData does.
test("resolves", () => {
  expect(fetchData()).resolves.toBe("ok");
});
```

This is the highest-value thing a linter catches here: `valid-expect` and `valid-expect-in-promise` are both in `eslint-plugin-jest`'s recommended config and both find it.

**Guidelines:**

- MUST return or await every promise a case creates, including one produced by `.resolves` or `.rejects`.
- MUST enable `eslint-plugin-jest`'s recommended config, whose `valid-expect` and `valid-expect-in-promise` rules catch this mechanically.
- SHOULD treat a suspiciously fast async case as a missing `await` before believing it.

## Asserting a Rejection

A rejection test that merely awaits can pass when the promise _resolves_, because nothing asserted that it did not. Two mechanisms prevent it: `.rejects`, which fails if the promise resolves, and `expect.assertions(n)` for the `try`/`catch` shape.

```ts
// Fails if the promise resolves.
await expect(load("missing")).rejects.toThrow("not found");

// The catch shape needs the guard, or a resolution passes silently.
test("rejects", async () => {
  expect.assertions(1);
  try {
    await load("missing");
  } catch (error) {
    expect(error).toBeInstanceOf(NotFoundError);
  }
});
```

**Guidelines:**

- MUST use `.rejects` rather than `try`/`catch` where the assertion is about the rejection value alone.
- MUST add `expect.assertions(n)` to any rejection test written with `try`/`catch`.
- MUST assert something specific about the rejection — a type, a message, a code — rather than only that it rejected.

## Timeouts

The default is 5000 ms per case and per hook. A case's third argument overrides it for that case; `jest.setTimeout` overrides it for the file; `testTimeout` overrides it for the project.

A timeout is a symptom, not a diagnosis. The common causes are a promise that never settles, a fake-timer clock that was never advanced, and a real network call that should have been faked — none of which a longer timeout fixes.

**Guidelines:**

- MUST diagnose a timeout before raising it; a raised timeout on a never-settling promise converts a fast failure into a slow one.
- MUST set a longer timeout at the narrowest scope that needs it — the case, then the file, then the project.
- SHOULD move a genuinely slow suite into its own project with its own `testTimeout` rather than raising the default for everything.
- SHOULD check whether fake timers are active when an awaited timer never fires; see [fake-timers.md](./fake-timers.md).

## Unhandled Rejections

Jest 30 gives the event loop an extra turn before attributing an unhandled rejection, which reduces both false reports and rejections attributed to the wrong case. The `waitForUnhandledRejections` option controls it and **defaults to `false`** — the name reads like a safety feature that is on, and it is not. Enabling it costs measurable time on a fast suite.

**Guidelines:**

- MUST verify the current default against the installed Jest's documentation before relying on unhandled-rejection behavior; this option is new and its default is not what its name suggests.
- SHOULD enable `waitForUnhandledRejections` when chasing a rejection reported against the wrong case, and measure the cost before leaving it on.
