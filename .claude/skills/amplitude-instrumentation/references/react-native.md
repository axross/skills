# React Native

Apply this reference when wiring Amplitude into a React Native or Expo app. Two of the three inspected repositories are React Native apps, and between them they demonstrate most of what this file warns about. The platform differs from web in ways that are easy to miss precisely because the JavaScript API looks identical.

Verified against Amplitude's documentation on **2026-07-29**, for `@amplitude/analytics-react-native`.

## AsyncStorage Backs Both Storage Slots

The SDK depends on `@react-native-async-storage/async-storage`, and it uses it for **two** distinct things:

| Slot              | What it holds                                               |
| ----------------- | ----------------------------------------------------------- |
| `storageProvider` | The event queue — events awaiting flush                     |
| `cookieStorage`   | Identity and session state — device id, user id, session id |

Both are overridable. Overriding only one is the trap: replace `storageProvider` with an in-memory implementation and the queue stops surviving a restart; replace `cookieStorage` and **the device id regenerates on every launch**, so every app open is a new user.

**Guidelines:**

- MUST override both storage slots or neither; replacing one leaves either the queue or the identity unpersisted, and the identity case silently multiplies the user count.
- MUST verify that identity survives an app restart when a custom storage implementation is in place, since a fresh device id per launch looks like growth rather than a defect.

## Declaring AsyncStorage

AsyncStorage belongs in `dependencies`, not `devDependencies`. It is a runtime requirement of the SDK.

The honest caveat: React Native CLI autolinking scans **both** `dependencies` and `devDependencies`, so the wrong placement usually still links the native module and usually still works. That is what makes it a slow-burning defect rather than an outage — it is one `--omit=dev` install or one bundler-pruning change away from silent in-memory identity.

> **Found in `axross/porousel`**: `@react-native-async-storage/async-storage` is declared in `devDependencies`. Very likely working today in a normal EAS build; filed as `axross/porousel#4` as a correctness problem rather than a live outage.

**Guidelines:**

- MUST declare `@react-native-async-storage/async-storage` in `dependencies` when the app uses the Amplitude React Native SDK.
- SHOULD treat a `devDependencies` placement as a defect to fix even when the app currently works, because the failure it enables is silent and retroactive.
- MAY opt a native module out of autolinking through `react-native.config.js`, and MUST confirm the SDK still has a persistence backing when doing so.

## No Autocapture

The React Native SDK does not autocapture. No screen views, no sessions, no element interactions, no page views — every event is hand-written.

**Guidelines:**

- MUST instrument screen views explicitly in a React Native app; no navigation integration emits them for you.
- MUST NOT port a web instrumentation plan to React Native unchanged, since the web plan assumes autocaptured events that will never arrive.

## Session Events Default Off

`trackingSessionEvents` defaults to **`false`** on React Native, where the Browser SDK's autocapture `sessions` option defaults to **on**. One project fed by both platforms therefore gets session events from web and not from mobile unless someone notices.

**Guidelines:**

- MUST set `trackingSessionEvents` deliberately rather than inheriting it, and record the choice where the cross-platform taxonomy is documented.
- SHOULD align the session-event decision across platforms reporting into one project, or state in the tracking plan that session metrics are web-only.

## Over-the-Air Updates and Native Code

An over-the-air update ships JavaScript. If a version of the Amplitude SDK changed native code, a JS-only update **cannot** carry it — the JavaScript expects a native module the installed binary does not have.

Amplitude's own release history includes native changes at versions **1.3.0** and **1.6.0 and above**, which is exactly the range live projects are upgrading through.

**Guidelines:**

- MUST NOT ship an Amplitude SDK version bump over the air when that release changed native code; it needs a new native build.
- MUST check a release's native-change status before bumping the SDK in a project that relies on OTA updates.
- SHOULD pin the SDK version and bump it as a deliberate, natively-rebuilt change rather than through a floating range that an OTA update might pick up.

## Expo and Compatibility

Expo is supported, including Expo projects built for web. **Expo Go is not supported** — the SDK needs a development or production build.

Amplitude's stated support policy is narrow: _"Amplitude supports only the latest version of React-Native."_ Concretely, at the verification date, `@amplitude/analytics-react-native >= 1.4.0` requires React Native `>= 0.68`, and versions `1.0.0`–`1.3.6` require React Native `>= 0.61, <= 0.70`. The minimum iOS deployment target is **13.0**.

**Guidelines:**

- MUST NOT expect Amplitude to work under Expo Go; use a development build.
- MUST check the SDK's compatibility matrix against the project's React Native version before upgrading either, since the support policy covers only the latest React Native.
- SHOULD treat `migrateLegacyData` — default `true` — as relevant only when migrating from a maintenance-line SDK, and turn it off once the migration is complete.

## Configuration Defaults Worth Knowing

| Option                  | Default                     |
| ----------------------- | --------------------------- |
| `trackingSessionEvents` | `false`                     |
| `migrateLegacyData`     | `true`                      |
| `sessionTimeout`        | 1,800,000 ms                |
| `minIdLength`           | `5`                         |
| `flushQueueSize`        | 30 events                   |
| `flushIntervalMillis`   | 1,000 ms                    |
| `flushMaxRetries`       | 5                           |
| `offline`               | `false` (detection enabled) |
| `logLevel`              | `LogLevel.Warn`             |

**Guidelines:**

- SHOULD raise `logLevel` to a debug level only in development builds, and MUST NOT leave verbose SDK logging on in a release build.
