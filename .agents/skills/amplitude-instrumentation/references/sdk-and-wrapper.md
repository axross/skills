# SDK and Wrapper

Apply this reference when choosing an Amplitude package, upgrading one, or deciding what your own code puts in front of it. The choice is load-bearing in a way most SDK choices are not: the package determines which Amplitude products you can reach without a second install, and the wrapper determines whether a naming mistake is a one-line fix or a migration.

Everything here was verified against Amplitude's documentation and the npm and pub.dev registries on **2026-07-29**. Amplitude renames configuration surfaces between minors, so treat a concrete option name as _verified at that date_ rather than permanent, and look it up in the installed version's own documentation before relying on it.

## Choosing the Package

Amplitude ships one package per platform plus a bundle. The bundle exists because Session Replay and Experiment are separate products with separate SDKs, and wiring all three by hand is where most projects get their version skew.

| Package                             | Platform     | Reach                                                       |
| ----------------------------------- | ------------ | ----------------------------------------------------------- |
| `@amplitude/analytics-browser`      | Web          | Analytics only                                              |
| `@amplitude/unified`                | Web          | Analytics plus Experiment and Session Replay in one install |
| `@amplitude/analytics-react-native` | React Native | Analytics only; no autocapture                              |
| `@amplitude/analytics-node`         | Node         | Server-side analytics                                       |
| Script loader (`<script>` snippet)  | Web          | Analytics, with autocapture enabled by the installer        |

The iOS (Swift), Android (Kotlin), Flutter, Unity, and Unreal SDKs are real and supported, but they are not first-class here. Treat each as a **family with a prescribed lookup**: the concepts in this skill — identity, sessions, the `Identify` operator set, group and revenue calls, consent gating — carry across all of them, while the method names and option keys do not. Read the installed SDK's own reference page for the exact surface rather than transliterating a web snippet.

**Guidelines:**

- MUST choose one Amplitude analytics package per application and let exactly one module import it; a second import path is how two clients with two device ids end up in one app.
- SHOULD prefer `@amplitude/unified` on web when the project uses Session Replay or Experiment alongside analytics, because it removes the version-skew between three separately-installed SDKs.
- MUST NOT transliterate a Browser SDK snippet into an iOS, Android, or Flutter codebase; look the method up in that SDK's own reference, since only the concepts carry across and the names do not.
- SHOULD check the installed version against the registry when picking up an existing project, and state the version any rule was verified against when writing one down.
- MUST NOT let a maintenance-line SDK go unnoticed: an SDK two majors behind is not merely old, it is missing the identity and consent surfaces the current rules assume.

## One Client Per App

Amplitude's default client is a module-level singleton named `$default_instance`. Creating a second named instance with `instanceName` is a real feature, and almost always the wrong reach — two instances mean two device ids, two session clocks, and two sets of cookies for one user.

> A legitimate second instance: sending a narrow, separately-governed event stream to a different Amplitude project — a compliance audit trail, or a white-labelled tenant's own project.

> Not a reason for a second instance: wanting different default properties on some events. That is one client and a property on the event.

**Guidelines:**

- MUST use the default client unless a second Amplitude _project_ genuinely needs its own stream, and name the second one explicitly with `instanceName` when it does.
- MUST NOT create a second instance to vary default properties, event naming, or sampling; those are properties and call-site decisions on one client.
- SHOULD document, next to the second `init` call, which project it targets and why a single client could not serve the case.

## What the Wrapper Owns

Every inspected repository put a hand-written module in front of the SDK, and each one used it to normalise something. That is the right instinct: the wrapper is the only place a naming rule can be enforced mechanically, and the only place a vendor swap stays cheap.

The tool-agnostic rules for that module — the one-module SDK boundary, the typed event schema, event naming, property discipline, and where the call site goes — belong to the product-event-tracking guidance in a software-instrumentation capability. This skill owns what is Amplitude-specific about it.

```typescript
// The one module that imports the Amplitude SDK.
import * as amplitude from "@amplitude/analytics-browser";

// A typed schema, so a rename is a compile error rather than a silent chart break.
type Event =
  | { name: "Preset Loaded"; properties: { count: number } }
  | { name: "Checkout Completed"; properties: { orderTotal: number } };

export function track<E extends Event>(event: E) {
  if (!enabled) return; // no key configured — inert, not crashing
  amplitude.track(event.name, event.properties);
}
```

**Guidelines:**

- MUST normalise event names and property keys inside the wrapper rather than at each call site, so one casing rule holds across the codebase instead of drifting per file.
- MUST NOT let the wrapper's own diagnostics reach production output — a `console.log` inside the track function ships to every user's console and leaks the payload.
- SHOULD keep the wrapper's signature typed against a closed event schema, so adding an event is a deliberate edit and renaming one is a compile error.
- MUST keep the wrapper inert rather than throwing when no API key is configured, and make that state visible in development instead of silently disabling tracking.
- SHOULD send to one vendor per wrapper; a dual-sink wrapper that normalises names differently per vendor produces two taxonomies that cannot be reconciled later.

## Renamed and Moving Surfaces

Two renames are worth knowing because both appear in live projects and neither fails loudly — the old key is simply ignored. The current names live in the [Browser SDK 2 reference](https://amplitude.com/docs/sdks/analytics/browser/browser-sdk-2); what that page does not carry is a deprecation record, which is why this one exists.

| Old surface         | Current surface                  | Verified                                           |
| ------------------- | -------------------------------- | -------------------------------------------------- |
| `defaultTracking`   | `autocapture`                    | Replaced as of Browser SDK **2.10.0**, 2026-08-02  |
| `fetchRemoteConfig` | `remoteConfig.fetchRemoteConfig` | Browser SDK 2, 2026-07-29 — **unconfirmed**, below |

The second row did not re-verify on 2026-08-02: the Browser SDK 2 reference still shows `fetchRemoteConfig` as a top-level `init` option in its own quickstart snippet, alongside a separate `remoteConfig` object documented for proxying. Whether the top-level key is deprecated, aliased, or current is not decidable from that page, so treat the row as a prompt to check the installed version rather than as a settled rename.

**Guidelines:**

- MUST treat a silently-ignored configuration key as the expected failure mode of an Amplitude rename, and verify an option still exists in the installed version rather than assuming a wrong key would error.
- SHOULD grep for `defaultTracking` when picking up a web project on Browser SDK 2, since it still parses as an unknown key and quietly leaves autocapture at its defaults.
- MUST look up per-feature minimum versions before enabling a feature — autocapture, remote configuration, and session replay each landed in a specific minor, and enabling one below its floor is a no-op rather than an error.
