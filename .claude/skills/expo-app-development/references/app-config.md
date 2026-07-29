# App Configuration

Apply this reference when editing the app config, adding a config plugin, regenerating native projects, declaring a permission or a privacy manifest, or setting the identity and versioning keys a build depends on.

The app config is the single description of what the native app _is_ — its identity, its icons, its capabilities, its native dependencies. It is read at build time to generate the native projects, and a subset of it is readable at runtime.

Verified against SDK 51 through 57.

## Static and Dynamic Config

A static config is a JSON file; a dynamic config is a JavaScript or TypeScript module exporting a function. A dynamic config is required as soon as a value must be _computed_ at build time — read from the environment, derived from the repository, or branched on a build profile.

The two coexist. When both are present the dynamic config receives the static one and returns the final config, which keeps the large declarative bulk in JSON and confines the module to the values that genuinely vary. Spread the incoming config rather than rebuilding it, or every key not restated silently disappears.

**Example:**

```ts
// app.config.ts — extends app.json rather than replacing it
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  version: process.env.PREVIEW_VERSION_NAME || config.version,
  extra: {
    ...config.extra,
    commitHash: resolveCommitHash(),
  },
});
```

**Guidelines:**

- MUST use a dynamic config when any value must be computed at build time, and a static config when none must.
- MUST spread the incoming config and each nested object being extended, rather than returning a config built from scratch.
- MUST keep a dynamic config total — it runs during every build and every prebuild, so a throw there fails all of them.
- SHOULD leave the declarative bulk in the static config and confine the dynamic module to the computed keys.
- SHOULD comment why each computed value is computed, since the reason is a build-pipeline fact invisible from the app's code.

## Build-Time Values

Values the app needs to _display_ or _report_ but that only the build knows — a commit hash, a build identifier — travel through the config's extra field and are read back at runtime through the constants module. This is the channel for non-secret build metadata; it is not a channel for configuration a user could change, and not a place for secrets, which are readable in the shipped bundle.

**Guidelines:**

- MUST pass build-time metadata through the config's extra field and read it through the constants module.
- MUST treat everything in the config as public; it ships inside the app and is readable from it.
- SHOULD provide a fallback for a value that may not resolve, so a build from outside the pipeline still runs.

## Config Plugins

A config plugin is how a library adds native configuration — permissions, entitlements, build settings, native dependencies — without the app editing native projects by hand. A library that documents a plugin must have that plugin listed; installing the package alone leaves its native side unconfigured, and the failure appears at build or at first use rather than at install.

Plugin order is load-bearing. Plugins apply in sequence, and a later one can overwrite what an earlier one wrote. When a build produces native configuration that does not match what a plugin asked for, plugin order is the first thing to check.

**Guidelines:**

- MUST list a library's config plugin in the app config whenever the library documents one.
- MUST pass a plugin's options through its config entry rather than editing what it generates.
- SHOULD keep plugin order deliberate, and comment any ordering that exists because one plugin must follow another.
- MUST re-run prebuild after adding, removing, or reconfiguring a plugin; the change has no effect on an already-generated project.

## Continuous Native Generation

Native projects are generated from the app config, not authored. Under this arrangement the native directories are build output: they are absent from version control, regenerated on demand, and discarded by a clean prebuild. Editing them appears to work and is silently reverted the next time anything regenerates.

Everything a hand edit would have done is expressible another way — a config key, a plugin's options, an existing plugin, or a local plugin the app writes for the purpose.

**Guidelines:**

- MUST NOT hand-edit generated native projects in an app that generates them; express the change in the config or in a plugin.
- MUST keep generated native directories out of version control while the app generates them.
- SHOULD write a local config plugin for a native change no published plugin covers, rather than checking in the generated projects to preserve one edit.
- MUST treat adopting checked-in native projects as a deliberate, one-way decision, not an incidental consequence of needing one edit.

## Permissions, Privacy, and Identity

Several keys have consequences well outside the app's own behavior, and each has a store-review or upgrade failure mode attached.

- **Permission declarations** must exist for every permission the app requests at runtime. A platform denies an undeclared request outright, and a declared-but-unused permission draws review scrutiny.
- **Privacy manifests** declare what data the app collects and which restricted APIs it uses, with a reason code per API. Their absence, or a missing entry, is a submission rejection rather than a runtime error.
- **Identity keys** — the bundle identifier, the package name, the scheme, the project identifier — determine which app a build _is_. Changing one after release is a new app, not an update.
- **The runtime-version policy** determines which builds an over-the-air update may target; it is covered where updates are.

**Guidelines:**

- MUST declare every permission the app requests at runtime, and remove a declaration once its feature is gone.
- MUST maintain a privacy manifest covering collected data types and restricted API usage, including what a dependency uses on the app's behalf.
- MUST NOT change an identity key on a released app without treating it as shipping a distinct app.
- SHOULD keep declarations that a config plugin also writes consistent with the plugin's options, rather than duplicating them at two strengths.
- SHOULD review these keys when a dependency is added, since a dependency can introduce both a permission and a restricted-API usage.
