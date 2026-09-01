# Agent Sessions

How a Claude Code or Codex session starts in this repository, the hooks that
run during one, and the one setting that cannot be verified from inside a
session at all.

## The Session-Start Hook

In a Claude Code cloud session, `.claude/hooks/session-start.sh` installs
dependencies, activating a Node version manager first if one is present. A
Codex session runs the same session-start and check scripts through
`.codex/hooks.json` — the two shell scripts are wired for both hosts, and the
pair MUST be kept in step when either changes.

## The Opt-In Quality Hooks

The opt-in format-on-edit and check-before-stop hooks materialize from
[`.claude/settings.local-example.json`](../../.claude/settings.local-example.json)
in a Claude Code cloud session. Format-on-edit is not wired for Codex, because
`format.sh` reads the edited path from a Claude Code payload field that a
Codex session does not send — so a Codex session keeps the blocking behaviour
described below for every check the `PostToolUse` hook would otherwise have
repaired first.

A blocking `Stop` check is expensive in a way a `PostToolUse` repair is not: it
fires only after the agent believes the task is finished, so a failure there
costs one full main turn — the agent has to read the failure, re-plan, and
run its fix — before it can stop again. Whether a check belongs at `Stop` or
earlier, at `PostToolUse`, therefore turns on whether it needs an authoring
decision (something only that turn can supply) or is purely mechanical (safe
to repair the moment the file is written, at no such cost):

- **`npm run lint`, the violations `--fix` repairs** (trailing spaces,
  multiple blank lines, missing blank lines around a list, and the rest
  `markdownlint-cli2 --fix` can resolve on its own) — **non-blocking.**
  `format.sh` repairs these on `PostToolUse` as each Markdown file is
  written, so they never reach `Stop`.
- **`npm run lint`, the violations `--fix` cannot repair** (a duplicate
  heading, more than one top-level heading, an empty link, and similarly
  structural findings) — **blocking.** The correct repair is an authoring
  decision — which heading to rename, what the link should point to — that
  only the agent's own turn can make.
- **`node ./skills/agent-skill-authoring/scripts/check-links.mjs`** —
  **blocking.** A broken relative link has no mechanical repair; its correct
  target is a judgement call the same way an unrepairable lint violation is.
- **The change-in-flight reminder** — **already non-blocking.** It emits a
  `systemMessage` and exits `0` rather than failing the hook, because it
  cannot confirm from local state alone whether a pull request already
  covers the pushed commits it is reminding about.

## Telemetry Tagging

[`.claude/settings.json`](../../.claude/settings.json) carries an `env` block
stamping `repository=skills` and the session's launch surface onto the
OpenTelemetry metrics Claude Code exports, so this repository's usage
separates from every other repository sharing an account or a cloud
environment. Its Codex counterpart is `[otel]` in
[`.codex/config.toml`](../../.codex/config.toml). Neither configures anything
else — no endpoint, no credential, no `CLAUDE_CODE_ENABLE_TELEMETRY` — so a
contributor who has never set telemetry up sees no behavior change from it.

Verifying a change to that block is the catch: Claude Code does not pass
`OTEL_*` variables to the subprocesses it spawns, so `echo
$OTEL_RESOURCE_ATTRIBUTES` inside a session prints nothing even when the
exporter holds the value. Confirm it in the metrics backend instead, against a
session started **after** the change — an already-running session read its
configuration at startup.
