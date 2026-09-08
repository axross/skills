# Agent Skills

Installing and refreshing a skill in this repository, and confirming the
install actually took. [Directory Structure](../conventions/directory-structure.md)
covers where the source and the two installed roots live;
[agent-skill-management](../../skills/agent-skill-management/SKILL.md) covers
the general install, lockfile, and refresh model this procedure is an instance
of.

## Installing and Refreshing

Regenerate `.agents/skills/` from the source under `skills/` with the
`vercel-labs/skills` CLI:

```bash
npx skills add ./skills --agent codex --skill '*' --yes
```

For a targeted refresh, replace `'*'` with the intended skill name. For example:

```bash
npx skills add ./skills --agent codex --skill agent-skill-management --yes
```

Inspect the installer summary and generated diff before committing. A targeted
refresh MUST NOT become a bulk update or unrelated lockfile cleanup.

The CLI copies rather than symlinks when the source is a local path —
`--copy`'s "instead of symlinking" in the CLI's own help text governs a
remote or `node_modules`-mediated install, not this one — so
`.claude/skills/<name>` is not written by this command. Those links are made
once and simply kept:

```bash
for d in .agents/skills/*/; do
  n=$(basename "$d")
  ln -sfn "../../.agents/skills/$n" ".claude/skills/$n"
done
```

Commit both roots and `skills-lock.json` alongside the source in the same
change — they are tracked artifacts, not build output to leave uncommitted.

## Keeping the Symlink Root in Step

A skill added or removed needs the corresponding `.claude/skills/<name>` link
added or removed with it; the installed-copy check
(`skills/agent-skill-management/scripts/check-installed-copies.mjs`) fails on
either half being missed on its own.

## Confirming Both Hosts Loaded Them

The suite checks files, not a running host's selection or loaded body. Report
installation, source agreement, discovery, and active loading separately using
[the management evidence model](../../skills/agent-skill-management/references/active-loading.md).
The existing hosts retain their discovery checks in a fresh session:

- **Codex** — run `/skills` and inspect the listing and any context-budget
  warnings, not only names.
- **Claude Code** — run `/context` and inspect the skills listed there.

Neither listing alone proves the selected source or loaded content. Invoke the
intended skill and inspect whatever source and body evidence that host exposes.
If that evidence is unavailable, report active loading as unverified; do not
infer it from a passing file comparison. Report hosts not exercised as untested.

## Verify Amp's selected source and content

These operations follow [Amp's skill documentation](https://ampcode.com/docs/customize/skills),
checked on 2026-09-08. Recheck the current session's tool contracts when using
them; a child session need not expose the parent's tools.

Amp's documented first-match order is local global roots
(`~/.config/agents/skills/`, `~/.agents/skills/`, `~/.config/amp/skills/`),
project and searched-parent `.agents/skills/`, then Claude-compatible locations,
configured `amp.skills.path` directories, built-ins, personal repository skills,
and workspace repository skills. Consult the linked documentation for the full
order when diagnosing a collision. A local global skill can mask this project.
The `.claude/skills/` name is not a compatibility defect; this repository's
links resolve to the existing `.agents/skills/` content.

After an authorized refresh, verify the intended skill in the active thread:

1. Record the expected source path and a distinguishing passage from the updated
   body. Compare the installed files against source and inspect the lockfile
   diff. For `agent-skill-management`, the installed root is
   `.agents/skills/agent-skill-management`; the `.claude/skills/` link resolves
   there too.
2. Ask Amp to list the available skills and where each came from. For a separate
   shell inventory, use `amp skills list --json`; that inventory does not prove
   the existing thread's state.
3. Use the active thread's `reload_skills` tool. It rescans local directories and
   refreshes server-managed skills. Running `amp skills list` in a shell does
   **not** reload the thread.
4. Invoke the intended skill with the thread's skill-loading tool. Compare the
   returned base directory and body with the expected source and passage. For
   this change, check for `Discovery and Active Loading` and its route to
   `references/active-loading.md`; open that reference when applying its rules.
5. Report the four observations and evidence. An unexpected source is a
   mismatch even if installation passed. A stale body is not a successful
   refresh. If source or body is not exposed, report verification unavailable
   and the risk of an unexpected or stale active skill.

When the result is missing or unexpected, diagnose before changing files:

- Inspect same-name sources and symlink targets; different path strings can
  resolve to the same content. Identify the actual selected source rather than
  treating every alias as a collision.
- Check `amp.skills.disableClaudeCodeSkills` when only a Claude-compatible
  location is missing. Disabled compatibility discovery does not disable this
  repository's `.agents/skills/` root and does not justify adding another tree.
- Check broken links, source access, and metadata diagnostics separately. Keep
  standard metadata rules with skill authoring. For host extensions, consult
  the active host's documentation rather than removing another host's fields
  merely because Amp does not use them.
- Treat plugin-bundled names such as `<plugin-name>:<skill-name>` as qualified
  names, not bare-name collisions. Do not change plugin registration to repair
  this library's installation.

## Exercise failure cases without changing global skills

Use an isolated test installation and distinct body passages to distinguish
the expected and unexpected sources. Do not edit personal/global skills or
settings for a test without authorization. Exercise the following cases through
the available host, recording its scope separately from static walkthroughs:

| Case                                                | Expected observation                                                              |
| --------------------------------------------------- | --------------------------------------------------------------------------------- |
| Install passes, another same-name source wins       | Installation passes; active source mismatch                                       |
| Disk changes while the session retains the old body | Source agreement passes; active body remains stale until reload and re-invocation |
| Compatibility discovery is disabled                 | Claude-compatible candidate absent; no duplicate tree created                     |
| Source or load evidence is hidden                   | Active verification unavailable, not success                                      |

If an isolated host run is unavailable, record the unexecuted case and its
residual risk. A fixture or walkthrough cannot prove the live host's precedence
or reload behavior.

## When `npx skills` Fails to Resolve

In some environments — a fresh container with no local install, or a stale
npx cache — both `npx skills …` and `npx --yes skills …` abort with
`npm error could not determine executable to run`, which reads like a broken
command rather than a resolution failure. An explicit version specifier fixes
it:

```bash
npx --yes skills@latest add ./skills --agent codex --skill '*' --yes
```

The plain `npx skills` form stays canonical — reach for the specifier only
after seeing that error, since pinning `@latest` on every run fetches the
newest CLI build each time.
