# Logic Extraction

Apply this reference when a component body grows past rendering — when it fetches, transforms, branches on domain rules, or forks by platform.

## Keep Data Access Out of the Component

A component that reaches into the data layer directly scatters caching, validation, error handling, and logging across every call site that renders it. The same component then cannot be rendered in a test, a story, or a second screen without dragging that machinery along.

**Guidelines:**

- MUST NOT import a database client, an ORM, or a raw HTTP client into a component file; data access goes through the host project's data layer.
- MUST NOT let a data-access module import components, routing, or view libraries — the dependency runs one way.
- MUST return a parsed domain model from the data layer, not a raw row or an unvalidated response body, so the component never performs schema-shaped defensive checks.
- SHOULD keep a component's knowledge of loading and failure to _which branch to render_, delegating what a failure means to a helper (see [component-states.md](./component-states.md)).

## Helpers, Hooks, and Module-Scope Functions

Three destinations, chosen by what the logic needs:

| The logic…                                 | Belongs in                        | Why                                             |
| ------------------------------------------ | --------------------------------- | ----------------------------------------------- |
| is pure, and reused                        | a helper module                   | testable without React, importable anywhere     |
| uses React state or effects, and is reused | a hook                            | carries the lifecycle its callers need          |
| is pure, and used by exactly one component | a module-scope function beside it | no indirection to chase, still unit-addressable |

**Guidelines:**

- MUST extract pure logic reused by two or more components into a helper module owned by the feature, or the shared location when features cross.
- MUST extract stateful logic reused by two or more components into a hook, named `use<Subject><Behavior>`, placed with the feature that owns it.
- SHOULD keep a single-use pure function at module scope in the component's own file, below the component, rather than creating a helper module for one caller.
- MUST NOT wrap a pure function in a hook merely to place it; a hook that calls no React API is a helper with extra ceremony.
- SHOULD move a module-scope function into a helper module the moment a second file needs it.
- MUST hoist a magic number or a repeated literal to a named module-scope constant, following the host project's casing convention for constants.

## Route-Local and Single-Use Sub-Components

A presentational fragment used once — a glyph, a section wrapper, a row body — stays **unexported** in the file that uses it. Exporting it invites a second consumer to depend on a shape that was never designed for reuse, and moving it to its own file adds a hop for no benefit.

**Guidelines:**

- MUST leave a single-use sub-component unexported in its only caller's file.
- MUST move it into the component directory as a named export the moment a second file needs it, applying the cohesion rules in [composition.md](./composition.md).
- SHOULD define an unexported sub-component below the component that uses it, so the file's primary export reads first.
- MUST keep a route or page module thin — screen options and composition of the owning feature's components — rather than accumulating feature logic there.

## Platform-Forked Files

When one component needs a genuinely different implementation per platform, fork the **file**, not the component's contract. The base file owns the prop contract; each platform file imports that contract rather than restating it, so the platforms cannot drift apart in their signatures.

**Example:**

```text
linear-progress.tsx          # base: prop contract + universal fallback
linear-progress.ios.tsx      # imports the contract via ComponentProps<typeof …>
linear-progress.android.tsx
```

**Guidelines:**

- MUST let the base file define the prop contract, and derive each platform file's props from it rather than re-declaring them.
- MUST keep the exported component name identical across every fork, so call sites are platform-agnostic.
- MUST NOT fork a file for a difference a variant prop or a conditional style can express; forking is for a genuinely different implementation.
- SHOULD give the base file a safe universal rendering when the host bundler may resolve it on an unforked platform.
