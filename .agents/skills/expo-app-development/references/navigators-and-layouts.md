# Navigators and Layouts

Apply this reference when writing a `_layout` file, choosing a tabs implementation, arranging stacks inside tabs, gating a route subtree behind authentication, or presenting a screen as a modal or a sheet.

## Choosing a Tabs Implementation

Expo Router ships more than one tabs implementation, and which one is current **changes between SDK releases** — as does the API surface of the newer one. Treating either as a fixed answer produces guidance that is wrong within a release or two.

As of SDK 57, [native tabs](https://docs.expo.dev/router/advanced/native-tabs/) are the recommended implementation, with the [JavaScript tabs](https://docs.expo.dev/router/advanced/tabs/) documented alongside them: they render the platform's own tab bar, which brings the system's appearance, accessibility behavior, and per-platform affordances for free. Their API has already moved once — SDK 55 relocated the label, icon, badge, and vector-icon components from separate module exports onto static properties of the trigger component — so an app on an older SDK and an app on a current one do not share import statements.

There is also a real fallback. The native tab host has been observed to crash on Android's New Architecture, and an app that hits it is correct to run the JavaScript tabs implementation instead. That is a documented platform constraint, not a lapse to correct on sight.

**Guidelines:**

- MUST use the tabs implementation the **installed** SDK's documentation recommends, and determine which that is from the versioned documentation rather than from memory or from another app.
- MUST check the tabs API surface against the installed SDK after an upgrade, since component locations have moved between releases.
- MAY use the JavaScript tabs implementation when the native one crashes or misbehaves on a platform the app ships to, and MUST record the specific reason in a comment at the layout.
- MUST NOT copy tab imports from another app without confirming both are on the same SDK.
- SHOULD keep the tab set fixed rather than computed, so the router's route tree does not change shape at runtime.

## Stacks Inside Tabs

Each tab owns its own navigation history, so each tab gets its own stack — a `_layout` inside the tab's directory rendering a stack navigator. The header then belongs to that inner stack, where it can differ per tab and per screen, rather than to a single header above the tab bar.

The consequence is that the tabs layout usually shows no header of its own. Leaving one on produces two stacked headers, which is a rendering bug that is easy to miss on a single tab.

**Example:**

```
src/app/
  (tabs)/
    _layout.tsx          the tabs navigator, headerShown false
    index.tsx
    collections/
      _layout.tsx        this tab's stack — headers live here
      index.tsx
      [slug].tsx
```

**Guidelines:**

- MUST give each tab its own stack layout when its screens push, so each tab keeps an independent history.
- MUST disable the header on the tabs navigator when the inner stacks provide headers.
- SHOULD keep a tab's screens inside that tab's directory, so the tab's route tree is readable from the file system.

## The Root Layout

The root layout is the app's outermost mounted component. It is responsible for the app-wide provider composition, the root navigator, and the app-wide system chrome — and for nothing that belongs to a screen.

Providers compose in dependency order, outermost first: a provider that another depends on must enclose it. Where the entry module has already run initialization, the root layout consumes the result rather than repeating the work.

**Example:**

```tsx
// src/app/_layout.tsx
import "@/unistyles";

import { QueryClientProvider } from "@tanstack/react-query";
import { RootNavigator } from "@/auth/components/root-navigator";
import { queryClient } from "@/core/helpers/query-client";

function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <RootNavigator />
      <StatusBar style="auto" />
    </QueryClientProvider>
  );
}

export default wrapRootComponent(RootLayout);
```

**Guidelines:**

- MUST keep the root layout to provider composition, the root navigator, and app-wide chrome.
- MUST order providers by dependency, with a provider enclosing everything that consumes it.
- MUST place a style-system or polyfill import that must run before any component at the top of the root layout, above the other imports.
- SHOULD extract a root navigator with real logic — an auth gate, a conditional tree — into a named component rather than inlining it.
- MUST NOT fetch screen data or hold screen state in the root layout; it never unmounts, so anything it holds lives for the process.

## Gating a Subtree Behind Authentication

Expo Router can mount or omit part of the route tree declaratively from a guard, which is preferable to imperatively redirecting from inside a screen: an unauthenticated user never has a route to reach, so there is no window in which a protected screen mounts and then bounces.

Gate the whole subtree rather than each screen. Gating individually leaves the surrounding chrome — a tab bar with authenticated destinations — visible to a signed-out user.

**Example:**

```tsx
<Stack screenOptions={{ headerShown: false }}>
  <Stack.Protected guard={status === "authenticated"}>
    <Stack.Screen name="(tabs)" />
  </Stack.Protected>

  <Stack.Protected guard={status !== "authenticated"}>
    <Stack.Screen name="welcome" />
    <Stack.Screen name="sign-in" />
  </Stack.Protected>
</Stack>
```

**Guidelines:**

- MUST gate protected routes declaratively at the navigator rather than redirecting from inside a screen.
- MUST gate the whole authenticated subtree, so a signed-out user never sees authenticated chrome.
- MUST hold the splash screen, or render a neutral surface, while the guard's input is still resolving — an unresolved guard otherwise flashes the signed-out tree at every launch.
- SHOULD keep the guard's input in one place the whole app reads, rather than deriving authentication separately per navigator.

## Modals and Sheets

A screen presented as a modal or a sheet is still a route: it is declared in the layout with a presentation option, not rendered inline as a component with its own visibility state. Routing it means the back gesture, the deep link, and the navigation history all work without extra code.

Sheet presentations carry platform-specific options — detents, grabber visibility, background interaction — that exist on one platform and are ignored on the other. Set them, but do not rely on them for the screen to be usable.

**Guidelines:**

- MUST declare a modal or sheet as a route with a presentation option, rather than as a conditionally rendered component.
- MUST keep the screen usable when platform-specific presentation options are ignored, since they do not apply on every platform.
- SHOULD dismiss a modal by navigating back rather than by mutating state a parent screen owns.
