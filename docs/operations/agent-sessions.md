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
Codex session does not send.

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
