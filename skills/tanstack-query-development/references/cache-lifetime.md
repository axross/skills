# Cache Lifetime

Apply this reference when choosing how long data stays fresh, deciding what triggers a refetch, setting up polling, or reviewing a query that refetches too often or never.

## The Defaults That Surprise

The out-of-the-box configuration is deliberately aggressive. Knowing it is what makes a deviation a decision rather than an accident.

| Default                | Value                                      |
| ---------------------- | ------------------------------------------ |
| `staleTime`            | `0` — data is stale the moment it arrives  |
| `gcTime`               | 5 minutes after the last observer unmounts |
| `retry`                | 3, with exponential backoff                |
| `refetchOnMount`       | `true` when stale                          |
| `refetchOnWindowFocus` | `true` when stale                          |
| `refetchOnReconnect`   | `true` when stale                          |
| `structuralSharing`    | `true`                                     |
| mutation `retry`       | `0`                                        |

`staleTime: 0` is the one that surprises: every new observer of a key triggers a background refetch. That is correct for volatile data and wasteful for anything that changes on a human timescale.

**Structural sharing** keeps references stable across refetches when the data has not actually changed, which is what stops a background refetch from re-rendering everything downstream. It works on JSON-compatible values only — a response containing a `Date`, `Map`, or class instance is always treated as changed.

**Guidelines:**

- MUST treat `staleTime: 0` as a deliberate choice rather than a default to inherit silently; most data has a defensible freshness window.
- SHOULD set the project-wide defaults once on the client and override per query only where that query genuinely differs — see [query-client.md](./query-client.md).
- MUST NOT lower the retry count or disable retries globally to make tests pass; configure the test client instead — see [testing.md](./testing.md).
- SHOULD be aware that a response carrying non-JSON values defeats structural sharing, and normalize at the data-layer boundary where that causes re-render churn.

## Choosing a Staleness Window

`staleTime` is how long data is considered fresh. While fresh, none of the automatic triggers refetch it.

Two values stop staleness-driven refetching entirely, and they are not interchangeable:

- **`Infinity`** — never goes stale on its own, but `invalidateQueries` still works.
- **`'static'`** — never refetches at all. Invalidation has no effect, and `refetchOnMount`/`refetchOnWindowFocus`/`refetchOnReconnect` set to `"always"` are ignored.

`'static'` suits data that cannot change while the process runs: feature flags read at boot, permissions loaded at sign-in, a static reference table. Anything a write can affect needs `Infinity` at most, or invalidation silently stops working.

**Guidelines:**

- MUST choose `staleTime` from how quickly the data actually changes and how costly a stale render is, not by copying a neighbouring query.
- MUST NOT use `'static'` for anything a mutation can invalidate; invalidation is a no-op against it and the staleness is unrecoverable.
- SHOULD reserve `'static'` for values fixed for the lifetime of the process, and use `Infinity` where manual invalidation must still work.
- SHOULD keep `gcTime` at or above `staleTime`; an entry collected sooner than it goes stale can never be served fresh from cache.

## Refetch Triggers

Three triggers refetch a **stale** query automatically: a new observer mounting, the window regaining focus, and the network reconnecting. Each can be turned off per query or globally, and each accepts `"always"` to fire regardless of staleness.

On React Native, focus and reconnect do nothing until the corresponding managers are wired — the options are present and silently inert. See [react-native.md](./react-native.md).

**Guidelines:**

- SHOULD prefer raising `staleTime` over disabling the refetch triggers; the triggers are what keep data current, and staleness is the tuning knob.
- MUST NOT disable a trigger globally to fix one noisy query; set it on that query.
- MUST wire the focus and online managers on React Native before relying on focus or reconnect refetching.

## Polling

`refetchInterval` refetches on a timer while at least one observer is active, independently of `staleTime` — a fresh query still polls.

The function form computes the interval from the current query, which is how a poll stops when the thing it is watching finishes:

```ts
refetchInterval: (query) =>
  query.state.data?.status === "complete" ? false : 2_000,
```

Returning `false` clears the timer; returning a number again resumes it. By default polling pauses when the window loses focus — `refetchIntervalInBackground: true` overrides that.

Each observer runs its own timer. Two components polling one key each fire on their own schedule; what is deduplicated is the concurrent **fetch**, not the timer.

**Guidelines:**

- MUST give a poll a termination condition — a state check returning `false`, or an unmount — rather than polling indefinitely.
- SHOULD express a poll that watches for completion as the function form, so it stops on its own rather than being cleaned up elsewhere.
- SHOULD leave background polling off unless the surface must stay current while the user is elsewhere, since it keeps the network and the device awake.
- MUST NOT rely on a poll interval for deduplication across components; each observer runs its own timer.

**Review checks:**

- A query with no `staleTime` on data that plainly changes slowly — **Minor**; every mount refetches.
- `staleTime: 'static'` on data a mutation invalidates — **Major**; the invalidation is a silent no-op.
- `gcTime` shorter than `staleTime` — **Major**; the entry is collected before it can be reused fresh.
- A refetch trigger disabled globally to quiet one query — **Major**; it silently changes every other query.
- `refetchInterval` with no termination condition — **Major**; it polls until the component unmounts, including on a screen the user has stopped looking at.
- Focus or reconnect refetching relied on in React Native with no manager wiring — **Major**; the option is inert.
