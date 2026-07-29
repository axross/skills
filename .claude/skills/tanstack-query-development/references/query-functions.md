# Query Functions

Apply this reference when writing the function that performs a read, adapting a transport to it, or reviewing how a failure or a cancellation is handled inside one.

## The Promise Contract

A `queryFn` returns a promise that either resolves data or **throws**. Two rules follow, and both are easy to violate without an error.

Resolving `undefined` is treated as a **failure**, not as an empty success. To cache "nothing", resolve `null`.

Returning nothing at all — an `async` function that awaits a call and forgets to return it — produces exactly that failure, and reads as a fetch that mysteriously never populates.

```ts
// Wrong: awaits, returns undefined, query errors.
queryFn: async () => {
  await api.todos.fetch();
};

// Right.
queryFn: async () => {
  return await api.todos.fetch();
};
```

**Guidelines:**

- MUST return a value from the `queryFn`; an implicit `undefined` return is treated as a failed query.
- MUST resolve `null` rather than `undefined` to represent a successful empty result.
- MUST let the function throw or reject on failure so the query enters its error state.
- MUST NOT swallow a failure and return a sentinel value — an empty array, a `null` that means "it broke" — which caches the failure as success.

## Transports That Do Not Throw

Most clients reject on an error response. The platform `fetch` does not: a 404 or a 500 resolves normally with `ok: false`. A `queryFn` built on it has to raise the failure itself, or every error response caches as a successful read of an error body.

```ts
queryFn: async () => {
  const response = await fetch(`/collections/${slug}`);
  if (!response.ok) {
    throw new CollectionRequestError(response.status);
  }
  return response.json();
};
```

**Guidelines:**

- MUST check the response status and throw when the transport does not reject on an error response.
- SHOULD throw a typed domain error carrying what the caller needs to distinguish failures, so the presentation layer can narrow it — see [error-handling.md](./error-handling.md).
- SHOULD route the actual request through the feature's data-layer or API helper and keep the `queryFn` a thin adapter over it, so the helper stays testable on its own.

## What the Function Receives

The `queryFn` is called with a `QueryFunctionContext`:

| Field       | What it carries                                          |
| ----------- | -------------------------------------------------------- |
| `queryKey`  | the key this call is running under                       |
| `client`    | the `QueryClient` executing it                           |
| `signal`    | an `AbortSignal` that aborts when the query is cancelled |
| `meta`      | the static metadata declared on the options              |
| `pageParam` | the current page parameter, for a page-walking query     |

Reading an input back out of `queryKey` is possible but rarely worth it: the factory already closed over the same value, and destructuring the key couples the function to the key's positional layout.

The function runs outside React, so it reads a store or singleton **imperatively** — see [option-factories.md](./option-factories.md).

**Guidelines:**

- MUST read a store or singleton through its non-reactive accessor inside the function, never a hook.
- SHOULD close over the factory's inputs rather than destructuring them back out of `queryKey`, so the function does not depend on the key's layout.
- SHOULD declare static per-query metadata on `meta` rather than encoding it in the key; `meta` is not part of cache identity.

## Cancellation

The `signal` aborts when a query is cancelled — superseded by a newer fetch, explicitly cancelled, or removed. Threading it into the transport is what makes an abandoned request actually stop.

```ts
queryFn: async ({ signal }) => {
  const response = await fetch(`/collections/${slug}`, { signal });
  // …
};
```

Consuming the signal changes behaviour: without it, an unmounted query's request still completes and populates the cache; with it, the request aborts and the query's state reverts. Both are reasonable — the first wastes bandwidth, the second discards a nearly-finished response.

Cancelling manually is a `cancelQueries` call, with two options worth knowing: `revert` (default `true`) restores the state from before the in-flight fetch, and `silent` suppresses the cancellation error reaching observers.

Cancellation does **not** work with the Suspense hooks.

**Guidelines:**

- MUST thread `signal` into the transport for any request that is expensive enough that abandoning it matters.
- SHOULD leave `signal` unused for a short request whose result is worth keeping even after its component unmounts.
- MUST NOT rely on cancellation inside a Suspense-based read; the Suspense hooks do not support it.
- MUST call `cancelQueries` before writing an optimistic value, so an in-flight refetch cannot land on top of it — see [optimistic-updates.md](./optimistic-updates.md).

**Where the teardown trigger is owned.** An app-framework capability may require that an in-flight request be cancelled when the screen that issued it goes away. That rule owns the **trigger**; this reference owns the **mechanism** — the signal, `cancelQueries`, and the `subscribed` option in [consuming-queries.md](./consuming-queries.md). Satisfy it with those rather than with a hand-rolled abort controller alongside the query.

## Streaming a Chunked Response

A response that arrives as an async iterable — a token stream, a progressive result set — is read through the streaming helper rather than by accumulating into a ref. The query goes to success on the first chunk and stays fetching until the stream ends.

```ts
import { experimental_streamedQuery as streamedQuery } from "@tanstack/react-query";

queryOptions({
  queryKey: ["users", userId, "chat", threadId],
  queryFn: streamedQuery({ streamFn: fetchChunks }),
});
```

Its refetch behaviour is a choice: `reset` (the default) clears and re-streams, `append` adds to what is there, and `replace` swaps the whole value once the stream ends.

**Guidelines:**

- SHOULD use the streaming helper for an async-iterable source rather than accumulating chunks outside the cache.
- MUST choose the refetch mode deliberately; the default discards everything already streamed.
- MUST treat the helper as experimental and check its signature against the installed version before relying on it.

**Review checks:**

- A `queryFn` with no return, or one that resolves `undefined` — **Critical**; the query errors and the cause is invisible at the call site.
- A `fetch`-based `queryFn` that does not check response status — **Critical**; error responses cache as successful data.
- A failure caught inside the `queryFn` and returned as an empty value — **Critical**; the error state never happens and the UI shows "no results".
- A hook called inside a `queryFn` — **Critical**.
- A long-running or expensive request with no `signal` threading — **Minor**, rising to **Major** where the query's key changes rapidly under user input.
- A hand-rolled abort controller sitting beside a query — **Major**; it duplicates cancellation the library already owns and the two can disagree.
