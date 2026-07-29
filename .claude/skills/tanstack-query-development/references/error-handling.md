# Error Handling

Apply this reference when deciding how a failure surfaces, mapping one to user-facing copy, setting a retry policy, or reviewing a query whose errors go nowhere.

## Making a Failure Reach the Query

A query fails only if its function throws — see [query-functions.md](./query-functions.md). Everything below assumes that.

v5 **removed** the per-query `onError`, `onSuccess`, and `onSettled` callbacks. Code carrying them is either pre-v5 or written from memory; the options are ignored rather than rejected, so the handler silently never runs.

**Guidelines:**

- MUST NOT put `onError`, `onSuccess`, or `onSettled` in a `queryOptions` factory; they are not supported and fail silently.
- MUST make the `queryFn` throw rather than returning a sentinel, or no error channel can fire at all.

## One Channel per Query

Three channels exist. Pick one per query, deliberately.

| Channel                              | Suits                                              |
| ------------------------------------ | -------------------------------------------------- |
| The returned `error` / `isError`     | an inline error surface with a retry — the default |
| An error boundary via `throwOnError` | a failure that makes the whole surface meaningless |
| The global `QueryCache({ onError })` | cross-cutting reporting, not per-screen copy       |

Mixing them on one query produces an error reported twice and handled inconsistently. The global handler is for reporting only: it sees every failure, and deciding user-facing copy there means deciding it without knowing the screen.

A global handler should filter. Expected operational failures — an expired session, a dropped connection — are states the UI already shows; reporting them buries the real problems.

```ts
new QueryCache({
  onError: (error, query) => {
    if (isReportable(error)) {
      report(error, { extra: { queryKey: query.queryKey[0] } });
    }
  },
});
```

**Guidelines:**

- MUST choose one error channel per query rather than letting a global handler and a local surface both act on it.
- SHOULD default to the returned `error` with an inline retry, and escalate to a boundary only where a partial screen would be meaningless.
- MUST reserve the global cache handler for reporting, never for user-facing copy.
- SHOULD filter expected operational failures out of global reporting, so the signal is not swamped by states the UI already handles.

## Boundaries and Resetting Them

Under Suspense, `throwOnError` defaults to throwing **only when there is no data**: a query that previously succeeded renders its stale data rather than surfacing the failure. Forcing every error to the boundary means throwing manually.

An error boundary also needs a way to let the query try again — otherwise the fallback is terminal. `QueryErrorResetBoundary` supplies that as a render prop; `useQueryErrorResetBoundary` is the hook form, for a boundary that reads the reset function itself rather than receiving it.

```tsx
<QueryErrorResetBoundary>
  {({ reset }) => (
    <ErrorBoundary onReset={reset} fallbackRender={/* … */}>
      <Page />
    </ErrorBoundary>
  )}
</QueryErrorResetBoundary>
```

**Guidelines:**

- MUST pair any boundary-based error handling with a reset path, or the fallback cannot be recovered from without a remount.
- SHOULD be explicit that a Suspense query with existing data will not throw by default, and throw manually where every failure must reach the boundary.

## Mutations: Tolerate or Propagate

A `mutationFn` catches only what it can resolve locally and continue past. Everything else rejects.

The distinction is whether the operation can still succeed. A best-effort remote call whose failure does not change the outcome is caught, logged, and passed over; the step that defines the operation is not.

> Signing out: the remote session teardown is wrapped in `try`/`catch` — offline still signs the user out locally, so the failure is logged and swallowed. The local session clear is **not** wrapped: if that throws, the mutation must reject, because the user is still signed in.

**Guidelines:**

- MUST catch inside the `mutationFn` only a failure the operation can tolerate and continue past, and log it rather than discarding it.
- MUST let every other failure reject, so it reaches `error`/`isError` and any `onError`.
- MUST treat the `mutationFn` as the root call site for a write, and let a software instrumentation capability's rule on where a `try`/`catch` belongs govern from there.
- MUST NOT catch broadly to keep a UI from showing an error; that converts a failed write into a silent one.

