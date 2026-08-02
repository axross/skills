# Events and Properties

Apply this reference when emitting an event, attaching properties, updating a user profile, or tuning how events reach Amplitude. What to track, how to name it, and where the call site goes belong to the product-event-tracking guidance in a software-instrumentation capability; this reference owns the Amplitude mechanism underneath — the operators, the ceilings, and the batching behaviour.

Verified against [Amplitude's HTTP V2 API documentation](https://amplitude.com/docs/apis/analytics/http-v2) on **2026-08-02**.

## Tracking an Event

```typescript
amplitude.track("Checkout Completed", { orderTotal: 42.5, currency: "USD" });
```

Every SDK's `track` compiles down to the HTTP V2 event shape, so the transport's constraints are the SDK's constraints. A property that exceeds a limit is truncated at ingestion, not rejected — the event still lands, quietly wrong.

**Guidelines:**

- MUST keep property values within **1,024 characters**; Amplitude truncates beyond that rather than erroring, so an over-long value is lost silently.
- MUST NOT rely on an event failing loudly when it violates a limit; verify the shape at the wrapper instead of trusting an ingestion error that will not come.
- SHOULD keep an event's property count near the documented guidance of roughly twenty; a payload far past that is usually several events wearing one name.

## The Project Ceilings

A project caps event types, event properties, and user properties, at the figures in [Amplitude's limits documentation](https://amplitude.com/docs/faq/limits-and-quotas). What that page does not say is what crossing one costs: past each ceiling **Amplitude stops indexing new values** — the data still arrives, it just becomes unreachable from ordinary queries, so the failure looks like missing data rather than like a quota error.

A second, lower ceiling bites first: only the first **1,000 values** of a given property appear in dropdown menus, which is what makes a high-cardinality property feel broken in the UI long before the project is anywhere near its limit.

**Guidelines:**

- MUST NOT put an unbounded value in an event _name_ — a name templated with an id or a screen title consumes the 2,000-type ceiling and cannot be reclaimed.
- SHOULD move a high-cardinality attribute into a property value rather than a property key, since keys count against the 2,000-property ceiling and values do not.
- MUST treat approaching any ceiling as an instrumentation defect to fix at the source, because deleting a type does not restore indexing for the values already dropped.

## Event Properties Versus User Properties

An event property describes one occurrence. A user property describes the person, and applies to every one of their future events. Choosing wrong is not cosmetic: a user property overwrites, so recording a per-event value there destroys the history.

Amplitude exposes a set of `Identify` operators, catalogued in the [user-properties documentation](https://amplitude.com/docs/get-started/identify-users). Which one to reach for is the decision, and that is the column upstream does not have:

| Operator                   | Use for                                                         |
| -------------------------- | --------------------------------------------------------------- |
| `set`                      | The current value of an attribute — plan, locale, role          |
| `setOnce`                  | A value that must never change — first-seen date, signup source |
| `add`                      | A running numeric total                                         |
| `append` / `prepend`       | Adding to a list                                                |
| `preInsert` / `postInsert` | Adding to a list only if absent                                 |
| `remove`                   | Removing from a list                                            |
| `unset`                    | Clearing an attribute                                           |

**Guidelines:**

- MUST use `setOnce` for any attribute that describes an origin — acquisition source, first plan, signup date — because `set` overwrites it on every later call and the original is unrecoverable.
- MUST NOT record a per-event value as a user property; it overwrites the profile and makes the previous value unqueryable.
- SHOULD keep user-property arrays within the **10,000-character** allowance that `append`/`prepend` operate under.
- MUST NOT exceed roughly **1,800 user-property updates per hour** for one user — Amplitude rate-limits past that, and a per-event `identify` call reaches it on any active user.
- MUST NOT hardcode an environment or build-constant value as a user property; it describes the build, not the person.

> **Found in `axross/aqua`**: `setUserProperties({"Environment": "production"})` is hardcoded, so every user reports production regardless of where the event came from.

## Groups and Revenue

`setGroup` associates a user with an account, workspace, or team; event-level `groups` scopes one event; `groupIdentify` sets properties on the group itself rather than on its members. Revenue has its own object, and `revenueType` is what makes a refund distinguishable from a purchase at query time.

**Guidelines:**

- MUST use the `Revenue` object rather than a plain numeric property when recording money, because revenue charts read the dedicated fields and ignore an ordinary property.
- MUST set `revenueType` on every revenue event, since a refund and a purchase are otherwise indistinguishable in a revenue total.
- SHOULD use `groupIdentify` for attributes of the account and `identify` for attributes of the person; putting an account attribute on every member makes it impossible to count accounts.

## Delivery, Batching, and Dedup

Events queue and flush rather than sending one request each, under `flushQueueSize`, `flushIntervalMillis`, `flushMaxRetries`, and `useBatch` — each with its default in the [Browser SDK 2 reference](https://amplitude.com/docs/sdks/analytics/browser/browser-sdk-2).

`insert_id` is the deduplication contract: Amplitude ignores a subsequent event carrying the same `insert_id` on the same `device_id` within a **seven-day** window. That is what makes a retry safe.

**Guidelines:**

- MUST set a stable `insert_id` on any event a producer may retry, so a retry deduplicates instead of double-counting; without one, at-least-once delivery becomes at-least-once _counting_.
- MUST call `flush()` before a context that is about to disappear — a page unload, a process exit, a serverless invocation ending — or the queued events are lost.
- SHOULD leave the flush defaults alone on a client; raising `flushQueueSize` trades a smaller request count for a larger loss window when the app closes.
- SHOULD enable `useBatch` only for high-throughput server-side producers, and size batches against the transport limits rather than the SDK defaults.
- MUST NOT assume offline events are lost — the mobile SDKs queue them — but MUST NOT assume they are kept forever either; verify the installed SDK's offline behaviour before relying on it.

## What Amplitude Sets for You

Amplitude attaches platform, language, IP-derived location, and other context automatically. `trackingOptions` turns individual pieces off — `ipAddress`, `language`, and `platform` all default to `true`.

**Guidelines:**

- MUST disable IP collection through `trackingOptions.ipAddress` when the project's privacy posture forbids IP-derived location, rather than attempting to strip it downstream.
- SHOULD NOT re-send a property Amplitude already sets; a hand-set duplicate drifts from the automatic one and the two disagree in charts.
