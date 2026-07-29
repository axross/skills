# Safe Areas

Apply this reference when a screen draws to the edge of the display, when enabling edge-to-edge rendering, when deciding which edges a screen is responsible for, or when a surface is clipped by a notch, a home indicator, or a system bar.

A safe-area inset is the distance from an edge of the display to the nearest area the system does not cover. It is a **minimum clearance**, not a spacing value: a device without a notch reports zero, so a surface that uses the raw inset as its padding has no gutter at all on that device.

## Which Edges a Screen Owns

The single most common safe-area defect is applying an inset at an edge the screen does not own. A screen inside a navigator rarely reaches all four edges: a stack header already clears the top, a tab bar already clears the bottom, and a sheet presentation clears its own. Applying an inset again at those edges doubles the clearance and produces a visible band.

Work out, per screen, which edges its content actually reaches:

| Arrangement                       | Edges the screen owns                 |
| --------------------------------- | ------------------------------------- |
| Stack header shown, tab bar shown | horizontal only                       |
| Header hidden, tab bar shown      | top and horizontal                    |
| Header shown, no tabs             | bottom and horizontal                 |
| Full-screen, no chrome            | all four                              |
| Scroll view under chrome          | content insets, not container padding |

A scrolling screen is a distinct case: the container should extend under the chrome so content scrolls beneath it, while the _content_ carries the inset. Padding the container instead produces a scroll view that stops short of the edge with a dead band below it.

**Guidelines:**

- MUST determine which edges a screen reaches from its navigator arrangement before applying any inset, rather than applying all four by default.
- MUST NOT apply an inset at an edge where a header, tab bar, or sheet presentation already provides clearance.
- MUST apply insets to a scrolling surface's content rather than to its container, so content scrolls under the chrome instead of stopping short of it.
- SHOULD re-check a screen's owned edges when its navigator arrangement changes, since hiding a header silently transfers an edge to the screen.
- SHOULD verify on a device with a notch or a home indicator and one without, since a zero inset hides the whole class of defect.

## Edge-to-Edge Rendering

Edge-to-edge means the app draws beneath the system bars rather than being laid out inside them. It is the modern Android default, it is enabled through configuration rather than in code, and enabling it retroactively makes every screen responsible for insets it previously did not have to think about.

Treat enabling it as a change with app-wide scope: it is not a per-screen setting, and screens written before it was on will have content behind the status bar until they are revisited.

**Guidelines:**

- MUST enable edge-to-edge through the app config rather than by manipulating system bars imperatively at runtime.
- MUST audit every screen when enabling edge-to-edge on an existing app, not only the screen that motivated the change.
- SHOULD keep system-bar appearance set once at the root, so a transition between screens does not flicker between two styles.

## Applying an Inset in a Stylesheet

> **Twin section.** A shortened restatement of rules a React component styling capability owns in full under its own safe-areas topic, so this skill stands alone where that capability is not installed. Where it is installed, **it governs** — it states these mechanics in the terms of the concrete style system, and in more detail than here. Both copies are maintained; a difference in what they **require** is a defect in whichever was edited alone.

When the project's style system exposes insets in its own runtime, read them there and keep the inset in the stylesheet, rather than reaching for a separate context hook and passing values through the component's render. Compose a horizontal inset with the surface's own gutter so a device reporting zero still gets the design's spacing, and use the direction-agnostic properties so a right-to-left layout mirrors.

**Guidelines:**

- MUST read insets from the style system's runtime when it exposes them, rather than from a separate safe-area context hook.
- MUST combine an inset with the surface's own gutter as a maximum of the two, never using the raw inset as the padding.
- MUST use direction-agnostic start and end properties for horizontal insets rather than left and right.

## When No Style System Exposes Insets

Not every app has a style system with a runtime. Where none does, the insets come from the safe-area context — a provider mounted near the root and a hook read in the component — and the same composition rules apply, one level out in the render rather than inside the stylesheet.

Follow the host app's existing mechanism rather than introducing a second. An app that reads insets through a hook everywhere does not become more correct by adding a style-system runtime for one screen; it becomes an app with two conventions.

**Guidelines:**

- MUST mount the safe-area provider above every consumer when the app reads insets through the context hook.
- MUST apply the same maximum-of-inset-and-gutter composition when the value comes from a hook rather than a style runtime.
- MUST follow the app's established inset mechanism rather than introducing a second one for a single screen.

## The Wrong-Edge Defect

The characteristic failure is an inset read from one axis and applied to the other — a horizontal inset used as top padding:

```tsx
paddingTop: Math.max(insets.right, spacing.x32),   // wrong axis
paddingTop: Math.max(insets.top, spacing.x32),     // intended
```

It survives review because it is shaped exactly like the correct line, and it survives testing because on most devices the horizontal insets are zero in portrait — so the maximum returns the fallback and the layout looks right. It surfaces only in landscape, or on a device with horizontal insets, and it propagates by copy-paste: the same wrong line tends to appear in every sibling that was cloned from the first.

**Guidelines:**

- MUST check that each inset's axis matches the edge it is applied to, treating an axis mismatch as a defect rather than a style choice.
- MUST check the sibling surfaces when one such defect is found, since these propagate by copying.
- SHOULD verify inset-bearing screens in landscape, which is where a zero-in-portrait inset stops hiding the mistake.
