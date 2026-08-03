# Seeding the Cache

Apply this reference when a surface should render something before its own fetch resolves — opening a detail view from a list, avoiding a spinner on data already in hand, or reviewing a seed that renders stale.

## Written to the Cache, or Only Standing In

Two options seed a query, and the difference is whether the value is **persisted**. Upstream documents them apart — [Initial Query Data](https://tanstack.com/query/latest/docs/framework/react/guides/initial-query-data) and [Placeholder Query Data](https://tanstack.com/query/latest/docs/framework/react/guides/placeholder-query-data) — so the axis that decides between them has to be assembled by the reader:

| Option            | Written to the cache | Query status while it shows | Flagged as                |
| ----------------- | -------------------- | --------------------------- | ------------------------- |
| `initialData`     | yes                  | `success`                   | nothing — it is real data |
| `placeholderData` | no                   | `success`                   | `isPlaceholderData: true` |

`initialData` says _this is the data, it just came from somewhere else_. It is written to the cache, other observers of the key see it, and it counts as a real fetch result for staleness purposes.

`placeholderData` says _this is approximately what will be there_. It never enters the cache, so a partial or synthesized value cannot leak into other observers or survive as though it had been fetched.

The rule follows directly: anything incomplete, approximate, or synthesized is `placeholderData`. `initialData` is only for a genuine, complete instance of the type.

**Guidelines:**

- MUST use `placeholderData` for partial, approximate, or synthesized values; `initialData` persists them into the cache where other readers cannot tell them from fetched data.
- MUST use `initialData` only for a complete value of the query's own type.
- SHOULD branch on `isPlaceholderData` where the difference is user-visible — disabling a control that would act on incomplete data, or dimming the surface.
- MUST NOT seed a query with data from a different tenant or session; the seed is subject to the same identity rules as the key.

## Telling the Cache How Old the Seed Is

By default `initialData` is treated as **just fetched**. With the default `staleTime: 0` that means it renders and immediately refetches; with a longer `staleTime` it means the seed is trusted for that whole window even if it was already old when it arrived.

`initialDataUpdatedAt` supplies the real timestamp, so staleness is measured from when the data was actually produced:

```ts
useQuery({
  ...getCollectionQueryOptions(slug),
  initialData: () =>
    queryClient
      .getQueryData(getCollectionListQueryOptions(scope).queryKey)
      ?.find((c) => c.slug === slug),
  initialDataUpdatedAt: () =>
    queryClient.getQueryState(getCollectionListQueryOptions(scope).queryKey)
      ?.dataUpdatedAt,
});
```

**Guidelines:**

- MUST pass `initialDataUpdatedAt` whenever the seed did not originate at that moment, so `staleTime` measures from the truth rather than from the render.
- MUST NOT use an inflated `staleTime` to stop a seeded query refetching immediately; that misstates the freshness of every later fetch too.
- SHOULD pass a function rather than a value when producing the seed is expensive; it runs once at initialization instead of on every render.

## Seeding From a List

The canonical case: a list query already holds a summary of each item, and opening one should render immediately rather than showing a spinner for data partly in hand.

Whether that summary is `initialData` or `placeholderData` depends on whether it is the **whole** item. A list row carrying every field of the detail type is `initialData`; a row carrying a title and a snippet, where the detail view shows a body, is `placeholderData` — persisting it would put a truncated record in the cache under the detail key.

Reading the source entry's `dataUpdatedAt` also allows the seed to be skipped when the list is too old to trust:

```ts
initialData: () => {
  const state = queryClient.getQueryState(listKey);
  if (state && Date.now() - state.dataUpdatedAt <= 10_000) {
    return state.data?.find((c) => c.slug === slug);
  }
  return undefined; // fall through to a real fetch
},
```

**Guidelines:**

- MUST seed from a list with `placeholderData` where the list row is a summary rather than the full record.
- SHOULD skip the seed when the source entry is older than the detail view can tolerate, returning `undefined` so the query fetches normally.
- MUST read the source entry through its own factory's key rather than a retyped array — see [query-keys.md](./query-keys.md).

## Writing a Value Directly

When the data is already in hand and no query needs to own the decision, `setQueryData` writes it straight in — after a mutation returns the updated record, or when a payload arrives over a socket.

Updates must be **immutable**. Mutating the object read from the cache appears to work and then produces stale renders, because structural sharing sees no change.

**Guidelines:**

- MUST update immutably in `setQueryData`, returning a new object rather than mutating what was read.
- MUST match the exact shape the query produces, including the page structure of a page-walking query — see [paginated-and-infinite-queries.md](./paginated-and-infinite-queries.md).
- SHOULD prefer invalidation over a direct write where correctness matters more than the saved request — see [cache-invalidation.md](./cache-invalidation.md).

**Review checks:**

- Partial or synthesized data passed as `initialData` — **Major**; a truncated record becomes indistinguishable from a fetched one for every other reader.
- A seed from another query with no `initialDataUpdatedAt` — **Minor**, rising to **Major** where `staleTime` is long enough to keep old data on screen.
- `staleTime` inflated to stop a seeded query refetching — **Major**; it misstates freshness for every subsequent fetch.
- A `setQueryData` updater mutating the object it received — **Major**; renders go stale in a way that reproduces intermittently.
- A seed built from a different tenant's cache entry — **Critical**.