## Surfacing and Mapping

The factory surfaces the **raw domain error**. The presentation layer maps it to copy.

Translating inside the factory destroys the type — the call site receives a string it cannot branch on — and puts user-facing wording in the data layer, where it cannot vary by screen.

```ts
function messageForError(error: unknown): string {
  if (error instanceof CollectionRequestError) {
    if (error.kind === "auth") return "You don't have permission to view this.";
    if (error.kind === "network") return "Couldn't reach the server.";
  }
  return "Something went wrong. Please try again.";
}
```

The same mapper can decide more than wording — an icon, a tone, and whether a retry is even offered. A permission failure is not retryable; presenting a retry button that cannot succeed is worse than presenting none.

**Guidelines:**

- MUST surface the domain error unwrapped from the factory, so the call site can narrow it with `instanceof`.
- MUST map an error to user-facing copy at the presentation layer, keyed off the error's type or kind.
- SHOULD decide retryability in the same mapper, and omit the retry control for a failure retrying cannot fix.
- SHOULD share one mapper across surfaces that map the same failures, so two screens cannot describe one error differently.

## Declaring a Reporting Policy on the Query

A global handler that inspects the key to decide what to do is guessing. `meta` lets the query declare its own policy, and the handler read it — registered project-wide so it is typed:

```ts
declare module "@tanstack/react-query" {
  interface Register {
    queryMeta: { report?: boolean; redact?: ReadonlyArray<string> };
  }
}

queryOptions({
  queryKey: ["users", userId, "collections"],
  queryFn: () => fetchCollections(scope),
  meta: { report: true },
});
```

`meta` is not part of cache identity, so it can carry this without fragmenting the cache.

What the reporter does with the signal — levels, breadcrumbs, PII handling — belongs to a software instrumentation capability. This reference owns only the declaration and where it is read.

**Guidelines:**

- SHOULD declare a query's reporting policy on `meta` rather than having the global handler infer one from the key.
- MUST register `queryMeta`/`mutationMeta` on the `Register` interface so the shape is typed rather than a free-form record.
- MUST NOT put anything identifying cache contents in `meta`; it is not part of the key and does not separate entries.
- MUST defer log levels, capture semantics, and PII boundaries to a software instrumentation capability.

## Retry

Queries retry **3** times with exponential backoff by default; mutations do not retry at all. The query default is right for transient transport failures and wrong for anything deterministic — a 404 or a permission failure retried three times just delays the error by several seconds.

The function form filters by error:

```ts
retry: (failureCount, error) =>
  error instanceof CollectionRequestError && error.kind === "auth" ? false : failureCount < 3,
```

While retries are in flight, `error` stays `null` and the failure is visible on `failureReason` — which is why an error surface can appear to lag behind the network panel.

**Guidelines:**

- MUST NOT retry a deterministic failure — authentication, authorization, validation, or not-found; it only delays the error.
- SHOULD set the project-wide retry policy on the client and override per query only where that query differs — see [query-client.md](./query-client.md).
- SHOULD read `failureReason` rather than `error` when surfacing what is happening during retries.
- MUST NOT disable retries globally to make tests deterministic; configure the test client — see [testing.md](./testing.md).

**Review checks:**

- `onError` or `onSuccess` in a `queryOptions` factory — **Major**; silently ignored, so the handler never runs.
- A query with no error channel at all — **Major**; the failure renders as a permanent loading or empty state.
- Both a global handler and a local surface acting on one query's failure — **Minor**; duplicated reporting and inconsistent handling.
- A domain error stringified inside the factory — **Major**; the call site can no longer branch on it.
- A broad `catch` in a `mutationFn` that swallows the operation's defining failure — **Critical**; a failed write reports success.
- A retry on an authentication, authorization, or validation failure — **Minor**, rising to **Major** where it delays a sign-in error by seconds.
- A retry control offered for a failure retrying cannot fix — **Minor**.
- An error boundary with no reset path — **Major**; the fallback is terminal.
