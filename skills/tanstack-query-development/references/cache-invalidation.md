# Cache Invalidation

Apply this reference when a write should make other data refetch, when choosing between invalidating and writing directly, or when reviewing a list that stays stale after a mutation.

## Evicting What a Write Made Stale

Invalidating marks matching entries stale and refetches the ones currently rendered. The key comes from the affected query's **factory**, never from a retyped array:

```ts
export function getCollectionCreateMutationOptions(scope: Scope) {
  return mutationOptions({
    mutationKey: ["users", scope.userId, "collections", "create"],
    mutationFn: (input: CollectionInput) => createCollection(scope, input),
    onSuccess: (_data, _variables, _onMutateResult, context) =>
      context.client.invalidateQueries({
        queryKey: getCollectionListQueryOptions(scope).queryKey,
      }),
  });
}
```

Every write needs this considered. A mutation that changes server state and invalidates nothing leaves the UI showing data it just made wrong — the single most common defect in this layer, and one that looks like a caching bug rather than a missing call.

**Guidelines:**

- MUST invalidate or directly update the queries a write affects, in the mutation's success path.
- MUST target the key from the affected query's factory rather than retyping the array.
- MUST place invalidation in the factory's callbacks, not at a call site — see [mutations.md](./mutations.md).
- SHOULD list the affected queries deliberately when reviewing a new mutation; the omission is invisible until a user reports stale data.

## Choosing the Scope

Matching is by **prefix** by default: `["users", userId, "collections"]` invalidates the list, every filtered variant of it, and everything nested beneath — each item and its sub-resources.

Three ways to narrow or widen:

- **prefix** (default) — everything at or beneath the key.
- **`exact: true`** — only the entry with precisely that key.
- **`predicate`** — an arbitrary test against each entry, for anything the key shape cannot express.

Too narrow leaves stale data on screen. Too broad refetches things the write did not touch — on a tenancy-rooted key, invalidating at the root after editing one record refetches the entire tenant.

**Guidelines:**

- MUST choose the narrowest scope that still covers everything the write actually affected.
- SHOULD use `exact: true` where nested entries are genuinely unaffected, rather than accepting the prefix's reach by default.
- SHOULD reach for `predicate` only when the key shape cannot express the condition; a key that needs a predicate for a routine case is usually shaped wrong — see [query-keys.md](./query-keys.md).
- MUST NOT invalidate at the tenancy root as a shortcut for identifying what changed; it refetches everything the session has loaded.

## Holding the Mutation Until the Refetch Lands

`invalidateQueries` returns a promise. **Returning** it from the callback keeps the mutation `pending` until the refetch completes, so a form's submitting state covers the whole round trip and the user does not see the old list for a frame.

```ts
onSuccess: (_d, _v, _r, context) =>
  context.client.invalidateQueries({ queryKey: listKey }),
```

Dropping the `return` — using a statement body without returning — settles the mutation immediately and the UI flickers through stale data.

Multiple invalidations combine with `Promise.all`.

**Guidelines:**

- MUST return the invalidation promise where the triggering UI should stay pending until the refetch lands.
- SHOULD combine multiple invalidations with `Promise.all` rather than awaiting them in sequence.
- MUST NOT return the promise where the write should settle immediately and the refetch can land afterwards — a background sync, say; the choice is deliberate either way.

## Writing the Response In

When a mutation returns the updated record, writing it into the cache saves a round trip:

```ts
onSuccess: (data, variables, _r, context) =>
  context.client.setQueryData(getCollectionQueryOptions(variables.slug).queryKey, data),
```

This is an optimization with a correctness cost: it trusts the response to be exactly what a fresh read would return. Where the server derives fields, applies defaults, or the record is shaped by another query's projection, the written value and the fetched one diverge silently.

Invalidation is the default. A direct write earns its place on a latency-critical path where the shapes are known to match.

Updates must be immutable — see [seeding-the-cache.md](./seeding-the-cache.md).

**Guidelines:**

- SHOULD prefer invalidation for correctness, and reserve a direct write for a latency-critical path where the response shape provably matches the query's.
- MUST update immutably, returning a new object rather than mutating what was read.
- SHOULD do both where it helps — write for immediacy, then invalidate so the authoritative value follows.

## Invalidate, Refetch, Reset, Remove

Four `QueryClient` methods overlap enough to be picked wrongly. Each is specified in the [`QueryClient` reference](https://tanstack.com/query/latest/docs/reference/QueryClient); what no page there states is which one a given situation calls for.

| Call                | Effect                                                  | Reach for it when                             |
| ------------------- | ------------------------------------------------------- | --------------------------------------------- |
| `invalidateQueries` | marks stale; refetches what is rendered                 | the default after a write                     |
| `refetchQueries`    | refetches regardless of staleness                       | a deliberate refresh, like pull-to-refresh    |
| `resetQueries`      | returns entries to their initial state, discarding data | a form or wizard restarting from scratch      |
| `removeQueries`     | deletes entries outright, with no refetch               | data that must not persist — a session ending |

`removeQueries` is the one with a privacy dimension: it is the only one that leaves nothing behind.

**Sign-out.** Clearing the session does not clear the cache. Entries stay resident until `gcTime` elapses — five minutes by default — so another account's data remains in memory after the user has signed out. With a tenancy root, one call removes exactly that tenant's entries; without one, `queryClient.clear()` is the blunt equivalent for a single-tenant app.

```ts
queryClient.removeQueries({ queryKey: ["users", userId] });
```

**Guidelines:**

- MUST remove a session's cache entries when it ends, rather than relying on garbage collection to expire them.
- MUST use `removeQueries` or `clear()` for that, not `invalidateQueries` — invalidation leaves the data resident and may refetch it.
- SHOULD target the tenancy prefix where the application has one, so a sign-out on a multi-account app does not evict another account's data.
- SHOULD use `refetchQueries` rather than `invalidateQueries` for an explicit user-initiated refresh, since it does not depend on staleness.

**Review checks:**

- A mutation that changes server state and invalidates nothing — **Major**, rising to **Critical** where the stale surface drives a further action.
- A hand-written key array in an invalidation — **Major**; it silently stops matching when the factory changes.
- Invalidation at the tenancy root after a single-record write — **Major**; it refetches the session's entire loaded surface.
- A dropped `return` on an invalidation whose UI depends on staying pending — **Minor**; the surface flickers through stale data.
- `setQueryData` from a response whose shape differs from the query's — **Major**; the divergence is silent until something reads the missing field.
- No cache eviction on sign-out — **Major**; another account's data stays readable in memory.
- `invalidateQueries` used to clear data at sign-out — **Major**; it can refetch with a token that is already gone.
