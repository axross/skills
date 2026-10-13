# Adaptive Styling

Apply this reference when a style depends on something about the user or the device rather than on available space — pointer type, hover capability, motion preference, output medium, writing direction. Space-driven adaptation lives in [fluid-and-responsive.md](./fluid-and-responsive.md).

## What Belongs in a Media Query

A media query describes the environment: the window, the input hardware, the user's stated preferences, the output medium. It does not describe how much room a component was given, and using it for layout is what makes a component un-embeddable.

**Guidelines:**

- MUST reserve viewport media queries for genuinely environment-level conditions — colour scheme, motion preference, pointer and hover capability, forced colours, print.
- MUST NOT use a width media query for component layout; use a container query and the tiering pattern instead.
- MUST declare each environment condition once, as high in the tree as it applies, rather than repeating it per surface.

## Reduced Motion

When choosing what remains visible without motion, consult the project's high-fidelity UI design practices. This reference implements that choice. If that capability is absent, preserve state feedback with immediate required targets, readable static loops, and no decorative movement; stopping interpolation is not the same as removing the state.

**Example — web:**

Keep target styles in the component's ordinary state rules, not only in keyframes or an animation-completion handler. These [motion-preference overrides](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion) act on three separate surfaces. The calculating label remains present; `.pressLift` owns only decoration, with positioning on its outer surface and pressed paint and focus styles unaffected. Disable its transition too, so a preference change does not animate a previous lifted pose back to rest:

```css
@media (prefers-reduced-motion: reduce) {
  .stateChange {
    transition: none;
  }

  .calculating {
    opacity: 1;
    animation: none;
  }

  .pressLift,
  .pressLift:active {
    transform: none;
    transition: none;
  }
}
```

**Example — mobile native:**

Inside an effect or worklet, assign the target instead of scheduling interpolation. The project's spring and timing configs illustrate different normal-motion paths; Reduced Motion bypasses both:

```tsx
position.value = reduceMotion
  ? targetPosition
  : withSpring(targetPosition, springConfig);
fill.value = reduceMotion
  ? targetFill
  : withTiming(targetFill, colorTimingConfig);
size.value = reduceMotion
  ? targetSize
  : withTiming(targetSize, sizeTimingConfig);
```

A loop has no final target. Cancel it and assign the chosen static value explicitly. Here the calculating label rests at full opacity rather than at a dim frame; `pulseTimingConfig` belongs to the project's motion tokens:

```tsx
const reduceMotion = useReducedMotion();

useEffect(() => {
  if (reduceMotion) {
    cancelAnimation(opacity);
    opacity.value = 1;
    return;
  }

  opacity.value = withRepeat(
    withSequence(
      withTiming(1, pulseTimingConfig),
      withTiming(dimOpacity, pulseTimingConfig),
    ),
    -1,
    false,
  );

  return () => cancelAnimation(opacity);
}, [reduceMotion, opacity]);
```

