# Query Keys

Apply this reference when shaping a key, adding an input to a query, or reviewing whether a cache entry can collide with another. The key is the cache's identity; almost every cache defect is a key defect.

## The Shape of a Key

A key is an array, hashed deterministically. Object property order inside a key does not matter; **array position does**.

```ts
// Identical — object property order does not matter.
["todos", { status, page }];
["todos", { page, status }];

// Different — array position does.
["todos", status, page];
["todos", page, status];
```

Everything in a key must survive `JSON.stringify`. A `Date`, `Map`, or class instance in a key hashes unreliably and silently splits or merges entries.

**Guidelines:**

- MUST make every key an array at the top level, containing only JSON-serializable values.
- MUST treat array position as significant and object property order as insignificant when reasoning about whether two keys match.
- MUST NOT put a non-serializable value — a `Date`, `Map`, `Set`, or class instance — in a key; convert it to a primitive first.

## The Tenancy Root

When more than one account, session, server, or region can exist at a time, **the tenant identifier is the root of the key**, as a `[kind, id]` pair — not a filter object trailing the resource.

```ts
// The signed-in user's collections.
["users", userId, "collections"];

// That collection's records.
["users", userId, "collections", collectionSlug, "records"];

// Everything belonging to that user — one prefix reaches all of it.
["users", userId];
```

Putting the tenant in a trailing filter — `["collections", { userId }]` — still separates entries correctly, so nothing looks broken. What it loses is **reach**: no prefix selects one tenant's entries, so signing out cannot evict them in one call, and a per-tenant invalidation has to enumerate every resource kind.

A single-tenant application does not need the root, and adding one there is noise. The test is whether two tenants' data can be resident at the same time.

**Guidelines:**

- MUST place the tenant identifier at the root of the key as a `[kind, id]` pair whenever more than one tenant's data can be resident at once.
- MUST include every dimension of tenancy the deployment actually has — the account, and the server or region where those vary independently.
- MUST NOT express tenancy as a trailing filter object when a tenancy root applies; it forfeits prefix reach.
- SHOULD omit a tenancy root in a genuinely single-tenant application, and add it as part of the change that introduces a second tenant.
- MUST make the sign-out eviction in [cache-invalidation.md](./cache-invalidation.md) target that root prefix.

## The Resource Path

Beneath the tenancy root, a key mirrors the resource's path: alternating kind and identifier segments, nesting the way a URL does. A **list** ends at the kind and omits the identifier, which is what keeps a list and a single item from colliding.

```ts
// A list — ends at the kind, no identifier.
["users", userId, "collections"];

// One item.
["users", userId, "collections", slug];

// A nested list.
["users", userId, "collections", slug, "records"];

// One nested item.
["users", userId, "collections", slug, "records", recordId];

// A sorted list — the filter object goes last.
["users", userId, "collections", { sort: "-createdAt" }];
```

Filters, sorting, and pagination go in a **single object** in the last position — never as loose positional segments, which are order-dependent and unreadable.

**Guidelines:**

- MUST shape the resource path as alternating kind and identifier segments, so a broader prefix invalidates everything nested beneath it.
- MUST end a list key at the resource kind, omitting the identifier.
- MUST express filters, sorting, and pagination as one trailing object rather than as separate positional segments.
- SHOULD keep identifier segments stable primitives — a slug, an id — and confine anything variable to the trailing object, since an unstable identifier explodes cache cardinality.

## What Goes In, and What Stays Out

Every input the `queryFn` reads that can **change what comes back** belongs in the key. An input that is missing merges two different reads into one entry, and the second caller silently gets the first one's data.

The converse matters just as much: a value the fetch needs but that does **not** identify the data stays out. An auth token is the canonical case — it authenticates the request, but a token refresh does not make the data different, and putting it in the key fragments the cache on every refresh.

**Guidelines:**

- MUST include every `queryFn` input that changes the result — an id, a filter field, a locale, a tenant — in the key.
- MUST NOT put a credential, token, or other rotating value in the key when it authenticates the request without identifying the data; read it at call time instead.
- MUST NOT include a value the `queryFn` never reads; it fragments the cache for nothing.
- SHOULD build a mutation key from the same tenancy-rooted path as the resource it writes, with the action verb appended — see [mutations.md](./mutations.md).

## Deriving the Key, Never Retyping It

The factory is the one place a key is written. Every cache read, write, and invalidation reads it back from there, which is what makes those calls type-safe and what stops a key from drifting out of sync with its factory.

```ts
queryClient.invalidateQueries({
  queryKey: getCollectionListQueryOptions(scope).queryKey,
});
queryClient.getQueryData(getCollectionListQueryOptions(scope).queryKey);
```

A project can also register a repository-wide key type, so every key is checked against one shape:

```ts
declare module "@tanstack/react-query" {
  interface Register {
    queryKey: ["users", string, ...ReadonlyArray<unknown>];
  }
}
```

**Guidelines:**

- MUST derive a key for `getQueryData`, `setQueryData`, `invalidateQueries`, or any filter from the factory rather than retyping the array.
- MUST NOT hand-write a key array at a call site; a typo produces a silent no-op, not an error.
- SHOULD register a project-wide `queryKey`/`mutationKey` type when the project wants every key to share a root shape.

**Review checks:**

- A `queryFn` input missing from the key — **Critical**; two different reads collide on one entry and the wrong data renders.
- Multi-tenant data with no tenancy root — **Major**; sign-out cannot evict in one call and a tenant switch can serve the previous tenant's entry.
- A token, session object, or other rotating credential in the key — **Major**; every refresh fragments the cache.
- A hand-written key array at a call site instead of the factory's — **Major**; it silently stops matching when the factory changes.
- A list key carrying the identifier of the item it lists — **Major**; the list and the item share one entry.
- Filters spread across positional segments rather than a trailing object — **Minor**.
- A non-serializable value in a key — **Major**; hashing is unreliable.
