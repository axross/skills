# Style Property Order

Apply this reference when writing or reviewing the order of declarations inside a style block, and the order of styles composed into one element. Both orders are stated as rules in `SKILL.md`'s **Style Property Order** section; this file carries why they are the convention and shows each one applied.

Unlike the other references here, this one rests on no external standard: no specification says what order declarations go in, and the choice is a project convention. It is stated as a rule anyway, because the value of an ordering convention comes entirely from every file following the same one.

Order is a readability contract, not decoration. A reader scanning an unfamiliar block should be able to find the box model without reading the colours, and should be able to tell a base value from a state override by position alone. Alphabetical order fails both tests — it interleaves `alignItems`, `backgroundColor`, and `borderRadius` into a list with no shape — so the convention is **semantic grouping**: properties in the order the browser or layout engine conceptually resolves them, outermost concern first.

## Applying the Block Order

The fifteen-group order puts positioning and layout first, spacing and colour in the middle, and custom properties and nested conditional content last. This block uses most of it — layout, size, spacing, colour, border, motion, and interaction reset, followed by a custom property, a container query, and a focus-visible state — in the order `SKILL.md` states:

```css
.card {
  display: flex;
  container: card / inline-size;
  flex-direction: column;
  row-gap: var(--space-16);
  inline-size: stretch;
  padding-block-end: var(--space-16);
  background-color: var(--color-component-accent-rest);
  border-radius: var(--radius-md);
  transition: background-color var(--duration-md) var(--ease-standard);
  outline: none;

  --variant: "compact";

  @container (width > 30rem) {
    --variant: "wide";
  }

  &:focus-visible {
    outline: var(--color-border-accent-interactive) solid var(--border-base);
    outline-offset: var(--border-base);
  }
}
```

## Applying the Composed Order

The `<Pressable>` below composes nine entries in the order `SKILL.md` states: an invariant base, two size-variant branches, two tone-variant branches, a transient state, an animated style, and the consumer's own style last — precedence readable from position alone, with nothing after the consumer's style to override it.

```tsx
<Pressable
  style={[
    styles.root,
    size === "sm" && styles.sizeSm,
    size === "md" && styles.sizeMd,
    variant === "solid" && intent === "neutral" && styles.solidNeutral,
    variant === "solid" && intent === "destructive" && styles.solidDestructive,
    disabled && styles.disabled,
    pressed && styles.pressed,
    animatedStyle,
    style,
  ]}
/>
```
