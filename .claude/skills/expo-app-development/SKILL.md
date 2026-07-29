---
name: expo-app-development
description: The ability to build an Expo app — the framework layer beneath its React components. Covers project layout and the routes-only `app/` directory; Expo Router file notation, thin route modules, navigators, links and deep links; app configuration, config plugins, and Continuous Native Generation; `EXPO_PUBLIC_` variables and secret boundaries; entry-module startup, splash gating, and provider order; safe areas and edge-to-edge; fonts, icons, and images; runtime permissions; on-device storage and SQL migrations; the Expo wiring of an error tracker; development builds and the dev menu; `jest-expo` testing and route tests; SDK upgrades and version discipline; build, release, and over-the-air updates; and the Expo MCP server. Prescribes lookups against the installed SDK's docs wherever an API surface moves between releases.
when_to_use: Use when working on an Expo app's framework layer — routes, app config, config plugins, permissions, safe areas, assets, on-device storage, testing, SDK upgrades, or shipping a build or update. Triggers include "Expo", "expo-router", "prebuild", "CNG", "EXPO_PUBLIC_", "splash screen", "deep link", "native tabs", "expo-updates", "runtime version", "EAS", "expo-doctor", and "expo MCP". For a component's composition, state, or styling, use the React component capabilities instead.
user-invocable: false
---

# Expo App Development

Use this capability whenever you work on the **framework layer** of an Expo app — the part that decides where files live, how a URL becomes a screen, what the native binary contains, what happens between launch and first paint, and how the app reaches a device. It owns the app; it does not own the components inside it.

It does **not** own what a component is. Composition, props contracts, extracted hooks, state placement, memoization, loading and error surfaces, list virtualization, and test-hook naming belong to a React component development capability. It does **not** own how a surface looks: design tokens, colour, typography, spacing, themes, and stylesheet structure belong to a React component styling capability. Log levels, error-handling structure, and capture semantics belong to a software instrumentation capability — this skill covers only the Expo **wiring** of an error tracker. End-to-end test authoring belongs to an end-to-end testing capability — this skill covers only the Expo prerequisites for a run. Where a rule here has a counterpart in one of those, this skill states the Expo-layer mechanic and names the owner rather than restating its reasoning.

**Version discipline.** Expo breaks between SDK releases, and an API surface frozen into a rule rots within one of them. Every version-sensitive statement in this skill names the SDK it was verified against, and where a surface is known to move, the rule is a **lookup** — consult the installed SDK's versioned documentation — rather than a fixed import path or component name. Treat an unversioned claim about Expo, in this skill or anywhere else, as suspect.

**Scope of the routing sections.** Expo also ships surfaces this skill deliberately excludes, because no rule here was derived for them: API routes (`+api.ts`), server output and web deployment, native module authoring, brownfield integration, DOM components, and App Clips. Where a task reaches one of those, say so rather than extrapolating from the rules below.

## Project Layout

See [project-layout.md](./references/project-layout.md) for:

- choosing a source root, and keeping configuration files outside it
- organizing by domain, and the by-kind layout to avoid
- declaring a path alias and mirroring it into the test runner's module mapper
- forking a module per platform, and the extension-free base file a fork requires
- pointing the package entry at a module that runs before the router

## Route Structure

See [route-structure.md](./references/route-structure.md) for:

- the file-notation set the router recognizes, and what each segment shape produces
- naming route files, and the casing the router and its tooling expect
- keeping the routes directory free of anything that is not a route or a layout
- choosing which route a group falls back to
- turning on generated route types, and what they change about navigation calls

## Route Modules

See [route-modules.md](./references/route-modules.md) for:

- what a route file may contain, and where the screen body belongs instead
- reading route parameters, and choosing between the local and global parameter hooks
- validating a parameter before it reaches application logic
- placing per-screen options in the route versus its owning layout

## Navigators and Layouts

See [navigators-and-layouts.md](./references/navigators-and-layouts.md) for:

- determining which tabs implementation the installed SDK recommends, and when to fall back
- nesting a stack inside each tab, and where a header belongs in that arrangement
- what the root layout is responsible for, and the order its providers compose in
- gating a route subtree behind authentication
- presenting a screen as a modal or a sheet

## Navigation and Links

See [navigation-and-links.md](./references/navigation-and-links.md) for:

- choosing between a declarative link and an imperative navigation call
- passing parameters through a typed href rather than an interpolated string
- adding a link preview or a context menu
- keeping a navigation primitive from clobbering a styled element's styles
- accepting a deep link, and treating its parameters as untrusted

