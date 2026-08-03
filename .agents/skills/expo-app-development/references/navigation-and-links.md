# Navigation and Links

Apply this reference when moving between routes, passing parameters, wrapping a custom component in a link, adding a link preview, or accepting an inbound deep link.

## Declarative Links versus Imperative Navigation

A link is the default. It renders as a real link the platform can treat as one — long-press previews, context menus, accessibility semantics, and the ability to open in a new context all follow from it — and it declares the destination in the markup where a reader can find it.

Navigate imperatively when the destination is only known after something happens: a submitted form, a resolved request, a redirect. Reaching for an imperative call inside an `onPress` on a plain pressable, where a link would have done, throws away the platform behavior for nothing.

**Guidelines:**

- MUST use a link for navigation triggered directly by pressing an element.
- SHOULD navigate imperatively only when the destination depends on work that happens after the interaction.
- SHOULD replace rather than push when the current screen should not be returned to, so the back gesture does not re-enter a completed flow.

## Typed Hrefs

Pass a destination as an object with a pathname and parameters, not as an interpolated template string. The object form is what the generated route types check, so a renamed route or a missing parameter becomes a compile error; an interpolated string type-checks as a string whatever it contains, and its parameters are not encoded for it.

**Example:**

```tsx
// Checked against the generated route types.
<Link href={{ pathname: "/collections/[slug]", params: { slug } }}>…</Link>

// Not checked, and silently wrong for a slug containing a reserved character.
<Link href={`/collections/${slug}`}>…</Link>
```

**Guidelines:**

- MUST pass a destination as a pathname-and-params object rather than an interpolated string.
- MUST use the route's declared pattern as the pathname — the bracketed segment — not the substituted value.
- SHOULD keep the same object form for imperative navigation calls, so both paths get the same checking.

## Previews and Context Menus

On platforms that support it, a link can carry a preview of its destination and a context menu of actions, both surfaced by long press. They are a platform convention rather than a decoration, and adding them to the primary navigational elements of a list or a card is worth the small cost.

**Guidelines:**

- SHOULD attach a preview to links whose destination is a substantial screen, such as a list item opening a detail view.
- MAY attach a context menu of actions the destination supports, so common actions do not require navigating first.
- MUST keep the link usable when the preview and menu are unavailable, since they do not render on every platform.

## The Navigation-Cloning Caveat

> **Twin section.** This is a deliberately shortened restatement of a rule a React component styling capability owns in full, under its own navigation-cloning topic, so this skill stands alone where that capability is not installed. Where it is installed, it governs — it states the mechanism in the terms of the concrete style system. Both copies are maintained; a difference in what they **require** is a defect in whichever was edited alone. The Expo-specific framing below — which router primitives clone, and the two escapes — is this skill's own.

A link asked to render a custom child clones that child to inject its press and href props. Cloning takes over the ref a runtime style system applies computed styles through, so a styled element cloned this way **loses its styles** — classically only in a release build, where it surfaces as a control rendered with no background.

The two escapes are to wrap the styled element in a plain component and let the link clone the wrapper, or to drop the link and navigate imperatively from the press handler.

**Guidelines:**

- MUST NOT let a link clone a styled element directly; wrap it, or navigate imperatively instead.
- MUST record the reason at the site, because the symptom does not reproduce in development and the workaround reads as removable.

## Deep Links

An inbound link can start the app cold, and it arrives from outside the app's control. The app declares a scheme in its config, and platform-verified links additionally require the platform's own association step — an entitlement and a hosted association file — which config alone does not accomplish.

A link the router cannot resolve on its own, such as one from a provider that hands back a custom callback URL, is handled by the routes root's native-intent module, which translates it into a path before routing.

Treat everything in an inbound link as untrusted input, exactly as with any route parameter. Beyond validating it, do not let a link _perform_ an action on arrival: a link that deletes, purchases, signs out, or changes a setting on open is a one-tap attack from any surface that can host a URL. Route to a screen that states what will happen and requires a confirmation.

**Guidelines:**

- MUST declare the app's scheme in the app config, and complete the platform association step separately for a verified link.
- MUST validate every value taken from an inbound link before it is used, on the cold-start path as well as the warm one.
- MUST NOT let opening a link perform a destructive, financial, or credential-affecting action; route to a confirmation instead.
- MUST handle a link that arrives while the app is already running as well as one that starts it, since the two take different paths.
- SHOULD resolve a non-routable inbound link in the native-intent module rather than special-casing it inside a screen.
- SHOULD test a deep link from a cold start, which is where an unresolved anchor or an unhandled parameter actually surfaces.
