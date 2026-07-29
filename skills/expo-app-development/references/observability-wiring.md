# Observability Wiring

Apply this reference when installing or configuring an error tracker in an Expo app, or when reported errors arrive without source context, without a release, or not at all.

This reference covers the **Expo wiring** only — the plugin, the bundler wrapper, the root wrap, and the build-time upload. What to log, at which level, where to catch, what an error's context may carry, and when to report versus rethrow belong to a software instrumentation capability, which owns them. Roles are named generically here ("the error tracker", "the analytics tool") because the wiring is the same shape whichever vendor fills them; for the concrete package names, options, and integrations of whichever tracker is installed, consult that vendor's own instrumentation capability.

## The Plugin and the Bundler Wrapper

An error tracker for an Expo app has two integration points beyond installing its package, and skipping either produces a tracker that appears to work while being much less useful.

Its **config plugin** performs the native-side setup and, at build time, uploads the debug symbols and source maps that turn a stack trace into file-and-line. Its **bundler wrapper** wraps the Metro configuration so the source maps the upload needs are produced in the first place.

The failure mode is characteristic: errors arrive, but every frame is minified with no source context, and nobody notices until an incident.

The wrapper replaces the default Metro config factory rather than sitting beside it, so project customization layers on top of what the wrapper returns. Keeping the default factory and adding the tracker's plugin separately is the common mistake, and it produces exactly that failure.

**Guidelines:**

- MUST add the error tracker's config plugin to the app config, not only its package to the manifest.
- MUST wrap the bundler configuration with the tracker's wrapper where it provides one, so source maps are generated.
- SHOULD verify after wiring that a deliberately thrown error arrives with resolved file-and-line, rather than assuming the integration is complete.
- MUST re-run prebuild after adding the plugin; the native side is not configured until then.

## Initialization and the Root Wrap

Initialize the tracker in the entry module, so failures during startup are captured rather than lost — startup is exactly when unrecoverable failures happen and exactly when nothing else is listening.

Be precise about what that placement buys. It runs before the app's own modules evaluate and well before the first render, which is the window that matters. It does **not** run before the router: the entry module imports the router's entry, and ES module imports are hoisted and evaluated before any statement in the importing module's body, so the router evaluates first regardless of where the initialization call sits in the file. Capturing failures inside the router's own module evaluation needs a separate side-effect module imported ahead of it.

Wrapping the root component additionally installs the tracker's own instrumentation: an error boundary above the app's tree, plus whatever navigation and interaction context the tracker attaches to reports.

**Guidelines:**

- MUST initialize the error tracker in the entry module, before the app's own modules evaluate and before any component renders.
- MUST NOT claim entry-module initialization precedes the router entry; import hoisting means it does not.
- MUST wrap the root component with the tracker's root wrapper, and export the wrapped component as the root layout's default.
- MUST leave the app functional when the tracker is not configured — a missing key disables reporting rather than failing the launch.
- MUST keep the app's own top-level error boundary regardless — a software instrumentation capability owns that rule, and the tracker's wrapper reports an error rather than presenting a usable screen.

## Release and Environment Tagging

A report is only actionable if it says which build produced it. The app version identifies the release, and where an app ships over-the-air updates, the update's own identity matters more than the store version — two devices on the same store version can be running different JavaScript.

Tag the environment too, so development and preview noise does not mix with production signal.

**Guidelines:**

- MUST tag reports with a release derived from the app's version, and with the update identity where the app ships over-the-air updates.
- MUST tag reports with an environment that distinguishes development, preview, and production.
- SHOULD pass a build identifier — a commit hash resolved at config time — so a report maps to source without a lookup.

## Tokens Stay at Build Time

The plugin's upload of symbols and source maps authenticates with a token that belongs to the **build**, not to the app. It is supplied through the build pipeline's secret storage and read by the plugin during the build; it must never be given the public environment prefix, which would inline it into the shipped bundle.

The tracker's own ingest key is a different thing — designed to be public, shipped in the app, and safe to prefix.

**Guidelines:**

- MUST supply the upload token through the build pipeline's secret storage, never through a prefixed environment variable.
- MUST NOT commit an upload token, including in an example environment file.
- SHOULD confirm from the tracker's documentation which of its keys are public before prefixing one.

## Development Gating

Reporting from development builds fills the tracker with errors nobody will action and consumes quota. Disable sending in development rather than removing the wiring, so the integration stays exercised and can be turned on deliberately when testing it.

**Guidelines:**

- MUST disable sending from development builds while leaving the wiring in place.
- SHOULD make the gate a single flag that can be flipped locally to test the integration.
- MUST NOT gate by deleting the initialization call, which leaves the app running an untested code path in production.
