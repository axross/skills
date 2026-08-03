# Paginated and Infinite Queries

Apply this reference when building a "load more" list, an infinite scroll, or a page-numbered table — or when reviewing one that duplicates rows, skips them, or refetches more than expected.

## Defining a Page-Walking Query

An infinite query — `useInfiniteQuery`, or `useSuspenseInfiniteQuery` under a boundary — keeps every fetched page under **one** cache entry: `data.pages` and `data.pageParams`. The factory needs `initialPageParam` and at least `getNextPageParam`.

**Property order matters, but only partly.** `queryFn` must come before both page-parameter callbacks, because the page-parameter type is inferred from it. `getPreviousPageParam` and `getNextPageParam` are **order-insensitive relative to each other** — swapping them changes nothing, and a rule stating a strict three-way order would flag correct code.

```ts
export function getCollectionRecordsInfiniteQueryOptions(scope: RecordsScope) {
  return infiniteQueryOptions({
    queryKey: ["users", scope.userId, "collections", scope.slug, "records"],
    queryFn: ({ pageParam }) => fetchRecords(scope, pageParam),
    initialPageParam: 1,
    getPreviousPageParam: (firstPage) => firstPage.previousPage ?? undefined,
    getNextPageParam: (lastPage) => lastPage.nextPage ?? undefined,
    maxPages: 5,
  });
}
```

`getNextPageParam` returning `undefined` or `null` is what sets `hasNextPage` to `false`. Returning a falsy-but-valid parameter — page `0`, an empty-string cursor — ends pagination by accident.

`maxPages` caps how many pages are retained, which matters twice: memory on a long list, and refetch cost, since a refetch re-fetches **every** retained page sequentially. Capping requires `getPreviousPageParam` as well, so discarded pages can be walked back to.

**Guidelines:**

- MUST place `queryFn` before `getPreviousPageParam` and `getNextPageParam`, since the page-parameter type is inferred from it; the two page callbacks may appear in either order.
- MUST return `undefined` from `getNextPageParam` to signal the end, and make sure a valid falsy page parameter is not mistaken for it.
- SHOULD set `maxPages` on a list a user can scroll far into, and supply `getPreviousPageParam` alongside it.
- MUST use `infiniteQueryOptions` rather than `queryOptions`; the latter does not carry the page-parameter types.

## Driving "Load More"

An infinite query has **one in-flight fetch at a time**. Calling `fetchNextPage` while a fetch is already running cancels and restarts it by default, which on a scroll handler firing repeatedly produces duplicated or skipped rows.

Guard on both flags:

```tsx
onEndReached={() => {
  if (hasNextPage && !isFetching) {
    void fetchNextPage();
  }
}}
```

`isFetchingNextPage` distinguishes appending a page from a background refresh of the whole list — the two want different indicators, one at the end of the list and one at the top.

**Guidelines:**

- MUST guard an automatic `fetchNextPage` trigger on `hasNextPage && !isFetching`, since a scroll handler fires far faster than a request completes.
- SHOULD distinguish `isFetchingNextPage` from `isFetching` in the UI; a footer spinner and a refresh indicator are different surfaces.
- MUST NOT call `fetchNextPage` from an effect that runs on every render; tie it to the scroll or a button.

## Rendering and Refetching

Pages are flattened for rendering. The flattening is a derivation, not something to store:

```tsx
const records = data.pages.flatMap((page) => page.records);
```

Row identity must come from the record, not from its index — a key derived from position breaks as soon as a page is inserted or the list refetches.

When an infinite query goes stale, **every retained page refetches sequentially**, starting from the first. That is deliberate: it prevents stale cursors from duplicating or skipping records. It also means a list with twenty pages loaded is an expensive refetch, which is what `maxPages` exists to bound.

Writing into an infinite query with `setQueryData` must preserve the `{ pages, pageParams }` shape, with both arrays kept the same length.

**Guidelines:**

- MUST derive the flattened list during render rather than storing it in state.
- MUST extract row keys from record identity, never from array position.
- MUST preserve both `pages` and `pageParams`, at equal length, in any direct write to an infinite query.
- SHOULD bound retained pages with `maxPages` on any list that can grow long, since refetch cost scales with pages retained.

## Page-Numbered Lists

A conventional paginated table is an ordinary query with the page in the key. Because each page is a separate cache entry, moving between pages moves between entries — and the surface drops to `pending`, flashing a spinner on every page change.

`placeholderData: keepPreviousData` holds the previous page's data while the new one loads:

```tsx
const { data, isPlaceholderData } = useQuery({
  ...getRecordsQueryOptions({ userId, page }),
  placeholderData: keepPreviousData,
});
```

`isPlaceholderData` is then what disables the "next" control, so a user cannot page past the end of data that has not arrived.

**Guidelines:**

- MUST put the page or cursor in the key for a page-numbered query; each page is its own entry.
- SHOULD apply `placeholderData: keepPreviousData` to any paged surface, so page changes do not flash a loading state.
- MUST disable forward navigation while `isPlaceholderData` is true, or the control acts on data that is not there yet.
- SHOULD choose an infinite query over a page-numbered one when the interaction is "load more" rather than "go to page N"; they are different cache shapes, not styling variants.

**Review checks:**

- Either page-parameter callback declared before `queryFn` — **Minor**; inference degrades silently, and the symptom appears far from the cause. The two page callbacks appearing in either order is **not** a finding.
- `fetchNextPage` unguarded on a scroll handler — **Major**; produces duplicated or skipped rows under fast scrolling.
- A valid falsy page parameter treated as the end of the list — **Major**; pagination stops one page early.
- Row keys derived from array index — **Major**; rows re-key on every insertion and refetch.
- A long infinite list with no `maxPages` — **Minor**, rising to **Major** where a refetch sequentially re-fetches many pages on a metered or slow connection.
- A page-numbered query with no `keepPreviousData` — **Minor**; every page change flashes a spinner.
- A direct write to an infinite query that drops `pageParams` or changes its length — **Major**; subsequent pagination reads the wrong cursor.
