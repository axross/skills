# Mutations

Apply this reference when writing an operation that changes server state, wiring it to a form or a control, or reviewing where its callbacks live.

## Defining a Write

A mutation factory returns `mutationOptions` with a typed `mutationFn` and a key. Typing the function's parameter and return value is what makes the call site infer its variables and data.

```ts
export interface SignInInput {
  serverUrl: string;
  email: string;
  password: string;
}

export function getSignInMutationOptions() {
  return mutationOptions({
    mutationKey: ["session", "sign-in"],
    mutationFn: async (input: SignInInput): Promise<Session> => {
      const result = await login(input);
      await useAuthStore.getState().authenticate(result);
      return result;
    },
  });
}
```

`mutationKey` is optional to the library and worth including anyway: it is what makes a write findable by `useIsMutating` and `useMutationState`, and what `setMutationDefaults` targets — the mechanism offline resumption depends on.

Build the key from the same tenancy-rooted resource path as the data it writes, with the **action verb last**. A create omits the identifier, since the resource does not exist yet.

```ts
// A create omits the identifier — the resource does not exist yet.
["users", userId, "collections", "create"];

// An action on an existing resource includes it.
["users", userId, "collections", slug, "update"];
["users", userId, "collections", slug, "delete"];

// An action on the current session.
["session", "sign-in"];
```

**Guidelines:**

- MUST type the `mutationFn`'s variables and return value explicitly, so the call site infers them.
- MUST give every mutation a `mutationKey` built from the target resource's path with the action verb appended.
- MUST omit the resource identifier for a create and include it for an action on an existing resource.
- SHOULD keep the verb a bare imperative — `create`, `update`, `delete`, `sign-in` — naming what the function does.

## Triggering It

`mutate` fires and forgets, reporting through state. `mutateAsync` returns a promise that rejects on failure — which means an unhandled rejection unless the caller catches it.

Reach for `mutate` by default. `mutateAsync` earns its keep only where the caller genuinely needs to sequence on the result, and then the `try`/`catch` is mandatory.

```tsx
const { mutate, isPending, error, reset } = useMutation(
  getSignInMutationOptions(),
);

const onSubmit = () => mutate(input, { onSuccess: () => router.back() });
```

`reset()` clears a finished mutation's `error` and `data` — the way a form drops a stale error message when the user starts editing again.

**Guidelines:**

- SHOULD use `mutate` and read state, rather than `mutateAsync`, unless the caller must sequence on the result.
- MUST wrap `mutateAsync` in `try`/`catch`; an uncaught rejection surfaces as an unhandled promise rejection rather than as mutation state.
- SHOULD call `reset()` when the user changes an input after a failure, so stale error copy does not persist.
- MUST NOT pass the DOM event straight to `mutate`; pass the extracted variables.

## Where a Callback Belongs

The placement encodes ownership.

| Concern                                                  | Belongs                   |
| -------------------------------------------------------- | ------------------------- |
| Cache invalidation, optimistic rollback, error reporting | the factory's callbacks   |
| Navigation, a toast, resetting a form                    | the `mutate(…)` call site |

Anything intrinsic to the write happens however it was triggered, so it belongs to the operation. Anything about the screen that fired it belongs to that screen — baking navigation into the factory makes the mutation unusable from anywhere else.

Both run: the factory's callbacks fire first, then the call site's. Two caveats matter:

- Call-site callbacks do **not** run if the component unmounts before the mutation settles. Factory callbacks always do — so anything that must happen regardless belongs in the factory.
- On repeated `mutate` calls, factory callbacks run for every call; call-site callbacks run **once**, for the last one only.

**Guidelines:**

- MUST put cache invalidation and rollback in the factory's callbacks, so they happen no matter which screen triggered the write.
- MUST put navigation, toasts, and form resets at the `mutate(…)` call site, not in the factory.
- MUST NOT rely on a call-site callback for anything that must happen even if the component unmounts.
- SHOULD leave a factory whose only failure handling is showing the error on screen callback-free, and let the component's `error` state drive the UI.

