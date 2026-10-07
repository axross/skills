# Style Composition

Apply this reference when deciding which styles live inside a component and which its consumer supplies, when accepting an incoming `className` or `style`, and when a repeated appearance tempts you to share a stylesheet.

The governing idea is that a component owns **what it looks like** and its consumer owns **where it sits and how much space the surrounding layout gives it**. Intrinsic defaults and internal geometry belong to the component; contextual placement does not. Splitting ownership at that seam is what makes a component composable.

## The Ownership Split

A component's own styles describe its interior: layout of its children, spacing between them, colour, typography, borders, radii, and its interaction states. Its consumer supplies the properties that only make sense relative to the surrounding layout.

Property spelling alone does not decide ownership. A relative root that anchors its own badge differs from an offset that moves the component among siblings. A component's structural or state-owned paint order differs from arbitrary elevation above neighbouring components. An icon's overrideable intrinsic size differs from a width chosen for one screen layout. A portal host can own screen-level overlay geometry; an ordinary embedded component cannot claim that role merely because it renders overlay content. Zeroing a native control's framework-default margin is a neutral reset, not permission to impose surrounding spacing.

**Example — the split across two files:**

```css
/* comment-avatar.module.css — appearance only, no size */
:where(:scope) {
  background-color: var(--color-component-accent-rest);
  border-radius: var(--radius-full);
  object-fit: cover;
}
```

```css
/* comments.module.css — the parent sizes the avatar it renders */
.avatar {
  inline-size: var(--space-40);
  block-size: var(--space-40);
}

.reply .avatar {
  inline-size: var(--space-32);
  block-size: var(--space-32);
}
```

**Guidelines:**

