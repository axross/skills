# Directory Structure

Where a skill's files live, the two tiers a skill can be written in, where a
validator or an agent definition belongs, and how the evaluation subsystem
under `tools/evaluation/` is laid out.

## The Tree

```text
<root>
├── skills/<name>/SKILL.md       # source: every distributable skill's editable copy
│   ├── references/              # detail the body defers to
│   └── scripts/                 # the skill's own validators, if it has any
├── .agents/skills/<name>/       # installed: generated from skills/, Codex reads this
├── .claude/skills/<name>        # installed: a symlink into .agents/skills/<name>/
├── .claude/agents/              # agent definitions — never a skill
├── docs/                        # this tree
├── tools/evaluation/            # the skill discovery and effect evaluations
│   ├── lib/                     # shared by both: credentials, mock-workspace, transcript/
│   ├── src/                     # what both readings share, by concern: layout, fingerprint, admission, comparability, spawn
│   ├── readings/                # each reading's own modules: discovery/, effect/
│   ├── mocks/                   # the mock fixtures both evaluations situate probes in
│   └── data/                    # discovery/ and effect/ measurement data, one per instrument
└── tests/                       # the suite that gates all of the above
```

## The Two Skill Tiers

Every skill in this repository is currently **distributable**: its source is
`skills/<name>/SKILL.md`, with any `references/` and `scripts/` beside it, and
it installs into `.agents/skills/` and `.claude/skills/` the way it would
install into any other project. A **repository-local** skill instead encodes
conventions specific to this repository, is committed directly under a skill
root, and is hand-edited in place — never touched by the install CLI or
listed in `skills-lock.json`.

No skill is in the repository-local tier today. `github-operation` was the
last one and is now distributable, so the tier is available rather than in
use. Registering one means passing its name to the installed-copy check as
`--local <name>` from
[`tests/repository/gates.mjs`](../../tests/repository/gates.mjs), which
otherwise treats an installed skill with no source as drift.

[agent-skill-management](../../skills/agent-skill-management/SKILL.md) covers
which tier a new skill belongs to; the actual install and refresh procedure is
in [Agent Skills](../operations/agent-skills.md).

## Both Installed Roots, and the Symlink Between Them

`.agents/skills/` holds the real, generated files — Codex reads from here.
`.claude/skills/<name>` is a symlink into `.agents/skills/<name>/`, made once
when a skill is added and simply kept afterward rather than regenerated on
every install; this is the form Claude Code's own documentation gives for a
skill entry. Both roots, and `skills-lock.json` alongside them, are tracked
artifacts committed to the repository — not build output to `.gitignore`. A
hand-edit to either installed root is silently discarded the next time the
source is reinstalled.

The installed-copy check compares the source against the symlink root, so one
run catches both a forgotten reinstall and a symlink that stopped resolving.
Every skill is in scope for it; the repository-local tier the check exempts
is currently empty. `.claude/skills/` being a symlink root rather than a
directory of real files is also a trap for anything that walks it — see
[Verification Gates](./verification-gates.md).

## Where a Validator Lives

A validator here ships with the skill that owns it, rather than sitting beside
the repository it happens to be written in — it is an agent utility, the thing
run after doing the work its skill governs, and it doubles as a standalone CLI
with `--help` so a single check can run without the suite. Run it from the
source tier under `skills/`, which is what the suite itself invokes; the
installed roots go stale mid-edit.

A validator earns its place when the defect it finds is **not visible in the
text its author just wrote** — because it spans files, because it counts, or
because it compares bytes. Four scripts that failed that test were removed
rather than rehomed: two mirrored a vendor's option surface in regular
expressions, which is the same staleness
[#179](https://github.com/axross/skills/issues/179) is moving the vendor
skills away from and less visible, since a pattern never renders; and two
re-checked rules an agent holding the skill can already see in the file in
front of it. What each of those skills teaches is unchanged — only the claim
that this repository ships a runnable checker for it is gone.

## `.claude/agents/` Is the Only Home for an Agent Definition

An agent definition — `.claude/agents/implementer.md`,
`.claude/agents/reviewer.md` — is not a skill, so `npx skills` does not carry
it and it is never installed, symlinked, or listed in `skills-lock.json`. Only
Claude Code is configured today;
[#218](https://github.com/axross/skills/issues/218) tracks the Codex side for
both.
