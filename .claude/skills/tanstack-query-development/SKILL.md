---
name: tanstack-query-development
description: The ability to build and review an application's server-state layer with TanStack Query v5 — the data a server owns, cached on the client. Covers the option-factory pattern (`queryOptions`/`infiniteQueryOptions`/`mutationOptions` returned from a `get<Name>…Options` function, never a bespoke wrapper hook); tenancy-rooted query keys; the `queryFn` contract and cancellation; consuming a query and its Suspense variants; `staleTime`, `gcTime`, and the refetch triggers; `enabled`, dependent queries, and request waterfalls; prefetching and seeding; pagination and infinite lists; mutations, invalidation, and optimistic updates; error channels and `meta`-declared telemetry; the query client; TypeScript inference; testing through a real client; the ESLint plugin's rules; React Native focus and online wiring; and, conditionally, server rendering and cache persistence.
when_to_use: Use when writing or reviewing anything that reads or writes server state through TanStack Query — "useQuery", "useMutation", "queryOptions", "queryKey", "staleTime", "gcTime", "invalidateQueries", "setQueryData", "optimistic update", "infinite scroll", "prefetch", "QueryClient", "dehydrate", "persistQueryClient", a stale list after a write, a duplicate or colliding cache entry, or a refetch that fires too often or never. For a component's own composition, props, and state use a React component development capability; for framework routing and rendering use the matching app-framework capability.
user-invocable: false
---

# TanStack Query Development

Use this capability whenever you write or review code that reads or writes **server state** — data another system owns, which the client holds only as a cache. It owns how that data is organized: where a query or mutation is defined, what identifies it in the cache, when it refetches, what invalidates it, how a failure surfaces, and how all of it is tested.

Server state is not application state. It goes stale on its own, it can be refetched, and two components asking for it should get one request. That is the whole reason this layer exists, and the rules below follow from it.

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119.html).

## Baseline and Scope

**TanStack Query v5 is the baseline**, verified against **5.101.4** — the current release at the time of writing. React 18 and TypeScript 5.4 are the minimums. Types ship as **patch** releases rather than majors, so a project should pin the patch version and expect type changes between them.

**The React adapter is the only one in scope.** The Vue, Svelte, Solid, Angular, Lit, and Preact adapters version independently of it and are out of scope entirely — no rule, no comparison.

**Both web and React Native are in scope.** Native needs wiring the browser gets for free; [react-native.md](./references/react-native.md) covers it, and skipping it silently disables two defaults rather than failing loudly.

**Two references are conditional.** [server-rendering.md](./references/server-rendering.md) applies only where the host renders on a server or uses React Server Components; [offline-persistence.md](./references/offline-persistence.md) applies only where the host's requirements call for offline continuity. Load neither by default.

**Version-sensitive claims name their version.** Behaviour has moved inside v5 — the mutation callback signatures gained an `onMutateResult` and a `context` argument, and `staleTime: 'static'`, `subscribed`, and `environmentManager` are all recent additions. Treat an unversioned claim about this library, here or anywhere else, as suspect and check it against the installed version's documentation.

## Boundaries

This skill stops where another capability owns the subject:

- **A component's own mechanics** — composition, props contracts, extracted hooks, state placement, memoization, loading and error surfaces, list virtualization, test-hook naming — belong to a React component development capability. This skill states only what a component owes a query it consumes.
- **CSS, design tokens, and themes** belong to a React component styling capability.
- **Framework routing, rendering, directives, route handlers, and on-device storage mechanisms** belong to the matching app-framework capability. Where one of those forbids hand-rolling a cache or requires a request to be cancelled on teardown, this skill supplies the mechanism and names that capability as owner of the trigger.
- **Log levels, capture semantics, breadcrumbs, and PII boundaries** belong to a software instrumentation capability. This skill owns only where a failure is caught, surfaced, and **declared** — see the `meta` channel in [error-handling.md](./references/error-handling.md) — not what a logger or error tracker does with it afterwards.
- **Assertion design, fixture quality, and coverage judgment** belong to unit-testing and quality-assurance capabilities. [testing.md](./references/testing.md) owns only what is specific to testing this library.

**The host project's existing convention wins.** Every rule states a default for a project that has not decided yet. Where the surrounding codebase already answers a question — the directory layout, the retry count, the error channel — match what is there rather than migrating the codebase as a side effect of an unrelated change.

## Server-State Boundary

See [server-state-boundary.md](./references/server-state-boundary.md) for:

- deciding whether a piece of data belongs to this layer, a store library, or a component
- recognizing a lifecycle or effect hook that looks like a query but is not one
- what remains in a global store once server state moves out of it

## Option Factories

See [option-factories.md](./references/option-factories.md) for:

- placing a query or mutation definition under its feature, and naming the file and the function
- returning one of the three option helpers, and why a bespoke wrapper hook is not an alternative
- keeping a factory a pure builder that calls no hook and starts no fetch
- deciding what a factory accepts as input, and what it reads at call time instead

## Query Keys

See [query-keys.md](./references/query-keys.md) for:

- putting the tenant at the root of a key when more than one can exist at a time
- shaping the resource path beneath it, and distinguishing a list from a single item
- placing filters, sorting, and pagination in the key
- deciding which inputs belong in the key and which deliberately stay out
- deriving every cache read and invalidation from the factory rather than retyping the array
- registering a project-wide key type

## Query Functions

See [query-functions.md](./references/query-functions.md) for:

- the promise contract, and the one return value that is treated as a failure
- making a transport that does not throw on an error response behave like one
- what the function receives, and reading a store or singleton without a hook
- threading the abort signal, cancelling manually, and where the teardown trigger is owned
- streaming a response that arrives in chunks

