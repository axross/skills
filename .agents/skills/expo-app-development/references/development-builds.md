# Development Builds

Apply this reference when setting up a local development loop, deciding whether a change needs a new native build, or adding a developer-only affordance.

## Which Changes Need a Native Build

The most common time sink in Expo development is reloading after a change that required a rebuild, and concluding the change did not work. The line is whether the change affects **native** content — a distinction [Expo's development-builds documentation](https://docs.expo.dev/develop/development-builds/introduction/) explains but does not reduce to a lookup:

| Change                                                         | Needs          |
| -------------------------------------------------------------- | -------------- |
| JavaScript, TypeScript, styles, assets already bundled         | reload         |
| Adding or removing a package with native code                  | native build   |
| Adding, removing, or reconfiguring a config plugin             | native build   |
| Changing app config native keys — permissions, icons, identity | native build   |
| Changing a public environment variable                         | rebuild bundle |

**Guidelines:**

- MUST rebuild natively after changing a config plugin, a native dependency, or a native app-config key, rather than reloading.
- MUST rebuild after changing a public environment variable, since its value is inlined into the bundle at build time.
- SHOULD clear the bundler cache when a change to resolution — extensions, aliases, transformers — appears not to take effect.
- SHOULD suspect a missing native build first when a newly configured native capability is absent at runtime.

## Development Build over the General-Purpose Client

A development build is the app's own binary, containing its own native dependencies, with the developer tooling included. The general-purpose client app can only run projects whose native dependencies it happens to contain, so any app with a native dependency outside that set cannot run in it — and an app that starts inside it usually outgrows it.

Standardize on a development build. The cost is one native build per platform per native change; the benefit is that development runs the same native code as production.

**Guidelines:**

- MUST use a development build for any app with a native dependency outside the general-purpose client's set.
- SHOULD standardize on a development build from the start rather than migrating once the client stops working.
- SHOULD keep a development build's configuration in a named build profile, so every developer builds the same thing.

## The Developer Menu

The developer menu is extensible, and it is the right home for the destructive-but-useful affordances a team needs while building: seeding data, erasing local state, resetting a migration, toggling a feature. Putting these behind the developer menu keeps them out of the app's own UI and out of production builds entirely.

Register them from the entry module so they exist regardless of which screen is open, and handle their failures — a registration callback that throws takes down the menu action with no feedback.

**Guidelines:**

- MUST register custom developer-menu items from the entry module rather than from a screen.
- MUST keep destructive developer affordances in the developer menu rather than in the app's own UI, so they cannot ship.
- MUST catch and report a failure inside a menu callback; an uncaught rejection there is silent.
- SHOULD name each item for what it does to the device's data, since these are used quickly and are not undoable.

## Launcher Behavior

Where the development client provides a launcher, it can be configured to open the most recent project rather than presenting a picker on every launch. On a machine that works on one app, this removes a step from every single run.

**Guidelines:**

- SHOULD configure the launcher to open the most recently used project when the machine works on one app at a time.
- MAY leave the picker enabled where several development builds are used side by side.
