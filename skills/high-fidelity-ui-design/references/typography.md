# High-Fidelity UI & Visual Design — Typography

A semantic type scale and readable text across languages and scripts.

Part of the research-grounded best-practices set for this skill (see the skill's `SKILL.md` for the full routing). Each principle below is distilled from reputable design sources; the `**Guidelines:**` bullets are the normative rules for this topic.

## Build a semantic type scale, not ad-hoc sizes

The failure this prevents is ad-hoc sizing: a designer wants one line to stand out and types font-size: 19px inline, or an engineer bumps body text to 18px on a single screen to "make it breathe." These orphan values never match a token, never theme, and quietly multiply until the app has forty near-duplicate sizes and no legible hierarchy. Assign by content importance, not by how a particular screen happens to feel in isolation — if the text is a section heading, it gets the title role everywhere, and if the title looks wrong, you fix the token, not the instance.

What makes that possible is a closed set of named roles, each a token bundling family, size, line height, and weight, plus letter spacing where declared. Both major platforms provide semantic styles ([Material 3 type-scale tokens](https://m3.material.io/styles/typography/type-scale-tokens), [Apple Dynamic Type](https://developer.apple.com/design/human-interface-guidelines/typography)). The bundling is the part that pays: because the properties travel as a unit, changing the brand font or nudging the scale updates every screen consistently, and light/dark or platform variants stay in lockstep.

Use the host project's approved role ramp first. Caption, chart label, and metric value serve different reading tasks; a deliberate ramp need not fit one modular ratio. Consistency comes from shared semantic roles and a tested hierarchy, not from making every role satisfy the same formula.

When starting a new design without an approved ramp, a 16px body with one modular ratio is one useful starting point ([A Responsive Guide to Type Sizing](https://cloudfour.com/thinks/responsive-guide-to-type-sizing/)). For example, 1.25 (major third) gives restrained steps, while 1.333 (perfect fourth) gives stronger heading contrast. Start with a small ladder, such as 6-8 distinct sizes, then test the roles against real content and platform text scaling. Neither that count nor that formula replaces an approved design system or the readability and accessibility requirements below.

**Good Example:**

> A settings screen uses `title` (22px / semibold) for the screen heading, `body` (16px / regular) for each row label, and `label` (13px / medium / +0.5 tracking) for the helper text under a toggle — three named roles pulled from the shared scale, so switching the app font or dark theme restyles all of them at once.

**Bad Example:**

> To make a card stand out, a developer writes `fontSize: 19` inline on its heading and `fontSize: 15` on its body — values that exist nowhere else in the system, match no token, don't scale with Dynamic Type, and leave the app with a dozen near-identical one-off sizes that read as visual noise instead of hierarchy.

**Guidelines:**

- MUST assign every string to a named role from the shared type scale (such as title, body, or label) and MUST NOT introduce raw font-size values that match no token.
- MUST use the host project's approved semantic role ramp, including purpose-specific roles, rather than forcing it onto a universal base size, modular ratio, or role count.
- MAY start a new scale with a 16px body and one modular ratio when no approved ramp exists; validate that choice against content, supported scripts, and platform accessibility requirements.
- SHOULD keep new scales small and express emphasis by pairing weight with size rather than leaning on color or all-caps as the primary hierarchy signal.
- MUST assign roles by content importance consistently across screens and fix the token rather than overriding a single instance when a role looks wrong.

Sources: [Typographic Hierarchies — Smashing Magazine](https://www.smashingmagazine.com/2022/10/typographic-hierarchies/)

## Choose text roles by language, script, and purpose

Language selects translated copy and language-appropriate glyph forms; script is the writing system whose glyphs the font needs to cover. Purpose determines the reading task. These are separate decisions: a translated chart label follows the prose font policy, while a rank pair or metric value can have a deliberately language-independent face. Being numeric alone does not make a role invariant — localized digits and units can change its required glyphs.

Choose script-specific faces and fallbacks for the content a role can receive, not only the app's current language. A Latin-language interface can still contain a Japanese name. [CSS Fonts' font-matching rules](https://www.w3.org/TR/2018/REC-css-fonts-3-20180920/#font-matching-algorithm) cover character coverage and fallback. A font covering those characters can still use the wrong language-specific forms: [CSS Fonts' language-specific display rules](https://www.w3.org/TR/2018/REC-css-fonts-3-20180920/#language-specific-support) use the element's content language when selecting glyphs. This calls for an explicit content/font policy, not a universal requirement to detect every string's script automatically. Token resolution and platform fallback mechanics belong to the project's component-styling practices where present; otherwise resolve complete roles centrally with supported-script coverage.

**Good Example:**

> `body`, `caption`, and `chartLabel` use faces suited to the selected language and supported scripts. A `metricValue` role keeps its purpose-specific face for a documented, unchanged digit/symbol repertoire. Localized units use a suitable text role, and localized digits or mixed-script values require a covered variant or fallback rather than an assumed Latin-only face.

**Bad Example:**

> Switching language replaces every face with the prose font, losing the distinct rank-pair treatment. Another screen does the opposite: it labels every number language-independent, then renders localized digits and units through a face that cannot display them.

Exercise the following cases when judging the role mapping:

| Case                            | Content and state                                                                                  | Failure to look for                                                                      |
| ------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Script coverage                 | Supported scripts, mixed-script names, localized digits, units, and symbols                        | Missing glyphs or incorrect language-specific forms, including in fallback               |
| Translation length              | Longest supported translations at narrow supported layouts                                         | Clipping, overlap, or loss of essential content                                          |
| Language precedence             | Device language A with saved user language B; a new selection while initialization is pending      | Text and roles disagree, or a late default replaces the selection                        |
| Language and appearance changes | Switch language, then switch to a previously inactive theme                                        | Stale language-dependent faces or missing roles                                          |
| Native large text               | Longest supported translations at default and largest accessibility text sizes supported by the OS | Broken hierarchy, clipped line boxes, overlap, or essential content becoming unavailable |

Apple's [typography guidance](https://developer.apple.com/design/human-interface-guidelines/typography) calls for testing at the largest accessibility text sizes, including custom fonts. These checks preserve the readability floors below; fitting a translation by reducing text size or disabling accessibility scaling does not satisfy them.

**Guidelines:**

- MUST choose a semantic role by content purpose and define its language/script coverage, including mixed-script content the role can receive.
- MAY keep a purpose-specific numeric or symbolic face language-independent only when its intended glyph repertoire remains covered; localized digits or units require an appropriate variant, role, or fallback.
- MUST verify the role mapping with the cases above on each supported platform, treating incorrect glyphs, clipping, overlap, and loss of essential content as failures rather than hiding them by shrinking text or disabling native text scaling.

## Tune body text for readability: size, measure, and leading

Size, measure, and leading interact, so tuning them in isolation is what produces the most common failure: a wide measure with tight leading, where the reader finishes a long line and can't reliably find the next one. Constrain the text container — a max-width around 60-70ch, or a fixed column that yields ~66 characters at your body size — instead of letting paragraphs run the full viewport width. Longer measures then want more leading; short columns and large display sizes want proportionally less.

The three floors themselves are lookups: roughly 15-25px of rendered body text ([Butterick](https://practicaltypography.com/summary-of-key-rules.html)), never below the 11pt mobile minimum for legibility at arm's length ([Apple](https://developer.apple.com/design/tips/)); about 50-75 characters per line including spaces ([Baymard](https://baymard.com/blog/line-length-readability)); and 120-145% leading, defaulting to about 1.5 ([Butterick on line spacing](https://practicaltypography.com/line-spacing.html)), which conveniently also clears the author-testable floor in [SC 1.4.12](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html). Around the geometry sit the legibility fundamentals ([NN/g](https://www.nngroup.com/articles/legibility-readability-comprehension/)): a clean typeface — serif is fine at high resolution, but avoid handwriting or decorative faces for body — on a plain, un-textured ground, with glyph contrast at [4.5:1 or better](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

The part a mockup usually skips is surviving a user override. SC 1.4.12 requires that when a reader forces those spacing values up, no content is clipped, overlapped, or lost — which means containers that grow with their text, and paragraphs that reflow rather than truncate. Fixed-height buttons, chips, and cards sized to exactly one line, single-line clamps on dynamic copy, and absolutely-positioned text over images are the usual sources of clipped or overlapping text once real content or accessibility settings enter the picture.

**Good Example:**

> A settings screen renders body text at 17px with line-height 1.5 (≈25px) inside a content column capped at 640px, so paragraphs land at ~65 characters per line on dark, high-contrast plain backgrounds — and still reflows cleanly when the OS text-spacing override is applied.

**Bad Example:**

> An onboarding paragraph is set at 13px with 1.2 line-height and allowed to span the full 900px viewport, producing ~110-character lines the eye keeps losing — and its description sits in a fixed-height card that clips the last line once real copy or larger accessibility spacing kicks in.

**Guidelines:**

- MUST size body text at roughly 15-25px of rendered height and never below the platform floor (11pt on mobile, with 17pt the iOS body default).
- MUST constrain the body text container to yield about 50-75 characters per line, capping its measure (for example a max-width near 60-70ch) rather than letting paragraphs span the full viewport.
- MUST set body line-height to at least 1.5× the font size and keep glyph-to-background contrast at 4.5:1 or higher on a plain, un-textured ground.
- MUST let text containers grow with their content — avoid fixed-height cards, chips, and buttons and single-line clamps on dynamic copy — so no content clips or overlaps when WCAG 1.4.12 spacing overrides are applied.
