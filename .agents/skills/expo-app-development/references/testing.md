# Testing

Apply this reference when configuring an Expo app's test runner, writing a test that touches routing, mocking a native module, or deciding whether a behavior can be covered without a native build.

This reference covers the **Expo-specific** test setup. How a unit test is designed, named, and asserted belongs to a unit testing capability; end-to-end authoring conventions belong to an end-to-end testing capability. Both own their topics; this one gets the Expo app to the point where their rules can apply.

## The Preset

An Expo app's test runner uses the Expo preset. It sets the transform, the environment, and — critically — a transform-ignore list that already permits every Expo and React Native package to pass through compilation.

That list is the single most common thing to break. A hand-written replacement inevitably omits a package that ships untranspiled modern syntax, and the result is a syntax error from inside a dependency that looks like a broken dependency rather than a misconfiguration. Extend the configuration around it; do not restate it.

**Guidelines:**

- MUST use the Expo preset rather than assembling an equivalent configuration.
- MUST NOT override the preset's transform-ignore list; a narrower hand-rolled list breaks on untranspiled dependencies.
- MUST mirror the project's path aliases into the runner's module mapper, per [project-layout.md](./project-layout.md); the runner does not read the TypeScript config.
- SHOULD add a targeted module mapping to work around one broken dependency, rather than widening the transform list to reach it.

## Testing Routes

The router ships its own test helper that renders a route tree — the layouts, the navigator, and the routes together — rather than a screen in isolation. Use it for anything whose behavior is navigational: an auth gate that mounts one subtree or another, a redirect, a parameter reaching a screen, a not-found fallback.

Rendering the screen component directly remains right for the screen's own behavior. The distinction is whether the thing under test is the _screen_ or its _place in the route tree_.

**Guidelines:**

- MUST use the router's route-rendering helper for behavior that depends on the route tree, rather than mounting a screen directly.
- SHOULD test an auth gate by asserting which subtree mounts, since that is the behavior the gate exists for.
- SHOULD keep a screen's own logic testable without a router, by having the route pass parameters in as props.

## Mocks

Two categories need mocking in almost every Expo app. **Native modules** have no implementation in a test environment, so a module the code under test imports must be replaced with one whose functions are controllable — a permission check that can return each of its states, a database that can be inspected. **The style system's runtime** usually ships its own test setup, which must be registered along with the app's own style configuration or every styled component renders unstyled.

A mock is part of the test's contract: it should return the shapes the real module returns, including the failure shapes, or the test passes against a module that does not exist.

**Guidelines:**

- MUST mock native modules the code under test imports, since they have no test-environment implementation.
- MUST register the style system's own test setup and the app's style configuration in the runner's setup files.
- MUST give a mock the same shape as the real module, including its error and empty results.
- SHOULD keep a shared mock beside the module it stands in for, so it is found and updated when that module changes.

## Version Pinning

The router's testing helpers depend on a specific major of the component testing library, and the two do not move together. A major bump of the testing library that changes whether rendering is synchronous will break every route test at once, with an error that points at the app's tests rather than at the mismatch.

The renderer must also match the React version exactly, not approximately.

**Guidelines:**

- MUST pin the component testing library to the major the installed router's test helpers support, and record why in the runner's configuration.
- MUST keep the test renderer's version matched to React's exact version.
- MUST re-check both pins during an SDK upgrade, since the router's helpers move with the SDK.
- SHOULD comment a pin at the pin, since it otherwise reads as an outdated dependency to bump.

## What Needs a Native Build

Some behavior cannot be covered in a JavaScript test environment at all: a permission dialog, a real database file, a camera, a push token, an over-the-air update, a native tab bar's own behavior. Covering these means a build on a device or simulator, driven by an end-to-end runner.

Recognize the boundary rather than mocking across it. A test that mocks the whole of a native capability tests the mock.

**Guidelines:**

- MUST cover native-dependent behavior in an end-to-end run on a real build rather than by mocking the capability entirely.
- MUST ensure the app builds and starts before an end-to-end run, since a failure there presents as every flow failing.
- SHOULD keep the seam narrow enough that the app's own logic is unit-testable with the native capability behind an interface.
