# TypeScript

Apply this reference when inference is producing `unknown`, when narrowing an error at a call site, or when setting up project-wide types for this layer.

## Where Inference Comes From

Types flow from the `queryFn`'s return type outward — through `data`, through `select`, and into every cache read that uses the factory's key. Nothing needs annotating **if** that function is typed.

Most transport clients return `any`, which is where inference quietly dies: `data` becomes `any`, no error is reported, and the loss only shows up much later as an unchecked property access.

```ts
// The one signature that has to be explicit.
const fetchCollections = (scope: Scope): Promise<Collection[]> =>
  api.get(`/collections`).then((r) => r.data);
```

The option helper is what carries the type onto the key. A key obtained from `getX(input).queryKey` is **branded** with the data type, so `getQueryData` returns `Collection[] | undefined` instead of `unknown`.

```ts
const data = queryClient.getQueryData(
  getCollectionListQueryOptions(scope).queryKey,
);
//    ^? Collection[] | undefined
```

**Guidelines:**

- MUST give the data-layer function an explicit return type; a transport returning `any` silently erases inference for everything downstream.
- MUST read the cache through the factory's branded key rather than a hand-written array, which yields `unknown` and needs a generic to compensate.
- MUST NOT paper over lost inference with a type assertion at the call site; fix the function's return type instead.
- SHOULD define the query's shape as a transfer type the data layer returns, rather than leaking the transport's response envelope into components.

## Narrowing a Result

The result is a discriminated union on `status` and its boolean flags. Checking one narrows `data` to defined:

```ts
const { data, isSuccess } = useQuery(getCollectionListQueryOptions(scope));
if (isSuccess) {
  data; // Collection[]
}
```

The Suspense hooks skip this entirely — `data` is guaranteed defined, which is much of their appeal. See [consuming-queries.md](./consuming-queries.md) for what they cost.

`select` re-types `data` to its own return type, so a narrowed selector changes what the component sees without any annotation.

**Guidelines:**

- MUST narrow on `status` or a boolean flag before reading `data`, rather than asserting it is defined.
- SHOULD order the branches loading → error → loaded so the loaded branch narrows naturally, which is also the render order in [consuming-queries.md](./consuming-queries.md).

## Typing the Error

`TError` defaults to `Error`. A factory that throws a subclass keeps it assignable, so the call site narrows with `instanceof` — the mechanism [error-handling.md](./error-handling.md)'s mapping depends on.

```ts
if (error instanceof CollectionRequestError && error.kind === "auth") {
  // …
}
```

Passing an explicit error generic to the hook is possible and costs the inference of every other generic. Narrowing at the call site is the better trade.

A project can also register the error type globally, which is how a codebase forces every call site to narrow explicitly:

```ts
declare module "@tanstack/react-query" {
  interface Register {
    defaultError: unknown; // call sites must narrow
  }
}
```

**Guidelines:**

- MUST narrow a domain error with `instanceof` at the call site rather than passing an error generic to the hook.
- MUST NOT throw a non-`Error` value from a `queryFn` or `mutationFn`; it defeats the default typing and every consumer's narrowing.
- SHOULD register `defaultError` globally only where the project wants explicit narrowing enforced everywhere, since it makes every call site do the work.

## Project-Wide Registration

The `Register` interface is the one place a project changes types for the whole layer:

| Field                        | Effect                                            |
| ---------------------------- | ------------------------------------------------- |
| `defaultError`               | the error type at every call site                 |
| `queryMeta` / `mutationMeta` | the shape of `meta`, which is otherwise free-form |
| `queryKey` / `mutationKey`   | a required shape for every key                    |

Registering `queryKey` is what mechanically enforces a tenancy root — a key not starting with the tenant pair stops compiling:

```ts
declare module "@tanstack/react-query" {
  interface Register {
    queryKey: ["users", string, ...ReadonlyArray<unknown>];
  }
}
```

The registered types must extend what the library expects — `meta` an object type, a key an array type — or registration fails in ways that are hard to read.

**Guidelines:**

- SHOULD register `queryMeta`/`mutationMeta` wherever `meta` carries a reporting policy, so it is a typed contract rather than a free-form record.
- SHOULD register `queryKey` where the project wants a root shape — a tenancy root — checked by the compiler rather than by review.
- MUST keep a registered `meta` type extending `Record<string, unknown>` and a registered key type extending an array type.

## Version and Inference Caveats

Types ship as **patch** releases, so a patch upgrade can change what compiles. Pin the patch version and treat a type change on upgrade as expected rather than as a defect.

Two known inference gaps, verified against **5.101.4**:

- `getQueriesData` returns an array of tuples with heterogeneous data and does **not** infer; pass the type explicitly.
- An inline `select` on a query object passed to `useQueries` cannot infer its argument from that object's own `queryFn`; build the entry from a factory instead — see [fetch-orchestration.md](./fetch-orchestration.md).

**Guidelines:**

- MUST pin the patch version of the library, since type changes ship in patches.
- MUST pass an explicit type to `getQueriesData`; it cannot infer.
- SHOULD build `useQueries` entries from factories, which sidesteps the inline-`select` inference gap.

**Review checks:**

- A data-layer function returning `any` or an untyped transport result — **Major**; inference is lost everywhere downstream and nothing reports it.
- A type assertion on `data` instead of narrowing — **Major**; it defeats the union that exists to prevent exactly that read.
- A generic passed to `useQuery` to fix an error type — **Minor**; it disables inference for the other generics.
- `getQueryData` on a hand-written key, returning `unknown` — **Major**; usually paired with an assertion that hides a real mismatch.
- A non-`Error` value thrown from a query or mutation function — **Major**.
- An unpinned minor range on the library where the project is type-strict — **Minor**.
