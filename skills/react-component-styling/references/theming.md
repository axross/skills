# Design Tokens and Theming

Apply this reference when declaring a project's design tokens, when choosing which token a style should use, and when a value you want has no token yet. Colour is large enough to have its own reference — see [color-and-gamut.md](./color-and-gamut.md) for ramps, role names, schemes, and gamut. Everything else lives here.

The primitive-versus-semantic tier split below follows the [W3C Design Tokens Format Module](https://www.designtokens.org/tr/drafts/format/) and [Material Design 3's design tokens](https://m3.material.io/foundations/design-tokens/overview).

Tokens exist so a visual decision is made once and consumed everywhere. That only holds if components consume the **semantic** tier — a name that says what the value is for — rather than the raw scale beneath it. A component that reaches past the semantic name to a primitive, or inlines the literal it would have resolved to, is the leak that breaks the next theme change.

## Token Families

A project declares these families. Values are the project's; the shapes are not negotiable, because a component written against one shape does not survive a project that chose another.

| Family       | Shape                                        | Notes                                              |
| ------------ | -------------------------------------------- | -------------------------------------------------- |
| Colour       | Semantic roles or optional component aliases | See [color-and-gamut.md](./color-and-gamut.md)     |
| Typography   | Composite named text roles                   | Family + size + line height + weight, bundled      |
| Spacing      | Numeric steps keyed to their base px         | `--space-16`, `theme.space.x16`                    |
| Radius       | Named tier                                   | `xs` / `sm` / `md` / `lg` / `full`                 |
| Border width | Named tier including a hairline step         | `hairline` / `base` / `thick`                      |
| Duration     | Named scale                                  | `sm` … `2xl`, by magnitude never by milliseconds   |
| Easing       | Role-named curves                            | `standard` / `enter` / `exit`, never `ease-in-out` |
| Shadow       | Named ordered layer recipes                  | Composite effects, not only shadow colour          |

Generic UI colour roles use the 13-step scheme ramps. Domain semantic roles use meaning-based namespaces, and optional component aliases resolve through semantic roles; neither namespace has to imitate the generic role × scheme shape.

**Guidelines:**

- MUST declare every family a project uses, even where one has a single member; a lone easing token still gets a role name so a second one can join it later.
- MUST NOT fold one family into another. Radius is not spacing, and a border width is not a spacing step, even when the numbers coincide today — the moment one moves, every borrowed use moves with it.
- MUST name a token for its role, never for its appearance or its value. `--duration-md` and `ease.standard` survive a retune; `--duration-200ms` and `ease-in-out` become lies.
- MUST keep the light and dark mappings structurally identical — the same names present in both — so no surface can reference a token that exists in only one scheme.

## Composite Shadow Effects

A shadow's colour alone does not define the effect: its layers also carry stacking order, offsets, blur, spread, and inset. Keep that recipe together under a semantic role so consumers do not recreate subtly different shadows. Blur softens a layer; spread expands or contracts its extent. They are separate values, not interchangeable measures of softness.

**Example — ordered layers in a token module; values are illustrative:**

Layers are listed front-to-back, and lengths use base px. Offsets follow [CSS box-shadow directions](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/box-shadow#values): positive X points right and positive Y points down. A platform conversion keeps that order and direction and converts units explicitly.

```ts
type ShadowLayer = {
  offsetX: number;
  offsetY: number;
  blurRadius: number;
  spreadDistance: number;
  color: string;
  inset?: boolean;
};

const sheetLayers: readonly ShadowLayer[] = [
  {
    offsetX: 0,
    offsetY: 4,
    blurRadius: 6,
    spreadDistance: -2,
    color: "rgba(0, 0, 0, 0.05)",
  },
  {
    offsetX: 0,
    offsetY: 10,
    blurRadius: 15,
    spreadDistance: -3,
    color: "rgba(0, 0, 0, 0.1)",
  },
];

const effects = {
  topSheet: sheetLayers,
  bottomSheet: sheetLayers.map((layer) => ({
    ...layer,
    offsetY: -layer.offsetY,
  })),
};
```

An overlay consumer selects `effects.topSheet` or `effects.bottomSheet` as a whole. These names describe where the sheet is used, not how its offsets are transformed. The bottom-sheet variant changes only the vertical direction; order and every other field still come from the base recipe. An inset well has a different purpose and layer semantics, so it deserves its own effect role rather than an arbitrary override of the sheet shadow. Resolve scheme-dependent colours where the host design system keeps themed tokens; invariant effects may be shared. Neither needs a prescribed namespace or file layout.

On web or native, consume the recipe directly when the renderer accepts it; otherwise convert at the platform boundary, retaining its declared stacking order and each field's meaning. A CSS shadow list or a native layer array such as React Native's [`BoxShadowValue`](https://reactnative.dev/docs/boxshadowvalue), where supported by the project's target versions and platforms, are possible representations, not required APIs. A mechanical replacement with [`drop-shadow()`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/filter-function/drop-shadow) is not equivalent: it follows an alpha mask, accepts no spread or inset, and its blur parameter has different semantics.

Negate `offsetY` at the adapter only if the target's verified positive-Y direction is upward; matching field names do not establish matching coordinate conventions. When documentation and implementation disagree, check the target version's implementation or a rendered asymmetric probe before choosing the conversion.

**Guidelines:**

- MUST resolve every shadow effect through a named layer recipe and consume each recipe whole, preserving layer order, colour, both offsets, blur, spread, and inset rather than tokenizing only colour or inlining component-local shadow geometry.
- SHOULD derive a variant from the base recipe when only a defined transformation changes; declare a separate semantic effect when its purpose or layer semantics differ.
- MUST preserve the recipe's semantics through web/native conversion. If the target cannot represent them, choose a supported rendering path or document an intentional fallback and its lost semantics rather than silently presenting a flattened shadow as equivalent.

## Composite Text Roles

Family, size, line height, and weight are not independent choices: a heading family at a caption size is a mistake no caller should be able to make by accident. Bundling them into one named role removes the combination from the caller's hands, and on mobile native it is the only shape that works — there is no cascade, so the four values have to arrive together.

Which field carries weight is not fixed, though: it follows from how the family makes weight addressable, and that is a property of the family, not of any one role. A family whose extra weights stay inside the four RIBBI faces (Regular/Italic/Bold/BoldItalic), or a web custom-property quad, is addressable by number. A family whose extra weights get their own OpenType `name` table entry is addressable only per face — the face name itself carries the weight, and a role built on it declares no separate number.

**Example — the shape on mobile native:**

```ts
const typography = {
  title: {
    fontFamily: fonts.heading,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "600",
  },
  body: {
    fontFamily: fonts.paragraph,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400",
  },
  caption: {
    fontFamily: fonts.paragraph,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400",
  },
  code: {
    fontFamily: fonts.monospace,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
  },
} as const;
```

```tsx
const styles = StyleSheet.create((theme) => ({
  title: { ...theme.typography.title, color: theme.colors.text.neutral.high },
}));
```

**Example — the same roles on web, as a custom-property quad:**

```css
.title {
  font-family: var(--text-title-family);
  font-size: var(--text-title-size);
  line-height: var(--text-title-leading);
  font-weight: var(--text-title-weight);
}
```

**Example — a family addressable only per face:**

A family with more weights than the four RIBBI faces (Avenir Next and JetBrains Mono both do) folds each extra weight into its own `name` table family string. A role built on one of those weights reads a face token and declares no numeric weight:

```ts
const typography = {
  title: {
    fontFamily: fonts.headingDemiBold, // resolves to "Avenir Next Demi Bold"
    fontSize: 20,
    lineHeight: 26,
    // no fontWeight — the face already carries it
  },
} as const;
```

**Guidelines:**

- MUST declare typography as named text roles that bundle family, size, line height, weight, and letter spacing where declared, and MUST apply a role whole rather than picking values out of it.
- MUST NOT inline a numeric `fontSize` or `font-size` in a component. Every size a project uses is a text role; a size with no role is a missing token, not an exception.
- MUST pair a font family with its feature settings wherever the project declares them, since setting one without the other produces glyph mismatches between surfaces.
- MUST classify a family once — as addressable by number when every face in use shares the OpenType `name` table's ID 1, or addressable only per face when any face in use does not — and apply that one classification to every role of the family, never per role.
- MUST NOT pair a numeric `fontWeight` with a face whose name already carries the weight; a number beside an already-weighted face invites the platform to synthesise a heavier style on top of it.
- MUST declare a face name that carries weight as a token the role reads, never the raw face-name string held directly in the role.
- MUST classify a family by reading its raw `name` table — ID 1 against ID 16/17, per the [OpenType `name` table specification](https://learn.microsoft.com/en-us/typography/opentype/spec/name) — not by a tool that merges both records into one shared-looking family. A self-hosted web font never meets the per-face condition, since `@font-face` declares `font-family` and `font-weight` directly and ID 1 is never consulted.
- SHOULD name roles for their content (`title`, `body`, `label`, `caption`, `code`), not their size (`lg`, `sm`), so a retune does not rename them.
- SHOULD classify a family the same way on every platform a project ships once any platform requires the per-face form, rather than addressing the same family two different ways.
- MAY add a role rather than stretch an existing one when a surface genuinely needs a new pairing — a new role is a design decision, but it is a cheaper one than a one-off literal.

### Resolve roles for the effective language

Build complete roles from the project's language/script font mapping at the theme boundary. Keep role names stable so components continue to apply `theme.typography.body` or the equivalent web role without local language branches. A language change can select a different face without changing the role's purpose; resolve that face's weight form and the selected mapping's declared letter spacing and font features along with its size and leading. Do not carry tracking over from the previous mapping or invent a value for a role that declares none.

The effective language is the already-resolved language the app uses for translations. Receive that input from application state rather than resolving preference policy inside a stylesheet. For language-preference initialization, ordering, or late-completion verification, consult the project's component/app-state language-preference practices where present. Without that optional capability, the host application still owns preference resolution before supplying the effective-language input.

Bindings can differ by purpose without splitting the bundle contract:

| Role purpose                                       | Font binding                                         | Coverage condition                                                                                   |
| -------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Translated body, caption, or chart label           | Language/script-specific face or fallback            | Translated text and supported mixed-script content                                                   |
| Deliberately invariant metric or rank-pair symbols | Fixed purpose-specific face                          | Documented unchanged digit/symbol repertoire                                                         |
| Localized numeric value or unit                    | Covered variant, separate semantic role, or fallback | Actual localized digits, separators, and unit text; not an assumption that all numbers are invariant |

Define fallback at the token/platform boundary too. On web, provide the role's font-family stack. On native, use the platform-supported face/fallback mechanism rather than assuming a web stack is portable. For known content in another language or script, supply the appropriate role variant or covered fallback; automatic per-string script detection is not required. A translation fallback alone says nothing about font glyph coverage.

Web content-language and writing-direction metadata belong to markup, not typography tokens. [Declare the document language on `html` with a valid BCP 47 language tag](https://www.w3.org/International/questions/qa-html-language-declarations#choosing-language-values). Map application identifiers to those tags: a mapping can define `en_US` → `en-US` or `english` → `en`; copying an internal key blindly into `lang` is not that mapping. Known differing-language elements use valid tags for their own content: an English interface can use `<html lang="en">` while a Japanese name uses `<span lang="ja">山田</span>`. [CSS Fonts' language-specific display](https://www.w3.org/TR/2018/REC-css-fonts-3-20180920/#language-specific-support) uses the element's content language for localized glyph forms; a font-family stack cannot supply that metadata.

When the effective language changes, update the document's mapped `lang` and independently resolved `dir` along with translated text and resolved roles. Direction follows the host application's locale/content policy, not the selected font or language attribute: [language markup does not set writing direction](https://www.w3.org/International/questions/qa-html-language-declarations#additional). Switching an English default to Arabic and back updates both document defaults; an English-specific run inside Arabic content retains its own `lang="en"` and `dir="ltr"`. Keep content-specific language and direction overrides tied to their content rather than replacing them with every new document default.

When choosing which roles can remain invariant or judging translated and large-text renders, consult the project's high-fidelity typography practices where present. Without them, check supported-script glyphs, shaping and fallback clusters, long translations, and native accessibility text sizes for broken rendering, clipping or lost content.

**Guidelines:**

- MUST resolve translated text roles from the same already-resolved effective language as the translations, accounting for known content-language/script differences through central variants or fallback rather than component-local font patches.
- MUST map application language identifiers to valid BCP 47 tags for `lang` on the document and known differing-language elements; keep language metadata in markup rather than typography tokens.
- MUST synchronize the document's mapped `lang` and independently resolved `dir` with each effective-language change, using the host application's locale/content direction policy and preserving content-specific language and direction overrides.
- MUST rebuild affected complete roles when the effective language changes, preserving the selected mapping's declared letter spacing and font features and each selected face's weight-addressing form; keep deliberately invariant bindings fixed rather than replacing every face with the prose font.
- MUST update every affected appearance mapping, including inactive light/dark themes, without replacing unrelated theme tokens, so a later appearance change cannot restore stale language-dependent roles.
- MUST define script-specific faces or platform-supported glyph fallback for the content each role accepts, including localized digits, units, and mixed-script strings.

## Spacing, Radius, and Border Width

Spacing steps carry their base pixel value in the name, because that number is the anchor a reader needs — it is the small-screen floor of a fluid token (see [fluid-and-responsive.md](./fluid-and-responsive.md)) and the thing a design hand-off is specified in. Radius and border width take named tiers instead, because their steps are role-shaped: a chip, a card, and a pill differ in kind, not in amount.

**Example:**

```css
--space-4: 0.25rem;
--space-8: clamp(0.5rem, 0.4643rem + 0.1786vi, 0.625rem);
--space-16: clamp(1rem, 0.9286rem + 0.3571vi, 1.25rem);

--radius-sm: 0.375rem;
--radius-md: 0.625rem;
--radius-full: 100vw;

--border-hairline: 0.0625rem;
--border-base: 0.125rem;
```

```ts
import { StyleSheet as NativeStyleSheet } from "react-native";

const space = {
  x4: 4,
  x8: 8,
  x12: 12,
  x16: 16,
  x24: 24,
  x32: 32,
  x48: 48,
} as const;
const borderWidth = {
  hairline: NativeStyleSheet.hairlineWidth,
  base: 1,
  thick: 2,
} as const;
```

React Native defines [`hairlineWidth`](https://reactnative.dev/docs/stylesheet#hairlinewidth) as the platform's width of a thin line, which can vary by platform and density. It is neither a fixed cross-device width nor a guarantee of the physical minimum. This example reads a platform constant in a token module; it does not create a React Native stylesheet. [The Unistyles creation rule](./unistyles.md#the-stylesheet-signature) still governs stylesheet creation and updates.

**Guidelines:**

- MUST key spacing steps to their base pixel value on both platforms — `--space-16` on web, `theme.space.x16` on native.
- MUST declare radius as a named tier and MUST NOT resolve a radius through the spacing scale, even where a step happens to match.
- MUST declare border widths as their own named tier, with a `hairline` step that uses the platform-defined thin-line width on native (`NativeStyleSheet.hairlineWidth` in this example) and a project-defined thin-line length on web.
- MUST NOT make a hairline, a border width, or a focus-ring dimension fluid; sub-pixel interpolation degrades border rendering and breaks a focus-ring specification.
- SHOULD assign each radius step a role in the project's design system (chip, card, pill) so a surface picks by role rather than by eye.

## Duration and Easing

Motion tokens follow the same role-naming rule as everything else. An easing token named for its curve (`ease-in-out`) is a value pretending to be a name: retuning the curve either renames the token or makes it false.

**Guidelines:**

- MUST draw every transition and animation duration from the duration scale, and every curve from a role-named easing token.
- MUST NOT inline a curve keyword or a `cubic-bezier()` literal in a component, and MUST NOT name an easing token after the curve it currently holds.
- MAY use a literal duration for a deliberately non-interactive cadence — a multi-second atmospheric reveal that does not belong on the interaction scale — and SHOULD promote it to a token once a third surface uses it.
- SHOULD keep the interaction tier small; a project needs far fewer durations than it thinks, and each extra one is a chance for two surfaces to disagree.

## Snapping to the Scale

A scale only constrains if values land on it. Ordinary spacing snaps to the nearest step; "no step fits" raises a design decision, not permission to inline. Preserving an approved design's bounded internal geometry follows the separate approval path below, not a broader literal category.

**Guidelines:**

- MUST resolve every colour, spacing, radius, border-width, duration, easing, and typography value through a token, except for the literal categories below or lengths meeting [Approved Local Geometry](#approved-local-geometry).
- MUST snap ordinary off-scale spacing to the nearest step, and MUST raise a missing step as a design decision rather than silently resolving it locally.
- MUST NOT disguise an off-scale value as a component-local constant or custom property. Every branch resolves to a project token, a literal category below, or a length meeting [Approved Local Geometry](#approved-local-geometry), and still satisfies applicable platform-adapter constraints. Naming a hard-coded hex or arbitrary padding does not make it a token.
- MUST keep unconditionally permitted off-token literals to this complete list:
  - **Fixed element dimensions** — an icon's drawn size, an avatar's diameter, a fixed line box, an `aspect-ratio`. These are geometry, not scale spacing.
  - **Ratios and multipliers** — an opacity, a `flex` value, a `z-index`, a `scale()` factor.
  - **Full-fill and intrinsic keywords** — `100%`, `stretch`, `auto`, `max-content`.
  - **Values inside the theme file itself**, which is where the scales are defined.
- MUST NOT extend that unconditional list locally. A font size is not on it (every size is a text role), and neither is a hairline (it is a border-width step).

### Approved Local Geometry

An optical correction adjusts visual alignment or balance to preserve an approved design constraint. Internal padding and gaps remain spacing, not fixed-element dimensions or ratios. The geometry-specific requirements below apply on every route. When the project's installed-rule deviation practices are available, use their generic adoption and validity checks as well, not instead. This path does not override other applicable rules.

**Example — React Native numeric layout lengths:**

> In this React Native illustration, assume positive spacing steps `4`, `8`, `12`, … resolve to the same numeric logical layout lengths. A noninteractive pill has an approved nominal height of `20`: with unchanged content height `16` and no other box terms, vertical padding `2` gives `20`, while snapping to `4` gives `24`. Leading padding/gap `3` and trailing padding `9` snap to `4` and `8`.
>
> These lengths are not CSS `pt` or physical pixels; on web, compare converted geometry with the token's resolved CSS length, not just its key. Scoped approval can preserve those exact internal lengths without adding single-use steps to the shared scale, but cannot waive independently applicable design or adapter rules. The same numbers in another component inherit no approval.

**Guidelines:**

- MUST compare the proposed internal lengths with the nearest scale steps and cite the design constraint that snapping would change; prefer the scale when it preserves the intended result, rather than accepting "looks better" alone.
- MUST distinguish a reusable missing scale step from component-specific geometry with the design-system owner. A shared need calls for a scale proposal; do not add single-use steps solely to avoid making a local approval decision.
- MAY retain exact off-token internal padding, gaps or alignment offsets only after the responsible human explicitly approves the deviation for the stated component and conditions. Approval of a design image alone does not approve an off-scale implementation.
- MUST stop a proposed implementation that conflicts with an independently applicable design grid/token or platform-adapter rule unless a separately valid human-adopted deviation covers that rule, source, scope and conditions under the actual host's priority and restrictions. Styling approval alone cannot authorize an off-scale CSS custom-property terminus.
- MUST keep the design evidence and nearest-step comparison, exact values/properties, scope, human approval locator and shared-scale decision recoverable through linked project records. Placement and document shape follow the project's applicable documentation and decision-record practices; absent a placement policy, use established project records. No single decision document or dedicated register is required. A local constant, an agent-authored assertion or a pending upstream proposal is not human adoption.
- MUST reassess before reuse in another component or context, or when the supporting geometry, assets, typography or scale changes. Repeated shared need reopens the scale decision; it does not automatically promote a one-off value or transfer the original approval.
- MUST NOT waive accessibility requirements for optical geometry, including target size, contrast, focus, text scaling and reflow. A noninteractive visual box does not establish an interactive hit-area minimum or permit clipping enlarged text; verify the hit area separately if the surface becomes interactive.

## Reading a Token Outside a Stylesheet

Some consumers of a token are not stylesheets: an icon component takes colour and size as props, a navigator takes them as options, an animation interpolates between them. These still resolve through tokens.

**Example — an icon on mobile native:**

```tsx
const { theme } = useUnistyles();

return <ChevronRight color={theme.colors.text.neutral.low} size={22} />;
```

**Guidelines:**

- MUST resolve a token through the theme object when a value is passed as a prop or an option on mobile native, rather than importing the raw palette module.
- MUST make a web SVG track its surrounding text colour with `currentColor` rather than taking a colour prop, unless the icon is deliberately independent of its context.
- MUST accept an icon as a component prop when a component lets its caller choose one, rather than a glyph-name string, so the caller keeps type safety and the component keeps control of colour and size.
- MUST source icons from the project's single icon set; a second set is a design decision, not a component-level one.
- SHOULD keep token reads out of render bodies where the platform offers a stylesheet-level equivalent — a value read in JS does not participate in the stylesheet's own update path.
