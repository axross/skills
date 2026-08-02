# Fake Timers

Apply this reference when code under test schedules work with a timer, debounces or throttles, polls, animates, or reads the clock — and whenever a test waits on real elapsed time.

Verified against `jest` 30.4.2 — [Jest — Timer Mocks](https://jestjs.io/docs/timer-mocks).

## The Wait This Replaces

A test that waits on the real clock is the anti-pattern fake timers exist to remove:

```ts
// Slow by construction, and flaky the moment CI is loaded.
await new Promise((resolve) => setTimeout(resolve, 100));
expect(rendered).toBe(3);
```

Every such wait costs its full duration on every run, and each one is a race: the assertion fires after a fixed delay rather than after the work, so a loaded machine fails a test that passes locally. A suite full of them is slow _and_ unreliable, which is the worst combination — the slowness discourages running it and the flakiness discourages trusting it.

Fake timers make the same test instant and deterministic, because the test advances the clock explicitly and nothing else can.

**Guidelines:**

- MUST NOT wait on real elapsed time to let scheduled work happen; take control of the clock instead.
- MUST advance the clock explicitly rather than awaiting a real delay, so the assertion runs after the work by construction rather than by timing.
- SHOULD treat any `setTimeout`-based wait in an existing spec as a defect to migrate, not a style preference.

## Taking Control and Giving It Back

`jest.useFakeTimers(config?)` replaces the timer and clock APIs; `jest.useRealTimers()` restores them. `fakeTimers.enableGlobally` turns them on for the whole project.

Leaving fake timers installed leaks into whatever runs next in the same file — including teardown that legitimately needs a real timer.

**Guidelines:**

- MUST restore real timers in an `afterEach` when a file enables fake timers for only part of its cases.
- MUST enable fake timers before the code that schedules a timer runs, not after.
- SHOULD enable them globally via `fakeTimers.enableGlobally` when most of a project's suites need them, rather than per file.

## Choosing How Far to Advance

| Call                           | Advances                                                 |
| ------------------------------ | -------------------------------------------------------- |
| `advanceTimersByTime(ms)`      | exactly `ms`, running everything scheduled within it     |
| `advanceTimersToNextTimer(n?)` | to the next `n` scheduled timers (default 1)             |
| `runOnlyPendingTimers()`       | only what is queued now — not what those callbacks queue |
| `runAllTimers()`               | everything, including newly scheduled timers             |
| `advanceTimersToNextFrame()`   | to the next animation-frame callback                     |

`runAllTimers` is the wrong choice for a self-rescheduling timer — a poller that queues its next run from its own callback never drains, and Jest aborts with an infinite-loop error once `timerLimit` (default 100 000) is reached. `runOnlyPendingTimers` is the answer there.

**Guidelines:**

- MUST use `runOnlyPendingTimers`, not `runAllTimers`, for a timer that reschedules itself.
- MUST prefer `advanceTimersByTime` when the test's point is the specific delay, so the assertion documents the interval.
- MUST NOT raise `timerLimit` to work around an infinite-loop error; it means the wrong advance was chosen.
- SHOULD assert that nothing happened before advancing, as well as that it happened after — otherwise the test passes against code with no delay at all.

## Timers That Resolve Promises

Advancing the clock synchronously runs timer callbacks, but does not let the microtask queue drain in between. Code whose timer resolves a promise — nearly all debounce and retry logic — needs the asynchronous variants: `advanceTimersByTimeAsync`, `runOnlyPendingTimersAsync`, `runAllTimersAsync`, `advanceTimersToNextTimerAsync`. Each awaits the microtask queue between timers.

```ts
jest.useFakeTimers();
const settled = retryWithBackoff(operation);
await jest.advanceTimersByTimeAsync(1000);
await expect(settled).resolves.toBe("ok");
```

**Guidelines:**

- MUST use the `Async` variant when a timer callback resolves or awaits a promise; the synchronous form leaves the continuation unrun and the test times out.
- MUST await the `Async` variant, since it returns a promise.
- SHOULD reach for the `Async` variant by default in a suite whose code is promise-based, rather than switching after a timeout.

## Keeping Specific APIs Real

`doNotFake` excludes named APIs from faking. It is what a test needs when the code reads `performance` for a measurement that should stay real, or when a library depends on `process.nextTick` behaving normally.

```ts
jest.useFakeTimers({ doNotFake: ["performance", "nextTick"] });
```

**Guidelines:**

- MUST list an API in `doNotFake` rather than abandoning fake timers entirely when only one clock source must stay real.
- SHOULD record why each `doNotFake` entry exists, since an unexplained entry cannot be retired safely.

## Moving the Wall Clock

`setSystemTime` changes what `Date` reports without advancing the timer queue; `now` sets the starting instant; `getRealSystemTime` reads the true time while it is faked. This is the mechanism for a test whose output embeds a date — a formatter, a snapshot, an expiry check.

**Guidelines:**

- MUST fix the clock with fake timers or `setSystemTime` before snapshotting any value containing a date or a duration.
- MUST distinguish moving the clock from advancing timers: `setSystemTime` does not run a scheduled callback.
- SHOULD choose a fixed, readable instant for a test's `now` rather than one derived from the current time.
