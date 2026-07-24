---
name: agent-skill-management
description: How this repository stores, installs, and maintains its agent skills across two tiers — repository-local skills committed directly under `.claude/skills/` (hand-edited in place, never CLI-managed, like this skill itself) and distributable skills sourced under `skills/` and installed into `.claude/skills/` with the vercel-labs/skills CLI (`npx skills`) plus the `skills-lock.json` lockfile — the decision rule for which tier a new skill belongs to, and the refresh-and-verify workflow after any skill change.
when_to_use: Apply when adding, editing, renaming, moving, or removing any agent skill in this repository, when deciding whether a new skill belongs under `skills/` or directly under `.claude/skills/`, or when the installed `.claude/skills/` copies or `skills-lock.json` need regenerating — for example after changing a `SKILL.md` or reference file, or when `git status` shows the installed copies out of sync with their source.
user-invocable: false
---

# Agent Skill Management

This repository holds agent skills in two tiers, and this skill owns how both are managed. **Distributable** skills — portable capabilities other projects can install — are authored under `skills/` (the source of truth) and **installed** into `.claude/skills/` — the directory Claude Code actually loads — with the [vercel-labs/skills](https://github.com/vercel-labs/skills) CLI (`npx skills`); `skills-lock.json` records what was installed. **Repository-local** skills — the ones that encode this repository's own conventions, such as this one — are committed directly under `.claude/skills/` and are never touched by the CLI.

Both tiers install into `.claude/skills/`, where Claude Code discovers every skill regardless of tier from its own `description`/`when_to_use`; there is no separate routing index to maintain.

**Guidelines:**

- MUST keep every skill discoverable through its own `description`/`when_to_use` when it is added, renamed, moved, or removed in either tier, per the project's skill-authoring practices — there is no master index to update.

## Choosing a Tier

Every skill lives in exactly one tier, decided by one question: **would the skill work, unchanged, installed into another project?**

- A skill that is self-contained and portable — it names no repository-specific file, workflow, or layout — is **distributable**: author it under `skills/<name>/` and install it with the CLI.
- A skill that encodes this repository's own structure or process — this skill itself, the agent-skill-authoring rules, the software-development baseline — is **repository-local**: commit it directly under `.claude/skills/<name>/`.

**Guidelines:**

- MUST place every new skill in exactly one tier using the portability question above, before writing its `SKILL.md`.
- MUST NOT store a repository-local skill under `skills/` or manage it with `npx skills`; it never appears in `skills-lock.json`.
- MUST move a skill between tiers deliberately when its scope changes — a repository-local skill later generalized for sharing moves its source to `skills/<name>/` and is reinstalled with the CLI — never by keeping a copy in both.
- MAY read a skill's tier off `skills-lock.json`: a skill listed there is distributable and installed; one absent from it is repository-local.

## Repository-Local Skills

A repository-local skill's committed copy under `.claude/skills/<name>/` **is** its source of truth. The prohibition on hand-editing installed copies does not apply here — editing these files in place is the correct workflow.

**Guidelines:**

- MUST edit a repository-local skill directly under `.claude/skills/<name>/` — its `SKILL.md`, `references/`, and any `scripts/` — and commit those files; there is no separate source directory and no install step.
- MUST author it to the same standard as any other skill — frontmatter, naming, discovery metadata, progressive disclosure — per the project's skill-authoring practices.
- MUST rename a repository-local skill with a `git mv` of its directory plus a matching frontmatter `name` update, and update every reference to the old name in the same change.

## Distributable Skills: Install and Refresh

A distributable skill is authored under `skills/<name>/SKILL.md` (with its `references/` beside it) and installed with the CLI. The CLI is run through `npx`; when the environment does not support symlinks, installs use `--copy` (the copy lands as a real directory under `.claude/skills/`).

**Commands:**

- Install or refresh every managed skill:

  ```bash
  npx skills add ./skills --agent claude-code --skill '*' --yes --copy
  ```

- Refresh a single skill by name:

  ```bash
  npx skills add ./skills --agent claude-code --skill <name> --yes --copy
  ```

- List installed skills: `npx skills list`
- Remove an installed skill: `npx skills remove <name>` (then delete its `skills/<name>/` source).

**Guidelines:**

- MUST author a distributable skill under `skills/<name>/`, never directly under `.claude/skills/`.
- MUST NOT hand-edit an installed copy under `.claude/skills/`; edit the source under `skills/` and reinstall.
- MUST re-run the install after editing any source skill so the committed `.claude/skills/` copy and `skills-lock.json` match the source.
- MUST commit the installed `.claude/skills/<name>/` copies and `skills-lock.json` alongside the `skills/` source; they are tracked artifacts, not gitignored.
- MUST pass `--copy` when symlinks are unsupported; a symlink install leaves `.claude/skills/` empty or broken there.
- MUST use `--skill '*'` to refresh all managed skills after a broad change, or `--skill <name>` for a targeted one.
- SHOULD run `npx skills add` from the repository root so `./skills` resolves and `skills-lock.json` is written there.
- SHOULD confirm the install summary lists every expected skill as `copied` before committing.

## The Lockfile

`skills-lock.json` is the install lockfile — analogous to `package-lock.json`. It records each distributable skill's `source`, `sourceType`, and a `computedHash` of the installed content, and is committed so the installed state is reproducible and drift is detectable. Repository-local skills never appear in it.

**Guidelines:**

- MUST commit `skills-lock.json` and regenerate it by running the install command, never by hand-editing.
- MUST treat a `computedHash` change with no corresponding source edit as install drift to investigate, not to blindly commit.
- SHOULD be aware that `source` is an absolute local path, so it can differ between machines; regenerate the lock with the install command in this repo rather than expecting a foreign checkout's lock to be byte-identical.

## Verification

Skill changes are documentation changes: they gate on format, lint, and relative-link integrity, plus the skill structure validator.

**Guidelines:**

- MUST run `npm run check` (Prettier, markdownlint, relative-link check) after any skill change — a direct edit or a reinstall — and fix any failure before committing.
- MUST run the relative-link check whenever a skill's files or links moved, since a stale link inside an installed copy fails the same check as the source.
- SHOULD validate a changed skill with the project's skill-structure validator (`scripts/check-skill.mjs`, shipped with the skill-authoring practices).
- SHOULD diff a reinstalled copy against its source (`git diff --stat`) to confirm the reinstall changed exactly the expected files.
