# Coverage

Apply this reference when enabling coverage, setting a threshold, excluding code from a report, or explaining a percentage that looks wrong.

Verified against Vitest 4.1.10.

## The Providers Are Separate Packages

Vitest 4 bundles neither provider. `@vitest/coverage-v8` or `@vitest/coverage-istanbul` must be installed explicitly, and `--coverage` against a project missing both fails at startup.

**V8** is the default. It reads coverage from the engine with no instrumentation pass, and since v3.2 remaps through the AST — so it now reports line and branch numbers at Istanbul's accuracy with V8's speed. It cannot work on a runtime without V8, which rules out Firefox and Bun.

**Istanbul** instruments the source before running. It works on any JavaScript runtime and costs a transform pass.

**Guidelines:**

- MUST add the provider package to the manifest when enabling coverage; v4 does not supply one.
- SHOULD keep the V8 default unless the runtime is not V8, or a specific reporting need requires instrumentation.

## The Inclusion Model Flatters the Number

By default Vitest reports **only files imported during the run**. A module no test imports does not appear — so it does not drag the percentage down, and the report reads healthier than the codebase is.

Vitest 4 removed `coverage.all` and `coverage.extensions`, which is how v3 opted into scanning everything. The replacement is `coverage.include`: name the source globs, and untested files appear at zero.

**Guidelines:**

- MUST set `coverage.include` to the project's source globs; without it the percentage describes only what was already imported.
- SHOULD exclude generated files, type-only modules, and config from the report rather than tolerating them as permanent zeros.

## Thresholds Are a Ratchet

`thresholds` accepts global values, per-glob values, `100`, and `autoUpdate`. The useful posture is a floor that only ever rises: set it at or just below the current number so a change cannot lower coverage, and raise it when work legitimately does.

A threshold set aspirationally above the current number fails every build until someone lowers it, which teaches the team that the threshold is noise.

**Guidelines:**

- MUST set a threshold at or below current coverage so it gates regressions rather than blocking every build.
- SHOULD raise the threshold in the change that improves coverage, rather than as a separate aspirational edit.

## Ignore Hints Need `@preserve`

Both providers honour comment hints — `/* v8 ignore next */`, `/* istanbul ignore if */`, and the `start` / `stop` pairs. But esbuild strips comments during transpilation, so a hint disappears before the provider sees it.

The `-- @preserve` suffix marks the comment as legal and keeps it:

```ts
/* v8 ignore next -- @preserve */
if (process.env.NODE_ENV === "development") debugOnly();
```

This is why most "the ignore hint does not work" reports are not about the hint at all.

**Guidelines:**

- MUST append `-- @preserve` to every coverage ignore hint in a TypeScript or transpiled source file.
- MUST NOT ignore a branch to reach a threshold; ignore only genuinely unreachable or environment-specific code, and state which in the comment.

## Reporters and Extension

Reporters render the collected data; `coverage.htmlDir` places the HTML output; `coverage.changed` limits the report to modified files while still running everything. Custom reporters implement Istanbul's `ReportBase`; a fully custom provider is named through `customProviderModule`.

`DEBUG=vitest:coverage` logs per-file collection time when coverage itself is the slow part — usually a misconfigured `include` pulling in `node_modules`.

**Guidelines:**

- SHOULD add a machine-readable reporter alongside the text one when CI ingests coverage.
- SHOULD reach for `DEBUG=vitest:coverage` before assuming coverage is inherently slow.

## What Coverage Measures

Coverage records that a line executed. It says nothing about whether anything was asserted about it — a test calling a function and asserting nothing produces the same coverage as one that checks every branch.

**Guidelines:**

- MUST treat coverage as a floor that catches untested code, never as evidence that tested code is verified.
- MUST NOT report a coverage percentage as verification evidence for a change; name the assertions instead.
