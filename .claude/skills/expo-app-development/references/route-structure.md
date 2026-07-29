# Route Structure

Apply this reference when adding, renaming, moving, or deleting a route file, when deciding what a directory under the routes root is allowed to contain, or when turning on generated route types.

Expo Router is the routing solution for an Expo app. Reaching for the underlying navigation library directly is a legacy arrangement: it costs the file-based routes, the generated types, deep-link resolution, and the router's own testing helpers, and the historical reasons for it — no way to set an initial route, no nested navigators — have since been answered by `unstable_settings.anchor` and nested layout files. Migrate such an app rather than extending it.

Verified against SDK 57.

## The Notation Set

A file's name determines what it matches. The notation is a closed set; a name outside it is a plain segment, which is a silent bug when a special form was intended.

| Form             | Produces                                                            |
| ---------------- | ------------------------------------------------------------------- |
| `index`          | the parent path itself                                              |
| `_layout`        | a layout wrapping every route in the directory — not itself a route |
| `[param]`        | a single dynamic segment                                            |
| `[...rest]`      | a catch-all matching one or more remaining segments                 |
| `(group)`        | an organizing directory that contributes nothing to the path        |
| `(a,b)`          | an array group producing one route tree per listed group            |
| `+not-found`     | the fallback for an unmatched path                                  |
| `+native-intent` | the handler for an inbound link the router cannot route on its own  |

The router also recognizes forms belonging to web output and server routes — customizing the static HTML shell, and server middleware. Both sit outside this skill's scope, so no rule here covers them; consult the installed SDK's documentation directly if the app ships a web or server target.

**Guidelines:**

- MUST place a route inside the routes root; a file outside it is never routable however it is named.
- MUST give the app a route matching `/`, so a cold launch never lands on nothing.
- MUST define a directory's navigator in that directory's `_layout` file rather than nesting a navigator inside a screen.
- MUST NOT name a route file with a group form directly, such as `(foo).tsx`; use `(foo)/index.tsx`.
- MUST NOT use characters outside the notation set in a route file name.
- SHOULD reach for an array group only when several stacks genuinely share screens, since it requires a layout that reads its own segment.

## Naming and Casing

Route file names are user-visible: each segment becomes a path segment, and the path appears in deep links, in analytics, and in the generated types. Use kebab-case throughout, including for directories, so a multi-word segment reads the same in every place it surfaces.

**Guidelines:**

- MUST name route files and route directories in kebab-case.
- MUST delete the old file when a route moves or is renamed, rather than leaving an unreferenced route that still resolves.
- SHOULD keep a route's name aligned with the domain directory that holds its screen body, so the two are findable from each other.

## Routes Only

The routes root holds routes and layouts, and nothing else. A component, a hook, a type, a test helper, or a constant placed there either becomes an unintended route or relies on the router ignoring it — both are fragile, and the second changes between SDK releases.

**Guidelines:**

- MUST keep every file under the routes root a route or a `_layout`.
- MUST give every route file a default export; the router mounts the default export and nothing else.
- MUST move a component, hook, model, helper, constant, or test file out of the routes root into the owning domain directory.
- MUST NOT colocate a route's own subcomponents beside it under the routes root, however local they are.

## Anchors and Route Settings

A group has no path of its own, so the router needs to be told which of its routes is the entry when one is not otherwise determined — most visibly for the back behavior of a deep link that lands mid-stack. A layout declares this by exporting route settings.

The setting was named `initialRouteName` before Expo Router 4 and is `anchor` from 4 onward. An app carrying the old name on a current SDK is silently not applying it.

**Example:**

```tsx
// src/app/(tabs)/_layout.tsx
export const unstable_settings = {
  anchor: "index",
};
```

**Guidelines:**

- MUST declare an anchor on a layout whose group can be entered directly at a non-index route.
- MUST use the anchor name the installed SDK expects, and check it after an SDK upgrade rather than assuming the old key still applies.
- SHOULD verify anchor behavior by opening a deep link to a nested route from cold start, since the setting has no effect on in-app navigation.

## Generated Route Types

The router can generate a type describing every route the app declares, which turns a wrong path from a runtime blank screen into a compile error. Turn it on. It is an app-config experiment rather than a default, and the generated types land in the project's generated-types directory, which the TypeScript config must include.

**Guidelines:**

- MUST enable generated route types in the app config for any app with more than a handful of routes.
- MUST include the generated-types directory in the TypeScript config, or the generated types resolve to nothing and every path silently widens to `string`.
- SHOULD regenerate types after adding or renaming a route — the development server does this on start — before trusting a type error or its absence.
