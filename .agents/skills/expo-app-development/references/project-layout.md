# Project Layout

Apply this reference when creating an Expo app's directory structure, adding a module to an existing one, introducing a path alias, forking a file per platform, or restructuring an app whose layout has drifted.

This reference applies to a new app **and** to reshaping one that already exists. Expo's own project-structure guidance restricts itself to new projects; this skill does not, because an app that has outgrown its layout is exactly when the rules matter. Restructure incrementally, and move a directory in its own change so the diff stays reviewable.

## The Source Root

Application code belongs under a single source root, conventionally `src/`. Configuration lives at the repository root, where the tools that read it expect to find it: the app config, the bundler config, the test-runner config, the TypeScript config, the package manifest, and any native-pipeline manifests. Mixing the two makes it impossible to tell at a glance which files ship in the bundle.

**Guidelines:**

- MUST keep application code under one source root rather than scattering it across the repository root.
- MUST keep configuration files at the repository root, outside the source root.
- SHOULD use `src/` as the source-root name unless the app already established a different one.
- MUST NOT place a file under the source root that only the build reads and the app never imports.

## Organizing by Domain

Within the source root, group modules by the **domain** they serve — the bounded concern a reader would name — not by the technical kind of file they are. A by-kind top level (`components/`, `hooks/`, `utils/`, `screens/`) scatters one domain across four directories and makes the blast radius of a change invisible; a by-domain top level keeps a domain's screens, components, hooks, models, and helpers adjacent, so deleting the domain is deleting a directory. Per-kind subdirectories are the organizing axis _inside_ a domain, never above it.

Two cross-cutting directories sit alongside the domains — `common/` and `core/` — and the next section draws the line between them. Everything else earns a domain.

**Example:**

```
src/
  app/                    routes only
  auth/                   one domain
    components/
    helpers/
    hooks/
    models/
    screens/
    stores/
  collections/            another domain
  common/                 shared primitives
  core/                   app-wide infrastructure
```

**Guidelines:**

- MUST group modules under the source root by domain, and name each directory after the domain rather than after a file kind.
- MUST NOT introduce top-level `components/`, `hooks/`, `utils/`, or `screens/` directories as the app's primary organizing axis.
- SHOULD keep a domain's screens, components, hooks, models, helpers, and stores in per-kind subdirectories inside that domain's directory.
- MUST NOT import from one domain's internals into another when the owning domain exposes a public surface; cross-domain reuse is a signal to promote the code to `common/`.

## Cross-Cutting Tiers

Two directories sit outside the domains, and what separates them is what each one knows. `common/` holds reusable UI and utility primitives that know nothing about the application — a button, a date formatter, a hook whose signature carries no domain vocabulary. `core/` holds app-wide infrastructure and the singletons the application is wired from — environment access, the HTTP or query client, the error tracker, storage. A `common/` module could be lifted into a different application unchanged; a `core/` module could not, because it encodes this one's configuration.

Everything else earns a domain. A module reaches `common/` only once a second domain imports it — until then it belongs to the domain that uses it, where deleting that domain deletes it too.

**Guidelines:**

- MUST keep `common/` to primitives that carry no domain vocabulary and no application configuration.
- MUST keep `core/` to app-wide infrastructure and singletons — environment access, clients, the error tracker, storage — rather than to shared UI.
- SHOULD place a new module in the domain that uses it, and move it into `common/` only once a second domain imports it.
- MUST NOT place a module in `common/` on first use in anticipation of reuse.

## Path Aliases

Declare a path alias for the source root and import through it, so a module can move between depths without rewriting the imports that reach it. The alias must be declared in the TypeScript config **and** mirrored anywhere else that resolves modules — most importantly the test runner, which does not read `tsconfig.json` paths.

An app that already has an alias keeps it. The rule is that exactly one alias convention exists per app and every resolver agrees on it, not that every app uses the same token.

**Example:**

```jsonc
// tsconfig.json
{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }
```

```js
// jest.config.cjs — the same mapping, in the test runner's own syntax
moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" }
```

**Guidelines:**

- MUST declare a path alias for the source root and import through it rather than through parent-relative paths that climb out of a directory.
- MUST mirror every declared alias into the test runner's module mapper, and into any other resolver the project configures.
- MUST follow the app's existing alias convention when one is already established, rather than introducing a second.
- SHOULD default a new app to `@/*` resolving to the source root, and record the choice where the project documents its conventions.
- MAY declare a second alias for a non-code directory such as assets when that directory sits outside the source root.

## Platform-Forked Files

The bundler resolves a platform-specific extension before the plain one, so `foo.ios.tsx` serves iOS and `foo.android.tsx` serves Android for the same `./foo` import.

**When to fork a component, and how its forks share a prop contract, belong to a React component development capability** — that skill owns the fork's contract rules. What this skill owns is the resolution consequence: a fork is a bundler behavior, and not every resolver in an Expo project applies it.

An extension-free base file is therefore required. Any resolver that does not apply platform extensions — the test runner in its default configuration, the type-checker in some configurations, a documentation tool — cannot resolve `./foo` at all when only `foo.ios.tsx` and `foo.android.tsx` exist. The failure surfaces far from the fork, as an unresolved import in a test rather than a missing file next to the sibling that does exist.

**Example:**

```
linear-progress.tsx          the base — required for resolution
linear-progress.ios.tsx
linear-progress.android.tsx
```

**Guidelines:**

- MUST provide an extension-free base file for every platform-forked module, so the import resolves under a resolver that does not apply platform extensions.
- MUST give the base file a real implementation or an explicit unsupported-platform failure, never an empty module that resolves and then renders nothing.
- SHOULD name the platform difference in a comment at the fork, since the forks rarely appear in the same diff.
- SHOULD confirm a newly forked module resolves in the test runner, which is where a missing base file is found.

## The Package Entry

The app's entry is the first application code to run, before the router mounts and before any component renders. Point the package manifest's entry at a module the app owns, and have that module import the router's entry, so there is a place to put initialization that must precede the first render — a style system's configuration, an error tracker, a splash-screen hold.

An app with nothing to initialize may point straight at the router's entry; adding the owned module later is a one-line change. Prefer the owned module as soon as the second thing needs to run early, rather than distributing initialization across module side effects.

**Example:**

```ts
// main.ts — declared as the package manifest's entry
import "expo-router/entry";

import { preventAutoHideAsync } from "expo-splash-screen";

preventAutoHideAsync();
```

**Guidelines:**

- MUST declare the app's entry module in the package manifest rather than relying on a default the tooling infers.
- SHOULD point the entry at a module the app owns, which imports the router's entry as its first statement.
- MUST keep the router-entry import first in that module, before any other import or statement with a side effect.
- MUST keep the entry module to initialization only — no component definitions, no route declarations, no business logic.
- SHOULD move an initialization side effect out of an arbitrary module and into the entry once its ordering relative to the first render matters.
