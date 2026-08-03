# Data Repair

Apply this reference when instrumentation has already shipped wrong and the question is what can be fixed after the fact. The short answer sets expectations for everything else: **ingested event data is immutable**, and Amplitude's repair tools change how data is _read_, not what was stored.

Verified against [Amplitude's transformations documentation](https://amplitude.com/docs/data/transformations) on **2026-08-02**.

## Transformations Are Query-Time

Amplitude's [transformations](https://amplitude.com/docs/data/transformations) — merging events, merging properties, renaming property values, hiding property values — apply when a chart or a cohort computes its result. The raw data is untouched, which is why they are reversible, and why they do not reach a warehouse export.

Three constraints, all verified:

- They can only be created on the project's **`main` branch**, with the _Show transformations_ toggle on.
- They **cannot transform Amplitude's default user properties**.
- They are **query-time only** — results in Snowflake or Redshift are unaffected.

> _"Transformations aren't permanent. You can reverse them, and you can edit or delete them at any time."_

**Guidelines:**

- MUST NOT expect a transformation to change data already exported to a warehouse; downstream consumers see the raw values.
- MUST NOT plan to transform an Amplitude default user property; it is not permitted.
- SHOULD use a transformation to make existing history queryable under the corrected name, and fix the emitter in the same change so the correction stops being needed.

> **Found in `axross/aqua`**: a shipped typo in a property value — `Communty Cards` — and property keys drifting within a single file between `Rank Pair` and `RankPair`. Both are precisely what rename and merge exist for, and both would have been prevented by a schema.

## Hiding Is Not Removing

Four operations get conflated, and they differ in what they cost and what they destroy. Amplitude documents each in its own place — [transformations](https://amplitude.com/docs/data/transformations) for hiding, the [User Privacy API](https://amplitude.com/docs/apis/analytics/user-privacy) for deletion — and nowhere sets them side by side:

| Operation  | Effect                                                                                |
| ---------- | ------------------------------------------------------------------------------------- |
| **Hide**   | Removes a value from the UI; raw data is preserved, and it still counts toward volume |
| **Block**  | Stops the event from being ingested going forward; it stops counting                  |
| **Delete** | Removes stored data                                                                   |
| **Drop**   | Discards the event client-side, before it is ever sent                                |

**Guidelines:**

- MUST NOT use hiding to satisfy a privacy or cost requirement; hidden data is still stored and still counted.
- MUST use a client-side drop — an enrichment plugin returning `null` — when data must never reach Amplitude at all, since every server-side control acts on data already received.
- MUST use the User Privacy API for a deletion obligation rather than blocking or hiding.
- SHOULD look up the current behaviour of blocking and deletion before relying on either, particularly whether an operation is reversible and what it does to historical charts.

## Other Repair Surfaces

Amplitude offers further constructs for reshaping data at query time — among them custom events, derived properties, persisted properties, lookup tables, and channel classifiers — and streaming transformations for reshaping in flight. Their exact capabilities and constraints vary by plan and move between releases.

**Guidelines:**

- MUST verify a repair construct is available on the project's plan before designing a fix around it, since availability is plan-dependent.
- SHOULD prefer a construct that leaves raw data intact over one that mutates in flight, so a mistake in the repair is itself repairable.

## The Standing Rule

Every tool here is a stopgap. A transformation makes a chart correct while the emitter stays wrong, which means the wrongness keeps accruing and every new consumer of the raw data inherits it.

> A transformation buys time to fix the instrumentation. It is not a substitute for fixing it, and a transformation that has outlived several releases is a defect nobody closed.

**Guidelines:**

- MUST fix the emitting code as part of any repair, and MUST NOT treat a transformation as the fix.
- SHOULD record why each transformation exists and what would let it be removed, so it does not become permanent by default.
- MUST NOT let a repair hide a systemic instrumentation problem — repeated renames of the same property mean the schema is missing, not that the values keep being unlucky.
