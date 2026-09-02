# Agent Sessions

How a Claude Code or Codex session starts in this repository, the hooks that
run during one, the one setting that cannot be verified from inside a session
at all, and the environment variables recommended for cutting a session's
cost.

## The Session-Start Hook

In a Claude Code cloud session, `.claude/hooks/session-start.sh` installs
dependencies, activating a Node version manager first if one is present. A
Codex session runs the same session-start and check scripts through
`.codex/hooks.json` — the two shell scripts are wired for both hosts, and the
pair MUST be kept in step when either changes.

## The Opt-In Quality Hooks

The opt-in format-on-edit and check-before-stop hooks materialize from
[`.claude/settings.local-example.json`](../../.claude/settings.local-example.json)
in a Claude Code cloud session. Format-on-edit fires only for a file changed
through the `Edit`, `Write`, or `MultiEdit` tools — the `PostToolUse`
matcher's scope, which this repository deliberately does not widen — so a
file changed another way, such as a Bash heredoc or `sed -i`, reaches `Stop`
uncorrected like any file in a Codex session, where format-on-edit isn't wired
at all because `format.sh` reads the edited path from a Claude Code payload
field a Codex session never sends. Either way, that file keeps the blocking
behaviour described below for every check the `PostToolUse` hook would
otherwise have repaired first.

A blocking `Stop` check is expensive in a way a `PostToolUse` repair is not: it
fires only after the agent believes the task is finished, so a failure there
costs one full main turn — the agent has to read the failure, re-plan, and
run its fix — before it can stop again. Whether a check belongs at `Stop` or
earlier, at `PostToolUse`, therefore turns on whether it needs an authoring
decision (something only that turn can supply) or is purely mechanical (safe
to repair the moment the file is written, at no such cost):

- **`npm run lint`, the violations `--fix` repairs** (trailing spaces,
  multiple blank lines, missing blank lines around a list, and the rest
  `markdownlint-cli2 --fix` can resolve on its own) — **non-blocking, when
  `format.sh` gets to a file first.** `format.sh` repairs these on
  `PostToolUse` as each Markdown file is written, so they reach `Stop` only
  when the edit fell outside its reach, per the caveat above.
- **`npm run lint`, the violations `--fix` cannot repair** (a duplicate
  heading, more than one top-level heading, an empty link, and similarly
  structural findings) — **blocking.** The correct repair is an authoring
  decision — which heading to rename, what the link should point to — that
  only the agent's own turn can make. `check.sh` never attempts one itself;
  its header comment says why.
- **`node ./skills/agent-skill-authoring/scripts/check-links.mjs`** —
  **blocking.** A broken relative link has no mechanical repair; its correct
  target is a judgement call the same way an unrepairable lint violation is.
- **The change-in-flight reminder** — **already non-blocking.** It emits a
  `systemMessage` and exits `0` rather than failing the hook, because it
  cannot confirm from local state alone whether a pull request already
  covers the pushed commits it is reminding about.

`format.sh` passes the edited file to `markdownlint-cli2` as an ordinary
glob argument rather than a literal path (its header comment says why), so
a filename holding a glob metacharacter resolves through markdownlint-cli2's
own glob library rather than matching itself outright. Verified against
markdownlint-cli2 0.15.0: `[`, `!`, and `#` still match through the
library's literal-path fallback, so the file gets fixed; `*` and `?` also
match, but as a genuine wildcard, which can additionally match an unrelated
sibling filename differing only at that one character; `{` does not match
at all, so the file is left untouched. None of this weakens the gate —
`npm run lint`'s repository-wide glob at `Stop` still catches any violation
the fix pass missed, or introduced by fixing the wrong file. Re-verify this
against markdownlint-cli2's glob resolver on a version upgrade, and again if
`LINT_FIX_FILE_GLOB` is ever widened past `*.md`.

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

Two environment variables account for the largest reductions found in this
repository's own cost analysis, and are worth setting for any session run
here, cloud or local:

- `CLAUDE_CODE_AUTO_COMPACT_WINDOW=500000` — moves auto-compaction's trigger
  from a measured median of **784,287** tokens to **384,000**, which lowers
  the average main context from 354k. Estimated **−29%**.
- `CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION=false` — stops prompt-suggestion
  generation, which cost **$467 over 30 days (3.0%)**.

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
