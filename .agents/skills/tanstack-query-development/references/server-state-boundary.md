# Server-State Boundary

Apply this reference when deciding whether a piece of state belongs to this layer at all — before writing a factory, when a store slice starts holding fetched data, or when reviewing a hook that fetches.

## What Counts as Server State

Server state is data another system owns. The client holds a copy, that copy goes stale without anyone touching it, and the same copy should serve every component that asks. Client state is the opposite on all three counts: the app owns it, it changes only when something changes it, and it usually belongs to one part of the tree.

| The state is                                                    | It belongs in                      |
| --------------------------------------------------------------- | ---------------------------------- |
| Fetched from a server, and the server can change it             | a query                            |
| A write sent to a server                                        | a mutation                         |
| Owned by the app, and shared across unrelated parts of the tree | the project's store library        |
| Owned by the app, and used by one component and its children    | component state                    |
| Derived from any of the above                                   | nothing — compute it during render |

The mistake worth naming: fetching into a store because the data is needed in two places. That buys sharing and pays for it with a hand-written cache — loading flags, staleness, refetching, and deduplication all reimplemented, usually incompletely.

**Guidelines:**

- MUST express data a server owns as a query, not as a store slice or component state populated by a fetch.
- MUST NOT copy a query result into component state or a store in order to modify it; derive what the view needs during render, or send a mutation.
- MUST NOT keep a second copy of a query's data anywhere; the cache entry is the copy.
- SHOULD leave genuinely app-owned state — a theme, a sidebar's open state, a draft form value — in the store or the component, since a query gives it nothing.
- SHOULD compute derived values during render rather than storing them, so they cannot go out of sync with what they derive from.

## A Hook Is Not Always a Query

A hook that runs an effect, subscribes to a platform event, or drives a timer is doing lifecycle orchestration. It stays a hook even when it reads a store, and even when it eventually causes a network call — what makes something a query is that its result is **cached under a key**, not that it is asynchronous.

**Examples:**

> A hook that hydrates a session from secure storage on launch and hides the splash screen once the status settles: lifecycle orchestration. It stays a hook.

> A hook that checks on a timer whether a token is near expiry and refreshes it: lifecycle orchestration, even though the refresh is a network call. Nothing reads its result from a cache.

> A function that reads the signed-in user's document list: a query. It has a cache identity, it goes stale, and two screens should share one request.

**Guidelines:**

- MUST keep a hook whose job is lifecycle or effect orchestration — timers, app-state listeners, splash gating, store hydration — as a hook, not a query.
- MUST express a cached read as a query factory and a server write as a mutation factory, even when a hook already exists that does something similar.
- SHOULD ask whether anything would read the result from the cache under a key; if nothing would, it is not a query.

## What Is Left in the Store

Once server state moves out, what remains in a global store is usually small: session identity, UI preferences, and cross-screen ephemeral state. That store is still the right place for it, and this layer does not replace it.

The one place the two touch is a factory reading the store — see [option-factories.md](./option-factories.md) for reading it without a hook, and [query-keys.md](./query-keys.md) for which of those values belong in the key.

**Guidelines:**

- MUST NOT treat this layer as a replacement for the project's store library; the two hold different kinds of state and coexist.
- SHOULD re-scope a store slice that exists only to cache fetched data into a query, rather than keeping both.
- MUST route a value the store owns into a query through the factory's input or a call-time read, never by duplicating it into the cache.

**Review checks:**

- Fetched data written into a store slice or component state that a query could hold — **Major**; it is a hand-written cache alongside a real one.
- A query result copied into `useState` so it can be edited — **Major**; the copy goes stale the moment the query refetches.
- A `useEffect` that fetches and stores the result, in a codebase that already has this layer — **Major**.
- A bespoke hook wrapping a fetch that nothing reads from the cache, flagged as a missing query — **not a finding**; lifecycle orchestration is allowed to be a hook.
