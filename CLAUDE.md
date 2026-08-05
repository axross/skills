@AGENTS.md

## Claude Code

The working agreement above is host-neutral and is the whole of it — this
section carries only what is true of Claude Code and of no other host.

- **Skills are read from `.claude/skills/`, which is <!-- count:claude-skill-symlinks -->29<!-- /count -->
  symlinks into `.agents/skills/`.** Claude Code follows a symlinked
  `<skill-name>` entry and reads `SKILL.md` from the target, so the installed
  skills load normally; the files themselves are installed once, under
  `.agents/skills/`.
- **`user-invocable` is a Claude Code frontmatter extension, and every skill
  here carries it.** Its companion `when_to_use` is deliberately absent: it is
  not part of the Agent Skills specification, a host such as Codex ignores it,
  and a trigger placed only there would be invisible on that host. Every skill's
  trigger is therefore front-loaded in `description`, which is the one field
  every host reads.
- **The opt-in quality hooks live in
  [`.claude/settings.local-example.json`](./.claude/settings.local-example.json)**
  and are materialized by
  [`.claude/hooks/session-start.sh`](./.claude/hooks/session-start.sh) in a
  cloud session. The same two shell scripts are wired for Codex in
  [`.codex/hooks.json`](./.codex/hooks.json); keep the pair in step when either
  changes.
- **[`.claude/settings.json`](./.claude/settings.json) stamps this repository
  onto the OpenTelemetry resource attributes** Claude Code exports. It
  configures nothing else — no endpoint, no credential — so a contributor who
  has never set telemetry up sees no behavior change. Its Codex counterpart is
  `[otel]` in [`.codex/config.toml`](./.codex/config.toml).
