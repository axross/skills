# Route Modules

Apply this reference when writing the contents of a route file, deciding where a screen's body belongs, reading route parameters, or attaching options to a screen.

## Thin Routes

> A React component development capability states the same expectation for route and page modules generally, as one rule inside its logic-extraction topic. This section is the Expo-specific treatment — what an Expo Router route file may hold, and where its screen goes — and does not weaken that rule.

A route file is a mounting point, not a place to build a screen. Everything a route file contains is coupled to the URL that reaches it, which makes it the worst place to put logic worth testing, reusing, or rendering in a different context. Keep the file to the default export, the screen options that belong to this route, and any literal the route alone needs.

The screen body lives in the owning domain directory — conventionally `screens/` inside that domain — as an ordinary component with an ordinary props contract. It can then be rendered in a test without a router, and reached from a second route later without a move.

**Example:**

```tsx
// src/app/(tabs)/collections/[slug].tsx
import { CollectionScreen } from "@/collections/screens/collection-screen";

export default function CollectionRoute() {
  return <CollectionScreen />;
}
```

**Guidelines:**

- MUST keep a route file to its default export, its own screen options, and literals only that route needs.
- MUST place the screen body in the owning domain's screen directory rather than in the route file.
- MUST NOT put data fetching, business logic, or reusable presentation in a route file.
- SHOULD have the route read its parameters and pass them to the screen as props, so the screen does not depend on the router.
- MAY let a route file remain a one-line re-export when it adds nothing beyond mounting.

## Route Parameters

Two hooks read parameters, and the difference matters. The local hook returns the parameters of the route the calling component belongs to; the global hook returns the parameters of the currently focused route, app-wide. A screen still mounted underneath a pushed screen keeps rendering, so a global read there returns the _other_ screen's parameters — a defect that only appears once a second screen exists.

Default to the local hook. Use the global hook when a component genuinely needs to react to whatever is focused, and say so in a comment.

**Guidelines:**

- MUST default to the local parameter hook, and reach for the global hook only when the component must track the focused route.
- MUST NOT use the global hook in a screen that can remain mounted beneath another screen unless the app-wide reading is the intent.
- SHOULD read parameters in the route file and pass them down, rather than calling a router hook deep inside a screen's tree.

## Parameters Are Untrusted

A route parameter arrives as a string from a source the app does not control: an in-app navigation, a cold-start deep link, a push notification, a link posted by a third party. It has no type beyond `string | string[]`, whatever the generated types imply about the shape of the _path_, and it may be absent, repeated, empty, or hostile.

Validate at the boundary — parse the parameter into the type the screen actually needs, and handle the failure branch — before any lookup, request, or render uses it.

**Example:**

```tsx
const { slug } = useLocalSearchParams<{ slug: string }>();
const parsed = collectionSlugSchema.safeParse(slug);

if (!parsed.success) {
  return <NotFoundScreen />;
}
```

**Guidelines:**

- MUST validate every route parameter against a schema or an explicit parse before application logic consumes it.
- MUST handle the invalid and missing branches with a real surface — a not-found screen or an error state — never by rendering as if the value were present.
- MUST NOT interpolate a route parameter into a request path, a query, or a file path without validating it first.
- MUST treat a repeated parameter as a real case; a parameter typed as a string can arrive as an array.
- SHOULD keep the parameter schema beside the screen's other models, so the route's contract is visible where the domain is.

## Screen Options

Options that describe a single screen — its title, whether it shows a header, its presentation — can be set from the route itself or declared by the owning layout. Prefer the layout when the option is part of the navigator's shape and the layout already names the screen; prefer the route when the option depends on data the route resolves.

Setting the same option in both places is a race whose winner changes with mount order.

**Guidelines:**

- MUST set an option in exactly one place — the route or its layout — never both.
- SHOULD declare structural options in the layout that already names the screen, and dynamic options in the route that resolves them.
- SHOULD set an option that depends on fetched data through the router's screen-options component, so it updates when the data arrives.
