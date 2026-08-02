# React and React Native

Apply this reference when configuring Jest for a React, React Native, or Expo project, or when a component test is failing for a reason that belongs to the runner rather than the component.

Verified against `jest` 30.4.2 — [Jest — Testing React Native Apps](https://jestjs.io/docs/tutorial-react-native). Component composition, props, and state belong to a React component capability; only the Jest side is covered here.

## Presets and the Exclusion Pattern

A React Native or Expo project uses `jest-expo` or the `react-native` preset. Much of that ecosystem publishes untranspiled ES modules, so the preset's `transformIgnorePatterns` — a negative lookahead listing the packages that must be transformed — is what makes the suite run at all.

Assigning a new `transformIgnorePatterns` **replaces** the preset's list rather than extending it, which is the most common way a working React Native suite breaks. Extend it instead.

**Guidelines:**

- MUST extend a preset's `transformIgnorePatterns` rather than replacing it when adding a package.
- MUST add the failing package to the lookahead when `Cannot use import statement outside a module` names a dependency; see [transforms-and-resolution.md](./transforms-and-resolution.md).
- SHOULD verify a changed pattern against the single failing spec, since a malformed lookahead fails identically to no change.

## Wiring the DOM Environment

A React web suite needs `jest-environment-jsdom` installed, `testEnvironment: "jsdom"`, and — for the assertion vocabulary teams expect — a matcher library registered in `setupFilesAfterEnv`:

```js
// jest.setup.ts
import "@testing-library/jest-dom";
```

```js
// jest.config
setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"];
```

It must be `setupFilesAfterEnv`, not `setupFiles`: `expect` does not exist yet during the latter.

**Guidelines:**

- MUST register matcher libraries in `setupFilesAfterEnv`; `expect` is undefined during `setupFiles`.
- MUST install `jest-environment-jsdom` explicitly; it has not shipped with Jest since version 28.
- SHOULD keep the DOM environment scoped to specs that render, rather than applying it project-wide.

## The Renderer

`react-test-renderer` is deprecated and is no longer the right default for new tests. A testing-library renderer — `@testing-library/react` on the web, `@testing-library/react-native` on native — is the current choice, and it also steers assertions toward rendered output rather than internals.

**Guidelines:**

- MUST NOT introduce `react-test-renderer` in new tests.
- SHOULD migrate an existing `react-test-renderer` spec when touching it, rather than as a separate sweep.

## Assertions That Pin the Framework

A render-prop or callback component invites assertions on how often and with what the framework called it. Those assertions pin React's scheduling, not the component's behavior — so a React upgrade that changes render counts turns the suite red without any behavior changing.

```ts
// Pins React's call pattern: a strict-mode or scheduling change breaks it.
expect(children).toHaveBeenCalledTimes(9);
expect(children).toHaveBeenNthCalledWith(5, 3);
```

The durable assertion is on what the component produced — the rendered output after the state that matters has settled.

**Guidelines:**

- MUST NOT assert an exact render or callback count for a component whose invocation frequency React decides.
- MUST assert rendered output or a user-visible effect rather than a sequence of callback arguments.
- SHOULD assert the settled state after advancing the clock, per [fake-timers.md](./fake-timers.md), rather than the intermediate calls that led to it.

## The Act Warning

A warning that an update was not wrapped in `act(...)` means state changed outside React's batching — usually because a promise or a timer resolved after the assertion. It is a real signal: the test is asserting at a moment the component is still settling.

**Guidelines:**

- MUST resolve an act warning by awaiting the settled state, rather than by silencing the console.
- SHOULD use the testing library's own async utilities, which wrap `act` correctly, instead of calling it directly.

## What Jest Cannot Establish

jsdom is not a browser and the native test environment is not a device. Layout, scrolling, gesture handling, animation timing, accessibility-service behavior, and platform navigation are outside what either can verify.

**Guidelines:**

- MUST route layout, gesture, animation, and platform-navigation confidence to an end-to-end suite on a real browser or device.
- MUST NOT assert on computed geometry or visibility under jsdom; those values are not calculated.
- SHOULD state the residual risk when a component's behavior is only partly covered by the Jest suite.
