# Initialization and Projects

Apply this reference when writing or reviewing the `init` call, deciding how many Amplitude projects a system needs, or handling the API key. Initialization is the highest-leverage code in an Amplitude integration: several options cannot change afterwards, and the two most common production defects — a hardcoded key and an initialization that runs before the user's identity is known — both live here.

Verified against Amplitude's documentation on **2026-07-29**.

## The `init` Call

The Browser SDK accepts the key alone, the key with options, the key with a user id, or all three:

```typescript
amplitude.init(AMPLITUDE_API_KEY);
amplitude.init(AMPLITUDE_API_KEY, options);
amplitude.init(AMPLITUDE_API_KEY, "userID");
amplitude.init(AMPLITUDE_API_KEY, "userID", options);
```

The React Native SDK takes the same shape — `init(apiKey, userId?, options?)`.

Passing a user id positionally at init is only correct when the app already knows who the user is at that moment. On a web page that has not resolved its session yet, it is a guess, and Amplitude's own documentation warns against initializing before the page has its identity and its final URL — marketing attribution is read from the URL at init, so an init that runs before a redirect resolves attributes the visit to the wrong source.

**Guidelines:**

- MUST call `init` exactly once per client — a second call re-reads marketing attribution from whatever URL is current at that moment, so a re-init on navigation overwrites the acquisition source with an internal one.
- MUST NOT pass a user id at init unless the identity is already resolved at that point; call the identity API after login instead.
- SHOULD defer `init` on web until the page has its final URL and its identity, because attribution and the initial session are both derived at that moment.
- MUST treat the option set as fixed after `init` — several options cannot be changed on a live client, so a value that varies by environment is read at init or not at all.

## Where `init` Lives

| Platform     | Where the call belongs                                                                 |
| ------------ | -------------------------------------------------------------------------------------- |
| Web          | The application entry module, after consent resolves and the URL is final              |
| React Native | The entry module, before the first screen renders and before any `track` call can fire |
| Node         | Process startup, once per process, not per request                                     |

**Guidelines:**

- MUST initialize before the first `track` call can execute, since events emitted against an uninitialized client are queued against a device id that may be replaced.
- SHOULD keep the init module free of feature imports, so initialization order stays obvious and does not depend on which screen loaded first.

## The API Key

An Amplitude client-side API key is **public by design** — it ships in the app bundle and anyone can read it. That does not make a hardcoded literal acceptable. A key in source cannot vary between development, staging, and production, and cannot be rotated without a release.

> **Found in `axross/oraculo`** (`src/core/event-tracking.ts`): the API key is read from configuration _with a literal as a fallback_. Tracking never appears broken, so nothing signals that development traffic is landing in the production project. Filed as `axross/oraculo#31`.

> **Found in `axross/porousel`**: the key is nullable and a missing key silently disables the tracker. The opposite failure — no data at all, discovered weeks later.

Amplitude also issues credentials that are **not** public: the secret key, and the Data/Ampli tokens. Those authenticate management and export APIs and must never reach a client bundle or a public environment prefix.

**Guidelines:**

- MUST read the API key from configuration or the environment, and MUST NOT commit a key literal as a value or as a fallback.
- MUST keep the secret key and any Data or Ampli token server-side, and MUST NOT place either behind a public environment prefix such as `NEXT_PUBLIC_` or `EXPO_PUBLIC_`.
- MUST make a missing key disable tracking without failing launch, and surface that disabled state loudly in development so it cannot go unnoticed.
- SHOULD fail the build or the startup check when a key is missing in a production build, since silence is the failure mode that survives to release.

## Projects and Environments

An Amplitude **project** is the unit of data isolation: its own API key, its own taxonomy, its own MTU count. The question every integration answers, explicitly or by accident, is whether development and production share one.

| Approach                          | What it buys                                 | What it costs                                                       |
| --------------------------------- | -------------------------------------------- | ------------------------------------------------------------------- |
| One project per environment       | Production charts never contain test traffic | Taxonomy changes must be published to each project                  |
| One project, environment property | One taxonomy to maintain                     | Every chart must filter, and one forgotten filter corrupts a number |

One project per environment is the safer default, and it is what a hardcoded key makes impossible.

**Guidelines:**

- SHOULD use a separate Amplitude project per environment, so a test run cannot move a production metric.
- MUST, when one project serves several environments, set an environment property on every event and state in the tracking plan that charts filter on it.
- MUST NOT rely on a hardcoded environment value — a literal `"production"` set at init reports production from a developer's laptop.

## Data Residency and Topology

`serverZone` selects `US` or `EU` ingestion, defaulting to `US`. Residency is fixed when the Amplitude organization is created; the SDK option routes to the matching endpoint rather than choosing where data lives.

Beyond one project, Amplitude offers cross-platform instrumentation (one project receiving web and mobile), organization-level identity resolution across projects, and Portfolio for viewing across them. Which to reach for is a product-analytics topology decision, not an SDK one.

**Guidelines:**

- MUST set `serverZone` to match the organization's residency, since a mismatch sends data to an endpoint the project does not exist in.
- SHOULD instrument web and mobile into one project when the same user crosses both, so a cross-platform funnel is answerable without stitching two projects together.
- MUST confirm the residency and the project's identity-resolution configuration with whoever owns the Amplitude organization rather than inferring either from the SDK options alone.
