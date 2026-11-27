---
type: Procedure
title: Agent Skills
description: Install and refresh distributed skills and check discovery, source identity and active content across hosts.
---

# Agent Skills

Installing and refreshing a skill in this repository, checking discovery in
Codex and Claude Code, and inspecting the active source and content in Claude
Code and Amp.
[Directory Structure](../conventions/directory-structure.md)
covers where the source and the two installed roots live;
[agent-skill-management](../../skills/agent-skill-management/SKILL.md) covers
the general lifecycle and evidence model these host procedures apply.

For an installed-rule finding or a bounded project exception, use management's
[installed-rule change guidance](../../skills/agent-skill-management/references/installed-rule-changes.md).
It distinguishes local conventions, approved deviations, and upstream proposals;
this operation does not introduce a separate register or exception policy.

## Installing and Refreshing

Regenerate `.agents/skills/` from the source under `skills/` with the
`vercel-labs/skills` CLI. `skills@1.7.6` is the version that writes this
repository's `skills-lock.json`; a plain `npx skills` resolves the registry's
latest release, whose refresh rewrites every hash and the lockfile schema
(observed with 1.9.0), so every command here names the version:

```bash
npx --yes skills@1.7.6 add ./skills --agent codex --skill '*' --yes
```

For a targeted refresh, replace `'*'` with the intended skill name. For example:

```bash
npx --yes skills@1.7.6 add ./skills --agent codex --skill agent-skill-management --yes
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

Claude Code's `.claude/skills/` root contains <!-- count:claude-skill-symlinks -->29<!-- /count -->
symlinks into `.agents/skills/`. Claude Code follows each skill directory link
to its `SKILL.md`; the installed bytes remain in one root.

A skill added or removed needs the corresponding `.claude/skills/<name>` link
added or removed with it; the installed-copy check
(`skills/agent-skill-management/scripts/check-installed-copies.mjs`) fails on
either half being missed on its own.

## Check discovery in Codex and Claude Code

Apply [the management evidence model](../../skills/agent-skill-management/references/active-loading.md)
using the current host's inspection route. Codex and Claude Code expose these
discovery checks in a fresh session:

- **Codex** — run `/skills` and inspect the listing and any context-budget
  warnings, not only names.
- **Claude Code** — run `/context` and inspect the skills listed there.

A catalog listing establishes discovery. To check what Claude Code delivered,
inspect a native activation in the actor that needed the skill. Active loading
in Codex remains unverified by the listing.

## Diagnose a same-name skill in Claude Code

1. Record the Claude Code version and consult its [skill location and precedence
   rules](https://code.claude.com/docs/en/skills#choose-where-skills-load).
   Among ordinary enterprise, personal and project roots the documented order is
   enterprise, then personal, then project. A same-name personal install can
   therefore mask a project pin. Plugin-qualified names have a distinct scope.
2. Identify the intended source revision. Compare its body and applicable
   references with the project installation, inspect the relevant
   `skills-lock.json` entry and compare any same-name personal candidate.
   Resolve symlinks before calling two paths different roots.
3. In a fresh session, inspect the intended actor's skill activation and its
   returned `Base directory for this skill:` line where available. Compare the
   resolved directory and the delivered body independently against the declared
   source and expected content. Check delivery of any applicable reference
   separately before relying on its revision. A parent's activation, a
   successful file read or the lockfile hash alone leaves native selection in
   a child unknown.
4. Choose the effective source for the deployment. A project-owned pin can
   govern after the owner resolves a competing personal install. If the
   personal copy is intentional, synchronize its contents with the pin and
   record that the personal root wins. Inspect fresh actor evidence again
   after an authorized change. Record the unchanged-content baseline
   in the comparison before changing the skill, then compare the new
   revision at the same effective level.

Apply these controls to an isolated fixture with identifiable revisions. They
describe expected observations; a fixture cannot qualify a live host.

| Expected test input                       | Source observation                | Content observation                                  |
| ----------------------------------------- | --------------------------------- | ---------------------------------------------------- |
| Expected root and current body delivered  | Matches after resolving any alias | Matches expected body                                |
| A different same-name root wins           | Different resolved root           | Compare independently; synchronized copies can match |
| Expected root but previous body delivered | Matches                           | Stale                                                |
| Catalog or disk inventory only            | Active selection unknown          | Delivery unknown                                     |

A visible base directory with no observable body qualifies only the source.
Keep missing actor, reference or delivery evidence unknown. For an adopter
comparison, retain private paths and transcripts locally and share the result
and its limits in aggregate.

## Verify Amp's selected source and content

Use [Amp's skill documentation](https://ampcode.com/docs/customize/skills)
and check the active session's tool contracts. A child session can expose
different tools from its parent.

Consult the linked documentation for Amp's current precedence when diagnosing
a collision. A local global skill can mask this project.
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
   returned base directory and body with the expected source and distinguishing
   passage recorded in step 1 for this refresh.
5. Evaluate the returned evidence using the management model linked above.

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

Run this matrix when changing the host integration or the loading evidence
model. An ordinary skill-content refresh uses the applicable host procedure
above and does not require this matrix.

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
npx cache — a bare `npx skills …` aborts with
`npm error could not determine executable to run`, which reads like a broken
command rather than a resolution failure. The commands above name
`skills@1.7.6`, the version recorded for this repository's lockfile, so run them
as written.

If `npx --yes skills@1.7.6 …` itself fails to resolve, report the failure and
what was tried. Do not substitute `skills@latest`: its refresh can rewrite the
lockfile, as [Installing and Refreshing](#installing-and-refreshing) records, so
moving to it is a deliberate, separately scoped change rather than a fallback.