- MUST NOT set consumer-owned contextual placement or size on a component's own root, whether in a stylesheet, inline or animated declaration. On web, inspect [style-property-order.md](./style-property-order.md)'s **Positioning**, **Placement in the parent**, **Size** and `margin-*` **Spacing** properties for that purpose. Longhands, logical properties and shorthands follow the same ownership test. The **Layout container** group, `padding-*` and `aspect-ratio` describe the interior and stay with the component.
- MUST apply the same ownership test to mobile-native `position`, edge offsets, `zIndex`, `flex`/`flexGrow`/`flexShrink`/`flexBasis`, `alignSelf`, every `margin*` spelling and width/height bounds. `aspectRatio` stays with the component as on web; spelling a contextual declaration differently does not change its owner.
- MAY set a root property needed for justified intrinsic default geometry, an internal coordinate system, structural/state-owned paint order, overlay-host geometry or a neutral framework reset. These roles do not permit contextual sibling positioning or arbitrary elevation.
- MUST keep intrinsic size defaults overrideable through the published styling prop and apply [the token and literal rules](./theming.md#snapping-to-the-scale); off-scale spacing does not become intrinsic geometry by being labelled a default.
- MAY set a full-fill value on the root — `width: stretch`, `inline-size: 100%`, or `flex: 1` on native, and any other spelling of the same claim (`width: -webkit-fill-available`) — and the same claim expressed as an upper bound, `max-inline-size: 100%` or `maxWidth: '100%'`. Each claims **the whole** of the space the consumer gave. A fraction of it chosen for surrounding layout stays prohibited: `50%`, `calc(50% + 10px)` and `calc(100% - 32px)`. An absolute length (`320`, `20rem`) chosen for that layout, or a viewport-relative size on an embedded component (`100vw`, `100dvh`), is equally contextual; it is not an intrinsic default or overlay-host responsibility.
- MUST set consumer-owned contextual properties from the consumer, passing them through the component's `className` (web) or `style` (native) prop.
- MUST keep appearance in the component even when size lives outside it; a child that renders two roots (an image and a letter fallback) applies the consumer's size class to both so the roots stay interchangeable.
- SHOULD state the split in a comment when a component's stylesheet conspicuously lacks a size, so the next reader does not "fix" it by adding one.

## Accepting a Consumer's Styles

> **Twin section.** This section's three obligations — accept, never drop, merge last — and the override-versus-variant split in [When a Consumer Overrides](#when-a-consumer-overrides) are deliberately restated, in shorter form, by a React component development capability's styling-props reference, so that skill stands alone where this one is not installed. Both copies are maintained; a change to either belongs in the other, and a difference in what they **require** is a defect in whichever was edited alone, not a distinction to preserve. This copy owns the topic and governs wherever both are installed, naming the project's concrete tooling where the other names mechanisms generically.

Every component that renders a styled root accepts the consumer's styles and merges them **last**. Ordinary static native styles then give the caller precedence; web overrides also depend on the cascade and selector specificity. Array position does not outrank an animation runtime — see [composed-style precedence](./style-property-order.md#order-of-composed-styles).

Internal animation may own an appearance property, but cannot defeat promised external placement or size control. A composition boundary is effective only when it separates the conflicting property: an outer placement surface and inner animated visual can do that, while forwarding both conflicting declarations to the same animated root cannot. Components without that conflict need no extra wrapper.

**Example — web:**

```tsx
export function Snippet({
  className,
  children,
}: ComponentProps<"pre">): JSX.Element {
  return <div className={clsx(css.snippet, className)}>{children}</div>;
}
```

**Example — mobile native:**

```tsx
export function Card({
  style,
  ...props
}: ComponentPropsWithRef<typeof View>): JSX.Element {
  return <View style={[styles.card, style]} {...props} />;
}
```

**Guidelines:**

- MUST accept `className` on every web component that renders a styled root, and `style` on every mobile-native one.
- MUST merge the incoming value **last** and keep the published consumer-controlled placement and size overrides effective; when internal animation conflicts, separate that control rather than promising that array order resolves it.
- MUST NOT destructure the prop and then fail to apply it — a silently dropped `style` breaks the contract for every caller and is invisible at the type level.
- MUST merge Unistyles styles with array syntax (`[styles.root, style]`) and MUST NOT spread them or pass them through `StyleSheet.flatten`; both destroy the binding Unistyles updates through, so the style silently stops reacting to theme and runtime changes ([Merging styles](https://www.unistyl.es/v3/guides/merging-styles/)).
- MUST keep the component's own root selector at zero specificity on web (see the CSS Modules rules) so a single incoming class is enough to override it.

## When a Consumer Overrides

An override is legitimate when the difference is contextual — where the component sits, how large it is in this layout, how much room it gets. It is illegitimate when it changes what the component _is_, because the next caller then has to copy the override to get the same thing.

**Guidelines:**

- MUST express a contextual difference — position, size, margin, grid placement — as a consumer style.
- MUST express an identity difference — a filled versus outlined button, a destructive versus neutral action — as a variant prop on the component, not as a consumer override of its colours.
- MUST NOT reach into a component's internals from outside — no descendant selector that pierces another component's scope, and no override of a class the component did not publish. Route cross-component styling through a prop, a consumer class on the root, or a shared token.
- SHOULD promote a repeated override into a variant once a second caller needs it identically; the third caller is too late.

## One Module per Component

Sharing a stylesheet between two components couples them invisibly: a change made for one silently reshapes the other, and neither file says so. Sharing a _component_ makes the coupling explicit and reviewable.

**Guidelines:**

- MUST give each component its own style module, named after the component file (`blog-post-header.tsx` → `blog-post-header.module.css`).
- MUST NOT import another component's style module. When two components genuinely need the same appearance, extract a shared component and use it in both.
- MAY declare more than one scope root in one module when a single file exports more than one component — a loaded and a loading variant, for example.
- SHOULD split a component's own stylesheet when the component splits, rather than leaving one module serving two files.

## Sizing a Child from Its Parent

Because size is a consumer concern, a parent frequently sizes children it does not own. On web the consumer's class carries the size; on mobile native the consumer's `style` does, and where a child's size depends on a _measured_ parent, see the parent-measurement rules in the fluid-and-responsive and Unistyles references.

**Example — a parent supplying block spacing to child components it renders:**

```css
/* markdown-content.module.css — outside the component's own scope block:
   these classes are handed to child components, not applied to own markup. */
.snippet {
  margin-block: var(--space-24);
}

.embed {
  margin-block: var(--space-24);
}
```

**Guidelines:**

- MUST keep consumer-destined classes visually separate from the component's own scoped rules — outside the scope block on web — so a reader can tell which rules apply to this component's markup and which travel to a child.
- MUST size a child through the child's published styling prop, never by selecting into it.
- SHOULD name a consumer-destined class after the child it targets (`.avatar`, `.snippet`) rather than after the property it sets.