For a decorative lift, skip its animation driver and clear its owned transform instead of assigning a lifted target. Reanimated retains previously applied animated styles when a callback returns `{}` or the style is removed; [unset the property explicitly](https://docs.swmansion.com/react-native-reanimated/docs/core/useAnimatedStyle/) when reusing that view:

```tsx
const liftStyle = useAnimatedStyle(() => ({
  transform: reduceMotion ? undefined : [{ translateY: lift.value }],
}));
```

The snippet owns only decoration. If base or consumer styles also need `transform`, preserve them through [separate placement and animated-paint surfaces](./style-composition.md#accepting-a-consumers-styles), not a blanket transform reset.

Use the project's existing preference source and lifecycle. Reanimated 4.x [`useReducedMotion`](https://docs.swmansion.com/react-native-reanimated/docs/device/useReducedMotion/) returns the startup preference and does not rerender on OS setting changes; an effect dependency does not turn it into a subscription. That API caveat does not prescribe a startup-only policy for every app. Use [`cancelAnimation`](https://docs.swmansion.com/react-native-reanimated/docs/core/cancelAnimation/) to stop an existing loop before assigning its static value.

**Guidelines:**

- MUST provide a reduced-motion branch for every animation and every transition a change introduces, on both platforms.
- MUST NOT ship an infinite, looping, or full-surface animation without one — this is the case where the preference matters most.
- MUST put required target styles or values outside animation-only keyframes and completion callbacks, so bypassing interpolation still applies the state.
- MUST cancel a loop before assigning its specified static value on native; on web, pair the component-scoped animation override with an explicit static style.
- MUST omit or reset the owned decorative transform in the reduced branch, without clearing transforms needed for layout or consumer styling.
- MUST NOT duplicate an animated surface and guard only one copy; a second copy of the same keyframes with no guard is a defect that reads as an oversight in review.

## Hover, and the Pointer It Depends On

`:hover` on a touch device is sticky: a tap applies the hover style and nothing removes it, so the element stays visually "hovered" until something else is tapped. Gating hover styles fixes it — but which feature to gate on is not obvious, and the intuitive choice is wrong.

Four media features are involved, in two families:

| Feature                    | Describes                         |
| -------------------------- | --------------------------------- |
| `hover`, `pointer`         | The **primary** input mechanism   |
| `any-hover`, `any-pointer` | **Any** available input mechanism |

For hover styles, gate on the **primary** pair. A device whose primary input is touch should not get hover styles even if a mouse is also attached, because the user is mostly touching. And `hover: hover` alone is not enough — a stylus device reports `hover: hover` while still being used by touch, which reintroduces the sticky-hover problem — so pair it with `pointer: fine`.

**Example:**

```css
.card {
  background-color: var(--color-component-accent-rest);

  @media (hover: hover) and (pointer: fine) {
    &:hover {
      background-color: var(--color-component-accent-hovered);
    }
  }
}
```

**Guidelines:**

- MUST gate every `:hover` rule on `@media (hover: hover) and (pointer: fine)`.
- MUST NOT gate hover on `any-hover`; it is true for a phone with a mouse paired, which is exactly the device that should not get hover styles.
- MUST give every interactive surface an affordance that does not depend on hover — a focus style, a pressed state, a persistent border or underline — since hover is unavailable to a large share of users.
- MUST NOT convey information through a hover-only state; hover may enhance, never inform.
- SHOULD pair a hover style with the equivalent pressed style on mobile native, where hover does not exist at all.

## Interactive Target Size

Target size gates on the **any** family, and this asymmetry with the hover rule is deliberate: a laptop with a touchscreen must still offer touch-sized targets, because the user might reach up and tap at any moment. `any-pointer: coarse` is true whenever _any_ attached input is imprecise, which is exactly the condition under which a small target is a problem.

For design goals, platform recommendations, and dense-grid decisions, consult high-fidelity UI design's touch-target practices when installed. Without that owner, use the following bounded policy: ordinary web controls start with a 24x24 CSS px baseline and aim for 44x44 CSS px when coarse input is available. Native controls follow their platform's recommendations in native units, not CSS-pixel conversions.

[WCAG 2.5.8 (AA)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) tests whether an axis-aligned 24x24 CSS px square fits wholly within the actual target, or an exception applies, regardless of pointer precision. Bounding-box dimensions alone do not prove that test. For undersized targets, assess the exception's full conditions, including clearance from actual neighboring targets when using Spacing. [WCAG 2.5.5 (AAA)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html) uses 44x44 CSS px with its own exceptions and no Spacing exception; meeting either criterion alone does not establish overall conformance.

**Example:**

```css
.control {
  min-inline-size: 24px;
  min-block-size: 24px;

  @media (any-pointer: coarse) {
    min-inline-size: 44px;
    min-block-size: 44px;
  }
}
```

Specification thresholds are literal CSS lengths, not spacing-scale steps that move when the design rhythm changes. The coarse-pointer size above is an explicit web touch design goal, not a native-unit conversion or a pointer-specific conformance floor. Check the final receiving shape: clipping or rounded corners can invalidate the square test even when both CSS minimum dimensions are set.

**Guidelines:**

- MUST gate target sizing on `@media (any-pointer: coarse)`, not on `pointer: coarse`, so a hybrid device gets touch-sized targets.
- MUST implement the applicable size test on both axes of the actual receiving region or evaluate a qualifying exception; mixed-axis thresholds do not substitute for that assessment.
- SHOULD use a 24x24 CSS px baseline for ordinary web controls and a 44x44 CSS px coarse-pointer touch goal, without treating AA's threshold as the universal usability goal.
- MUST measure the **hit area**, not the drawn glyph, and verify the final receiving shape rather than only the CSS box dimensions.
- MUST express a target minimum as the literal length the specification states, not as a spacing step; it is an accessibility constant, and routing it through the design scale lets a spacing retune move an accessibility floor.
- SHOULD prefer growing the hit area over growing the visual when the design calls for a small control and expansion is viable (see below).

## Expanding a Hit Area

A control often needs a larger target than it should visually occupy. Both platforms can grow the target without moving the visual, but available pitch — the distance between neighboring control positions — and parent bounds limit expansion. A dense grid with insufficient room needs larger pitch or an expanded editing view, not automatic per-cell expansion.

**Example — web, padding offset by an equal negative margin:**

```css
.iconButton {
  display: flex;
  padding: var(--space-12);
  margin: calc(var(--space-12) * -1);
  border-radius: var(--radius-md);
}
```

**Example — mobile native, `hitSlop`:**

```tsx
<Pressable hitSlop={12} accessibilityRole="button" onPress={onPress}>
  <ChevronRight color={theme.colors.text.neutral.low} size={20} />
</Pressable>
```

[React Native Pressable](https://reactnative.dev/docs/pressable) limits its hit area to the parent view's bounds, and sibling Z-index takes precedence in hit-testing. The snippet therefore assumes an independent press target with enough room in its parent; the requested `hitSlop` alone does not prove the resulting size. `hitSlop` extends press-start detection, not a custom container pan handler's coordinate partitions.

**Guidelines:**

- MUST offset the padding with an exactly equal negative margin on web, so the visual position does not shift as the target grows.
- SHOULD use `hitSlop` for independent native press targets when available pitch and parent bounds permit expansion without changing the visual.
- MUST verify the effective native hit area under parent bounds and sibling hit-testing; changing per-control `hitSlop` does not change custom coordinate selection regions.
- MUST give the expanded area the project's radius tier so a pressed or hovered background reads as part of the design rather than as a rectangle.
- MUST NOT overlap two expanded hit areas; the invisible regions collide long before the visuals do, and the resulting mis-taps are hard to diagnose.

## Print

Print is an output medium a UI is rarely designed for and frequently broken in — a scroll container clips its content to one screenful on paper, and decorative overlays waste ink.

**Guidelines:**

- SHOULD add a print branch for any surface whose content is clipped by a scroll container, releasing the clipping so the full content paints.
- SHOULD hide scroll affordances, edge fades, and decorative overlays in print.
- MUST keep a print branch confined to `@media print` rather than compensating for it in the screen styles.

## Writing Direction

Direction-agnostic styles are free on web — the logical properties do the work — and they are the difference between a layout that mirrors correctly for a right-to-left locale and one that has to be re-authored.

**Guidelines:**

- MUST write direction-agnostic styles on web: `margin-block`/`margin-inline`, `padding-block`/`padding-inline`, `inline-size`/`block-size`, `inset-block-*`/`inset-inline-*`, `border-inline-start`/`border-block-end`.
- MUST use `start`/`end` keywords on `text-align` rather than `left`/`right`.
- MUST NOT mix directional paradigms on one element; a physical and a logical declaration for the same edge is a bug waiting for the first right-to-left render.
- MUST use `paddingStart`/`paddingEnd` and `marginStart`/`marginEnd` on mobile native rather than their `Left`/`Right` counterparts, including where a value comes from a safe-area inset.
- MAY use a physical property where none has a logical equivalent (`transform`, `object-fit`, `aspect-ratio`) or for a graphic with intrinsic orientation.
