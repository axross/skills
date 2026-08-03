# Transforms and Module Resolution

Apply this reference when Jest cannot parse a file it should, cannot resolve an import it should, or when an edit to a transformer appears to have no effect.

Verified against `jest` 30.4.2 — [Jest — Code Transformation](https://jestjs.io/docs/code-transformation).

## Transforms

`transform` maps a file pattern to a transformer. The default is `babel-jest` for `.js`, `.jsx`, `.ts`, and `.tsx`, applied automatically whenever a Babel configuration exists. `transform: {}` disables transformation entirely, which is what a native-ESM suite running plain JavaScript wants.

A transformer also handles non-JavaScript assets: a stylesheet or an image import that a bundler would resolve needs either a transformer returning a stub or a `moduleNameMapper` entry — the latter is usually simpler.

**Guidelines:**

- MUST set `transform` for any file extension the suite imports that Node cannot parse, rather than relying on the default's four patterns.
- MUST NOT add a `transform` entry alongside a preset that already supplies one unless the intent is to replace it; see [configuration.md](./configuration.md).
- SHOULD map static assets through `moduleNameMapper` rather than writing a transformer, unless the test needs something derived from the file.

## The Most Common Failure

`Cannot use import statement outside a module` means a file containing ESM syntax reached the runtime untransformed. In practice it is almost always a dependency: `transformIgnorePatterns` defaults to `["/node_modules/", "\\.pnp\\.[^\\/]+$"]`, so nothing under `node_modules` is transformed, and a package published as untranspiled ESM therefore arrives as raw `import` statements.

The fix is a negative lookahead listing the packages that _should_ be transformed. React Native ecosystems always need one, because much of that ecosystem publishes untranspiled source.

```js
// Transform nothing in node_modules except these packages.
transformIgnorePatterns: [
  "node_modules/(?!(react-native|@react-native|expo|expo-.*|@expo)/)",
];
```

The pattern is easy to get subtly wrong, and a wrong one fails identically to no pattern at all. Verify by running the one failing spec, not the whole suite.

**Guidelines:**

- MUST read the error's file path first; it names the package that needs transforming and turns guesswork into a lookup.
- MUST scope the exclusion to the packages that need it rather than transforming all of `node_modules`, which is very slow.
- MUST preserve a preset's existing `transformIgnorePatterns` when adding to it; assigning a new array discards the preset's list, which is how a working React Native suite breaks.
- SHOULD verify a changed pattern against the single spec that was failing, since a malformed lookahead produces the same message as no change.

## Module Resolution

| Option                 | Controls                                        |
| ---------------------- | ----------------------------------------------- |
| `moduleNameMapper`     | rewriting a request to another path or a stub   |
| `moduleFileExtensions` | which extensions are tried, in order            |
| `moduleDirectories`    | which directory names are searched for packages |
| `modulePaths`          | additional absolute roots                       |
| `resolver`             | a custom resolution implementation              |

`moduleNameMapper` entries are regular expressions tried **in insertion order**, and the first match wins. Where one alias prefix is a prefix of another — `@/components/*` and `@/components/ui/*` — the more specific pattern has to come first, or the general one swallows it. That is the argument for deriving the map from the compiler's `paths` with an explicit sort, per [configuration.md](./configuration.md).

**Guidelines:**

- MUST order `moduleNameMapper` entries most-specific first, since the first matching pattern wins.
- MUST anchor mapping patterns with `^` and `$` so a pattern cannot match the middle of an unrelated request.
- MUST escape regular-expression metacharacters in a literal path used as a pattern.
- SHOULD verify a new mapping by resolving one real import in a spec rather than trusting the pattern by inspection.

## The Cache

Jest caches transform output keyed by content and configuration. A custom transformer that does not implement `getCacheKey` returns stale output after an edit, which presents as a change having no effect.

**Guidelines:**

- MUST implement `getCacheKey` in a custom transformer, incorporating anything outside the file that affects its output.
- MUST run with `--no-cache` while developing a transformer, and `--clearCache` when a stale cache is suspected in an otherwise unexplained failure.
- SHOULD NOT leave `--no-cache` in a project's test script; it makes every run substantially slower.
