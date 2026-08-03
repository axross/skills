# SDK Upgrades

Apply this reference when moving an app to a new Expo SDK, when a dependency reports an incompatibility, or when documentation and observed behavior disagree.

## The Upgrade Sequence

An Expo SDK pins the React Native version, the React version, and a compatible version of every Expo-managed package. Upgrading means moving all of them together; upgrading the SDK alone leaves an app whose packages target the previous one.

The sequence is: install the new SDK, align every managed dependency to it, run the diagnostic, then work through what it reports.

```bash
npx expo install expo@latest   # move the SDK
npx expo install --fix         # align every managed dependency to it
npx expo-doctor                # report what is still wrong
```

**Guidelines:**

- MUST align every Expo-managed dependency to the new SDK after changing it, rather than upgrading the SDK alone.
- MUST run the diagnostic after an upgrade and resolve what it reports before treating the upgrade as done.
- MUST regenerate native projects after an upgrade, since the generated output is SDK-specific.
- SHOULD upgrade one SDK at a time, since migration notes are written per release and compound badly when skipped.
- SHOULD commit the upgrade separately from any feature work, so a regression is bisectable to the upgrade itself.

## Read the Installed SDK's Documentation

Expo's documentation is versioned, and the default view is the current release. An app that is not on the current release is reading about a different framework — different component locations, different config keys, different defaults.

This is the most reliable source of wrong guidance in Expo work: an example copied from documentation for a newer SDK type-checks, runs, and does the wrong thing, or does not exist.

**Guidelines:**

- MUST read documentation for the SDK the app has installed, not the current one, and check which version a page describes before following it.
- MUST verify an API surface against the installed SDK before using it, rather than reproducing it from memory or from another app.
- SHOULD state the SDK version alongside any durable note recording how something works, so the note can be aged.

## A Library's Compatibility Is Its Own

The managed-dependency alignment covers packages the SDK knows about. Everything else — third-party native libraries, tooling, testing helpers — carries its own compatibility matrix against React Native and React, which the SDK cannot enforce.

Two of these bite regularly: a native library that has not yet shipped support for the React Native version the SDK pins, and testing helpers pinned against what the router's own helpers expect.

**Guidelines:**

- MUST check each unmanaged native dependency's own compatibility table against the SDK's pinned React Native version.
- MUST treat a library with no compatible release as a blocking upgrade constraint, and decide deliberately whether to wait, replace it, or hold the SDK.
- SHOULD check the test suite's own version constraints during an upgrade, since they fail together and late.

## What a Major Jump Is Likely to Require

Beyond dependency alignment, a major SDK jump tends to require migrations of a few recognizable kinds. Consult the release's own migration notes for specifics; these are the categories to expect:

- **Architecture migrations** — the New Architecture becoming default, requiring library support and surfacing behavior differences.
- **Framework version bumps** — a React major bringing its own migration, independent of Expo's.
- **Compiler adoption** — an optimizing compiler that changes when components re-render and can expose latent violations of the rules of hooks.
- **API relocations** — components and helpers moving between modules or onto namespaced properties.
- **Import-path consolidation** — where the SDK begins re-exporting an underlying library and direct imports of it become unsupported.

**Guidelines:**

- MUST read the release's migration notes before starting, rather than discovering each migration from a build failure.
- MUST re-verify import paths after a major jump, since relocations type-check as missing exports only where the app uses them.
- SHOULD enable an opt-in compiler or architecture flag as its own change, separate from the SDK bump, so regressions are attributable.
- SHOULD run the full test suite and an end-to-end pass after an upgrade, since the failures are behavioral rather than compile-time.
