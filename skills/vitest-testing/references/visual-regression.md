# Visual Regression

Apply this reference when comparing rendered appearance across runs, or deciding whether to adopt screenshot testing at all.

Verified against Vitest 4.1.10; ARIA snapshots require 4.1.4+. Requires Browser Mode.

## Capturing and Storing

`toMatchScreenshot` captures an element or page and compares it to a stored reference:

```ts
await expect(page.getByTestId("hero")).toMatchScreenshot("hero-section");
```

The first run writes a reference and **fails**, reporting that a new one was created. References live in `__screenshots__/` beside the test, named by test, browser, and platform — `hero-section-chromium-darwin.png` — and **must be committed**.

The platform is in the name because the same page renders differently per operating system. That is a mitigation, not a fix.

**Guidelines:**

- MUST commit reference screenshots; a missing reference fails rather than passing.
- SHOULD target a specific element rather than a full page, so an unrelated change elsewhere does not fail the assertion.

## Tolerances

Configured globally under `test.browser.expect.toMatchScreenshot` or per assertion:

- `comparatorName` and `comparatorOptions` — `threshold` for per-pixel color tolerance, `allowedMismatchedPixelRatio` and `allowedMismatchedPixels` for how much may differ. **When both limits are set, the stricter one wins.**
- `mask` — elements to paint over, for timestamps, avatars, and generated content.
- viewport and animations; Playwright disables animations by default.

Vitest also runs stable-screenshot detection: it captures, re-captures, compares, and repeats until two consecutive frames agree or it times out. That absorbs loading states and transitions, not genuine nondeterminism.

**Guidelines:**

- MUST mask dynamic content rather than raising the tolerance until it passes; a raised threshold hides real regressions everywhere.
- SHOULD set an explicit viewport, so a default size change does not invalidate every reference.

## Why Local Never Matches CI

Font rendering, GPU drivers, browser build, and headless-versus-headed all shift pixels. A developer's screenshot and CI's will differ on an unchanged page — this is expected, not a misconfiguration.

The only real fix is making the capture environment identical: a container, or a cloud browser service. Tuning thresholds until both pass instead widens the tolerance until the test stops detecting anything.

**Guidelines:**

- MUST generate reference screenshots in the same environment CI uses — a container or a cloud service — not on a developer machine.
- MUST NOT widen tolerance to reconcile two environments; fix the environment.
- SHOULD await `document.fonts.ready` before capturing, so a font swap does not race the screenshot.

## Operating It

Isolate visual tests in their own directory and CI job, so their failures do not obscure unit failures. Update baselines through a **manually triggered** job — automatic updates mean a regression can rewrite its own reference. Store references in Git LFS once the suite is large.

A failure produces three images: the reference, the actual, and a diff highlighting mismatches in red and anti-aliasing in yellow, with the pixel count and ratio.

**Guidelines:**

- MUST keep baseline updates manual; an automatic update makes the test unable to fail.
- SHOULD run visual tests as a separate CI job from the unit suite.

## The Cheaper Alternative

`toMatchAriaSnapshot` and `toMatchAriaInlineSnapshot` (4.1.4+) assert the accessibility tree rather than pixels. It catches structural regressions — a heading level, a missing label, a control that stopped being reachable — and does not break on a font bump or a platform difference.

For most component work it answers the real question at a fraction of the cost.

**Guidelines:**

- SHOULD prefer an ARIA snapshot over a screenshot when the regression being guarded against is structural rather than visual.

## The Honest Cost

This is the most expensive and most flakiness-prone thing in a suite: binaries in CI, binary files in history, and an ongoing baseline-maintenance burden.

**Guidelines:**

- MUST be able to state which regression class visual testing guards against before adopting it; "catching visual bugs" is not a specific enough answer to justify the cost.
- SHOULD scope it to the few surfaces where appearance is the product, rather than applying it broadly.
