# High-Fidelity UI & Visual Design — Color & Contrast

Contrast minimums recalculated per theme, and never encoding meaning in color alone.

Part of the research-grounded best-practices set for this skill (see the skill's `SKILL.md` for the full routing). Each principle below is distilled from reputable design sources; the `**Guidelines:**` bullets are the normative rules for this topic.

## Meet contrast minimums for text and non-text UI, per theme

A palette that passes its audit and still fails in production is the ordinary case, and it fails in the pairings nobody sampled. Recalculate every pairing separately for light and dark; a token set that passes in one theme routinely fails in the other, because dark themes invert the luminance relationship and low-chroma grays behave differently against near-black than against near-white. Check text against each effective surface it lands on, including elevated cards, sheets, and menus — not the base background you sampled once. Use the least-contrasting relevant ground for the foreground in use; the lightest surface can be worst for light text, but a darker surface can be worse for dark text. Do the same for every interactive state independently: hover, focus, active, and disabled each recolor text or its ground, and each must clear the threshold on its own (disabled controls are the one documented exception under 1.4.11, but faded "muted" text that is still meant to be read is not exempt).

The floors themselves are a one-line lookup: 4.5:1 for normal text and 3:1 for large text ([SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)), plus 3:1 for the visual information needed to identify and operate a control — a boundary when nothing else marks the hit area, the parts of an icon required to read it, and the indicators separating selected, focused, or checked from their neighbors ([SC 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)). Read them as hard floors rather than targets to approach: 4.47:1 fails 4.5:1 and 2.999:1 fails 3:1, so do not round up, and do not accept a tool that reports a rounded value. [APCA](https://git.apcacontrast.com/documentation/APCAeasyIntro.html), the WCAG 3 research method, is worth consulting alongside them as supplementary readability guidance — it catches thin weights, small type, and mid-tone-on-mid-tone pairings that clear WCAG 2 and still read poorly — but WCAG 2 AA stays the pass/fail baseline the mockup is measured against.

The common failure mode is checking one representative screen in one theme against the base background and declaring the palette compliant, then shipping placeholder gray captions, icon-only controls, focus rings, and disabled-looking-but-active states that quietly fall below 3:1 or 4.5:1 in the theme nobody re-measured.

**Good Example:**

> Checking a normal-text caption on every ground it uses: #555555 clears 4.5:1 on white but fails it on a darker #777777 sheet. Correct the paired roles before shipping, recheck the least-contrasting effective ground in each state, and recalculate the dark-theme counterpart separately — plus confirm the focus ring and the checkbox's checked-state fill at 3:1 against their adjacent colors.

**Bad Example:**

> Sampling one hero screen in light mode, seeing body text at 4.5:1, and calling the whole palette accessible — while the same gray caption lands at 3.9:1 on an elevated sheet, the dark theme's muted text sits at 3.2:1, and the icon-only toolbar buttons never get measured at all.

**Guidelines:**

- MUST recalculate every text and non-text color pairing separately for light and dark, since a token that clears the floor in one theme routinely fails in the inverted-luminance other.
- MUST clear WCAG 2 AA floors as hard thresholds — 4.5:1 for normal text, 3:1 for large text (18pt/24px, or 14pt bold/18.67px and heavier) — and 3:1 for the boundary, icon, and state indicators that identify or operate a control, without rounding a below-floor ratio up to pass.
- MUST measure text against each relevant effective surface a card, sheet, or menu can produce, using the least-contrasting ground for that foreground rather than always the lightest surface. Recheck each hover, focus, active, and muted state on its own ground, exempting only truly disabled controls under 1.4.11.
- MAY consult APCA as supplementary readability guidance for thin weights, small type, and mid-tone-on-mid-tone pairings, while keeping WCAG 2 AA as the pass/fail baseline.

Sources: [Contrast and Color Accessibility — WebAIM](https://webaim.org/articles/contrast/) · [5 Visual Treatments that Improve Accessibility — Nielsen Norman Group](https://www.nngroup.com/articles/visual-treatments-accessibility/) · [Color — Human Interface Guidelines — Apple](https://developer.apple.com/design/human-interface-guidelines/color)

### Verify effective colors, not token structure

An alpha token's existence or a matching role path across themes proves structure, not the rendered color or its contrast. Even an independent check that a tint reaches its target color says nothing about the foreground drawn on it. Select pairs from actual usage, not the cross-product of a palette; the relevant background is behind the text, or adjacent to the required control indicator, in that state.

A toolbar label over a translucent header needs separate cases on a page and on a card when their grounds differ. A shared token name alone cannot justify combining cases with different resolved stacks or contrast requirements. When resolving those colors requires alpha composition, consult the component-styling capability's backdrop and compositing mechanics where available. Otherwise, use the renderer's documented compositing model; report unresolved backdrop or color-space assumptions as verification limits, not passing pairs.

Default to a contrast calculation on the effective colors obtained from the styles and their resolved backdrop. Composite translucent foregrounds too, then apply the contrast method's luminance conversion; that conversion does not choose the renderer's compositing space. Check the actual render when group opacity, filters, blending or color conversion exceed the calculation's assumptions. For text, use the source foreground color with those effects resolved, not antialiased glyph-edge pixels ([SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)).

Images and gradients need the least-contrasting relevant regions behind the content, not an average background color ([G18](https://www.w3.org/WAI/WCAG22/Techniques/general/G18)). A few samples cannot prove contrast over future unknown content. Use an opaque backing or a scrim whose composited background range is demonstrably bounded when a guarantee is needed; translucency or blur alone is not that guarantee.

**Guidelines:**

- MUST select contrast pairs from text and visual information actually needed to identify or operate the UI, preserving distinct states and resolved backdrops rather than treating all token combinations as equally relevant.
- MUST record each checked foreground/background/state pair with its effective colors and resolved layer stack. Keep its contrast result with the calculation assumptions and applicable floor; token presence, role-path parity and target-color matching are not substitutes.
- MUST distinguish a color-match tolerance from a contrast threshold; acceptable approximation to a target cannot turn a below-floor ratio into a pass.
- MUST disclose the coverage limits of checks over variable or unknown backgrounds; finite samples establish only the sampled cases unless the background range is bounded and verified.
- MUST report product-approved low-contrast deviations separately from compliant pairs; approval does not create a WCAG exemption or justify a claim of full conformance.

## Never encode meaning in color alone

Color-only encoding is the defect that survives every review conducted in full color on a good screen — which is every review. The concrete how-to is to build each status, validation, selection, and interactive-affordance state with its non-color signal already in place (an icon, a text label, a shape, a stroke or border, weight, or a fill pattern), then run a grayscale test on the full mockup — desaturate the artboard, or view it through a color-blindness simulator for protanopia, deuteranopia, and tritanopia — and treat whatever became ambiguous as a defect to fix before handoff. The recurring pair is the two-line chart and the traffic-light status dot: both read perfectly to a designer with full color vision and collapse into identical grays for a meaningful slice of users. Fix them with dash patterns, marker shapes, or direct labels; and with an icon plus text beside the dot.

The requirement behind that pass is short — color must not be the only visual means of conveying information, indicating an action, or distinguishing an element ([SC 1.4.1](https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html)) — and it has exactly one measurable escape hatch, which is also where it is most often misread. WCAG treats a difference in both hue and lightness of at least 3:1 contrast as an acceptable additional distinction, which is why a body-text link that differs from surrounding text by 3:1 can rely on color plus (ideally) an underline. But the 3:1 allowance only helps when the user does not need to identify a specific color's meaning; if the information is "green means valid, red means invalid," no contrast ratio between them substitutes for a non-color cue, since a viewer who cannot separate the two hues learns nothing from their contrast. Treat 3:1 as covering "these two things are different," never "this one specifically means X."

For charts, see [chart information equivalence](./accessibility-and-cognitive-load.md#provide-task-relevant-chart-information-beyond-identification) for recovering task-relevant meaning without visual marks, a separate check from distinguishing series without color.

**Good Example:**

> A form field in the error state shows a red border AND a red-tinted X icon AND helper text ("Enter a valid email") below it — desaturate the screen and the field still reads as broken via the icon, the text, and the border weight change.

**Bad Example:**

> A status dashboard shows service health as colored dots only — green, amber, red — with no label or icon, so a deuteranopic viewer (or anyone on a grayscale display) sees three near-identical gray dots and cannot tell which service is down.

**Guidelines:**

- MUST pair every color that carries status, validation, selection, or interactive-affordance meaning with a second non-color channel — an icon, text label, shape, border, weight, or fill pattern — in the mockup itself.
- MUST run a grayscale or color-blindness-simulator pass (protanopia, deuteranopia, tritanopia) over the full artboard before handoff and fix any status dot, selected chip, required-field marker, or multi-line chart that becomes ambiguous once hue is removed.
- MUST NOT rely on a 3:1 hue-and-lightness difference to convey a specific color's meaning, reserving that allowance only for signaling that two elements differ.
- SHOULD distinguish chart series and traffic-light statuses with dash patterns, marker shapes, or direct labels rather than line or dot color alone.

Sources: [5 Visual Treatments that Improve Accessibility — Nielsen Norman Group](https://www.nngroup.com/articles/visual-treatments-accessibility/) · [Error-Message Guidelines — Nielsen Norman Group](https://www.nngroup.com/articles/error-message-guidelines/) · [Colour — GOV.UK Design System](https://design-system.service.gov.uk/styles/colour/) · [Don't use color alone to convey information (colorblind) — Access Guide](https://www.accessguide.io/guide/colorblind)