## Callback Signatures and Property Order

The signatures gained arguments during v5 — verified against **5.101.4**:

```ts
interface MutationCallbacks<TVariables, TData, TError, TOnMutateResult> {
  onMutate: (
    variables: TVariables,
    context: MutationFunctionContext,
  ) => Promise<TOnMutateResult> | TOnMutateResult;
  // Non-optional here: onSuccess runs only after onMutate resolved.
  onSuccess: (
    data: TData,
    variables: TVariables,
    onMutateResult: TOnMutateResult,
    context: MutationFunctionContext,
  ) => Promise<unknown> | unknown;
  // Optional here: these can run when onMutate never did.
  onError: (
    error: TError,
    variables: TVariables,
    onMutateResult: TOnMutateResult | undefined,
    context: MutationFunctionContext,
  ) => Promise<unknown> | unknown;
  onSettled: (
    data: TData | undefined,
    error: TError | null,
    variables: TVariables,
    onMutateResult: TOnMutateResult | undefined,
    context: MutationFunctionContext,
  ) => Promise<unknown> | unknown;
}
```

`onMutateResult` is what `onMutate` returned — the rollback handle. `context` carries `context.client`, so a callback can reach the query client without importing a singleton or calling a hook.

Code written against the older three-argument shape reads `context` where `onMutateResult` now sits, and fails at runtime rather than in the type checker if the shapes happen to be compatible.

The nullability differs by callback, and the reason is worth knowing: `onSuccess` runs only once `onMutate` has resolved, so its rollback handle is guaranteed. `onError` and `onSettled` can run when `onMutate` never did — a failure before it, or no `onMutate` at all — so theirs is possibly `undefined`. The call-site options passed to `mutate(variables, { … })` are a **different** interface, where `onSuccess`'s handle is optional too.

**Property order matters** here too, but less than it is often stated: `onMutate` must come before `onError` and `onSettled`; those two are **order-insensitive relative to each other**.

Returning a promise from any callback makes the mutation await it before the next one runs — which is how an invalidation keeps `isPending` true until the refetch finishes.

**Guidelines:**

- MUST write callbacks against the current signatures and verify them against the installed version before relying on argument positions.
- MUST place `onMutate` before `onError` and `onSettled`; their mutual order is unconstrained.
- SHOULD reach the query client through `context.client` inside a callback rather than importing the singleton.
- MUST return the promise from a callback whose work should complete before the mutation settles.

## Retry and Serialization

Mutations do **not** retry by default — the opposite of queries, and correct, since a non-idempotent write retried blindly can duplicate an effect. Set `retry` only on a write that is genuinely idempotent.

Concurrent calls to the same mutation run in **parallel** by default. A `scope` with an `id` serializes them: same scope, one at a time, the rest queued.

**Guidelines:**

- MUST NOT set `retry` on a mutation that is not idempotent; a duplicate write is worse than a reported failure.
- SHOULD give a mutation a `scope` where concurrent invocations would race — repeated edits to one record, or a queue that must apply in order.
- SHOULD leave the default parallel behaviour for independent writes.

**Review checks:**

- Callbacks written against the pre-5.101 argument order — **Critical**; the rollback handle and the client are read from the wrong positions.
- `mutateAsync` with no `try`/`catch` — **Major**; failures escape as unhandled rejections instead of mutation state.
- Navigation or a toast baked into a factory callback — **Major**; the mutation becomes single-use.
- Invalidation placed in a call-site callback rather than the factory — **Major**; it silently does not happen when the component unmounts first.
- `retry` on a non-idempotent mutation — **Critical**.
- A missing `mutationKey` where the project relies on `useMutationState` or offline resumption — **Major**; both need a key to target.
- `onError` or `onSettled` before `onMutate` in the options object — **Minor**. Flagging `onSettled` before `onError` is **not** a finding; that pair is unordered.
