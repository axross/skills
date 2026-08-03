# React Native

Apply this reference when setting up this layer in a React Native application, or when reviewing why focus and reconnect refetching never happens there.

## The Two Managers

The library learns about focus and connectivity from two managers. On the web they populate themselves from browser events. On React Native those events do not exist, so **both must be wired explicitly**.

Until they are, `refetchOnWindowFocus` and `refetchOnReconnect` are inert. They still default to `true`, they still appear in the options, and nothing warns — the app simply never refetches on foreground or reconnect, and the symptom is stale data rather than an error.

```ts
import { focusManager, onlineManager } from "@tanstack/react-query";
import { AppState, Platform } from "react-native";

onlineManager.setEventListener((setOnline) => {
  const subscription = addNetworkStateListener((state) =>
    setOnline(!!state.isConnected),
  );
  return () => subscription.remove();
});

focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener("change", (status) => {
    if (Platform.OS !== "web") {
      handleFocus(status === "active");
    }
  });
  return () => subscription.remove();
});
```

Both belong at module scope in the application's entry, alongside the client — they are process-wide, and registering them from a component ties a global to that component's lifetime.

The connectivity source is whichever network module the project already has; the manager does not care which, only that something calls `setOnline`.

**Guidelines:**

- MUST wire both `onlineManager` and `focusManager` in a React Native application before relying on any refetch-on-focus or refetch-on-reconnect behaviour.
- MUST register them once at module scope near the client's construction, not inside a component.
- MUST return the unsubscribe function from each listener, or the subscription leaks across fast refresh.
- SHOULD guard the focus listener on the platform where the app also runs on web, since the browser already supplies focus.
- MUST NOT assume the options work because they are set; without the managers they are silently inert.

## Screen Focus

App focus is not screen focus. The focus manager reports the whole application returning to the foreground; a user navigating back to a screen that has been mounted the whole time is a different event, and the navigation library owns it.

Refetching on screen focus is an explicit call, scoped so it does not refetch the entire cache:

```ts
useFocusEffect(
  useCallback(() => {
    queryClient.refetchQueries({
      queryKey: listKey,
      stale: true,
      type: "active",
    });
  }, [queryClient]),
);
```

The `stale: true` and `type: "active"` filters are what keep this proportionate — without them it refetches everything, including queries for screens the user is not looking at.

Most focus hooks also fire on **mount**, which duplicates the query's own initial fetch. Skipping the first invocation is usually wanted.

**Guidelines:**

- MUST scope a screen-focus refetch with a key and the `stale`/`type` filters rather than refetching the whole cache.
- SHOULD skip the first invocation of a focus effect that also fires on mount, so it does not duplicate the initial fetch.
- SHOULD prefer a `staleTime` that expires naturally over a manual focus refetch where the data's freshness window is well understood.

## Detaching an Off-Screen Query

A screen kept mounted by a navigator keeps its queries subscribed — polling, refetching, and re-rendering while invisible. `subscribed: false` detaches a query without unmounting the component:

```tsx
const isFocused = useIsFocused();
const { data } = useQuery({
  ...getRecordsQueryOptions(scope),
  subscribed: isFocused,
});
```

While detached the query neither refetches nor re-renders; re-subscribing brings it up to date. This matters most on a device where each refetch costs battery and metered data.

**Guidelines:**

- SHOULD detach a polling or frequently-refetching query on a screen a navigator keeps mounted but the user cannot see.
- MUST NOT use `subscribed` as a substitute for `enabled`; one detaches an existing query, the other prevents it running at all.
- SHOULD verify `subscribed` exists in the installed version before relying on it; it is a recent addition.

## Fetching on a Device

A mobile network drops far more often than a desktop one, which makes `networkMode` a real choice rather than a default to inherit. Its three values are defined in the [Network Mode guide](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode), which describes them for a browser.

`always` is the correct mode for a query that reads from **on-device** storage — a local database read has no network dependency, and leaving it in `online` mode means it stops working exactly when the device goes offline.

A paused query reports `fetchStatus: 'paused'` while staying `pending`, which is why a spinner keyed on `isPending` alone hangs forever offline — see [consuming-queries.md](./consuming-queries.md).

**Guidelines:**

- MUST set `networkMode: 'always'` on a query whose function reads local storage rather than the network.
- SHOULD choose `offlineFirst` where a cache or service layer can answer before the network is reached.
- MUST render something meaningful for a paused fetch rather than an indefinite spinner.
- SHOULD define what each screen does with no connectivity — cached content, an empty state, or an error — as a deliberate decision.

**Review checks:**

- A React Native application relying on focus or reconnect refetching with the managers unwired — **Major**; the options are inert and the failure is silent.
- A manager registered inside a component — **Major**; a process-wide global tied to one component's lifetime.
- A listener that does not return its unsubscribe function — **Minor**; it leaks across fast refresh.
- A screen-focus refetch with no key or filters — **Major**; it refetches the entire cache on every navigation.
- A focus effect that duplicates the initial fetch on mount — **Minor**.
- A local-storage-backed query left in the default network mode — **Major**; it stops working offline, which is when local storage matters most.
- `isPending` driving a spinner with no paused handling — **Major**; it hangs indefinitely offline.
