# Skill Portability

Every skill in this repository is a distributable skill: it installs into
other projects, and [agent-skill-authoring](../../skills/agent-skill-authoring/SKILL.md)
and [agent-skill-management](../../skills/agent-skill-management/SKILL.md) own
what that means in general — a distributable skill names no file, command, or
layout belonging to the repository it was written in, and carries no
`count:` marker (see [Marked Counts](./marked-counts.md)). What follows is
this repository's own answer: which of its configuration surfaces a skill's
portability actually depends on, and which host reads less of a skill than
the other.

## The Description Byte Cap and Codex's Truncation

Codex reads a skill's `name` and `description` and nothing else — see
`CLAUDE.md` for why no skill here carries a `when_to_use`. Codex refuses to
load a skill whose `description`
exceeds 1,024 bytes, and
[`check-skill-frontmatter.mjs`](../../skills/agent-skill-authoring/scripts/check-skill-frontmatter.mjs)
enforces that cap in bytes rather than characters, matching what Codex actually
counts. Codex also truncates per-skill descriptions to fit its whole listing
into a context budget, so the front of a `description` is the part that
reliably arrives — every skill here front-loads its trigger for that reason.

Codex's default sandbox additionally runs commands with network disabled. Of
the scripts bundled across this repository's skills, that limitation affects
only `link-freshness/check.mjs`, and its `--dry-run` mode needs no network.

## Configuration Surfaces That Fail Globally

A small mismatch in one of these breaks skill discovery outright for every
skill at once, not just one rendered page — refresh the owning host's current
docs before editing one, per Fast-Moving Dependencies below:

- Any `SKILL.md` frontmatter — a malformed block, or a field Claude Code or
  Codex parses differently than expected, stops that skill from loading.
- `.claude/settings*.json` and the hooks under `.claude/hooks/` — these
  configure how every Claude Code session in this repository starts, not one
  skill's behavior.
- `.markdownlint-cli2.jsonc`, `.prettierrc.json`, and `.prettierignore` — a
  change here changes what every Markdown file in the repository is checked
  and formatted against, skills included.

## Fast-Moving Dependencies

Some dependencies move fast enough that memory of their configuration surface
is unreliable. Consult the current official docs before changing behavior
these govern, rather than recalling a prior version's rules:

| Dependency                   | Refresh docs before changing                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| Claude Code                  | Skill format and frontmatter, hook and settings configuration, slash-command behavior, MCP configuration |
| markdownlint-cli2 / Prettier | Lint and format configuration, suppression syntax, rule names                                            |
| Vitest                       | Suite configuration, runner and matcher APIs, CLI flags                                                  |
