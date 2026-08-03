# Startup and Lifecycle

Apply this reference when arranging what happens between process start and first paint — entry-module initialization, the splash screen, readiness gating, provider composition, and system chrome.

## The Entry Module

The entry module runs before the router mounts and before any component renders. That makes it the only place for initialization that must be complete before the first render: configuring a style system, starting an error tracker so it captures errors during startup itself, and taking hold of the splash screen before the framework can hide it.

Order within the module is real. The router entry is imported first; everything after it runs before the router's own render pass.

**Example:**

```ts
// main.ts
import "expo-router/entry";

import { preventAutoHideAsync, setOptions } from "expo-splash-screen";
import { StyleSheet } from "react-native-unistyles";
import { initializeErrorTracker } from "@/core/error-tracking";
import { themes } from "@/theme";

preventAutoHideAsync();
setOptions({ fade: true });

initializeErrorTracker();

StyleSheet.configure({ themes, settings: { adaptiveThemes: true } });
```

**Guidelines:**

- MUST put initialization that must precede the first render in the entry module, not in a component effect.
- MUST start the error tracker in the entry module, so failures during startup are captured rather than lost.
- MUST keep entry-module work synchronous and fast; anything awaited here delays the first frame with the splash still up.
- MUST NOT let the entry module throw — there is no error boundary above it, and a throw is a launch crash.
- SHOULD start an asynchronous initializer here and await its result behind the readiness gate, rather than blocking the module on it.

## Holding the Splash Screen

The splash screen is the app's only cover for work that must finish before the first screen is honest. Take hold of it in the entry module — before the framework's automatic hide can run — and release it exactly once, when every gate has resolved.

The hold must be released on **every** path, including the failure paths. An initializer that rejects and leaves the splash up is indistinguishable from a hang.

**Guidelines:**

- MUST take hold of the splash screen in the entry module rather than in a component.
- MUST release the hold on every path, including when an initializer fails, so a failure surfaces as an error screen rather than a frozen splash.
- MUST NOT gate the splash on work that can be done after first paint; a gate is for what makes the first screen wrong, not for everything that is in flight.
- SHOULD cap a gate that depends on the network, so a slow or absent connection does not hold the app at the splash indefinitely.

## The Readiness Gate

The component that owns the gate renders nothing until every prerequisite has resolved, then releases the splash and renders the tree. Rendering nothing is deliberate: rendering a partial or placeholder tree behind the splash mounts screens against data that is not there yet, and produces exactly the flashes the splash exists to prevent.

Compose the gate from named conditions so it is readable which prerequisite is outstanding.

**Example:**

```tsx
const isReady =
  fontsLoaded && isDatabaseInitialized && isMigrationDone && isAnalyticsReady;

useEffect(() => {
  if (isReady) {
    hideSplashScreen();
  }
}, [isReady]);

if (!isReady) {
  return null;
}

return children;
```

**Guidelines:**

- MUST render nothing until the gate resolves, rather than rendering a partial tree behind the splash.
- MUST include in the gate every prerequisite the first screen genuinely depends on — at minimum the data layer's readiness and any migration it must apply.
- MUST release the splash from an effect keyed on the composed condition, so it fires once when the condition flips.
- SHOULD name each condition rather than composing anonymous booleans, so a stuck launch is diagnosable.
- SHOULD report a failed prerequisite to the error tracker before falling through, since a swallowed failure here presents as a blank launch.

## Provider Composition

Providers form the app's dependency graph, expressed as nesting: a provider that another consumes must enclose it. Two constraints follow. The readiness gate belongs _inside_ the providers whose readiness it reports, because it consumes their state. And a provider whose value is created inline is recreated on every render of its owner — a defect that surfaces as the whole tree re-rendering, or a client's cache resetting.

**Guidelines:**

- MUST nest providers in dependency order, with each provider enclosing its consumers.
- MUST create a provider's value once — outside the component, or held in a ref or memo — never inline in the render.
- SHOULD place the readiness gate inside the providers it reads from and outside the screens it protects.
- SHOULD keep the number of app-wide providers small; a provider only the settings screens use belongs at the settings layout.

## System Chrome and Edge-to-Edge

Status-bar appearance, navigation-bar appearance, and the root background are app-wide and belong at the root, not set per screen — a per-screen setting produces a visible flicker when a transition crosses two screens that disagree.

Edge-to-edge rendering, where the app draws beneath the system bars, is the modern Android default and is enabled through configuration rather than in code. Turning it on changes what every screen must account for, which is a safe-area concern.

**Guidelines:**

- MUST set app-wide system chrome at the root layout rather than per screen.
- MUST enable edge-to-edge through the app config, and treat enabling it as a change that affects every screen.
- SHOULD set a root background colour that matches the app's own surface, so a slow first paint does not flash the platform default.

## Splash Configuration Across SDKs

How the splash screen is configured has moved. A top-level `splash` key in the app config was the mechanism on SDK 51; the [splash-screen library's config plugin](https://docs.expo.dev/versions/latest/sdk/splash-screen/) is the mechanism on SDK 54 and 57. The exact release where the key stopped being honoured was not verified here — determine it from the installed SDK's own documentation rather than from this range.

The practical risk is an app carrying the legacy key on a current SDK: it reads as configured while configuring nothing, and the symptom is a default splash rather than an error.

**Guidelines:**

- MUST configure the splash screen through the mechanism the installed SDK documents, and re-check it after an SDK upgrade.
- MUST NOT assume a legacy splash key is still honoured because it is still present in the config.
- SHOULD remove a legacy splash key once the plugin is configured, rather than leaving two sources that disagree.
