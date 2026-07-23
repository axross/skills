---
name: skill-installation
description: How this repository installs and maintains `skills/`-sourced agent skills with the vercel-labs/skills CLI (`npx skills`) — the source-under-`skills/` layout, the committed installed copies under `.claude/skills/`, the `skills-lock.json` lockfile, and the refresh-and-verify workflow to run after adding, editing, or removing a source skill.
when_to_use: Apply when adding, editing, updating, renaming, or removing any skill under `skills/`, or when the installed `.claude/skills/` copies or `skills-lock.json` need regenerating — for example after changing a `SKILL.md` or reference file, or when `git status` shows the copies out of sync with their source.
user-invocable: false
---

# Skill Installation

This repository can hold agent skills in two forms, and one CLI keeps them in sync. Skills authored through the [vercel-labs/skills](https://github.com/vercel-labs/skills) layout live under `skills/` (the source of truth) and are **installed** into `.claude/skills/` — the directory Claude Code actually loads — with the `npx skills` CLI. Both the source and the installed copies are committed, and `skills-lock.json` records what was installed.

Not every skill uses this flow: the repository's own guideline and workflow skills (the ones indexed in `AGENTS.md` that ship directly under `.claude/skills/`, such as this one) are committed there directly and are **not** managed by `npx skills`. This skill governs only the `skills/`-sourced skills.

The `skills/` source directory ships **empty** in the template, with no `skills-lock.json` until the first skill is installed — in this repository, `loop-engineering` is that first managed skill. Follow this skill the moment a skill is authored under `skills/`.

**Guidelines:**

- MUST author a managed skill under `skills/<name>/SKILL.md` (with its `references/` beside it), never directly under `.claude/skills/`.
- MUST re-run the install after editing any source skill so the committed `.claude/skills/` copy and `skills-lock.json` match the source, then verify with `npm run check`.
- MUST commit the installed `.claude/skills/<name>/` copies and `skills-lock.json` alongside the `skills/` source; they are tracked artifacts, not gitignored.
- MUST NOT hand-edit an installed copy under `.claude/skills/`; edit the source under `skills/` and reinstall.
- MUST keep `AGENTS.md` in sync when a managed skill is added, renamed, or removed, per the project's agent-skills best-practices skill.

## Install And Refresh

The CLI is run through `npx`; when the environment does not support symlinks, installs use `--copy` (the copy lands as a real directory under `.claude/skills/`).

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
- Remove an installed skill: `npx skills remove <name>` (then delete its `skills/<name>/` source and update `AGENTS.md`).

**Guidelines:**

- MUST pass `--copy` when symlinks are unsupported; a symlink install leaves `.claude/skills/` empty or broken there.
- MUST use `--skill '*'` to refresh all managed skills after a broad change, or `--skill <name>` for a targeted one.
- SHOULD run `npx skills add` from the repository root so `./skills` resolves and `skills-lock.json` is written there.
- SHOULD confirm the install summary lists every expected skill as `copied` before committing.

## The Lockfile

`skills-lock.json` is the install lockfile — analogous to `package-lock.json`. It records each managed skill's `source`, `sourceType`, and a `computedHash` of the installed content, and is committed so the installed state is reproducible and drift is detectable. It does not exist until the first managed skill is installed.

**Guidelines:**

- MUST commit `skills-lock.json` and regenerate it by running the install command, never by hand-editing.
- MUST treat a `computedHash` change with no corresponding source edit as install drift to investigate, not to blindly commit.
- SHOULD be aware that `source` is an absolute local path, so it can differ between machines; regenerate the lock with the install command in this repo rather than expecting a foreign checkout's lock to be byte-identical.

## Verification

Skill changes are documentation changes: they gate on format, lint, and relative-link integrity.

**Guidelines:**

- MUST run `npm run check` (Prettier, markdownlint, relative-link check) after reinstalling, and fix any failure before committing.
- MUST run the relative-link check whenever a managed skill's files or links moved, since a stale link inside an installed copy fails the same check as the source.
- SHOULD diff the installed copy against its source (`git diff --stat`) to confirm the reinstall changed exactly the expected files.
