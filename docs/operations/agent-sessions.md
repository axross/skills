# Agent Sessions

How an Amp orb provisions this repository, how a Claude Code or Codex session
starts after provisioning, the hooks that run during one, the one setting that
cannot be verified from inside a session at all, and the environment variables
recommended for cutting a session's cost.

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

After orb provisioning, a Claude Code cloud session runs
`.claude/hooks/session-start.sh`. The hook activates a Node version manager when
one is present, materializes host-local settings and an optional environment
file, and runs `npm install` as a fallback for sessions outside a provisioned
orb. A Codex session runs the same session-start and check scripts through
`.codex/hooks.json` — the two shell scripts are wired for both hosts, and the
pair MUST be kept in step when either changes. Orb setup does not replace these
host-specific responsibilities, and the session-start hook is not Amp's
toolchain-provisioning entry point.

## The Opt-In Quality Hooks

The opt-in format-on-edit and check-before-stop hooks materialize from
[`.claude/settings.local-example.json`](../../.claude/settings.local-example.json)
in a Claude Code cloud session. Format-on-edit fires only for a file changed
through the `Edit`, `Write`, or `MultiEdit` tools — the `PostToolUse`
matcher's scope, which this repository deliberately does not widen — so a
file changed another way, such as a Bash heredoc or `sed -i`, reaches `Stop`
uncorrected like any file in a Codex session, where format-on-edit isn't wired
at all. Amp also keeps explicit repair commands rather than an automatic
repair plugin. The hook consumes Claude's absolute `tool_input.file_path`;
an absent or unsupported payload is skipped, not inferred from another host's
schema. The current [Claude hook reference](https://code.claude.com/docs/en/hooks#posttooluse)
documents `Edit` and `Write` payloads; keeping `MultiEdit` in the existing matcher
does not establish that a current host emits it. Files outside repair's reach
keep the blocking behaviour below.

Automatic repair is limited to the existing `.md` / `.js` trigger scope and
an existing regular file. Both the original path and its canonical target must
be inside the project and outside these protected trees:

- Installed `.agents/skills` and `.claude/skills` aliases
- Dependency trees and Git metadata
- Mock projects

A source-looking
alias into installed material is excluded, as is an installed alias pointing
back into source. An owned internal symlink can repair only its owned target.
Repair skips paths that escape the project or cannot be safely resolved:

- External symlinks
- Traversal paths
- Unresolved targets

Resolution
requires `realpath` with existing-path and NUL-output support (`-e` / `-z`);
without it the best-effort hook skips repair rather than using a weaker guard.

Both passes skip glob/control-sensitive names, including:

- `*`
- `?`
- `{`
- Bracket and extglob syntax
- Backslashes and control characters

Shell quoting alone
does not make a Markdown glob literal. The lint pass therefore keeps an ordinary
project-relative argument and suppresses configuration-added positive globs with
`--no-globs`; it never uses the colon-literal form that bypasses root ignores.
The formatter uses the installed Prettier CLI with only the selected file,
not `npm run format`, whose embedded glob would still visit the repository if
a filename were appended. Prettier exclusions are checked at both path
identities: mocks and measurements receive no formatter writes. Mocks receive
no lint repair either, while measurements remain eligible for Markdown lint
repair. Ordinary names containing spaces and hand-authored evaluation files
outside those excluded trees remain eligible. These checks establish selection,
not a lock against other writers or hostile concurrent filesystem replacement.

Manual whole-repository commands remain as documented in
[README](../../README.md). A skipped or failed repair exits `0` and
does not weaken the non-writing completion checks. Actual shell-hook fixtures
exercise selection, exclusions and exit statuses; they are not evidence of
live Claude/Codex startup or Amp automatic repair.

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

`Stop` remains check-only: lint or relative-link failure reports on stderr and
exits `2`, which [Claude's exit-code contract](https://code.claude.com/docs/en/hooks#exit-code-2)
uses to block stopping. Successful checks, or no pending content under the
existing Git change gate, exit `0`. There is no Git-only PR/review reminder and
no replacement detector: local remote-tracking refs can be stale and cannot
establish PR or review completion. A synchronous `systemMessage` is also
user-facing, not an agent instruction. Delivery completion follows the
[change loop's actual evidence](./development-workflow.md),
not this quality hook's success.

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
