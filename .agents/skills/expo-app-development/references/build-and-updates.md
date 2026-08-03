# Build, Release, and Updates

Apply this reference when setting up or changing how the app is built and distributed, defining build profiles, or shipping an over-the-air update.

**This reference is pipeline-neutral.** An Expo app can be built by a hosted build service or by a self-hosted native pipeline, and both are legitimate. What the _app_ must declare is the same either way; the pipeline is an adapter around it. Rules below that belong to one adapter say so.

## What the App Declares Regardless of Pipeline

Independent of who runs the build, the app itself must carry: its identity keys, a version, the platform-specific build numbers or their auto-increment policy, its permission and privacy declarations, its plugin set, and — where it ships over-the-air updates — an update URL and a runtime-version policy.

These live in the app config because they describe the app. A pipeline that injects them at build time instead makes the app un-buildable outside that pipeline, which is the failure mode that turns a pipeline migration into a rewrite.

**Guidelines:**

- MUST keep the app's identity, version, and declarations in the app config rather than injected by the pipeline.
- MUST keep the app buildable locally, so a pipeline outage or a migration is not a blocker.
- SHOULD compute a per-build value — a preview version name, a commit hash — in the dynamic config from an environment variable the pipeline sets, rather than having the pipeline rewrite files.

## Build Profiles

A profile names a build's audience and shape: whether it includes the development client, how it is distributed, which update channel it subscribes to, and how its build number increments. Profiles inherit, so shared settings are declared once.

The distinction to keep sharp is between a build for developers, a build for testers, and a build for the store. They differ in distribution and in what they connect to, and collapsing any two of them ships a development affordance to users or points a store build at a preview channel.

**Guidelines:**

- MUST define a distinct profile per audience — development, internal testing, and store release — rather than reusing one.
- MUST put shared settings in a base profile and extend it, so profiles cannot drift apart silently.
- MUST include the development client only in development profiles.
- SHOULD pin the build environment — the toolchain versions the pipeline uses — so a build is reproducible.
- SHOULD name a profile's channel explicitly rather than relying on a default, since the default binds a build to whichever channel shares its name.

## Over-the-Air Updates

An over-the-air update replaces the app's **JavaScript bundle and its bundled assets** on devices already carrying a compatible native binary. That boundary is the whole of the mechanism, and everything else follows from it.

An update **cannot** change: native dependencies, config-plugin output, permissions, entitlements, icons, the splash screen, identity keys, or the SDK. A change touching any of those needs a store release. Attempting to ship one over the air produces an update that installs and then crashes on the device it was meant to fix.

**Guidelines:**

- MUST verify that a change is bundle-only before shipping it as an update; anything native requires a new binary.
- MUST NOT ship an update that requires a native capability the target binaries do not already have.
- SHOULD treat an update as a release: it reaches users directly, so it gets the same verification a store build gets.
- SHOULD keep a rollback path — the previous update republished — rather than relying on a fix-forward that is itself unverified.

## Runtime Versions and Channels

Two mechanisms decide which devices receive which update, and confusing them is the usual cause of an update that goes nowhere or reaches the wrong build.

The **runtime version** describes the native binary's capabilities. An update is only delivered to a binary whose runtime version matches — this is the compatibility guard. Its policy determines when the value changes, and a policy that changes it too rarely delivers updates to binaries that cannot run them; too often, and no binary is ever eligible.

The **channel** describes an audience. A build subscribes to a channel, and an update is published to one. Channels route; runtime versions gate.

**Guidelines:**

- MUST set a runtime-version policy deliberately, and change it whenever the native binary's capabilities change.
- MUST publish an update to the channel the target builds subscribe to, and confirm the mapping rather than assuming it.
- MUST NOT publish to a production channel from a working branch; treat channel targeting with the care of a deployment target.
- SHOULD verify an update against a build from the same runtime version before publishing it to users.
- SHOULD keep the update's release tagging aligned with the error tracker's, so a report identifies the update rather than only the store version.

## Continuous Integration

The pipeline is the place where the checks that gate a release actually run. Whatever the adapter, the shape is the same: verification on every change, a build on the branches that produce artifacts, and publication as a separate deliberate step.

**Guidelines:**

- MUST run the app's format, lint, type-check, and test gates on every change, independent of the build.
- MUST keep publication — a store submission or an update push — a separate step from building, so an artifact can be built without being released.
- SHOULD supply pipeline secrets through the pipeline's own secret storage, never through committed files or prefixed variables.
