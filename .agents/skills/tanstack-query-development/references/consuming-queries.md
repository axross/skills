# Consuming a Query

Apply this reference when calling a factory from a component, rendering its states, or reviewing why a component re-renders more than it should.

## Calling the Factory

A component passes the factory's result straight to the hook. A per-call option is layered by spreading — which is how `enabled`, `select`, or a screen-specific staleness window get applied without the factory knowing about them.

```tsx
const { data, isPending, isError, error, refetch } = useQuery({
  ...getCollectionListQueryOptions({ userId, serverUrl }),
  enabled: session !== null,
});
```

Spreading is also what lets the same factory serve `useQuery`, `useSuspenseQuery`, `prefetchQuery`, and a cache read — the reason the pattern exists.

**Guidelines:**

- MUST consume a query with `useQuery(getX(input))`, spreading the factory's result when a per-call option is needed.
- MUST gate a query that cannot run yet with `enabled` at the call site rather than making the factory return a half-built object.
- SHOULD keep per-call options to what genuinely varies by call site; anything intrinsic to the operation belongs in the factory.

## Two Status Fields

`status` describes the **data** — `pending`, `error`, `success`; `fetchStatus` describes the **function** — `fetching`, `paused`, `idle`. Both are defined in the [Queries guide](https://tanstack.com/query/latest/docs/framework/react/guides/queries), which also explains why they are separate fields. What that page does not say is that reading the wrong one is the most common loading-state bug.

A query can be `pending` **without fetching** — disabled, or paused with no network. Rendering a spinner on `isPending` alone therefore shows a spinner forever on a device that is offline. The derived flag `isLoading` (`isPending && isFetching`) is the one a first-load spinner should read.

**Guidelines:**

- MUST read `isLoading` rather than `isPending` for a first-load spinner wherever a query can be disabled or paused.
- SHOULD use `isFetching` for a background-refresh indicator, distinct from the first-load surface.
- SHOULD use `useIsFetching` or `useIsMutating` for an application-wide activity indicator rather than threading flags upward.

## The Four Branches

A data-backed component has four branches — loading, error, empty, loaded. That all four must exist, and how the surfaces behind them are built, belongs to a React component development capability. What this reference owns is **which query field selects which branch**, because reading the wrong one is how a branch becomes unreachable.

| Branch  | Selected by                                          |
| ------- | ---------------------------------------------------- |
| loading | `isLoading`, not `isPending` — see the section above |
| error   | `isError`, with `error` for the copy                 |
| empty   | the resolved `data`, once success is established     |
| loaded  | everything else                                      |

**Guidelines:**

- MUST select the loading branch from `isLoading` and the empty branch from the resolved `data`, so neither becomes unreachable on a gated or offline query.
- MUST drive the error branch's retry from `refetch`, and omit the control where the failure is not retryable — see [error-handling.md](./error-handling.md).
- SHOULD map the error to user-facing copy outside the component body rather than branching on error kinds inline.

## What a Component Subscribes To

The result object is a proxy: a component re-renders only for the fields it actually **reads**, as [Render Optimizations](https://tanstack.com/query/latest/docs/framework/react/guides/render-optimizations) describes. Two habits defeat that, and both are silent.

**Rest destructuring** touches every field, so the component subscribes to all of them and re-renders on every internal change:

```tsx
const { data, ...rest } = useQuery(getX()); // subscribes to everything
```

**`select`** narrows a subscription to a derived slice, so a component watching a count re-renders only when the count changes. It re-runs whenever `data` changes or the function's identity changes, so an inline arrow re-runs on every render — hoist it or memoize it.

```tsx
const selectCount = (data: Todo[]) => data.length; // stable module-scope identity

const { data: count } = useQuery({
  ...getTodosQueryOptions(),
  select: selectCount,
});
```

The result object itself is **not** referentially stable — a new object every render — so putting it in a hook dependency array re-runs that hook constantly. Destructure the field first.

**Guidelines:**

- MUST NOT use rest destructuring on a query or mutation result; it subscribes the component to every field.
- MUST NOT put a query or mutation result object in a React hook's dependency array; destructure the value or function first and depend on that.
- SHOULD use `select` to subscribe to a derived slice when a component needs less than the whole result.
- MUST give `select` a stable identity — module scope or `useCallback` — since an inline function re-runs it on every render.
- MUST NOT throw from `select` or use it to validate; it runs on already-cached data and a failure there does not produce an error state.
- MAY set `subscribed: false` to detach a query whose surface is not visible — see [react-native.md](./react-native.md).

## Suspense Variants

`useSuspenseQuery`, `useSuspenseInfiniteQuery`, and `useSuspenseQueries` — the set introduced in v5, catalogued in the [Suspense guide](https://tanstack.com/query/latest/docs/framework/react/guides/suspense) — move loading and error handling to boundaries. `data` is then guaranteed defined, which removes the narrowing at every call site.

What they give up is real: no `enabled`, so a query cannot be conditionally disabled; no `placeholderData`; and no cancellation. Queries in one component also fetch **serially** — the first suspends before the second starts — so a parallel set needs `useSuspenseQueries` rather than several hooks side by side.

By default an error only reaches a boundary when there is no data to show; a query that previously succeeded renders stale data instead. Throwing manually is the way to force every error to the boundary.

When a key changes in response to user input, wrap the update in `startTransition` so the boundary's fallback does not replace the current screen.

**Suspending without the Suspense hooks.** An ordinary `useQuery` result carries a `promise` field that `React.use()` can suspend on in a child component. That keeps everything the Suspense hooks give up — `enabled`, `placeholderData`, cancellation — while still moving the loading surface to a boundary.

It is gated behind a feature flag on the client, and does nothing without it:

```tsx
const queryClient = new QueryClient({
  defaultOptions: { queries: { experimental_prefetchInRender: true } },
});

function Parent() {
  const { promise } = useQuery(getCollectionListQueryOptions(scope));
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Child promise={promise} />
    </Suspense>
  );
}

function Child({ promise }: { promise: Promise<Collection[]> }) {
  const collections = use(promise);
  // …
}
```

**Guidelines:**

- MUST use `useSuspenseQueries` for a parallel set inside one component; side-by-side suspense hooks fetch serially.
- MUST NOT reach for a Suspense hook where the query needs to be conditionally disabled; there is no `enabled`.
- SHOULD wrap a key-changing state update in `startTransition` so the fallback does not replace visible content.
- MUST pair a Suspense read with an error-boundary reset path — see [error-handling.md](./error-handling.md).
- SHOULD reach for `useQuery().promise` with `React.use()` rather than a Suspense hook where the query still needs `enabled`, `placeholderData`, or cancellation.
- MUST enable `experimental_prefetchInRender` on the client before relying on `promise`; without it the field does not resolve, and treat the flag as experimental at the installed version.

**Review checks:**

- `isPending` driving a first-load spinner where the query is gated or the app can be offline — **Major**; the spinner never resolves.
- Rest destructuring of a query result — **Minor**, rising to **Major** on a surface that re-renders visibly.
- A query result object in a hook dependency array — **Major**; the hook re-runs every render.
- An inline `select` function — **Minor**; it re-runs on every render.
- An empty branch selected from a flag rather than from the resolved `data` — **Major**; it never renders, so an empty result shows as a bare container.
- Several `useSuspenseQuery` calls side by side in one component — **Major**; a serial waterfall presented as parallel.
