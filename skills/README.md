# `skills/` — installable skill sources

This directory is the **source of truth** for distributable agent skills that
are installed into `.claude/skills/` with the
[vercel-labs/skills](https://github.com/vercel-labs/skills) CLI (`npx skills`).
The repository's own guideline and workflow skills instead live directly under
[`.claude/skills/`](../.claude/skills) and are not managed by `npx skills`.

Currently sourced here:

- `code-review` — a self-contained, portable code-review methodology:
  reviewer-mode reset, severity-ranked findings with file-line evidence and fix
  snippets, a merge verdict, and a posted/CI-review overlay.
- `loop-engineering` — a self-contained delivery workflow that drives one unit
  of work from intake to a review-ready pull request (plan → code →
  independent review).
- `product-requirement-document-authoring` — a self-contained, portable skill
  for writing and reviewing product requirement documents (PRDs), feature specs,
  and plan documents.

Author a distributable skill here as `skills/<name>/SKILL.md` (with its
`references/` beside it), then install it so Claude Code can load it:

```bash
npx skills add ./skills --agent claude-code --skill '*' --yes --copy
```

The installed copies under `.claude/skills/<name>/` and the generated
`skills-lock.json` are committed alongside this source. See the
[Skill Installation](../.claude/skills/skill-installation/SKILL.md) skill for the
full install, lockfile, and refresh-and-verify workflow, and
[Agent Skills Best Practices](../.claude/skills/agent-skills-best-practices/SKILL.md)
for how to author the skill itself.
