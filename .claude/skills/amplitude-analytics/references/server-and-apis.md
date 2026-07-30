# Server and APIs

Apply this reference when sending events from a backend, building a producer against Amplitude's HTTP endpoints, or choosing which Amplitude API a task needs. Server-side ingestion has different failure modes from client-side: identity is not ambient, retries are real, and a loop can exceed a rate limit in seconds.

Verified against Amplitude's documentation on **2026-07-29**.

## Server-Side Identity

The Node SDK is a family member with a prescribed lookup, like the other non-first-class SDKs — but one rule is universal and worth stating here, because getting it wrong corrupts every server-sent event.

On a client, the SDK holds the current user. On a server, it does not: one process serves every user. Identity must be passed **per call**, from the authenticated request.

**Guidelines:**

- MUST pass the user id explicitly on every server-side event, resolved from the request being handled.
- MUST NOT call a server SDK's global identity setter in a request handler — it is process-wide, and it attributes concurrent requests to whichever user set it last.
- MUST initialize a server client once per process, not per request.
- SHOULD send a device id alongside the user id only when the server genuinely knows the originating device; inventing one fragments the user's identity.

## Choosing an Ingestion Endpoint

| Endpoint               | Shape                                    |
| ---------------------- | ---------------------------------------- |
| **HTTP V2**            | The general-purpose ingestion endpoint   |
| **Batch Event Upload** | Higher throughput, for bulk and backfill |

Regional endpoints: `https://api2.amplitude.com` (US) and `https://api.eu.amplitude.com` (EU).

**Guidelines:**

- MUST send to the endpoint matching the organization's data residency; the wrong region is a project that does not exist rather than a redirect.
- SHOULD use the Batch endpoint for backfills and bulk producers, and HTTP V2 for ordinary per-request emission.

## The Limits That Shape a Producer

| Limit                               | Value                           |
| ----------------------------------- | ------------------------------- |
| Maximum request size                | Under **1 MB**                  |
| Maximum events per request          | Fewer than **2,000**            |
| String character limit              | **1,024** characters            |
| Project throughput, HTTP API and V2 | **50,000** events/second        |
| SDK endpoint throughput             | up to **150,000** events/second |
| User-property updates for one user  | **1,800** per hour              |

On the Free plan: 1,000 events/second, a recommended maximum of 10 events per batch, and 100 batches/second.

An oversized request returns **413**; an invalid time format or a problematic id returns **400**.

**Guidelines:**

- MUST size batches against the 1 MB and 2,000-event ceilings rather than against a round number, since exceeding either returns 413 and loses the whole request.
- MUST handle 413 by splitting the batch rather than retrying it unchanged, because an unchanged retry fails identically.
- MUST NOT emit a per-event `identify` for an active user; the 1,800-per-hour ceiling is reached quickly and the excess is rate-limited away.
- SHOULD partition a high-throughput producer by device id or user id, so one user's events stay ordered and the load spreads.

## Retries and `insert_id`

`insert_id` is the deduplication contract, and a **seven-day** window applies per app for the same `device_id`. Without it, at-least-once delivery becomes at-least-once counting.

```typescript
// Deterministic from the fact, not random — a retry must reproduce it.
const insertId = `order-completed:${orderId}`;
```

**Guidelines:**

- MUST set a deterministic `insert_id` derived from the fact being recorded, never a fresh random value, or a retry produces a second event.
- MUST NOT retry past the seven-day dedup window and expect deduplication; beyond it the same `insert_id` is a new event.
- SHOULD retry with backoff on transient failures and MUST NOT retry a 400, which will fail identically every time.

## Client-Side Versus Server-Side

Server-side emission is more reliable — no ad blockers, no browser storage, no lost events on tab close — and it knows less. It cannot see the UI, has no ambient device context, and lacks whatever the client knows about the interaction.

**Guidelines:**

- SHOULD emit business-critical facts — payments, subscription changes, provisioning — server-side, where an ad blocker cannot suppress them.
- SHOULD emit interaction facts client-side, where the context that makes them meaningful exists.
- MUST NOT emit the same fact from both without an `insert_id` that makes them the same event, or every such fact is double-counted.

## The Other APIs

Beyond ingestion, Amplitude exposes management and export APIs — Attribution, Export, Taxonomy, Behavioral Cohorts, and User Privacy among them. They do not all take the same credential: ingestion uses the project API key, while management and export endpoints require the secret key or a dedicated token.

**Guidelines:**

- MUST check which credential an endpoint requires before wiring it, since the project API key authenticates ingestion and not management.
- MUST keep secret keys and management tokens server-side, and MUST NOT expose either through a public environment prefix.
- SHOULD use the Taxonomy API to inspect or enforce the tracking plan programmatically rather than scraping the UI.
