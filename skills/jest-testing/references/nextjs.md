# Next.js

Apply this reference when configuring Jest in a Next.js application, or when deciding what a Next.js codebase can and cannot verify with Jest.

Verified against `jest` 30.4.2 and Next.js 16 — [Next.js — Testing with Jest](https://nextjs.org/docs/app/guides/testing/jest). The framework's own conventions — routing, the server/client boundary, caching — belong to a Next.js capability; only the Jest side is covered here.

## What the Framework's Helper Configures

`next/jest`'s `createJestConfig(options)` wraps a configuration and supplies:

- the compiler's transform, matching what the application builds with
- automatic mocking of stylesheets, CSS modules, image imports, and font imports
- `.env` files loaded into `process.env`
- `node_modules` excluded from transformation, and `.next` from resolution
- flags read from `next.config` that enable compiler features

That covers the transformation and asset problems a Next.js suite would otherwise hit one at a time. Using it removes the need to hand-write `transform`, and hand-writing one on top of it usually breaks it.

**Guidelines:**

- MUST use `next/jest` rather than hand-configuring a transform for a Next.js application.
- MUST NOT set `transform` alongside it unless the intent is to replace the compiler transform entirely.
- SHOULD let it mock assets rather than adding `moduleNameMapper` entries for stylesheets and images, which would duplicate what it already does.

## Exporting the Configuration

The helper returns a **function**, because loading `next.config` is asynchronous. The configuration object is passed to it and the result is exported. Spreading the result, or exporting the plain object, loses the framework's contribution.

```js
// jest.config.cjs
const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });

/** @type {import("jest").Config} */
const config = {
  testEnvironment: "node",
  clearMocks: true,
  testMatch: ["<rootDir>/app/**/*.spec.ts", "<rootDir>/payload/**/*.spec.ts"],
};

module.exports = createJestConfig(config);
```

Note `.cjs`: a Next.js application usually declares `"type": "module"`, which makes a `jest.config.js` using `module.exports` fail to parse.

**Guidelines:**

- MUST export the result of calling the helper, never the configuration object it was given.
- MUST NOT spread the helper's return value into another object; it is a function-produced async config, not a plain one.
- MUST name the config file with an extension matching the package's module type.

## What Jest Cannot Verify Here

Next.js's own documentation states that **asynchronous Server Components are not supported** by Jest, and recommends end-to-end tests for them. Synchronous Server Components and Client Components can be unit tested.

That boundary is broader in practice than it sounds: request-scoped behavior, caching and revalidation, route handlers' integration with the framework's runtime, and anything reading framework request context are all better verified by driving a real server.

**Guidelines:**

- MUST route an asynchronous Server Component's behavior to an end-to-end test rather than attempting to render it in Jest.
- MUST NOT assert on caching, revalidation, or request-scoped framework behavior from a unit test; those depend on the framework runtime.
- SHOULD extract the pure decision out of a component or handler and unit test that, leaving the wiring to a broader test.

## Server-Fenced Modules

A module importing `server-only` throws when loaded outside a server context. Under `testEnvironment: "node"` that fence is usually satisfiable, but the module frequently also reaches for a database or framework context that a unit test has no business starting.

The productive shape is the same one the rest of this library recommends: keep the decision logic in a plain module with no fence and no framework import, and let the fenced module be thin wiring the end-to-end suite covers.

**Guidelines:**

- MUST keep testable decision logic in a module free of `server-only` and framework imports, rather than mocking the fence.
- SHOULD use `testEnvironment: "node"` for a Next.js suite testing server logic, reserving jsdom for specs that render components.
- SHOULD split component specs and server-logic specs into separate projects when both exist, so neither pays the other's environment cost.
