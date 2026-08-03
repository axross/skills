# Assets and Images

Apply this reference when adding a font, an icon set, a vector graphic, a bundled binary, an app icon, or when rendering an image.

## Fonts

A font can be embedded natively at build time through the font library's config plugin, or loaded at runtime from JavaScript. Prefer embedding: an embedded face is available at the first frame, which removes it from the launch's readiness gate entirely, and it cannot produce the unstyled-text flash that a runtime load can.

Runtime loading remains correct for a face the app cannot know at build time — one fetched, chosen by the user, or supplied by content.

Load only the faces the app actually renders. A family shipped in every weight and italic pair is tens of megabytes of binary for the two or three faces the design system names, and every one of them is embedded in the app.

**Guidelines:**

- MUST embed a known font through the config plugin rather than loading it at runtime.
- MUST list only the faces the design system uses, not a family's full set.
- MUST include a runtime-loaded font in the readiness gate, so text never renders in a fallback face and then reflows.
- SHOULD report a font-loading failure to the error tracker and continue, rather than holding the launch on a font.
- MUST NOT both embed a face through the plugin and load the same face at runtime; the runtime load is redundant work at every launch.

## Icons and Vector Graphics

An icon set arrives either as a font — one glyph per icon, sized and coloured as text — or as vector components. Both are legitimate; the font is cheaper to render and constrains icons to a single colour, while components allow multi-colour artwork and per-path control.

Importing vector graphics as components requires bundler wiring: the transformer that compiles them, the graphic extension moved out of the asset extensions and into the source extensions, and a type declaration so the import type-checks.

**Example:**

```js
// metro.config.js
config.transformer.babelTransformerPath =
  require.resolve("react-native-svg-transformer/expo");
config.resolver.assetExts = config.resolver.assetExts.filter(
  (ext) => ext !== "svg",
);
config.resolver.sourceExts.push("svg");
```

**Guidelines:**

- MUST move the graphic extension out of the asset extensions when routing it through a transformer; leaving it in both makes resolution order decide the outcome.
- MUST provide a module type declaration for the transformed extension, or every such import is an error or an implicit `any`.
- SHOULD pick one icon mechanism per app and keep to it, rather than mixing a font and components for the same icon set.
- SHOULD start the bundler with a cleared cache after changing extension configuration, since the resolution is cached.

## Bundled Assets and Extra Extensions

An asset the bundler does not recognize — a model, an audio file, a database seed — needs its extension registered before it can be imported. An asset that must exist on the file system before first use additionally needs pre-loading, either through the asset library's config plugin at build time or by loading it behind the readiness gate.

**Guidelines:**

- MUST register an unrecognized asset extension with the bundler before importing files of that type.
- MUST pre-load an asset the app requires on first use, rather than assuming a bundled asset is already on disk.
- SHOULD defer a large asset that is not needed at launch until the feature that uses it, rather than adding it to the launch gate.

## App Icons and Splash Images

The launcher icon, the platform-specific icon variants, the adaptive icon layers, and the splash image are declared in the app config and generated into the native projects. They are build-time inputs: changing one requires regenerating and rebuilding, not a reload.

**Guidelines:**

- MUST supply the icon variants each platform expects rather than one image for all of them.
- MUST supply the adaptive icon's layers separately where the platform composes them, since a single flattened image is cropped unpredictably.
- SHOULD keep the splash image simple and centred, because it is composited against a background colour at a size the app does not control.
- MUST rebuild after changing an icon or splash asset; neither updates through a reload or an over-the-air update.

## Rendering Images

Use the Expo image component rather than the core one. It brings disk and memory caching, transitions, priority, a placeholder while loading, and correct behavior in recycled lists — all of which the core component leaves to the app.

Two settings matter most in lists. A **recycling key** tells the component that a recycled view now shows a different image, without which a fast scroll shows the previous row's image in the new row. And **explicit dimensions** prevent the layout shift that arrives when an image's intrinsic size does.

**Guidelines:**

- MUST use the Expo image component for remote and bundled images rather than the core image component.
- MUST give an image in a recycled list a recycling key derived from its source.
- MUST give an image explicit dimensions or an aspect ratio, so its arrival does not reflow the surrounding layout.
- SHOULD set a cache policy deliberately per use — a durable remote asset and a signed one-off URL do not want the same policy.
- SHOULD provide a placeholder for an image that is not immediately available, rather than leaving a blank region.