## App Configuration

See [app-config.md](./references/app-config.md) for:

- choosing between a static and a dynamic app config, and extending rather than replacing
- passing build-time values into the app, and reading them back at runtime
- adding a config plugin, and why plugin order is load-bearing
- regenerating native projects, and why the generated directories are not edited
- declaring permissions, privacy manifests, identity keys, and the runtime-version policy

## Environment and Secrets

See [environment-and-secrets.md](./references/environment-and-secrets.md) for:

- what the public environment prefix does to a value at build time
- accessing an inlined variable so the bundler can actually replace it
- centralizing and validating environment access in one module
- which values must never carry the public prefix, and where those belong instead
- ordering `.env` files, and which of them are committed

## Startup and Lifecycle

See [startup-and-lifecycle.md](./references/startup-and-lifecycle.md) for:

- what runs in the entry module before the first render
- holding the splash screen, and the readiness gate that releases it
- composing providers, and the order their dependencies impose
- setting system chrome and the Android edge-to-edge mode
- configuring the splash screen on a current SDK versus a legacy one

## Safe Areas

See [safe-areas.md](./references/safe-areas.md) for:

- determining which edges a screen actually owns once navigators supply their own chrome
- turning on edge-to-edge rendering, and what it changes about every screen
- applying an inset in a stylesheet, in summary, deferring to the styling capability that owns it
- handling safe areas when no style system exposes insets
- the wrong-edge inset defect, and how it survives review

## Assets and Images

See [assets-and-images.md](./references/assets-and-images.md) for:

- embedding a font at build time versus loading one at runtime, and loading only the faces used
- importing vector graphics as components, and the bundler wiring that requires
- registering extra asset extensions, and pre-loading a heavy asset
- supplying the app icon, adaptive icon, and splash image
- rendering a remote image with a cache policy, placeholder, and stable recycling key

## Permissions

See [permissions.md](./references/permissions.md) for:

- the three states a permission check returns, and the branch each one needs
- asking at the moment of need rather than at launch
- keeping a runtime request and its configuration declaration in step
- sending a user to system settings once the prompt is no longer available

## Data and Storage

See [data-and-storage.md](./references/data-and-storage.md) for:

- choosing a storage mechanism from what the data is, not from what is convenient
- keeping credentials out of general-purpose key-value storage
- opening an on-device database, and applying generated migrations at startup
- storing large binaries on the file system rather than in a database or preferences
- where this skill's remit ends and a server-state layer begins

## Observability Wiring

See [observability-wiring.md](./references/observability-wiring.md) for:

- installing an error tracker's config plugin and bundler wrapper
- wrapping the root component so unhandled errors are captured
- tagging events with a release and an environment the build can identify
- keeping an upload token to build time, and out of the app
- disabling reporting in development without deleting the wiring

## Development Builds

See [development-builds.md](./references/development-builds.md) for:

- deciding whether a change needs a new native build or only a reload
- choosing a development build over the general-purpose client app
- registering custom entries in the developer menu
- selecting which build the launcher opens by default

## Testing

See [testing.md](./references/testing.md) for:

- the preset an Expo app's test runner uses, and the transform list not to hand-roll
- rendering a route tree in a test rather than a screen in isolation
- mocking a native module and a style system's runtime
- pinning the testing library against what the router's own test helpers expect
- what cannot be covered without a native build, and where it belongs instead

## SDK Upgrades

See [sdk-upgrades.md](./references/sdk-upgrades.md) for:

- moving an app to a new SDK, and aligning every Expo-managed dependency afterwards
- running the diagnostic that reports a mismatched or unsupported dependency
- reading documentation for the installed SDK rather than the current one
- reconciling a library's own compatibility table against the SDK's pin
- the migrations a major SDK jump is likely to require

## Build, Release, and Updates

See [build-and-updates.md](./references/build-and-updates.md) for:

- what the app must declare regardless of which pipeline builds it
- treating a hosted service and a self-hosted native pipeline as two adapters
- separating build profiles by distribution and by the channel they subscribe to
- deciding whether a change can ship as an over-the-air update at all
- keeping a runtime version and an update channel compatible

## Expo MCP

See [expo-mcp.md](./references/expo-mcp.md) for:

- connecting the hosted Expo MCP server, and authenticating it from an environment variable
- enabling the local development-server capabilities, and the SDK that introduced them
- what the server answers that documentation alone does not
- reconnecting after a development server restarts
