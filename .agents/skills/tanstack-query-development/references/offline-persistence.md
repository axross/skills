# Offline Persistence

**Applies only where the host's requirements call for offline continuity** — data readable without a connection, or writes that survive a restart. An application that can show an error when the network is gone needs none of this; skip the reference entirely.

Apply it when the cache must outlive the process, when writes have to queue offline, or when reviewing a persisted cache for staleness or leakage.

## Behaviour With No Connection

`networkMode` decides what happens when there is no connectivity, and it applies to queries and mutations alike. Its three values — `online` (the default), `always`, and `offlineFirst` — are defined in the [Network Mode guide](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode).

A paused query keeps `status: 'pending'` and reports `fetchStatus: 'paused'`. This is the trap: a surface keyed on `isPending` alone shows a spinner that can never resolve, because nothing is running and nothing will fail.

`offlineFirst` suits a layer that can answer before the network is reached — a service worker, an HTTP cache, a local store.

**Guidelines:**

- MUST render a distinct state for a paused fetch rather than an indefinite spinner; it is neither loading nor failed.
- MUST set `networkMode: 'always'` on a query whose function does not use the network at all.
- SHOULD choose `offlineFirst` where something local can answer first and the network is a fallback.

## Writes That Queue

A paused mutation is retained and resumes when connectivity returns, **in the order it was queued**. Order matters: two edits to one record applied in reverse produce the wrong final state, and a create resumed after its own update fails outright.

`scope` serializes writes that must not interleave — see [mutations.md](./mutations.md).

`queryClient.resumePausedMutations()` is what drains that queue. The client calls it itself whenever connectivity returns **or** the app regains focus — both managers trigger it, which is one more reason to wire them on React Native. A restore from persistence does **not**, so it has to be called once restoration finishes.

Resuming after a **restart** needs more, because functions cannot be serialized. Only mutation _state_ persists, so the rehydrated mutation has no function to call unless one is registered against its key:

```ts
queryClient.setMutationDefaults(["users", userId, "collections", "update"], {
  mutationFn: updateCollection,
});
```

Without that registration, resumption fails with a missing-function error — at restart, for a write the user believes succeeded.

**Guidelines:**

- MUST register `setMutationDefaults` for every mutation expected to resume after a restart; the persisted state carries no function.
- MUST make a resumable mutation idempotent, since resumption can replay a write the server already applied.
- SHOULD scope writes that must apply in order rather than relying on queue order alone.
- MUST call `resumePausedMutations()` after a restore completes, rather than assuming restoration triggers the queue itself.

## Persisting and Restoring

Persistence writes the dehydrated cache to storage and restores it on launch. `persistQueryClient` wires it imperatively; `PersistQueryClientProvider` does the same in the tree and is the usual choice, since it wires the restore and supplies `useIsRestoring` to everything beneath it. Both, and the persister packages behind them, are documented under [persistQueryClient](https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient).

It does **not** hold rendering. Children render immediately; what the provider suppresses is _fetching_, holding queries at `fetchStatus: 'idle'` until the restore settles — which is what stops a query from racing the restored value and landing on top of it.

Gating what appears on screen is the half left to the caller. A restore is asynchronous, so a surface that renders through it shows empty data and then a populated cache a moment later, reading as a flash of missing content. `useIsRestoring` is how a component decides to wait.

**Guidelines:**

- MUST gate rendering on `useIsRestoring` where a flash of empty content matters; the provider suppresses fetching on its own, but renders children immediately.
- MUST gate fetching explicitly when wiring the restore with `persistQueryClient` rather than the provider; only the provider supplies the restoring state.
- SHOULD set `gcTime` at least as long as the intended persistence window, since an entry collected before it is written back is not persisted.
- SHOULD persist deliberately rather than wholesale — the whole cache written on every change costs storage and serialization time on every mutation.
- MUST verify `experimental_createQueryPersister`'s API against the installed version before using it to persist per query rather than whole-cache; it is experimental and its signature moves.

## Invalidating a Persisted Cache

Persisted data outlives a deployment. A restored entry whose shape no longer matches what the code expects is a crash on launch, and the user cannot clear it.

A buster string tied to the release is what discards incompatible data:

```ts
persistQueryClient({ queryClient, persister, buster: APP_VERSION });
```

**Guidelines:**

- MUST set a buster derived from a value that changes when the persisted shape can change — a release identifier or a schema version.
- MUST NOT assume a restored entry matches the current code's expectations; the shape can predate the running build.
- SHOULD treat a change to any persisted query's shape as requiring a buster change, the same way a schema migration would.

## Tenancy and What Is on Disk

Persistence turns a cache into stored data, which changes what a stale entry costs. Two rules follow.

A persisted cache **must not** carry one tenant's data into another's session. The tenancy root in [query-keys.md](./query-keys.md) is what makes that enforceable — restore only the current tenant's prefix, or clear the store on sign-out. Without a tenancy root, the only safe option is discarding everything.

And what is written must be safe at rest. Credentials, tokens, and sensitive personal data do not belong in a general-purpose cache store; keep them out of query data, or exclude those entries from persistence.

**Guidelines:**

- MUST remove or exclude a tenant's persisted entries when their session ends, rather than relying on the buster or on garbage collection.
- MUST exclude entries holding credentials or sensitive personal data from persistence; a cache store is not a secure store.
- SHOULD restore only the current tenant's prefix where the persister supports partial restoration.

## Why This Is Not a Hand-Rolled Cache

An app-framework capability may require that server state **not** be hand-persisted into device storage as a cache. That rule is correct and this reference does not weaken it.

The two are different things:

- **What that rule forbids** — reading a response and writing it into device storage as an ad-hoc mirror, with its own staleness, its own invalidation, and no relationship to the query that produced it. It is a second cache that drifts from the first.
- **What this reference describes** — the server-state layer persisting **its own** cache through the library's adapter. There is one cache; it is the same entries, keyed the same way, invalidated the same way, and it happens to survive a restart.

The rule tells a reader to defer persistence to the server-state layer. This is that layer doing it. A hand-written mirror alongside a persisted cache is still the defect the rule names.

**Guidelines:**

- MUST NOT write query results into device storage by hand alongside a persisted cache; the layer's own persister is the sanctioned mechanism.
- MUST route persistence through a persister so entries stay keyed and invalidated by the same rules as the in-memory cache.
- SHOULD name the app-framework capability's rule when a reviewer reads persistence here as a contradiction of it.

**Review checks:**

- A spinner driven by `isPending` with no paused state — **Major**; it never resolves offline, which is exactly when it renders.
- A resumable mutation with no `setMutationDefaults` — **Major**; it fails at restart, for a write the user believes succeeded.
- A non-idempotent mutation marked resumable — **Critical**; resumption can replay a write the server already applied.
- A restore wired with `persistQueryClient` and no `useIsRestoring` gate on fetching — **Major**; the restore lands on top of results it did not produce. Not a finding under `PersistQueryClientProvider`, which suppresses fetching itself.
- A surface rendered through a restore where a flash of empty content matters — **Minor**; the provider gates fetching, never rendering.
- Persistence with no buster — **Major**; a shape change crashes on launch against data the user cannot clear.
- A persisted cache not cleared or scoped at sign-out — **Critical**; another account's data is readable from disk.
- Credentials or sensitive personal data inside persisted query data — **Critical**.
- A hand-written device-storage mirror of query results — **Major**; two caches that drift, which is the defect the app-framework rule names.
