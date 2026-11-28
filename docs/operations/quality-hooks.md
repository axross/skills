---
type: Procedure
title: Quality Hooks
description: Diagnose skipped edit repairs and blocking Stop checks in the host that ran the session.
---

# Quality Hooks

Identify the host and event before diagnosing a file that still needs repair.
In Claude Code, the [local settings example](../../.claude/settings.local-example.json)
registers both PostToolUse and Stop. Session bootstrap copies the example to
local settings in a cloud session. [Codex](../../.codex/hooks.json) registers
the shared Stop check. Amp uses explicit repair commands. For startup,
effective settings and host trust, see [Agent Sessions](./agent-sessions.md#the-session-start-hook).

## An edit escaped repair

1. Check which tool wrote the file. Claude's PostToolUse matcher selects
   `Edit`, `Write` and `MultiEdit`. Shell edits bypass it. The
   [repair script](../../.claude/hooks/format.sh) reads an absolute
   `tool_input.file_path`. Missing or unsupported payloads skip repair.
   The current host reference documents `Edit` and `Write`; the matcher
   alone cannot establish that a host emits `MultiEdit`.
   [Claude hook reference](https://code.claude.com/docs/en/hooks#posttooluse)
2. Check both the original path and its resolved target. The trigger accepts
   existing regular `.md` and `.js` files inside the project. Installed skill
   roots, dependencies, Git metadata, mocks and external symlinks are excluded.
   An internal symlink is eligible only if both identities qualify. The script
   skips traversal, unresolved paths and glob- or control-sensitive names,
   including brackets, braces, wildcards, backslashes and extglob syntax.
   Spaces are supported. Resolution requires `realpath -ez`.
3. Identify the pass that should have run. For Markdown, lint repair uses
   `--no-globs` with an ordinary project-relative argument to preserve lint
   ignores and avoid selecting additional files. The installed Prettier CLI
   checks exclusions for both path identities, then formats only the selected
   target. Measurements can receive Markdown lint repair and are excluded
   from formatting. Hand-authored evaluation material outside excluded trees
   remains eligible.
4. Run the [repository checks](./development-setup.md#commands) on the result.
   A skipped or failed repair exits zero. For mechanical issues use the
   documented formatting or lint repair command and inspect its changes.
   For a duplicate heading, empty link or other structural finding, choose the
   correct repair in the document. Path checks cover selection of the target
   at the time of repair and provide no lock against concurrent writers.

## Stop blocked completion

The [Stop script](../../.claude/hooks/check.sh) checks for pending Markdown or
JavaScript matching `.md` or `.js` in Git status and, when an upstream is
configured, among changes from the upstream merge base to HEAD. It exits zero
when npm is unavailable or neither source reports matching paths.

When the check runs, it executes both commands from the repository root:

```sh
npm run lint
node ./skills/agent-skill-authoring/scripts/check-links.mjs
```

A failure prints the tail of their output on stderr and exits 2. Run the
commands separately for the full findings, correct the file or its link
destination, then rerun both. A successful check exits zero. Stop leaves
all files as they are: a repair at completion could otherwise leave an
already-pushed commit with the original violation.
[Claude exit-code contract](https://code.claude.com/docs/en/hooks#exit-code-2)

The [hook fixtures](../../tests/repository/quality-hooks.test.mjs) exercise
the shell commands, their selection rules and exit status. A live dispatch
claim also needs the effective host registration and the event for that
session. Stop checks lint and links. To establish delivery or review
completion, use the evidence in [Development Workflow](./development-workflow.md).
Local remote-tracking refs may be stale, and a synchronous `systemMessage`
is displayed to the user.
