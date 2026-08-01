# Reporters and CI Output

Apply this reference when configuring output, wiring a suite into CI, or reducing what a run prints.

Verified against Vitest 4.1.10; the `minimal` / `agent` reporter requires 4.1.0+.

## The Built-In Set

| Reporter                  | Output                                                     |
| ------------------------- | ---------------------------------------------------------- |
| `default`                 | summary with status; full tree on failure or a single file |
| `tree`                    | hierarchical, after each suite completes                   |
| `verbose`                 | every test individually, errors immediately (flat in v4)   |
| `dot`                     | one character per test                                     |
| `minimal` (alias `agent`) | failures and their errors only                             |
| `json`                    | machine-readable, including coverage                       |
| `junit`                   | XML for CI ingestion                                       |
| `tap` / `tap-flat`        | TAP, nested or flat                                        |
| `html`                    | browsable report; needs `@vitest/ui`                       |
| `github-actions`          | inline annotations plus a job summary                      |
| `blob`                    | intermediate results for `--merge-reports`                 |
| `hanging-process`         | what is preventing exit; resource-intensive                |

**Guidelines:**

- SHOULD keep the default reporter locally and add machine-readable ones only where something consumes them.
- MUST use `tree` rather than `verbose` when v3's nested output is wanted; `verbose` is flat in v4.

## The Agent Reporter and What Suppresses It

`minimal` prints only failed tests and their errors, suppressing passing-test console output and the summary. Vitest selects it automatically when it detects an AI coding agent — through the `std-env` library, or an explicit `AI_AGENT` environment variable — and the same detection sets coverage's `skipFull`.

**Configuring any custom `reporters` array skips that detection entirely.** A project that added `junit` for CI has opted out without intending to, and every agent run returns to full output.

**Guidelines:**

- MUST add `minimal` (or `agent`) to the array explicitly when a project configures custom reporters, or automatic detection is lost.
- SHOULD leave a project with no `reporters` configuration alone, rather than hardcoding a reporter that disables the detection.

## CI Output

`github-actions` renders failures as inline annotations and produces a job summary; it is enabled automatically on GitHub Actions **unless** custom reporters are configured, in which case it must be listed.

`blob` plus `--shard` writes intermediate results that `--merge-reports` combines into one report — the only correct way to report a sharded run.

`outputFile` takes a path for one reporter, or a map keyed by reporter name for several.

```ts
reporters: ["default", "junit"],
outputFile: { junit: "./reports/junit.xml" },
```

**Guidelines:**

- MUST list `github-actions` explicitly when configuring custom reporters on GitHub Actions.
- MUST merge blob reports from a sharded run; per-shard reports each describe a fraction of the suite.
- SHOULD write CI artifacts to a gitignored directory, and not commit them.

## Annotations

`context.annotate(message, type?, attachment?)` attaches a note or file to a test, with `notice`, `warning`, or `error` severity; `attachmentsDir` sets where attachments land.

Reporters surface them differently: `default` prints them only for failed tests, `verbose` always, `junit` as `properties`, `github-actions` as workflow messages, `tap` as diagnostics.

**Guidelines:**

- SHOULD annotate rather than `console.log` when context should survive into the CI report.
- MUST NOT rely on an annotation being visible under the default reporter for a passing test; it is not printed.
