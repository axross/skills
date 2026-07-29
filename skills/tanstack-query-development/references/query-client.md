# The Query Client

Apply this reference when creating the client, deciding what belongs in its defaults, or reaching it from code that is not a component.

## Exactly One Client

The client holds the cache. Creating a new one on a render throws the cache away and every query starts over — the surface flickers, refetches loop, and nothing looks obviously wrong in the code.

```tsx
function App() {
  const queryClient = new QueryClient(); // new cache on every render
  return (
    <QueryClientProvider client={queryClient}>{/* … */}</QueryClientProvider>
  );
}
```

Two correct forms, and which one is right depends on whether the client must be per-user:

**Module scope** — one client for the process. Correct for a client-only application, and the form that lets non-component code import it directly.

```ts
export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
});
```

**Lazy state** — one client per mounted app instance:

```tsx
const [queryClient] = useState(() => new QueryClient());
```

A module-scope client is **wrong** wherever one process serves multiple users — a server rendering requests for different people would share one cache between them. See [server-rendering.md](./server-rendering.md).

**Guidelines:**

- MUST create the client once for the application's lifetime, never inside a render body.
- MUST use `useState(() => …)` or a module-scope constant; the bare initializer form re-creates the cache on every render.
- MUST NOT use a module-scope client in a process that serves more than one user.
- SHOULD place the provider above everything that queries, and below anything the client's construction depends on.

## What Belongs in the Defaults

The client's `defaultOptions` set the project's baseline. A factory overrides only where that query genuinely differs.

| Belongs on the client                           | Belongs on a factory                         |
| ----------------------------------------------- | -------------------------------------------- |
| The project's baseline `staleTime` and `gcTime` | A staleness window specific to that resource |
| The retry policy and backoff                    | A fast-fail on a non-idempotent read         |
| `networkMode`, refetch-trigger defaults         | `enabled`, `select`, `placeholderData`       |
| The global error handler on the caches          | `meta` declaring that query's policy         |

Options set per-query always win over the client's defaults — which is why globally disabling something to fix one query does not work as intended and quietly changes everything else.

**Guidelines:**

- MUST set a baseline the project has actually chosen rather than inheriting the library defaults by omission — see [cache-lifetime.md](./cache-lifetime.md).
- MUST NOT change a client default to fix one query's behaviour; set it on that query.
- SHOULD keep the client's construction in one module the whole application imports, so there is one place to read the baseline.
- SHOULD attach cross-cutting reporting to `QueryCache`/`MutationCache` rather than repeating it per factory — see [error-handling.md](./error-handling.md).

## Reaching the Client

Two ways in, and the choice is not stylistic:

- **`useQueryClient()`** — inside a component. Reads from context, so it works with whatever provider is above it.
- **The imported singleton** — inside a factory, a callback, or any non-React module, which has no context to read.

Inside a mutation callback there is now a third and better option: `context.client`, which arrives as an argument and needs neither import nor hook. Prefer it — it keeps the factory independent of how the client is held, which is what lets the same factory work under a per-request client on a server.

**Guidelines:**

- MUST use `useQueryClient()` inside a component and never import the singleton there; the hook respects the provider actually above it.
- SHOULD use `context.client` inside a mutation callback rather than importing the singleton, so the factory stays portable.
- MUST NOT call `useQueryClient()` from a factory; a factory is not a component and has no context.

## Defaults for a Family of Keys

`setQueryDefaults` applies options to every query matching a key prefix — a way to give one resource family a different baseline without repeating it in each factory. `setMutationDefaults` does the same for mutations, and is **required** for offline resumption, since a persisted mutation has no function until one is registered against its key.

```ts
queryClient.setQueryDefaults(["users", userId, "collections"], {
  staleTime: 5 * 60_000,
});
```

**Guidelines:**

- SHOULD use `setQueryDefaults` where a whole key family shares a baseline, rather than repeating the option in every factory.
- MUST register `setMutationDefaults` for any mutation that must resume after a restart — see [offline-persistence.md](./offline-persistence.md).
- SHOULD keep these registrations beside the client's construction, so the full baseline is readable in one place.

**Review checks:**

- `new QueryClient()` in a render body — **Critical**; the cache is discarded every render.
- A module-scope client in a process serving multiple users — **Critical**; one user's cached data is served to another.
- A client default changed to fix a single query — **Major**; it silently alters every other query.
- `useQueryClient()` called outside a component — **Critical**.
- The singleton imported inside a component instead of the hook — **Minor**; it bypasses the provider and breaks under a per-request client.
- A persisted mutation with no `setMutationDefaults` registration — **Major**; it cannot resume and fails with a missing function.
