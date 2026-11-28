---
type: Procedure
title: Agent Sessions
description: Provision an Amp orb, verify session startup and configure telemetry and cost-related settings.
---

# Agent Sessions

Use this guide to provision an Amp orb, verify that a Claude Code or Codex
session loaded its project entry, or configure telemetry and cost settings.
For an edit that escaped repair or a session blocked at Stop, follow
[Quality Hooks](./quality-hooks.md).

## Amp orb provisioning

The executable [`.agents/setup`](../../.agents/setup) provisions a fresh or
stale Amp orb before the host starts an agent session. It installs the pinned
mise v2026.9.1 Linux x64 binary after verifying its SHA-256 checksum, then uses
an orb-local `~/.config/mise/skills.toml` to install Node 26. The checked-in
`package.json` remains the repository's Node version source of truth; no second
toolchain pin is committed.

Setup records the repository-scoped mise configuration and activation in
`~/.bash_profile`, once, so later login shells started in this repository use
the provisioned Node toolchain. It runs the documented `npm install` command to
restore dependencies. A marker derived from `package-lock.json` and the Node
major skips that install on an unchanged warm filesystem, while setup still
checks Node and npm before it exits.

The repository has no `.agents/resume` because waking an orb requires no
authentication, connection, or service repair. It has no `.amp/services.yaml`
because the repository runs no long-lived development service. Add either
lifecycle file only when the repository acquires the corresponding need.

## The Session-Start Hook

Select the intended checkout when launching a task. For a local launch, change
to the checkout root (for example, `cd /workspace/skills` when that is the
requested repository), verify its remote and root with `git remote -v` and
`git rev-parse --show-toplevel`, then start the host there. Read its scoped
[project entry](../../AGENTS.md) and, for a change, acquire its routed Loop
guidance before drafting a change plan, assigning change work or editing.
Codex normally gathers project instructions along the path from the project
root to the starting directory. A checkout beneath a parent launch directory
is outside that path. [Codex instruction discovery](https://developers.openai.com/codex/guides/agents-md/)

If a task must launch in a parent directory, put an instruction like this in
the **launch request** so the actor receives it before discovering the child
checkout.

> Locate the intended axross/skills checkout and confirm its root and remote.
> Read its scoped AGENTS.md and, for a change, the Loop Engineering guidance it
> routes to before drafting a change plan, assigning change work or editing.

Use the same direct reads when a startup hook is missing, disabled or fails.
If the entry or required guidance is inaccessible, identify the blocked action
and unmet gate.

[Claude Code](../../.claude/settings.json) and [Codex](../../.codex/hooks.json)
register two independent SessionStart commands. Both call the
[shared script](../../.claude/hooks/session-start.sh). Its `--remind` invocation
prints one project-entry pointer and exits before toolchain setup. The other
invocation activates an available version manager, materializes local settings
and an optional environment file, and returns the status of `npm install`.
Claude resolves the script through `CLAUDE_PROJECT_DIR`. Remote sessions opt
in with `CLAUDE_CODE_REMOTE=true`. Without that or the explicit
`SKILLS_SESSION_BOOTSTRAP=1` opt-in, local invocations exit silently.
The Codex registration sets that opt-in and its relative commands require the
checkout root as the session working directory. Keep both registrations in
step with the script. Amp orb provisioning uses the separate setup above.

Dispatch depends on the host loading the project settings and enabling the
hooks. Interactive Claude Code requires workspace trust for settings hooks. Its
`-p` and SDK sessions treat the folder as trusted for this purpose. Local Codex
requires a trusted project layer and trust for the current hook definitions. Check
the effective settings for the actual session. Both hosts document successful
SessionStart stdout as a context channel.
[Claude hook reference](https://code.claude.com/docs/en/hooks) ·
[Codex hook reference](https://developers.openai.com/codex/hooks/)

Offline fixtures execute the registered commands. To claim live dispatch,
identify the checkout revision, session, working directory, effective
registration and host event showing the command ran. To claim delivery,
also identify the reminder in that session's model input or host delivery
trace. Mark inaccessible evidence unknown. Reading the pointed-to files and
the actor's first report are separate observations.

## The Opt-In Quality Hooks

For host registrations, skipped repairs and recovery from a blocking Stop
check, see [Quality Hooks](./quality-hooks.md).

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

## Recommended Environment Variables

For long Claude Code sessions, contributors can reduce context size and
background generation with two environment settings:

- `CLAUDE_CODE_AUTO_COMPACT_WINDOW=500000` triggers compaction earlier on
  large contexts.
- `CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION=false` disables generation of
  suggested follow-up prompts.

Set them in the environment dialog at claude.ai/code for a cloud session, or
in `~/.claude/settings.json` for a local one. `~/.claude/settings.json` does
**not** reach a cloud session — its scope stops at your own machine.

`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` is not a substitute for the first variable:
Claude Code on the web sets it itself, and its value overrides whatever is
added to the environment.

Neither variable belongs in a committed settings file — a cost-saving
behavior one contributor wants is not something to impose on another. See the
`Claude Code — Cost Structure` dashboard at
<https://axross.grafana.net/d/claude-code-cost-structure> for where this
effect is read.
