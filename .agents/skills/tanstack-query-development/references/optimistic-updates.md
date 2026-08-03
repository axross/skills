# Optimistic Updates

Apply this reference when a write should appear applied before the server confirms it, or when reviewing an optimistic surface that flickers, double-renders, or fails to roll back.

## Two Approaches

Both are shown in the [Optimistic Updates guide](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates), as two worked examples rather than as a choice with consequences:

| Approach          | Where the pending value lives | Rollback                | Visible in              |
| ----------------- | ----------------------------- | ----------------------- | ----------------------- |
| Through the UI    | the mutation's `variables`    | automatic — none needed | the triggering surface  |
| Through the cache | written into the cache entry  | manual, via a snapshot  | every reader of the key |

The UI approach is dramatically simpler and should be the default. The cache approach exists for when more than one surface has to reflect the pending write.

## Through the UI

While a mutation is pending, its `variables` are available. Render them alongside the query's data and the pending row appears immediately; when the mutation settles and the list refetches, the real row replaces it.

```tsx
const { mutate, isPending, variables, isError } = useMutation(
  getAddTodoMutationOptions(),
);

<ul>
  {todos.map((todo) => (
    <li key={todo.id}>{todo.text}</li>
  ))}
  {isPending && <li style={{ opacity: 0.5 }}>{variables.text}</li>}
</ul>;
```

Nothing is written to the cache, so nothing needs rolling back — a failure simply stops rendering the pending row. `variables` survive a failure, so the row can persist with a retry control instead of vanishing.

This depends on the invalidation being awaited: returning the invalidation promise from `onSettled` keeps the mutation pending until the refetch lands, so the optimistic row is replaced rather than briefly disappearing between the two.

**Guidelines:**

- SHOULD use the `variables`-based approach by default; it needs no snapshot, no rollback, and no cancellation.
- MUST return the invalidation promise from the mutation's `onSettled`, or the optimistic row disappears for a frame before the real one arrives.
- SHOULD keep the failed row rendered from `variables` with a retry affordance rather than silently discarding the user's input.
- SHOULD distinguish the pending row visually, so an unconfirmed write is not presented as saved.

## Through the Cache

When several surfaces must reflect the write, the value goes into the cache in `onMutate` and is rolled back in `onError`.

Three steps, and the first is the one that gets forgotten:

```ts
onMutate: async (newTodo, context) => {
  // 1. Stop an in-flight refetch from landing on top of the optimistic write.
  await context.client.cancelQueries({ queryKey: todosKey });
  // 2. Snapshot for rollback.
  const previous = context.client.getQueryData(todosKey);
  // 3. Write optimistically.
  context.client.setQueryData(todosKey, (old) => [...old, newTodo]);
  return { previous };
},
onError: (_error, _variables, onMutateResult, context) => {
  // Optional-chained: the callback signature types this as possibly
  // undefined, since onMutate may not have run.
  context.client.setQueryData(todosKey, onMutateResult?.previous);
},
onSettled: (_data, _error, _variables, _onMutateResult, context) =>
  context.client.invalidateQueries({ queryKey: todosKey }),
```

Without the `cancelQueries`, a refetch already in flight resolves after the optimistic write and overwrites it — an intermittent bug that reproduces only under a race.

`onMutate`'s return value arrives as `onMutateResult` in the later callbacks. Note the position: it is the **third** argument of `onError`, not the second — see [mutations.md](./mutations.md).

**Guidelines:**

- MUST call `cancelQueries` on every key about to be optimistically written, and await it, before taking the snapshot.
- MUST snapshot before writing and restore that snapshot in `onError`.
- MUST invalidate in `onSettled` regardless of outcome, so the authoritative value replaces the optimistic one.
- MUST update immutably; mutating the cached object breaks rollback, because the snapshot references the same object.
- MUST read the rollback handle from the correct callback argument position for the installed version.

## Reaching a Mutation From Elsewhere

When the mutation and the query live in different components, `useMutationState` reads pending mutations out of the cache by key:

```tsx
const pending = useMutationState<string>({
  filters: {
    mutationKey: ["users", userId, "todos", "create"],
    status: "pending",
  },
  select: (mutation) => mutation.state.variables?.text,
});
```

It returns an **array** — several writes can be in flight at once. `mutation.state.submittedAt` gives each a stable key for rendering.

This is what makes the UI approach viable across a screen, and it needs a `mutationKey` to filter on.

**Guidelines:**

- MUST give a mutation a `mutationKey` when any other component needs to observe it.
- MUST handle the array form; concurrent writes are normal, and rendering only the first drops the rest.
- SHOULD key concurrent optimistic rows on `submittedAt` rather than on array index.

## Choosing

Reach for the cache approach only when the UI approach cannot express the requirement — that is, when a surface other than the triggering one must show the pending state. The cache approach costs a snapshot, a rollback path, a cancellation, and a race that only appears under load; none of that is worth paying for a single list.

**Guidelines:**

- SHOULD default to the UI approach and escalate to the cache approach only for a genuinely multi-surface requirement.
- MUST NOT apply an optimistic update to a write whose failure the user must not miss — a payment, a destructive action; show real pending state instead.
- SHOULD skip optimism entirely where the round trip is fast enough that a pending state is adequate.

**Review checks:**

- An optimistic cache write with no preceding `cancelQueries` — **Major**; an in-flight refetch overwrites it, intermittently.
- A `cancelQueries` that is not awaited — **Major**; same failure, narrower window.
- An optimistic write with no snapshot or no `onError` rollback — **Major**; a failed write leaves fabricated data in the cache.
- A mutating updater inside `onMutate` — **Critical**; the snapshot aliases the same object, so rollback restores the mutated value.
- The rollback handle read from the wrong callback argument — **Critical**.
- The cache approach used where only the triggering component renders the result — **Minor**; unnecessary complexity and a race for nothing.
- An optimistic update on a destructive or financial action — **Major**.
