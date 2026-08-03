# Option Factories

Apply this reference when adding a query or mutation, naming its file, or reviewing where a definition lives. This is the pattern every other reference assumes.

## One Factory per File, Named for What It Does

A query or mutation is a **plain function returning an options object** — never a custom hook wrapping `useQuery`. The factory owns the cache identity and the fetch; the component owns the reactive wiring by calling `useQuery(getX(input))` directly.

A wrapper hook (`useTodoList`, `useSignIn`) looks tidier and costs three things: the key stops being reachable for invalidation, the options stop being reusable by `prefetchQuery` or `useSuspenseQuery`, and every call site inherits whatever the hook decided about `enabled` and `select`.

```
src/
├── collections/
│   ├── queries/
│   │   ├── collection-list-query.ts        → getCollectionListQueryOptions
│   │   └── collection-records-infinite-query.ts
│   │                                       → getCollectionRecordsInfiniteQueryOptions
│   └── mutations/
│       └── collection-create-mutation.ts   → getCollectionCreateMutationOptions
```

**Guidelines:**

- MUST place a query factory under its feature's `queries/` directory and a mutation factory under its `mutations/` directory, following the host project's feature layout.
- MUST name a query file `<name>-query.ts`, an infinite-query file `<name>-infinite-query.ts`, and a mutation file `<name>-mutation.ts`, in kebab-case.
- MUST name the factory for its file — `get<Name>QueryOptions`, `get<Name>InfiniteQueryOptions`, `get<Name>MutationOptions`.
- MUST export exactly one factory per file, colocating only the types that directly support it.
- MUST NOT wrap a factory in a custom hook that hides `useQuery` or `useMutation`; call sites consume the factory directly.
- SHOULD NOT add a barrel file re-exporting factories; import each by its own path.
- SHOULD keep a factory in a shared location only once two or more features genuinely consume it.

## Return an Option Helper, Not a Bare Object

The three helpers — `queryOptions`, `infiniteQueryOptions`, `mutationOptions` — return their argument unchanged at runtime. What they add is types: the returned `queryKey` is **branded** with the data type its `queryFn` produces, which is what makes `getQueryData` and `invalidateQueries` type-safe instead of a stringly-typed guess.

```ts
import { queryOptions } from "@tanstack/react-query";

export interface CollectionListScope {
  readonly userId: string;
  readonly serverUrl: string;
}

export function getCollectionListQueryOptions(scope: CollectionListScope) {
  return queryOptions({
    queryKey: [
      "users",
      scope.userId,
      "collections",
      { server: scope.serverUrl },
    ],
    queryFn: () => fetchCollections(scope),
  });
}
```

Returning a bare object literal instead type-checks and silently loses the branding, so every later cache read falls back to `unknown`.

**Guidelines:**

- MUST return `queryOptions({…})`, `infiniteQueryOptions({…})`, or `mutationOptions({…})` from the factory rather than a bare object literal.
- MUST use `infiniteQueryOptions` for a page-walking query; `queryOptions` does not carry the page-parameter types.
- MUST derive every cache read and invalidation from the factory's returned key — see [query-keys.md](./query-keys.md).
- SHOULD let the factory own the options intrinsic to the operation — the key, the fetch, a deliberate staleness window — and leave per-call options to the call site.

## A Factory Is a Pure Builder

Calling a factory constructs an object. It must not call a hook, start a fetch, or read anything that could differ between the call and the moment the operation runs.

This is why a factory reads a store **imperatively**, through the store's non-reactive accessor, and does it **inside** the `queryFn` or `mutationFn` rather than in the factory body. Reading in the body captures whatever was current when the options were built — a stale closure by the time the fetch executes.

```ts
export function getSignOutMutationOptions() {
  return mutationOptions({
    mutationKey: ["session", "current", "sign-out"],
    mutationFn: async (): Promise<void> => {
      // Read at call time: the freshest session, not the one that existed
      // when these options were constructed.
      const { session, clear } = useAuthStore.getState();
      // …
    },
  });
}
```

**Guidelines:**

- MUST keep the factory free of hook calls; it runs outside React and has no context.
- MUST read a store or singleton through its non-reactive accessor, inside the `queryFn`/`mutationFn`, not in the factory body.
- MUST NOT perform the fetch, mutation, or any side effect while constructing the options.
- SHOULD accept a narrow input — the identifiers and filters the operation varies on — rather than a whole store slice or a component's prop bag.
- MUST thread every factory input that the fetch depends on into the key as well; see [query-keys.md](./query-keys.md).

**Review checks:**

- A custom hook wrapping `useQuery`/`useMutation` in place of a factory — **Major**; the key becomes unreachable for invalidation.
- A bare object literal where an option helper belongs — **Major**; cache reads silently degrade to `unknown`.
- A hook called inside a factory — **Critical**; it either throws or reads from the wrong context.
- A store read in the factory body rather than inside the `queryFn`/`mutationFn` — **Major**; a stale closure, and the failure is intermittent.
- More than one factory exported from one file, or a barrel re-exporting factories — **Minor**.
- A raw fetch or database call in a component, bypassing the layer entirely — **Major**; it has no cache identity and nothing can invalidate it.
