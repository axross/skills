# Testing

Apply this reference when testing a component that queries, testing a factory, or reviewing a test that mocks this layer.

General test design — file placement, fixture quality, what is worth asserting — belongs to a unit-testing capability. This reference owns only what is specific to this library.

## A Client per Test

Every test gets its own client, so one test's cached result cannot satisfy another's assertion. A shared client makes tests pass in one order and fail in another.

The test client also turns retries **off**. With the default of three retries and exponential backoff, a test of a failing query waits seconds before the error appears, and usually times out instead.

```ts
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}
```

Turning retries off on the client only works where the query does not set its own — per-query options win. A factory with an explicit `retry` needs it overridden at the call site in the test.

**Guidelines:**

- MUST construct a fresh client per test and never reuse the application's singleton, so cache state cannot leak between tests.
- MUST disable retries on the test client, or an error-path test waits for backoff and times out.
- MUST override a factory's own `retry` at the call site when testing its failure path; the client default does not reach it.
- SHOULD set `gcTime: Infinity` under a runner that warns about work scheduled after the test ends.

## Mock the Data Layer, Never the Query Layer

Stubbing `useQuery` to return `{ data, isPending }` tests the stub. The component's real branch selection, the factory's key, the `select`, and the error mapping all stop running — which is exactly the logic worth covering.

Mock the **data-layer function the `queryFn` calls**, and let everything above it run for real.

```tsx
jest.mock("~/collections/helpers/fetch-collections");

it("renders the fetched collections", async () => {
  jest.mocked(fetchCollections).mockResolvedValue([{ slug: "posts" }]);
  const client = createTestQueryClient();

  const { getByText } = render(
    <QueryClientProvider client={client}>
      <CollectionList />
    </QueryClientProvider>,
  );

  await waitFor(() => expect(getByText("posts")).toBeTruthy());
});
```

Keep the domain error class real when the component maps errors by type — mocking it away turns an `instanceof` check into a silent false.

**Guidelines:**

- MUST NOT mock `useQuery`, `useMutation`, or a `queryClient` method to inject state; mock the data-layer dependency instead.
- MUST provide a real client through the provider so the component's own hooks run.
- SHOULD keep domain error classes real so `instanceof`-based mapping is genuinely exercised.
- SHOULD seed the mock per test rather than globally, so each test states the data it depends on.

## Asserting Asynchronously

Everything here resolves asynchronously, so assertions wait. `waitFor` on the observable outcome — rendered text, a mapped error message, a follow-on call — is the assertion; the intermediate flags rarely are.

Each state branch deserves its own test, and the loading branch needs a promise that never resolves to hold the query pending:

```ts
jest.mocked(fetchCollections).mockReturnValue(new Promise(() => {}));
```

**Guidelines:**

- MUST wait for the outcome with `waitFor` rather than asserting synchronously after render.
- SHOULD cover loading, error, empty, and loaded separately, since each is a distinct branch — see [consuming-queries.md](./consuming-queries.md).
- SHOULD hold a query pending with a never-resolving promise to test the loading branch, rather than asserting on a flag before the fetch starts.
- SHOULD assert what the user observes rather than the query's internal flags.

## Testing a Factory Directly

A factory is a plain function, so its output can be asserted without React. This is worth doing where the **key** derives from inputs non-trivially — that key is the target of every invalidation, and getting it wrong breaks things far from where the mistake lives.

What is not worth asserting: a `queryFn` result that merely restates the mock. That tests the mock. Test the factory's own contribution — key shape, input threading, the store read, the side effects its callbacks trigger.

**Guidelines:**

- SHOULD assert a factory's key shape directly where the key derives from inputs non-trivially, including that the tenancy root is present.
- MUST NOT assert a `queryFn` result that only restates the mocked helper.
- SHOULD exercise `queryFn`/`mutationFn` behaviour through the consuming flow, or by invoking the returned option's function with the helper mocked.

## Page-Walking Queries and Routes

An infinite query is tested by driving it: assert the first page, call `fetchNextPage`, then assert the accumulation. The mock has to vary its response by page parameter, or the second page is indistinguishable from the first.

Where a screen renders through a router's test renderer, the provider goes **inside** the route map, wrapping the route component — a provider outside the renderer is not in the tree the route mounts into:

```tsx
renderRouter(
  {
    "collections/index": () => (
      <QueryClientProvider client={client}>
        <CollectionsScreen />
      </QueryClientProvider>
    ),
  },
  { initialUrl: "/collections" },
);
```

**Guidelines:**

- MUST vary the mocked response by page parameter when testing a page-walking query, or the accumulation assertion passes vacuously.
- MUST wrap the route component inside the route map when testing through a router's test renderer.
- SHOULD assert the flattened, rendered result rather than the `pages` array's internal shape.

**Review checks:**

- `useQuery` or `useMutation` mocked to inject state — **Major**; the test covers the stub, not the component.
- A `queryClient` method stubbed to fake cache contents — **Major**; same problem.
- A client shared across tests — **Major**; produces order-dependent passes that are painful to diagnose later.
- A test client with retries enabled on an error-path test — **Major**; it times out or takes seconds.
- A factory with its own `retry` tested without overriding it — **Major**; the client default does not apply.
- An assertion that only restates the mocked helper's return value — **Minor**; it tests nothing.
- A missing loading, empty, or error branch test on a surface that renders all four — **Minor**.
