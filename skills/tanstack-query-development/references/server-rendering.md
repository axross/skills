# Server Rendering

**Applies only where the host renders on a server or uses React Server Components.** A client-only application — a single-page app, a React Native app — needs none of this; skip the reference entirely.

Apply it when moving cache entries across the server/client boundary, prefetching in a server component, or reviewing why a hydrated query refetches immediately.

## A Client per Request

The single most important difference: on a server, one process serves many users. A module-scope client would share one cache between all of them, so one user's data reaches another — a data-leak defect, not a performance one.

The rule is a **new client per request** on the server, and **one client for the session** in the browser:

```ts
function getQueryClient() {
  if (environmentManager.isServer()) {
    return makeQueryClient(); // fresh per request
  }
  browserQueryClient ??= makeQueryClient(); // one per browser session
  return browserQueryClient;
}
```

The browser branch is a singleton on purpose: re-creating it during a suspended initial render would discard the cache mid-render.

`environmentManager` also lets a non-standard runtime — an extension worker, an unusual edge environment — override how "server" is detected.

**Guidelines:**

- MUST create a new client per request on the server; a shared one serves one user's cached data to another.
- MUST hold exactly one client for the browser session, and not re-create it when a render suspends.
- MUST NOT export a module-scope client from a module that both server and browser code import.
- SHOULD override server detection through `environmentManager` only for a runtime whose defaults are genuinely wrong.

## Defaults That Change

Two defaults are wrong for server rendering.

`staleTime: 0` means every hydrated query refetches the instant it mounts in the browser — the server's work is done, sent, and immediately repeated. A non-zero default is effectively required.

Retries are already **0** on the server, so a slow failure does not hold the response open. That is the library's own default and does not need setting.

**Guidelines:**

- MUST set a non-zero default `staleTime` where queries are prefetched on the server, or every one of them refetches on hydration.
- SHOULD keep server-side retries at their default of zero, so a failing dependency does not delay the whole response.

## Moving Entries Across the Boundary

`dehydrate` serializes a client's entries; `HydrationBoundary` restores them into the browser's client. Only successful queries are included by default, and only paused mutations.

Three options matter, and one is a security control:

| Option                 | Purpose                                                         |
| ---------------------- | --------------------------------------------------------------- |
| `shouldDehydrateQuery` | which entries cross — extend the default rather than replace it |
| `serializeData`        | transform values that do not survive serialization              |
| `shouldRedactErrors`   | strip error detail before it reaches the browser                |

Everything dehydrated is embedded in the response and readable by anyone who can read the page. A cache entry holding data the browser should not see must not cross, and a server error's message or stack must be redacted rather than shipped — server errors routinely carry internal paths, query fragments, and identifiers.

Replacing `shouldDehydrateQuery` wholesale rather than extending the default is a common way to accidentally start dehydrating errored or pending queries.

**Guidelines:**

- MUST NOT dehydrate an entry containing data the browser is not entitled to read; dehydrated state is public.
- MUST redact server error detail with `shouldRedactErrors` rather than letting messages and stacks reach the client.
- MUST extend the default predicate when customizing `shouldDehydrateQuery`, not replace it.
- SHOULD keep the dehydrated payload small; it is embedded in the response and paid for on every page load.

## Prefetching on the Server

The pattern is: prefetch where the request context is available, dehydrate, and let the client component's own query find the entry already there.

```tsx
export default async function Page() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(getCollectionListQueryOptions(scope));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CollectionList />
    </HydrationBoundary>
  );
}
```

The client component calls the **same factory**, which is what makes the keys match. A key that differs by even one segment produces a fetch on the client that the server already paid for — and no error.

Awaiting the prefetch blocks the response until it resolves; not awaiting it lets the shell stream and the query resolve on the client. Both are valid, and the choice is about what the first paint needs.

**Guidelines:**

- MUST use the same factory on both sides, so the server's entry and the client's query share a key.
- MUST NOT prefetch data the current user is not authorized to read; prefetching happens before any component decides what to render.
- SHOULD await only the queries the first paint genuinely needs, and let the rest resolve on the client.
- SHOULD verify a prefetch actually landed rather than assuming; a key mismatch is silent and shows up only as a duplicate request.

## Where This Stops

The framework's own concerns — which components run on which side, the directives that mark them, route-level caching and revalidation, streaming mechanics — belong to the matching app-framework capability. This reference covers only what this layer contributes at that boundary: the client's lifetime, the dehydration payload, and key agreement across the two sides.

The streamed-hydration integration package is experimental and framework-specific; treat its API as subject to change and check it against the installed version.

**Guidelines:**

- MUST defer component-boundary, directive, and route-caching rules to the app-framework capability rather than restating them here.
- MUST treat the streamed-hydration package as experimental and verify its API against the installed version.

**Review checks:**

- A module-scope client reachable from server-rendered code — **Critical**; one user's cached data is served to another.
- A browser client re-created on render rather than held — **Major**; the cache is discarded when the initial render suspends.
- Server-prefetched queries with a default `staleTime` of zero — **Major**; every one refetches on hydration and the server's work is wasted.
- Dehydrated state containing data the browser should not read — **Critical**.
- Server errors dehydrated without redaction — **Major**; internal detail is embedded in the page.
- `shouldDehydrateQuery` replaced rather than extended — **Minor**, rising to **Major** where it starts dehydrating errored entries.
- A server prefetch and a client query whose keys differ — **Minor**; the prefetch is wasted, silently.