## Consuming a Query

See [consuming-queries.md](./references/consuming-queries.md) for:

- calling a factory from a component, and layering a per-call option onto it
- telling the two status fields apart, and picking the one a spinner should read
- rendering the loading, error, empty, and loaded branches
- narrowing what a component subscribes to, and the two destructuring habits that defeat it
- reading a query result inside a React hook dependency array
- the Suspense variants, what they give up, and what to do when the key changes

## Cache Lifetime

See [cache-lifetime.md](./references/cache-lifetime.md) for:

- the defaults that surprise a first-time reader, and which of them to change deliberately
- choosing a staleness window, including the two values that stop refetching entirely
- how long an unused entry survives, and how that interacts with staleness
- the three automatic refetch triggers and turning one down
- polling on a timer, adapting the interval, and stopping it
- what belongs on the shared client versus on one factory

## Fetch Orchestration

See [fetch-orchestration.md](./references/fetch-orchestration.md) for:

- gating a query on a condition, and the type-safe alternative to a boolean gate
- one query waiting on another, and why that is a cost rather than a pattern
- running a set of queries whose size changes between renders
- recognizing a request waterfall and the three ways to flatten one
- warming the cache ahead of a render, and which warming call returns data or throws

## Seeding the Cache

See [seeding-the-cache.md](./references/seeding-the-cache.md) for:

- choosing between data that is written to the cache and data that only stands in for it
- telling the cache how old the seed already is
- building a seed out of a list query a detail view is opening from
- writing a value directly when it is already in hand

## Paginated and Infinite Queries

See [paginated-and-infinite-queries.md](./references/paginated-and-infinite-queries.md) for:

- defining a page-walking query, and the property order its type inference depends on
- deciding there is no next page, and capping how many are retained
- driving "load more" from a list without racing the fetch already in flight
- flattening pages for rendering, and what a refetch costs once several are loaded
- keeping the previous page visible while a page-numbered query moves

## Mutations

See [mutations.md](./references/mutations.md) for:

- defining a write, typing its variables, and keying it
- triggering it, and choosing between the callback form and the promise form
- deciding whether a callback belongs to the operation or to the screen that fired it
- the callback signatures and the property order inference depends on
- clearing a finished mutation's state, and serializing writes that must not interleave

## Cache Invalidation

See [cache-invalidation.md](./references/cache-invalidation.md) for:

- evicting what a write made stale, at the narrowest scope that is still correct
- matching by prefix, exactly, or by predicate
- holding a mutation pending until the refetch it triggered finishes
- writing a response straight into the cache instead of refetching it
- choosing among invalidate, refetch, reset, and remove
- clearing a session's entries when it ends

## Optimistic Updates

See [optimistic-updates.md](./references/optimistic-updates.md) for:

- showing a pending write without touching the cache
- writing to the cache ahead of the server, and rolling back when it fails
- stopping an in-flight refetch from overwriting the optimistic value
- reaching a pending mutation from a component that did not fire it
- choosing between the two approaches

## Error Handling

See [error-handling.md](./references/error-handling.md) for:

- making a failure reach the query at all, and the callbacks v5 removed
- choosing one error channel per query and what each one suits
- resetting an error boundary so a failed query can be retried
- deciding what a mutation swallows and what it lets through
- keeping user-facing copy out of the data layer
- declaring a failure's reporting policy on the query itself
- setting a retry policy, and what must never be retried

## The Query Client

See [query-client.md](./references/query-client.md) for:

- creating exactly one client, and the two correct ways to hold it
- what belongs in the client's defaults versus on an individual factory
- reaching the client from inside a factory versus from inside a component
- setting defaults for a family of keys

## TypeScript

See [typescript.md](./references/typescript.md) for:

- where inference comes from, and the one function that has to be typed for it to work
- narrowing a result to get at its data
- typing the error, and narrowing a domain subclass at the call site
- registering project-wide types for errors, metadata, and keys
- the cache-read helper that infers and the one that does not

## Testing

See [testing.md](./references/testing.md) for:

- giving each test its own client, and the settings a test client needs
- what to mock, and the layer that must never be mocked
- asserting on an asynchronous result, and covering each state branch
- testing an option factory on its own
- exercising a page-walking query, and rendering a route that owns one

## Tooling and Versions

See [tooling-and-versions.md](./references/tooling-and-versions.md) for:

- the eight lint rules, each as a rule a reader can follow without the linter
- when installing the plugin is worth it and when the rules stay review checks
- inspecting the cache while diagnosing, on web and elsewhere
- what changed on the way to v5, for a codebase arriving from v4
- reading documentation at the version actually installed

## React Native

See [react-native.md](./references/react-native.md) for:

- connecting the two managers that the browser populates automatically
- what silently stops working when they are not connected
- refetching when a screen regains focus, and unsubscribing one that loses it
- fetching on a device whose network drops more often than a browser's

## Server Rendering

Load only where the host renders on a server or uses React Server Components.

See [server-rendering.md](./references/server-rendering.md) for:

- creating a client per request on the server and one for the browser session
- the defaults that change when rendering starts on a server
- moving cache entries across the boundary, and what is excluded or redacted
- fetching in a server component and consuming the result in a client one
- where this skill stops and the app-framework capability takes over

## Offline Persistence

Load only where the host's requirements call for offline continuity.

See [offline-persistence.md](./references/offline-persistence.md) for:

- choosing how the layer behaves with no connection, and the state a paused fetch reports
- writes that queue while offline and resume in order
- persisting the cache, restoring it, and rendering while a restore is in flight
- why persistence here is not the hand-rolled cache an app-framework capability forbids
- invalidating a persisted cache on release, and keeping one tenant's data out of another's session
