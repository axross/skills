# Fetch Orchestration

Apply this reference when deciding when a query runs, coordinating several of them, removing a waterfall, or warming the cache ahead of a render.

## Gating a Query

`enabled: false` stops a query running automatically. It stays `pending` with `fetchStatus: 'idle'`, ignores invalidation and refetch calls aimed at it, and waits.

The common use is not permanent disabling but **deferral** — a query that cannot run until an input exists:

```tsx
const { data } = useQuery({
  ...getCollectionListQueryOptions({
    userId: session?.user.id ?? "",
    serverUrl,
  }),
  enabled: session !== null,
});
```

`skipToken` is the type-safe alternative: passing it in place of the `queryFn` disables the query while keeping the options fully typed, with no placeholder input to fabricate. Its one limitation is that `refetch()` cannot force it — there is no function to call.

Permanently disabling a query and driving it entirely with `refetch()` gives up the declarative model and everything built on it. A lazy query gated on its input is almost always what was wanted.

**Guidelines:**

- MUST gate a query on the existence of its inputs rather than passing placeholder values that produce a meaningless cache entry.
- SHOULD prefer `skipToken` over `enabled: false` in TypeScript where no manual `refetch()` is needed, since it avoids fabricating an input.
- MUST NOT use `skipToken` where the call site needs `refetch()`; it fails with a missing-function error.
- SHOULD NOT permanently disable a query and drive it imperatively; that forfeits background refetching, and a lazy query gated on input is usually the real requirement.

## Dependent Queries Are a Cost

A query gated on another query's result is a **waterfall**: two round trips where one would do, and the latency is additive. It is sometimes unavoidable, but it is never free and should not be reached for by default.

```tsx
const { data: user } = useQuery(getUserQueryOptions(email));
const { data: projects } = useQuery({
  ...getProjectsQueryOptions(user?.id ?? ""),
  enabled: user?.id !== undefined,
});
```

The fix is usually on the server: an endpoint that accepts the identifier the caller already has removes the first hop entirely.

**Guidelines:**

- MUST treat a dependent query as a latency cost to be justified, not as the default way to compose reads.
- SHOULD restructure the endpoint so both reads can start from what the caller already holds, where that is possible.
- SHOULD start the independent part of a screen's data immediately rather than gating everything behind the first result.

## A Changing Set of Queries

When the number of queries varies between renders, hooks cannot be called in a loop. `useQueries` takes an array and returns an array of results.

```tsx
const results = useQueries({
  queries: userIds.map((id) => getUserQueryOptions(id)),
});
```

`combine` reduces the results into one value with a stable identity, which avoids every consumer re-deriving the same aggregate.

An inline `select` written on a query object passed to `useQueries` cannot infer its argument from that same object's `queryFn` — it falls back to `unknown`. Building the entry with the option helper, as above, avoids that.

**Guidelines:**

- MUST use `useQueries` when the number of queries changes between renders; calling hooks in a loop violates the rules of hooks.
- SHOULD build each entry from its factory rather than inlining options, which keeps `select` inference working.
- SHOULD use `combine` to derive one aggregate from the set rather than recomputing it in each consumer.

## Request Waterfalls

A waterfall is any chain where one request cannot start until another finishes. They accumulate silently, because each one is introduced locally:

- a child component queries something its parent could have started
- a parent gains a query, and its existing children now wait for it
- a lazily-loaded component contains a query, so the code and the data load serially

Three ways to flatten one, in rough order of preference:

1. **Hoist** — start the request in the parent and pass the result down.
2. **Prefetch** — start it in the parent without consuming it, so it runs alongside.
3. **Restructure** — change the endpoint so one request answers both needs.

**Guidelines:**

- MUST NOT introduce a query into a component that renders only after a parent's query resolves, without checking what that adds to the chain.
- SHOULD prefetch in the parent when hoisting the result as a prop is impractical — an unrelated component several levels down.
- SHOULD inspect the network panel or the devtools periodically rather than reasoning about waterfalls only from the code.

## Warming the Cache

Prefetching populates an entry before anything renders it. The variants differ in what they return and how they fail:

| Call              | Returns         | On failure   |
| ----------------- | --------------- | ------------ |
| `prefetchQuery`   | `Promise<void>` | never throws |
| `fetchQuery`      | the data        | throws       |
| `ensureQueryData` | the data        | throws       |

An infinite query has its own warming call, `prefetchInfiniteQuery`, taking the same options the factory produces. `prefetchQuery` does not carry the page-parameter types, so warming a page-walking query through it primes the wrong shape.

| Call                    | Returns         | On failure   |
| ----------------------- | --------------- | ------------ |
| `prefetchInfiniteQuery` | `Promise<void>` | never throws |

`prefetchQuery` respects `staleTime`, so a prefetch of fresh data is a no-op — which is why an event-handler prefetch usually wants an explicit `staleTime`. `ensureQueryData` returns cached data if present and fetches only when it is absent.

`usePrefetchQuery` is the variant for starting a fetch during render, ahead of a Suspense boundary — the ordinary hook cannot do this, because it would suspend.

```tsx
function ArticleLayout({ id }: { id: string }) {
  usePrefetchQuery(getCommentsQueryOptions(id)); // starts now, does not suspend
  return (
    <Suspense fallback={<ArticleSkeleton />}>
      <Article id={id} />
    </Suspense>
  );
}
```

**Guidelines:**

- MUST use `fetchQuery` or `ensureQueryData` where the caller needs the data or needs the failure; the prefetch variants return nothing and swallow errors.
- SHOULD pass an explicit `staleTime` to an interaction-triggered prefetch, or it silently does nothing for already-fresh data.
- SHOULD prefetch from the router's loader where the project has one, so the request starts before the route's component is even imported.
- MUST use `usePrefetchQuery` rather than an ordinary query hook to warm a sibling query ahead of a Suspense boundary.
- MUST warm a page-walking query with `prefetchInfiniteQuery`, never `prefetchQuery`; the latter does not carry the page-parameter types.

**Review checks:**

- A query fed placeholder inputs instead of being gated with `enabled` — **Major**; it caches a meaningless entry under a real key.
- A dependent query where the endpoint could have taken the caller's existing identifier — **Minor**, rising to **Major** on a first-paint path.
- Hooks called in a loop over a variable-length array — **Critical**; it breaks on the render where the length changes.
- A new query added to a component that only renders after its parent's query resolves — **Major** when it lands on a first-paint path.
- An event-handler prefetch with no `staleTime` — **Minor**; it is usually a silent no-op.
- `prefetchQuery` used where the caller then reads the data — **Major**; it returns `void` and the read gets `undefined`.
