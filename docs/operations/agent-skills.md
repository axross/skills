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

The suite checks that the installed files are well-formed and in the right
place; it cannot check that a host actually read them, because each host loads
its skills at session start, which is not observable from inside the session
that changed the tree. Verify each once, in a fresh session:

- **Codex** — run `/skills` and confirm the library is listed. Codex warns
  when the listing exceeds its context budget and truncates descriptions to
  fit, so read the warning rather than only the names.
- **Claude Code** — run `/context` and confirm the skills appear, which is
  what proves the `.claude/skills/<name>` symlinks resolved.

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
